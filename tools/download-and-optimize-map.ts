import fs from 'fs';
import path from 'path';
import {exec} from 'child_process';
import {DownloadResult, DownloadStatus, handleImageBuffer, handleReplacing, humanFileSize, printSummary} from "./common";
import {pickLandingTile, startMapDownloadServer} from './map-download-server';

const ZONES_JSON_PATH = path.join('web/ao-bin-dumps/zones.json');
const OUTPUT_DIR = path.join('web/images/Maps');
const CDN_BASE_URL = 'https://cdn.albiononline2d.com/game-images/'
const EXTENSION_DIR = path.resolve('tools/map-download-extension');
const MAX_CONSECUTIVE_CHALLENGES = 3;
const IDLE_HINT_MS = 60_000;

interface ZoneInfo {
    name: string;
    type: string;
    pvpType: string;
    tier: number;
    file: string;
}

// Zone types to exclude - these don't need radar functionality
// (instanced content, personal islands, arenas, expeditions, etc.)
const EXCLUDED_ZONE_TYPES = new Set([
    // Personal/Guild islands - safe, no radar needed
    'PLAYERISLAND',
    'GUILDISLAND',
    'SHOWROOMISLAND',
    // Tutorial/Starting areas - one-time use
    'STARTAREA',
    'TUTORIAL',
    // Arenas - instanced PvP with different mechanics
    'ARENA_CUSTOM',
    'ARENA_STANDARD',
    'ARENA_CRYSTAL',
    'ARENA_CRYSTAL_NONLETHAL',
    'ARENA_CRYSTAL_20VS20',
    // Hellgates - small instanced group PvP
    'DUNGEON_HELL_2V2_LETHAL',
    'DUNGEON_HELL_2V2_NON_LETHAL',
    'DUNGEON_HELL_5V5_LETHAL',
    'DUNGEON_HELL_5V5_NON_LETHAL',
    'DUNGEON_HELL_10V10_LETHAL',
    'DUNGEON_HELL_10V10_NON_LETHAL',
    // Corrupted dungeons - 1v1 instanced
    'CORRUPTED_DUNGEON_INTERMEDIATE',
    // Expeditions - instanced PvE
    'T3_EXPEDITION_STANDARD',
    'T4_EXPEDITION_STANDARD',
    'T4_EXPEDITION_SURFACE',
    'T5_EXPEDITION_STANDARD',
    'T5_EXPEDITION_SURFACE',
    'T6_EXPEDITION_STANDARD',
    'T6_EXPEDITION_SURFACE',
    'HARDCORE_EXPEDITION_STANDARD',
    'HARDCORE_EXPEDITION_SURFACE',
    // Hall of Fame interiors - decorative only
    'PLAYERCITY_BLACK_ROYAL_NOFURNITURE_HALL_OF_FAME',
]);

function getMapFilesFromZones(): string[] {
    if (!fs.existsSync(ZONES_JSON_PATH)) {
        console.error(`❌ zones.json not found at ${ZONES_JSON_PATH}`);
        console.log('💡 Run "npm run update-data" first to generate zones.json');
        process.exit(1);
    }

    const zonesData: Record<string, ZoneInfo> = JSON.parse(fs.readFileSync(ZONES_JSON_PATH, 'utf-8'));
    const mapFiles = new Set<string>();
    let excludedCount = 0;

    for (const zone of Object.values(zonesData)) {
        if (zone.file) {
            if (EXCLUDED_ZONE_TYPES.has(zone.type)) {
                excludedCount++;
                continue;
            }
            mapFiles.add(zone.file + '.png');
        }
    }

    console.log(`🚫 Excluded ${excludedCount} zones (islands, arenas, expeditions, etc.)`);
    return Array.from(mapFiles);
}

// Image optimization settings
const MAX_IMAGE_SIZE = 800; // Max width or height in pixels
const IMAGE_QUALITY = 85; // WEBP quality (1-100)

let optimize = true;
let replaceExisting = false
let onlyUpgrade = false;

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: tsx download-and-optimize-map.ts [--replace-existing] [--no-optimize]');
        console.log('--replace-existing : Replace existing files in the output directory.');
        console.log('--no-optimize     : Skip image optimization step.');
        console.log('--only-upgrade    : Only replace files that are higher quality than existing ones.');
        process.exit(0);
    }
    if (args.includes('--replace-existing')) {
        replaceExisting = true;
    }
    if (args.includes('--no-optimize')) {
        optimize = false;
    }
    if (args.includes('--only-upgrade')) {
        onlyUpgrade = true;
    }
}

async function initPrerequisites() {
    console.log('Albion Online Map tiles Downloader and Optimizer Started');
    console.log('==================================================\n');

    parseArgs();

    if (optimize) {
        console.log('⚙️  Image optimization is ENABLED');
    }
    if (replaceExisting) {
        console.log('⚙️  Replacing existing files is ENABLED');
    }
    if (onlyUpgrade) {
        console.log('⚙️  Only upgrading lower quality files is ENABLED');
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Get map files from zones.json
    const mapFiles = getMapFilesFromZones();
    console.log(`📍 Found ${mapFiles.length} unique map files from zones.json\n`);

    if (mapFiles.length === 0) {
        console.log('⚠️ No map files found to process. Exiting.');
        process.exit(0);
    }

    return {mapFiles};
}

function outputPathFor(mapName: string): string {
    return path.join(OUTPUT_DIR, mapName.split('_')[0] + '.webp');
}

function openInChrome(url: string) {
    const command = process.platform === 'win32' ? `start "" chrome "${url}"`
        : process.platform === 'darwin' ? `open -a "Google Chrome" "${url}"`
            : `xdg-open "${url}"`;
    exec(command, err => {
        if (err) console.error(`❌ Could not open Chrome (${err.message}). Open this URL in Chrome: ${url}`);
    });
}

function printExtensionHint() {
    console.log('⏳ No answer from the OpenRadar Chrome extension yet.');
    console.log('   One-time setup: open chrome://extensions, enable Developer mode, click "Load unpacked"');
    console.log(`   and pick ${EXTENSION_DIR}. Then reload the Chrome tab.`);
    console.log('   If Chrome asks to access devices on your local network, allow it.');
}

function printStalledHint(url: string) {
    console.log('⏳ No news from the Chrome tab for 60 s. If it is closed or stuck, open this URL again:');
    console.log(`   ${url}`);
}

async function main() {
    const {mapFiles} = await initPrerequisites();
    const now = Date.now();
    const stats = {completed: 0, downloaded: 0, replaced: 0, skipped: 0, optimized: 0, failed: 0, optimizeFail: 0};
    const summary = () => printSummary({startTime: now, ...stats, outputDir: OUTPUT_DIR});

    const pending = mapFiles.filter(mapName => handleReplacing(outputPathFor(mapName), replaceExisting).status !== DownloadStatus.EXISTS);
    stats.skipped = stats.completed = mapFiles.length - pending.length;
    console.log(`⏭️  ${stats.skipped} map tiles already exist, ${pending.length} to download\n`);

    if (pending.length === 0) {
        summary();
        process.exit(0);
    }

    let received = 0;
    let challenges = 0;
    let contacted = false;
    let url = '';
    const server = await startMapDownloadServer({
        origin: new URL(CDN_BASE_URL).origin,
        names: pending,
        onList: () => {
            contacted = true;
        },
        onIdle: () => contacted ? printStalledHint(url) : printExtensionHint(),
        idleMs: IDLE_HINT_MS,
        onMap: async ({name, status, body}) => {
            if (status === 403) {
                if (++challenges >= MAX_CONSECUTIVE_CHALLENGES) {
                    console.error(`❌ Cloudflare refused ${challenges} downloads in a row. Stopping.`);
                    summary();
                    process.exit(1);
                }
                console.log('🛡️  Cloudflare challenge: the Chrome tab reloads. Tick the box if Chrome shows one.');
                return;
            }
            challenges = 0;
            console.log();
            const res: DownloadResult = status === 200
                ? {status: DownloadStatus.SUCCESS, size: humanFileSize(body.length), buffer: body}
                : {status: DownloadStatus.FAIL, message: `HTTP ${status}`};
            const result = await handleImageBuffer(res, outputPathFor(name), received++, pending.length,
                replaceExisting, onlyUpgrade, optimize, MAX_IMAGE_SIZE, IMAGE_QUALITY);
            if (result.downloaded) stats.downloaded++;
            if (result.failed) stats.failed++;
            if (result.optimizeFail) stats.optimizeFail++;
            if (result.didReplace) stats.replaced++;
            if (result.didSkip) stats.skipped++;
            if (result.didOptimize) stats.optimized++;
            stats.completed++;
        },
    });

    url = `${CDN_BASE_URL}${pickLandingTile(mapFiles, pending)}#openradar=${server.port}`;
    console.log(`🌐 Opening Chrome: ${url}`);
    console.log('   The OpenRadar extension downloads each tile in that tab. Keep it open.\n');
    openInChrome(url);

    await server.done;
    const missing = server.pending();
    if (missing.length > 0) {
        console.error(`❌ ${missing.length} map tiles were not received: ${missing.join(', ')}`);
        stats.failed += missing.length;
        stats.completed += missing.length;
    }
    await server.close();

    summary();
    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});

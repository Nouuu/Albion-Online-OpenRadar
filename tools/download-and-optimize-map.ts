import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import {connect, PageWithCursor} from 'puppeteer-real-browser';
import stealth from 'puppeteer-extra-plugin-stealth';
import {downloadFileWithPlaywright, handleImageBuffer, handleReplacing, printSummary} from "./common";

const ZONES_JSON_PATH = path.join('web/ao-bin-dumps/zones.json');
const OUTPUT_DIR = path.join('web/images/Maps');
const CDN_BASE_URL = 'https://cdn.albiononline2d.com/game-images/'

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

    // Use stealth plugin to avoid detection
    puppeteer.use(stealth());

    // Get map files from zones.json
    const mapFiles = getMapFilesFromZones();
    console.log(`📍 Found ${mapFiles.length} unique map files from zones.json\n`);

    if (mapFiles.length === 0) {
        console.log('⚠️ No map files found to process. Exiting.');
        process.exit(0);
    }

    // Create 2 browser instances for parallel downloads
    console.log('🌐 Launching browser 1...');
    const browser1 = await connect({
        // @ts-ignore
        headless: 'auto',
        fingerprint: true,
        turnstile: true,
        tf: true,
    });

    console.log('🌐 Launching browser 2...');
    const browser2 = await connect({
        // @ts-ignore
        headless: 'auto',
        fingerprint: true,
        turnstile: true,
        tf: true,
    });

    return {mapFiles, pages: [browser1.page, browser2.page], browsers: [browser1.browser, browser2.browser]};
}

async function processMapTile(
    mapName: string,
    index: number,
    total: number,
    page: PageWithCursor
): Promise<{
    downloaded: boolean,
    failed: boolean,
    optimizeFail: boolean,
    didReplace: boolean,
    didSkip: boolean
    didOptimize: boolean
}> {
    const filename = mapName.split('_')[0] + '.webp';
    const outputPath = path.join(OUTPUT_DIR, filename);
    console.log();

    let res = handleReplacing(outputPath, replaceExisting);
    if (res.status === 'exists') {
        console.log(`⏭️️ [${index + 1}/${total}] ${res.message}`);
        return {
            downloaded: false,
            failed: false,
            optimizeFail: false,
            didReplace: false,
            didSkip: true,
            didOptimize: false
        };
    }

    const url = `${CDN_BASE_URL}${mapName}`;
    res = await downloadFileWithPlaywright(url, page);

    return handleImageBuffer(
        res,
        outputPath,
        index,
        total,
        replaceExisting,
        onlyUpgrade,
        optimize,
        MAX_IMAGE_SIZE,
        IMAGE_QUALITY
    );
}

const CONCURRENCY = 2; // Number of parallel downloads

async function main() {
    const {mapFiles, pages, browsers} = await initPrerequisites();

    let downloaded = 0;
    let completed = 0;
    let optimizeFail = 0;
    let failed = 0;
    let optimized = 0;
    let replaced = 0;
    let skipped = 0;
    const now = Date.now();

    // Initialize both pages
    console.log('🔄 Initializing browsers...');
    await Promise.all(pages.map(async (page) => {
        await page.goto(CDN_BASE_URL, {waitUntil: 'networkidle2', timeout: 30000});
    }));
    await new Promise(res => setTimeout(res, 3000)); // Initial delay

    // Process in batches of CONCURRENCY (2 browsers)
    for (let i = 0; i < mapFiles.length; i += CONCURRENCY) {
        const batch = mapFiles.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map((mapName, batchIndex) =>
                processMapTile(
                    mapName,
                    i + batchIndex,
                    mapFiles.length,
                    pages[batchIndex % CONCURRENCY]
                )
            )
        );

        for (const result of results) {
            if (result.downloaded) downloaded++;
            if (result.failed) failed++;
            if (result.optimizeFail) optimizeFail++;
            if (result.didReplace) replaced++;
            if (result.didSkip) skipped++;
            if (result.didOptimize) optimized++;
            completed++;
        }
    }

    // Close all browsers
    await Promise.all(browsers.map(b => b.close()));

    printSummary({
        startTime: now,
        completed,
        downloaded,
        replaced,
        skipped,
        optimized,
        failed,
        optimizeFail,
        outputDir: OUTPUT_DIR
    });

    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});

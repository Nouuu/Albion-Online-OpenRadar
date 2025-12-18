import fs from 'fs';
import path from 'path';
import {downloadFile, DownloadStatus, handleFileBuffer, handleReplacing, printSummary} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const OUTPUT_DIR = 'web/public/ao-bin-dumps';

const FILES_TO_DOWNLOAD = [
    'harvestables.json',
    'items.json',
    'items.xml',
    'localization.json',
    'mobs.json',
    'spells.json',
];

// Zone types and their PvP classification
type PvpType = 'safe' | 'yellow' | 'red' | 'black';

interface ZoneInfo {
    name: string;
    type: string;
    pvpType: PvpType;
    tier: number;
    file: string;
}

function getPvpType(type: string): PvpType {
    if (!type) return 'safe';
    const t = type.toUpperCase();

    // Safe zones (check first - exceptions)
    if (t.startsWith('PLAYERCITY_')) return 'safe';
    if (t.includes('ISLAND')) return 'safe';
    if (['HIDEOUT', 'TUNNEL_HIDEOUT', 'TUNNEL_HIDEOUT_DEEP'].includes(t)) return 'safe';
    if (['SAFEAREA', 'STARTAREA', 'STARTINGCITY', 'TUTORIAL',
        'PASSAGE_SAFEAREA', 'DUNGEON_SAFEAREA'].includes(t)) return 'safe';
    if (t.includes('EXPEDITION')) return 'safe';
    if (t.startsWith('ARENA_')) return 'safe';
    if (t === 'TUNNEL_ROYAL') return 'safe';

    // Red zones (check before black - TUNNEL_ROYAL_RED)
    if (t.includes('RED')) return 'red';

    // Yellow zones
    if (t.includes('YELLOW')) return 'yellow';
    if (t.includes('HELL') && t.includes('NON_LETHAL')) return 'yellow';

    // Black zones
    if (t.includes('BLACK')) return 'black';
    if (t.startsWith('TUNNEL_')) return 'black';  // Roads of Avalon
    if (t.includes('CORRUPTED_DUNGEON')) return 'black';
    if (t.includes('HELL') && t.includes('LETHAL')) return 'black';

    return 'safe';
}

function extractTier(file: string): number {
    // Extract tier from filename like "2305_WRL_ST_AUTO_T5_KPR_OUT_Q1.cluster.xml" -> 5
    if (!file) return 0;
    const tierMatch = file.match(/_T(\d+)_/);
    if (tierMatch) {
        return parseInt(tierMatch[1], 10);
    }
    return 0;
}

async function downloadAndProcessWorldJson(): Promise<{ success: boolean, zonesCount: number }> {
    const worldJsonUrl = `${GITHUB_RAW_BASE}/cluster/world.json`;
    const outputPath = path.join(OUTPUT_DIR, 'zones.json');

    console.log('\n📍 Processing world.json for zone data...');

    const res = await downloadFile(worldJsonUrl);
    if (res.status !== DownloadStatus.SUCCESS || !res.buffer) {
        console.error(`❌ Failed to download world.json: ${res.message}`);
        return {success: false, zonesCount: 0};
    }

    console.log(`✅ Downloaded world.json (${res.size})`);

    try {
        const worldData = JSON.parse(res.buffer.toString('utf-8'));
        const clusters = worldData?.world?.clusters?.cluster || [];

        if (!Array.isArray(clusters)) {
            console.error('❌ Invalid world.json structure: clusters.cluster is not an array');
            return {success: false, zonesCount: 0};
        }

        const zones: Record<string, ZoneInfo> = {};

        for (const cluster of clusters) {
            const id = cluster['@id'];
            if (!id) continue;

            // Skip debug zones
            if (id.toLowerCase().includes('debug')) continue;

            const displayName = cluster['@displayname'] || id;
            const type = cluster['@type'] || '';
            const file = cluster['@file'] || '';

            // Keep full filename without extension for map images
            const filename = file.replace('.cluster.xml', '');

            zones[id] = {
                name: displayName,
                type: type,
                pvpType: getPvpType(type),
                tier: extractTier(file),
                file: filename
            };
        }

        const zonesJson = JSON.stringify(zones);
        fs.writeFileSync(outputPath, zonesJson);

        console.log(`💾 Generated zones.json with ${Object.keys(zones).length} zones`);

        // Log PvP type distribution
        const pvpCounts = {safe: 0, yellow: 0, red: 0, black: 0};
        for (const zone of Object.values(zones)) {
            pvpCounts[zone.pvpType]++;
        }
        console.log(`   🛡️ Safe: ${pvpCounts.safe} | 🔶 Yellow: ${pvpCounts.yellow} | ⚔️ Red: ${pvpCounts.red} | 💀 Black: ${pvpCounts.black}`);

        return {success: true, zonesCount: Object.keys(zones).length};

    } catch (error) {
        console.error(`❌ Failed to parse world.json: ${error}`);
        return {success: false, zonesCount: 0};
    }
}

let replaceExisting = false;

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: tsx update-ao-data.ts [--replace-existing]');
        console.log('--replace-existing : Replace existing files in the output directory.');
        process.exit(0);
    }
    if (args.includes('--replace-existing')) {
        replaceExisting = true;
    }
}

function initPrerequisites() {
    console.log('Albion Online Data Updater Started');
    console.log('==================================\n');

    parseArgs();

    if (replaceExisting) {
        console.log('🔧  Replace existing files: ENABLED\n');
    }

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }
}

async function main() {
    initPrerequisites();
    let downloadedCount = 0;
    let replacedCount = 0;
    let skippedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    const now = new Date();

    for (let i = 0; i < FILES_TO_DOWNLOAD.length; i++) {
        const filename = FILES_TO_DOWNLOAD[i];
        const outputPath = path.join(OUTPUT_DIR, filename);
        console.log();

        let res = handleReplacing(outputPath, replaceExisting);
        if (res.status === DownloadStatus.EXISTS) {
            completedCount++;
            skippedCount++;
            console.log(`⏭️️ [${i + 1}/${FILES_TO_DOWNLOAD.length}] ${res.message}`);
            continue;
        }

        const url = `${GITHUB_RAW_BASE}/${filename}`;
        res = await downloadFile(url);
        if (res.status == DownloadStatus.SUCCESS) {
            downloadedCount++;
            console.log(`✅ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Downloaded ${filename} (${res.size})`);
        } else {
            completedCount++;
            failedCount++;
            console.error(`❌ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Failed to download ${filename}: ${res.status} ${res.message}`);
            continue;
        }

        res = handleFileBuffer(res.buffer!, outputPath);
        console.log(`💾 [${i + 1}/${FILES_TO_DOWNLOAD.length}] ${res.message}`);
        replacedCount += replaceExisting ? 1 : 0;
        completedCount++;
    }

    // Process world.json to generate zones.json
    const zonesResult = await downloadAndProcessWorldJson();
    if (zonesResult.success) {
        completedCount++;
        downloadedCount++;
    } else {
        failedCount++;
    }

    printSummary({
        startTime: now.getTime(),
        completed: completedCount,
        downloaded: downloadedCount,
        replaced: replacedCount,
        skipped: skippedCount,
        failed: failedCount,
        outputDir: OUTPUT_DIR
    });

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
import './common'
import fs from 'fs';
import path from 'path';
import {downloadFile, DownloadStatus, handleFileBuffer, handleReplacing} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'ao-bin-dumps');

const FILES_TO_DOWNLOAD = [
    'formatted/items.txt',
    'formatted/world.json',
    'formatted/world.txt',
    'harvestables.json',
    'harvestables.xml',
    'items.json',
    'items.xml',
    'localization.json',
    'mobs.json',
    'mobs.xml',
    'randomdungeons.json',
    'randomdungeons.xml',
    'randomspawnbehaviors.json',
    'randomspawnbehaviors.xml',
    'rareresourcedistribution.json',
    'rareresourcedistribution.xml',
    'resourcedistpresets.json',
    'resourcedistpresets.xml',
    'resources.json',
    'resources.xml',
    'spells.json',
    'spells.xml',
    'treasures.json',
    'treasures.xml'
];

let replaceExisting = false;

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node update-ao-data.js [--replace-existing]');
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

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }
}

async function main() {
    initPrerequisites();
    let downloadedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    const now = new Date();

    for (let i = 0; i < FILES_TO_DOWNLOAD.length; i++) {
        const filename = FILES_TO_DOWNLOAD[i];
        const outputPath = path.join(OUTPUT_DIR, filename);

        let res = handleReplacing(outputPath, replaceExisting);
        if (res.status === DownloadStatus.EXISTS) {
            completedCount++;
            console.log(`⏭️️ [${i + 1}/${FILES_TO_DOWNLOAD.length}] ${res.message}`);
            continue;
        }

        const url = `${GITHUB_RAW_BASE}/${filename}`;
        res = await downloadFile(url, outputPath);
        if (res.status == DownloadStatus.SUCCESS) {
            downloadedCount++;
            console.log(`✅ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Downloaded ${filename} (${res.size})\n`);
        } else if (res.status === DownloadStatus.EXISTS) {
            completedCount++;
            console.log(`⏭️️ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Skipped existing file: ${filename}\n`);
            continue;
        } else {
            failedCount++;
            console.error(`❌ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Failed to download ${filename}: ${res.message}\n`);
            continue;
        }

        res = handleFileBuffer(res.buffer!, outputPath);


        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50)); // Throttle requests
    }

    console.log('📊 Summary:');
    console.log(`   🕒 Time taken: ${((new Date().getTime() - now.getTime()) / 1000).toFixed(2)} seconds`);
    console.log(`   ✅ Completed: ${completedCount}`);
    console.log(`   📥 Downloaded: ${downloadedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   🗺️ Location: ${OUTPUT_DIR}`);

    process.exit(0);
}

// Run
main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
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
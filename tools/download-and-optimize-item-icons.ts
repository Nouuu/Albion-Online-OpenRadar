import fs from 'fs';
import path from 'path';
import {downloadFile, DownloadStatus, handleImageBuffer, handleReplacing, printSummary} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const ICONS_DIR = path.join('web/images', 'Items');
const CDN_BASE = 'https://render.albiononline.com/v1/item/';

const MAX_IMAGE_SIZE = 128;
const IMAGE_QUALITY = 85;

let optimize = true;
let replaceExisting = false;
let onlyUpgrade = false;


function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: tsx download-and-optimize-item-icons.ts [options]');
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
    console.log('Albion Online Item Icons Downloader and Optimizer Started');
    console.log('=======================================================\n');

    parseArgs();

    if (optimize) console.log('⚙️  Image optimization is ENABLED\n');
    if (replaceExisting) console.log('🔧  Replace existing files: ENABLED\n');
    if (onlyUpgrade) console.log('⬆️  Only upgrade existing files: ENABLED\n');

    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, {recursive: true});
        console.log(`✅ Created directory: ${ICONS_DIR}\n`);
    }

    console.log(`📥 Downloading items.xml from GitHub...`);
    const res = await downloadFile(`${GITHUB_RAW_BASE}/items.xml`);
    if (res.status !== DownloadStatus.SUCCESS || !res.buffer) {
        console.error('❌ Failed to download items.xml');
        process.exit(1);
    }
    console.log(`✅ Downloaded items.xml\n`);

    const xmlContent = res.buffer.toString('utf-8');
    const uniqueNameRegex = /uniquename="([^"]+)"/g;
    const uniqueNames = new Set<string>();
    let match;
    while ((match = uniqueNameRegex.exec(xmlContent)) !== null) {
        uniqueNames.add(match[1]);
    }
    console.log(`📋 Found ${uniqueNames.size} unique items`);
    return {uniqueItems: Array.from(uniqueNames)};
}

async function processItemIcon(
    item: string,
    index: number,
    total: number
): Promise<{
    downloaded: boolean,
    failed: boolean,
    optimizeFail: boolean,
    didReplace: boolean,
    didSkip: boolean,
    didOptimize: boolean
}> {
    const filename = item + '.webp';
    const outputPath = path.join(ICONS_DIR, filename);
    console.log();

    let res = handleReplacing(outputPath, replaceExisting);
    if (res.status === DownloadStatus.EXISTS) {
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

    const url = `${CDN_BASE}${item}.png`;
    res = await downloadFile(url);

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

async function main() {
    const {uniqueItems} = await initPrerequisites();

    let completed = 0;
    let downloaded = 0;
    let optimizeFail = 0;
    let failed = 0;
    let optimized = 0;
    let replaced = 0;
    let skipped = 0;
    const now = Date.now();

    for (let i = 0; i < uniqueItems.length; i++) {
        const {
            downloaded: didDownload,
            failed: didFail,
            optimizeFail: didOptimizeFail,
            didReplace: didReplace,
            didSkip: didSkip,
            didOptimize: didOptimize
        } = await processItemIcon(uniqueItems[i], i, uniqueItems.length);

        if (didDownload) downloaded++;
        if (didFail) failed++;
        if (didOptimizeFail) optimizeFail++;
        if (didReplace) replaced++;
        if (didSkip) skipped++;
        if (didOptimize) optimized++;
        completed++;
    }

    printSummary({
        startTime: now,
        completed: completed,
        downloaded: downloaded,
        optimized: optimized,
        replaced: replaced,
        skipped: skipped,
        failed: failed,
        optimizeFail: optimizeFail,
        outputDir: ICONS_DIR
    });

    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});
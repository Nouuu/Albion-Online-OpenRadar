import fs from 'fs';
import path from 'path';
import {
    downloadFile,
    DownloadStatus,
    handleFileBuffer,
    handleReplacing,
    printSummary,
    processBufferWithSharp
} from "./common";

const ICONS_DIR = path.join(__dirname, '..', 'images', 'Items');
const ITEMS_XML = path.join(__dirname, '..', 'public', 'ao-bin-dumps', 'items.xml');
const CDN_BASE = 'https://render.albiononline.com/v1/item/';

const MAX_IMAGE_SIZE = 128;
const IMAGE_QUALITY = 85;

let optimize = true;
let replaceExisting = false;
let onlyUpgrade = false;


function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node download-and-optimize-item-icons.js [options]');
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

function initPrerequisites() {
    console.log('Albion Online Item Icons Downloader and Optimizer Started');
    console.log('=======================================================\n');

    parseArgs();

    if (optimize) {
        console.log('⚙️  Image optimization is ENABLED\n');
    }
    if (replaceExisting) {
        console.log('🔧  Replace existing files: ENABLED\n');
    }
    if (onlyUpgrade) {
        console.log('⬆️  Only upgrade existing files: ENABLED\n');
    }

    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, {recursive: true});
        console.log(`✅ Created directory: ${ICONS_DIR}\n`);
    }

    console.log(`📄 Parsing ${ITEMS_XML} to find unique item icons...`);

    const xmlContent = fs.readFileSync(ITEMS_XML, 'utf-8');
    const uniqueNameRegex = /uniquename="([^"]+)"/g;
    const uniqueNames = new Set<string>();
    let match;
    while ((match = uniqueNameRegex.exec(xmlContent)) !== null) {
        uniqueNames.add(match[1]);
    }
    console.log(`📋 Found ${uniqueNames.size} unique items in items.xml`);
    const uniqueItems: string[] = Array.from(uniqueNames);
    return {uniqueItems};
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
    const filename = item + '.png';
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

    const url = `${CDN_BASE}${filename}.png`;
    res = await downloadFile(url, outputPath);
    if (res.status === DownloadStatus.SUCCESS) {
        console.log(`✅ [${index + 1}/${total}] Downloaded ${filename} (${res.size})`);
    } else {
        console.error(`❌ [${index + 1}/${total}] Failed to download ${filename}: ${res.status} - ${res.message}`);
        return {
            downloaded: false,
            failed: true,
            optimizeFail: false,
            didReplace: false,
            didSkip: false,
            didOptimize: false
        };
    }

    res = await processBufferWithSharp(res.buffer!, outputPath, onlyUpgrade, optimize, MAX_IMAGE_SIZE, IMAGE_QUALITY);
    if (res.status === DownloadStatus.EXISTS) {
        console.log(`⏭️️ [${index + 1}/${total}] ${res.message}`);
        return {
            downloaded: true,
            failed: false,
            optimizeFail: false,
            didReplace: false,
            didSkip: true,
            didOptimize: false
        };
    }
    if (res.status === DownloadStatus.ERROR) {
        console.error(`❌ [${index + 1}/${total}] Optimization failed: ${res.message}`);
        return {
            downloaded: true,
            failed: false,
            optimizeFail: true,
            didReplace: false,
            didSkip: false,
            didOptimize: false
        };
    }
    if (res.status === DownloadStatus.OPTIMIZED || res.status === DownloadStatus.SUCCESS) {
        console.log(`🖼️️ [${index + 1}/${total}] ${res.message} (${res.size})`);
    }

    res = handleFileBuffer(res.buffer!, outputPath);
    console.log(`💾 [${index + 1}/${total}] ${res.message}`);

    return {
        downloaded: true,
        failed: false,
        optimizeFail: false,
        didReplace: replaceExisting,
        didSkip: false,
        didOptimize: res.status === DownloadStatus.OPTIMIZED
    };
}

async function main() {
    const {uniqueItems} = initPrerequisites();

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
    })

    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});
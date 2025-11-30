const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

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
    const uniqueNames = new Set();
    let match;
    while ((match = uniqueNameRegex.exec(xmlContent)) !== null) {
        uniqueNames.add(match[1]);
    }
    console.log(`📋 Found ${uniqueNames.size} unique items in items.xml`);
    const uniqueItems = Array.from(uniqueNames);
    return {uniqueItems};
}

async function downloadAndOptimizeItemIcon(url, outputPath) {
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    }

    if (!replaceExisting && !onlyUpgrade && fs.existsSync(outputPath)) {
        console.log(`⏭️  Skipping existing file: ${path.basename(outputPath)}`);
        return {status: 'exists', name: outputPath};
    }

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                return downloadAndOptimizeItemIcon(response.headers.location, outputPath)
                    .then(res => resolve(res))
                    .catch(err => resolve(err));
            }

            if (response.statusCode !== 200) {
                resolve({status: 'fail', message: `HTTP ${response.statusCode} - ${response.statusMessage}`});
                return;
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`📥 Downloaded: ${path.basename(outputPath)}, size: ${humanFileSize(buffer.length)}`);
                processBufferWithSharp(buffer, outputPath)
                    .then(res => resolve(res))
                    .catch(err => resolve(err));
            });
        }).on('error', (err) => {
            resolve({status: 'error', name: outputPath, message: err.message});
        });
    });
}

async function processBufferWithSharp(buffer, outputPath) {
    const imgName = path.basename(outputPath);
    if (!replaceExisting && onlyUpgrade && fs.existsSync(outputPath)) {
        try {
            const existingMetadata = await sharp(fs.readFileSync(outputPath)).metadata();
            const newMetadata = await sharp(buffer).metadata();
            if (newMetadata.width <= existingMetadata.width &&
                newMetadata.height <= existingMetadata.height) {
                console.log(`⏭️ Existing file is equal or better quality, skipping: ${imgName}`);
                return {status: 'exists', name: outputPath};
            }
        } catch (err) {
            console.log(`⚠️ Could not read existing file metadata, proceeding with download: ${imgName}`);
        }
    }

    if (optimize) {
        try {
            buffer = await sharp(buffer)
                .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .png({
                    quality: IMAGE_QUALITY,
                    compressionLevel: 9
                })
                .toBuffer();
        } catch (error) {
            return {status: 'optimize-fail', name: imgName, message: error.message};
        }
    }
    fs.writeFileSync(outputPath, buffer);
    console.log(`💾 Saved: ${outputPath}, size after optimization: ${humanFileSize(buffer.length)}`);
    return {status: 'success', name: imgName, size: humanFileSize(buffer.length)};
}

function humanFileSize(size) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}


async function main() {
    const {uniqueItems} = initPrerequisites();

    let completed = 0;
    let downloaded = 0;
    let optimizeFail = 0;
    let failed = 0;
    const now = Date.now();

    for (let i = 0; i < uniqueItems.length; i++) {
        const itemName = uniqueItems[i];
        const outputPath = path.join(ICONS_DIR, `${itemName}.png`);

        const url = `${CDN_BASE}${itemName}.png`;
        const res = await downloadAndOptimizeItemIcon(url, outputPath);

        if (res.status === 'success') {
            downloaded++;
            completed++;
            console.log(`✅ [${i + 1}/${uniqueItems.length}] Downloaded & optimized ${itemName} (${res.size})\n`);
        } else if (res.status === 'exists') {
            completed++;
            console.log(`⏭️️ [${i + 1}/${uniqueItems.length}] Skipped existing file: ${itemName}\n`);
        } else if (res.status === 'optimize-fail') {
            optimizeFail++;
            console.error(`❌ [${i + 1}/${uniqueItems.length}] Failed to optimize ${itemName}: ${res.message}\n`);
        } else {
            failed++;
            console.error(`❌ [${i + 1}/${uniqueItems.length}] Failed to download ${itemName}: ${res.message}\n`);
        }

        await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50)); // Throttle requests
    }

    console.log('📊 Summary:');
    console.log(`   🕒 Time taken: ${((Date.now() - now) / 1000).toFixed(2)} seconds`);
    console.log(`   ✅ Completed: ${completed}`);
    console.log(`   📥 Downloaded & optimized: ${downloaded}`);
    console.log(`   ❌ Failed downloads: ${failed}`);
    console.log(`   ⚠️  Optimize failures: ${optimizeFail}`);
    console.log(`   🗺️ Location: ${ICONS_DIR}`);

    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});
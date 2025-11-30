const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const puppeteer = require('puppeteer-extra');
const {connect} = require('puppeteer-real-browser');
const stealth = require('puppeteer-extra-plugin-stealth');

const MAP_XML_FILES_DIR = path.join(__dirname, '..', 'work/data/ao-bin-dumps/cluster');
const OUTPUT_DIR = path.join(__dirname, '..', 'images/Maps');
const CDN_BASE_URL = 'https://cdn.albiononline2d.com/game-images/'

// Image optimization settings
const MAX_IMAGE_SIZE = 1024; // Max width or height in pixels
const IMAGE_QUALITY = 80; // PNG quality (1-100)

let optimize = true;
let replaceExisting = false;

let totalMapTiles = 0;

async function downloadAndOptimizeWithPlaywright(mapName, page) {
    const mapFileName = mapName.split('_')[0] + '.png';
    const outputPath = path.join(OUTPUT_DIR, mapFileName);
    const mapUrl = `${CDN_BASE_URL}${mapName}`;

    // Early return if file already exists
    if (!replaceExisting && fs.existsSync(outputPath)) {
        console.log(`⏭️️ Skipping existing file: ${mapFileName}`);
        return {status: 'exists', name: mapFileName};
    }

    console.log(`🌐 Downloading with Playwright: ${mapUrl}`);

    const response = await page.goto(mapUrl, {waitUntil: 'networkidle2', timeout: 30000});

    await new Promise(res => setTimeout(res, 2000 + Math.random() * 500)); // Random delay between 2-2.5s

    if (response && (response.status() >= 200 && response.status() < 400)) {
        let buffer = await response.buffer();
        console.log(`✅ Downloaded: ${mapName}, size: ${humanFileSize(buffer.length)}`);
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

            } catch (err) {
                return {status: 'optimize-fail', name: mapName, message: err.message};
            }
        }
        fs.writeFileSync(outputPath, buffer);
        console.log(`💾 Saved: ${outputPath}, size after optimization: ${humanFileSize(buffer.length)}`);
        return {status: 'success', name: mapName, size: humanFileSize(buffer.length)};
    } else {
        return {
            status: 'fail',
            name: mapName,
            code: response ? response.status() : 'N/A',
        };
    }
}

function humanFileSize(size) {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

function parseArgs() {
    const args = process.argv.slice(3);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node download-and-optimize-map.js [--replace-existing] [--no-optimize]');
        console.log('--replace-existing : Replace existing files in the output directory.');
        console.log('--no-optimize     : Skip image optimization step.');
        process.exit(0);
    } else if (args.includes('--replace-existing')) {
        replaceExisting = true;
    } else if (args.includes('--no-optimize')) {
        optimize = false;
    }
}

function initPrerequisites() {
    console.log('Unified Map tiles Downloader and Optimizer Started');
    console.log('==================================================\n');

    parseArgs();

    if (optimize) {
        console.log('⚙️  Image optimization is ENABLED');
    }
    if (replaceExisting) {
        console.log('⚙️  Replacing existing files is ENABLED');
    }

    // Check if sharp is installed
    try {
        require.resolve('sharp');
    } catch (e) {
        console.error('❌ ERROR: sharp module not found!');
        console.error('   Please install it with: npm install sharp');
        process.exit(1);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Use stealth plugin to avoid detection
    puppeteer.use(stealth());

    // List all map XML files
    const mapFiles = fs.readdirSync(MAP_XML_FILES_DIR).filter(file => file.endsWith('.xml'))
        .map(value => value.replace(".cluster.xml", ".png"));
    totalMapTiles = mapFiles.length;

    if (totalMapTiles === 0) {
        console.log('⚠️ No map files found to process. Exiting.');
        process.exit(0);
    }

    totalMapTiles = mapFiles.length;

    return {mapFiles};
}

(async function () {
    const {page} = await connect({
        headless: 'auto',
        fingerprint: true,
        turnstile: true,
        tf: true,
    })

    const {mapFiles} = initPrerequisites();

    let downloaded = 0;
    let completed = 0;
    let optimizeFail = 0;
    let failed = 0;
    let now = Date.now();

    await page.goto(CDN_BASE_URL, {waitUntil: 'networkidle2', timeout: 30000});
    await new Promise(res =>setTimeout(res, 3000)); // Initial delay

    for (let i = 0; i < mapFiles.length; i++) {
        const mapName = mapFiles[i];
        const result = await downloadAndOptimizeWithPlaywright(mapName, page);
        if (result.status === 'success') {
            downloaded++;
            completed++;
            console.log(`✅ [${i + 1}/${totalMapTiles}] Downloaded and optimized: ${mapName}`);
        } else if (result.status === 'exists') {
            completed++;
            console.log(`⏭️ [${i + 1}/${totalMapTiles}] File already exists, skipped: ${mapName}`);
        } else if (result.status === 'optimize-fail') {
            optimizeFail++;
            console.log(`⚠️ [${i + 1}/${totalMapTiles}] Optimization failed for: ${mapName} - ${result.message}`);
        } else {
            failed++;
            console.log(`❌ [${i + 1}/${totalMapTiles}] Download failed for: ${mapName} - Status Code: ${result.code || 'N/A'} - ${result.message || ''}`);
        }
    }
    await page.browser().close();

    console.log('\nDownload and Optimization Summary:');
    console.log('===================================');
    console.log(`🕒 Time taken: ${((Date.now() - now) / 1000).toFixed(2)} seconds`);
    console.log(`✅ Total completed: ${completed}`);
    console.log(`✅ Successfully downloaded and optimized: ${downloaded}`);
    console.log(`⚠️ Optimization failures: ${optimizeFail}`);
    console.log(`❌ Failed downloads: ${failed}`);
    console.log('Total map tiles processed: ' + totalMapTiles);
})();

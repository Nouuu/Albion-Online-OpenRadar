/**
 * Download & Optimize ALL missing item icons from Albion Online official CDN
 * Parses items.xml and downloads every missing icon, puis optimise avec sharp
 * Usage: node scripts-shell/download-and-optimize-item-icons.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

const ICONS_DIR = path.join(__dirname, '..', 'images', 'Items');
const ITEMS_XML = path.join(__dirname, '..', 'public', 'ao-bin-dumps', 'items.xml');
const CDN_BASE = 'https://render.albiononline.com/v1/item';

const MAX_IMAGE_SIZE = 128;
const IMAGE_QUALITY = 85;

if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${ICONS_DIR}\n`);
}

console.log('📄 Parsing items.xml...');
const xmlContent = fs.readFileSync(ITEMS_XML, 'utf-8');
const uniqueNameRegex = /uniquename="([^"]+)"/g;
const uniqueNames = new Set();
let match;
while ((match = uniqueNameRegex.exec(xmlContent)) !== null) {
    uniqueNames.add(match[1]);
}
console.log(`📋 Found ${uniqueNames.size} unique items in items.xml`);

const missingItems = Array.from(uniqueNames).filter(name => {
    return !fs.existsSync(path.join(ICONS_DIR, `${name}.png`));
});

console.log(`📥 Missing: ${missingItems.length} icons`);
console.log(`🌐 CDN: ${CDN_BASE}`);
console.log(`📁 Output: ${ICONS_DIR}\n`);

if (missingItems.length === 0) {
    console.log('✅ All icons already downloaded!');
    process.exit(0);
}

async function downloadAndOptimizeIcon(itemName) {
    const outputPath = path.join(ICONS_DIR, `${itemName}.png`);
    const url = `${CDN_BASE}/${itemName}.png`;
    return new Promise((resolve) => {
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', async () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        const optimizedBuffer = await sharp(buffer)
                            .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
                                fit: 'inside',
                                withoutEnlargement: true
                            })
                            .png({
                                quality: IMAGE_QUALITY,
                                compressionLevel: 9
                            })
                            .toBuffer();
                        fs.writeFileSync(outputPath, optimizedBuffer);
                        resolve({ status: 'success', name: itemName });
                    } catch (err) {
                        resolve({ status: 'optimize-fail', name: itemName, message: err.message });
                    }
                });
            } else {
                resolve({ status: 'fail', name: itemName, code: response.statusCode });
            }
        }).on('error', (err) => {
            resolve({ status: 'error', name: itemName, message: err.message });
        });
    });
}

(async function() {
    let downloaded = 0;
    let failed = 0;
    let errors = 0;
    let optimizeFail = 0;
    for (let i = 0; i < missingItems.length; i++) {
        const itemName = missingItems[i];
        const result = await downloadAndOptimizeIcon(itemName);
        if (result.status === 'success') {
            downloaded++;
            console.log(`[${i + 1}/${missingItems.length}] ✓ ${itemName}`);
        } else if (result.status === 'fail') {
            failed++;
            console.log(`[${i + 1}/${missingItems.length}] ✗ ${itemName} (HTTP ${result.code})`);
        } else if (result.status === 'error') {
            errors++;
            console.log(`[${i + 1}/${missingItems.length}] ✗ ${itemName} (${result.message})`);
        } else if (result.status === 'optimize-fail') {
            optimizeFail++;
            console.log(`[${i + 1}/${missingItems.length}] ✗ ${itemName} (OPTIMIZE ${result.message})`);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`\n✅ Downloaded & optimized: ${downloaded}`);
    console.log(`❌ Failed (404): ${failed}`);
    console.log(`⚠️  Download errors: ${errors}`);
    console.log(`⚠️  Optimize errors: ${optimizeFail}`);
    console.log(`📊 Total attempted: ${missingItems.length}`);
})();

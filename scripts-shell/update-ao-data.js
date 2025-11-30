/**
 * update-ao-data.js
 *
 * Simple script to download/update Albion Online data files from ao-data/ao-bin-dumps
 *
 * Usage:
 *   node scripts-shell/update-ao-data.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

/**
 * Download a file from URL to local path
 */
function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading: ${url}`);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                return downloadFile(response.headers.location, outputPath)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }

            const fileStream = fs.createWriteStream(outputPath);
            let downloadedBytes = 0;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
            });

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                const sizeKB = (downloadedBytes / 1024).toFixed(2);
                console.log(`✅ Downloaded: ${path.basename(outputPath)} (${sizeKB} KB)`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(outputPath, () => {
                }); // Delete partial file
                reject(err);
            });
        }).on('error', reject);
    });
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting Albion Online data update...\n');

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        console.log(`📁 Creating directory: ${OUTPUT_DIR}`);
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
    }
    // Download all files

    for (const filename of FILES_TO_DOWNLOAD) {
        const outputDir = path.dirname(path.join(OUTPUT_DIR, filename));
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }
        const url = `${GITHUB_RAW_BASE}/${filename}`;
        const outputPath = path.join(OUTPUT_DIR, filename);
        try {
            await downloadFile(url, outputPath);
        } catch (error) {
            console.error(`❌ Failed to download ${filename}:`, error.message);
            process.exit(1);
        }
    }

    console.log('\n🎉 All files updated successfully!');
    console.log(`📍 Location: ${OUTPUT_DIR}`);
}

// Run
main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
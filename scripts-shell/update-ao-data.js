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

let replaceExisting = false;

/**
 * Download a file from URL to local path
 */
async function downloadFile(url, outputPath) {

    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    }

    if (!replaceExisting && fs.existsSync(outputPath)) {
        console.log(`⏭️️ Skipping existing file: ${path.basename(outputPath)}`);
        return {status: 'exists'};
    }
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading: ${url}`);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                return downloadFile(response.headers.location, outputPath)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }

            if (response.statusCode !== 200) {
                reject({status: 'fail', message: `HTTP ${response.statusCode} - ${response.statusMessage}`});
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
                resolve({status: 'success', sizeKB});
            });

            fileStream.on('error', (err) => {
                fs.unlink(outputPath, () => {
                }); // Delete partial file
                reject({status: 'error', message: err.message});
            });
        }).on('error', (err) => {
            reject({status: 'error', message: err.message});
        });
    });
}

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

/**
 * Main function
 */
async function main() {
    initPrerequisites();
    let downloadedCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < FILES_TO_DOWNLOAD.length; i++) {
        const filename = FILES_TO_DOWNLOAD[i];
        const outputPath = path.join(OUTPUT_DIR, filename);

        const url = `${GITHUB_RAW_BASE}/${filename}`;
        const res = await downloadFile(url, outputPath);
        if (res.status === 'success') {
            downloadedCount++;
            completedCount++;
            console.log(`✅ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Downloaded ${filename} (${res.sizeKB} KB)\n`);
        } else if (res.status === 'exists') {
            completedCount++;
            console.log(`⏭️️ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Skipped existing file: ${filename}\n`);
        } else {
            failedCount++;
            console.error(`❌ [${i + 1}/${FILES_TO_DOWNLOAD.length}] Failed to download ${filename}: ${res.message}\n`);
        }
    }

    // console.log('\n🎉 All files updated successfully!');
    // console.log(`📍 Location: ${OUTPUT_DIR}`);
    console.log('📊 Summary:');
    console.log(`   ✅ Completed: ${completedCount}`);
    console.log(`   📥 Downloaded: ${downloadedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   🗺️ Location: ${OUTPUT_DIR}`);
}

// Run
main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

// Paths
const SPELLS_JSON_PATH = path.join(__dirname, '../public/ao-bin-dumps/spells.json');
const LOCALIZATION_JSON_PATH = path.join(__dirname, '../public/ao-bin-dumps/localization.json');
const OUTPUT_DIR = path.join(__dirname, '../images/Spells');
const CDN_BASE_URL = 'https://render.albiononline.com/v1/spell/';

// Image optimization settings
const MAX_IMAGE_SIZE = 128; // Max width/height in pixels
const IMAGE_QUALITY = 85;   // PNG quality (1-100)

let optimize = true;
let replaceExisting = false;
let onlyUpgrade = false;

let totalSpells = 0;

function downloadAndOptimizeSpellIcon(url, outputPath) {
    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    }

    if (!replaceExisting && fs.existsSync(outputPath)) {
        console.log(`⏭️️ Skipping existing file: ${path.basename(outputPath)}`);
        return {status: 'exists', name: outputPath};
    }
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading: ${url}`);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                return downloadAndOptimizeSpellIcon(response.headers.location, outputPath)
                    .then(res => resolve(res))
                    .catch(err => reject(err));
            }

            if (response.statusCode === 404) {
                resolve({status: 'not-found', message: '404 Not Found'});
                return;
            }

            if (response.statusCode !== 200) {
                resolve({status: 'fail', message: `HTTP ${response.statusCode} - ${response.statusMessage}`});
                return;
            }

            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));

            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log(`✅ Downloaded: ${url}, size: ${humanFileSize(buffer.length)}`);
                processBufferWithSharp(buffer, outputPath).then(res => resolve(res)).catch(err => resolve(err));
            });
        }).on('error', (err) => {
            resolve({status: 'error', message: err.message});
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

function buildLocalizationMap(localizationData) {
    // Build localization map (@namelocatag -> English name)
    const localizationMap = new Map();
    for (const tu of localizationData.tmx.body.tu) {
        const tuid = tu['@tuid'];
        if (!tuid) continue;

        const tuv = tu.tuv;
        if (!tuv) continue;

        // Handle both single tuv and array of tuv
        const seg = Array.isArray(tuv)
            ? tuv.find(t => t['@xml:lang'] === 'EN-US')?.seg
            : tuv.seg;

        if (seg) {
            localizationMap.set(tuid, seg);
        }
    }
    return localizationMap;
}

function extractUiSprites(uiSprites, spellsArray) {
    if (!spellsArray) return;

    const arr = Array.isArray(spellsArray) ? spellsArray : [spellsArray];

    for (const spell of arr) {
        const uiSprite = spell['@uisprite'];

        if (uiSprite && uiSprite.trim()) {
            uiSprites.add(uiSprite.trim());
        }
    }
}

function buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsArray) {
    if (!spellsArray) return;

    const arr = Array.isArray(spellsArray) ? spellsArray : [spellsArray];

    for (const spell of arr) {
        const uiSprite = spell['@uisprite'];
        const nameLocaTag = spell['@namelocatag'];

        if (uiSprite && uiSprite.trim() && nameLocaTag) {
            const localizedName = localizationMap.get(nameLocaTag);
            if (localizedName && !uiSpriteToLocalizedName.has(uiSprite)) {
                uiSpriteToLocalizedName.set(uiSprite.trim(), localizedName);
            }
        }
    }
}

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node download-and-optimize-map.js [--replace-existing] [--no-optimize]');
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
    console.log('🔮 Unified Spell Icon Downloader & Optimizer');
    console.log('=============================================\n');

    parseArgs();

    if (optimize) {
        console.log(`⚙️ Image optimization is ENABLED`);
    }
    if (replaceExisting) {
        console.log(`⚙️ Existing icons will be REPLACED`);
    }
    if (onlyUpgrade) {
        console.log(`⚙️ Only UPGRADE existing icons if new version is larger`);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Load and parse spells.json
    console.log(`📄 Loading ${SPELLS_JSON_PATH}...`);
    const spellsData = JSON.parse(fs.readFileSync(SPELLS_JSON_PATH, 'utf8'));

    if (!spellsData.spells) {
        console.error('❌ Invalid spells.json structure: missing "spells" root');
        process.exit(1);
    }

    // Load and parse localization.json
    console.log(`📄 Building ${LOCALIZATION_JSON_PATH} map... (this may take a moment)`);
    const localizationMap = buildLocalizationMap(JSON.parse(fs.readFileSync(LOCALIZATION_JSON_PATH, 'utf8')));
    console.log(`✅ Loaded ${localizationMap.size} localizations\n`);

    // Extract unique uisprite values (these will be the icon filenames)
    const uiSprites = new Set();
    // Process all spell types
    extractUiSprites(uiSprites, spellsData.spells.passivespell);
    extractUiSprites(uiSprites, spellsData.spells.activespell);
    extractUiSprites(uiSprites, spellsData.spells.togglespell);
    totalSpells = uiSprites.size;
    console.log(`✅ Found ${totalSpells} unique spell uisprites\n`);

    // Build reverse map: uisprite -> localized name (for API calls)
    const uiSpriteToLocalizedName = new Map();
    // Build the map
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.passivespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.activespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.togglespell);
    console.log(`✅ Built uisprite->localized name map: ${uiSpriteToLocalizedName.size} mappings\n`);

    const uiSpritesArray = Array.from(uiSprites);
    return {uiSpritesArray, uiSpriteToLocalizedName};
}

async function main() {
    const {uiSpritesArray, uiSpriteToLocalizedName} = initPrerequisites();

    let downloaded = 0;
    let completed = 0;
    let optimizeFail = 0;
    let failed = 0;
    let now = Date.now();

    for (let i = 0; i < uiSpritesArray.length; i++) {
        const filename = `${uiSpritesArray[i]}.png`;
        const localizedFilename = `${uiSpriteToLocalizedName.get(uiSpritesArray[i])}.png`;
        const outputPath = path.join(OUTPUT_DIR, filename);

        let url = `${CDN_BASE_URL}${filename}`;
        let res = await downloadAndOptimizeSpellIcon(url, outputPath);

        if (res.status === 'not-found' && url !== `${CDN_BASE_URL}${localizedFilename}`) {
            console.log(` ⚠️ 🔄 Icon not found with uisprite name: ${filename}, trying localized name: ${localizedFilename}`);
            url = `${CDN_BASE_URL}${localizedFilename}`;
            res = await downloadAndOptimizeSpellIcon(url, outputPath);
        }

        if (res.status === 'success') {
            downloaded++;
            completed++;
            console.log(` ✅ [${i + 1}/${totalSpells}] Downloaded ${filename} (${res.size})\n`);
        } else if (res.status === 'exists') {
            completed++;
            console.log(` ⏭️️ [${i + 1}/${totalSpells}] Skipped existing file: ${filename}\n`);
        } else if (res.status === 'optimize-fail') {
            optimizeFail++;
            console.log(` ⚠️ [${i + 1}/${totalSpells}] Optimization failed for: ${filename} - ${res.message}\n`);
        } else {
            failed++;
            console.error(` ❌ [${i + 1}/${totalSpells}] Failed to download ${filename}: ${res.message}\n`);
        }
    }

     console.log('📊 Summary:');
    console.log(`   🕒 Time taken: ${((Date.now() - now) / 1000).toFixed(2)} seconds`);
    console.log(`   ✅ Completed: ${completed}`);
    console.log(`   📥 Downloaded: ${downloaded}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️ Optimization Failures: ${optimizeFail}`);
    console.log(`   🧙‍♂️ Location: ${OUTPUT_DIR}`);

    process.exit(0);
}


main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});

/**
 * Unified Spell Icon Downloader & Optimizer
 * Downloads all spell icons from spells.json using Albion Online CDN
 * and compresses them to 128x128px in a single pass
 *
 * Features:
 * - Downloads from CDN with retry and correct /spell/ URL patterns
 * - Compresses and resizes images to 128x128px (max)
 * - Overwrites existing files with optimized versions
 * - Uses sharp for high-quality image processing
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');

// Paths
const SPELLS_JSON_PATH = path.join(__dirname, '../work/data/ao-bin-dumps/spells.json');
const LOCALIZATION_JSON_PATH = path.join(__dirname, '../work/data/ao-bin-dumps/localization.json');
const OUTPUT_DIR = path.join(__dirname, '../images/Spells');
const CDN_BASE_URL = 'https://render.albiononline.com/v1/spell/';

// Image optimization settings
const MAX_IMAGE_SIZE = 128; // Max width/height in pixels
const IMAGE_QUALITY = 85;   // PNG quality (1-100)

// Stats
let totalSpells = 0;
let downloaded = 0;
let optimized = 0;
let alreadyOptimized = 0;
let failed = 0;
let totalBytesBefore = 0;
let totalBytesAfter = 0;

console.log('🔮 Unified Spell Icon Downloader & Optimizer');
console.log('=============================================\n');

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
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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
console.log(`📄 Loading ${LOCALIZATION_JSON_PATH}... (this may take a moment)`);
const localizationData = JSON.parse(fs.readFileSync(LOCALIZATION_JSON_PATH, 'utf8'));

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
console.log(`✅ Loaded ${localizationMap.size} localizations\n`);

// Extract unique uisprite values (these will be the icon filenames)
const uiSprites = new Set();

function extractUiSprites(spellsArray) {
    if (!spellsArray) return;

    const arr = Array.isArray(spellsArray) ? spellsArray : [spellsArray];

    for (const spell of arr) {
        const uiSprite = spell['@uisprite'];

        if (uiSprite && uiSprite.trim()) {
            uiSprites.add(uiSprite.trim());
        }
    }
}

// Process all spell types
extractUiSprites(spellsData.spells.passivespell);
extractUiSprites(spellsData.spells.activespell);
extractUiSprites(spellsData.spells.togglespell);

totalSpells = uiSprites.size;
console.log(`✅ Found ${totalSpells} unique spell uisprites\n`);

// Build reverse map: uisprite -> localized name (for API calls)
const uiSpriteToLocalizedName = new Map();

function buildUiSpriteMap(spellsArray) {
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

// Build the map
buildUiSpriteMap(spellsData.spells.passivespell);
buildUiSpriteMap(spellsData.spells.activespell);
buildUiSpriteMap(spellsData.spells.togglespell);

console.log(`✅ Built uisprite->localized name map: ${uiSpriteToLocalizedName.size} mappings\n`);

/**
 * Optimize an image with sharp
 * @param {Buffer} buffer - Image buffer
 * @param {string} filePath - Output file path
 * @returns {Promise<{success: boolean, bytesBefore: number, bytesAfter: number}>}
 */
async function optimizeImage(buffer, filePath) {
    try {
        const bytesBefore = buffer.length;

        // Process with sharp
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

        const bytesAfter = optimizedBuffer.length;

        // Write optimized image
        fs.writeFileSync(filePath, optimizedBuffer);

        totalBytesBefore += bytesBefore;
        totalBytesAfter += bytesAfter;

        return { success: true, bytesBefore, bytesAfter };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Download and optimize a spell icon
 * @param {string} uiSprite - Spell uisprite identifier
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<{success: boolean, exists?: boolean, uiSprite?: string}>}
 */
function downloadAndOptimizeSpellIcon(uiSprite, retryCount = 0) {
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 2000;

    return new Promise((resolve) => {
        const fileName = `${uiSprite}.png`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // Get localized name for API call
        const localizedName = uiSpriteToLocalizedName.get(uiSprite) || uiSprite;

        // CORRECT URL PATTERNS - PRIORITIZE /spell/ endpoints!
        const urlPatterns = [
            `${CDN_BASE_URL}${encodeURIComponent(uiSprite)}.png`,           // 1. spell endpoint with uiSprite
            `${CDN_BASE_URL}${encodeURIComponent(localizedName)}.png`,      // 2. spell endpoint with localized name
        ];

        let currentUrlIndex = 0;

        function tryDownload() {
            if (currentUrlIndex >= urlPatterns.length) {
                // All URLs failed, try retry
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => {
                        downloadAndOptimizeSpellIcon(uiSprite, retryCount + 1).then(resolve);
                    }, 100 * (retryCount + 1)); // Exponential backoff
                    return;
                }

                // All retries exhausted
                failed++;
                resolve({ success: false, uiSprite });
                return;
            }

            const url = urlPatterns[currentUrlIndex];
            currentUrlIndex++;

            const request = https.get(url, async (response) => {
                if (response.statusCode === 200) {
                    // Download to buffer
                    const chunks = [];
                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', async () => {
                        const buffer = Buffer.concat(chunks);

                        // Optimize and save
                        const result = await optimizeImage(buffer, filePath);

                        if (result.success) {
                            downloaded++;
                            optimized++;
                            resolve({ success: true, exists: false });
                        } else {
                            console.error(`\n⚠️  Optimization failed for ${uiSprite}: ${result.error}`);
                            tryDownload(); // Try next URL
                        }
                    });

                    response.on('error', () => {
                        tryDownload(); // Try next URL
                    });
                } else {
                    tryDownload(); // Try next URL
                }
            });

            // Set timeout
            request.setTimeout(TIMEOUT_MS, () => {
                request.destroy();
                tryDownload(); // Try next URL
            });

            request.on('error', () => {
                tryDownload(); // Try next URL
            });
        }

        tryDownload();
    });
}

/**
 * Re-optimize existing image files
 * @param {string} uiSprite - Spell uisprite identifier
 * @returns {Promise<{success: boolean}>}
 */
async function reOptimizeExistingIcon(uiSprite) {
    const fileName = `${uiSprite}.png`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    try {
        if (!fs.existsSync(filePath)) {
            return { success: false };
        }

        const buffer = fs.readFileSync(filePath);
        const result = await optimizeImage(buffer, filePath);

        if (result.success) {
            alreadyOptimized++;
            return { success: true };
        }

        return { success: false };
    } catch (error) {
        console.error(`\n⚠️  Failed to re-optimize ${uiSprite}: ${error.message}`);
        return { success: false };
    }
}

/**
 * Download and optimize all spell icons
 */
async function processAllSpells() {
    const uiSpriteArray = Array.from(uiSprites);
    const BATCH_SIZE = 5; // Process 5 at a time (lower due to optimization overhead)
    const failedSpells = [];

    console.log(`📥 Starting download and optimization of ${totalSpells} spell icons...\n`);
    console.log(`⚙️  Settings: Max size ${MAX_IMAGE_SIZE}x${MAX_IMAGE_SIZE}px, Quality ${IMAGE_QUALITY}%\n`);

    for (let i = 0; i < uiSpriteArray.length; i += BATCH_SIZE) {
        const batch = uiSpriteArray.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(async (uiSprite) => {
                const fileName = `${uiSprite}.png`;
                const filePath = path.join(OUTPUT_DIR, fileName);

                // If file exists, re-optimize it; otherwise download and optimize
                // if (fs.existsSync(filePath)) {
                //     return await reOptimizeExistingIcon(uiSprite);
                // } else {
                //     return await downloadAndOptimizeSpellIcon(uiSprite);
                // }
                return await downloadAndOptimizeSpellIcon(uiSprite);
            })
        );

        // Track failed spells
        results.forEach((result, idx) => {
            if (!result.success) {
                failedSpells.push(batch[idx]);
            }
        });

        // Progress update
        const progress = Math.min(i + BATCH_SIZE, totalSpells);
        const percent = ((progress / totalSpells) * 100).toFixed(1);
        const savedBytes = totalBytesBefore - totalBytesAfter;
        const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
        process.stdout.write(
            `\r⏳ Progress: ${progress}/${totalSpells} (${percent}%) - ` +
            `Downloaded: ${downloaded}, Re-optimized: ${alreadyOptimized}, Failed: ${failed} | ` +
            `Saved: ${savedMB}MB`
        );
    }

    console.log('\n\n✅ Processing complete!\n');
    console.log('📊 Summary:');
    console.log(`   Total spells: ${totalSpells}`);
    console.log(`   Downloaded & optimized: ${downloaded}`);
    console.log(`   Re-optimized existing: ${alreadyOptimized}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success rate: ${(((downloaded + alreadyOptimized) / totalSpells) * 100).toFixed(1)}%`);

    // Size reduction stats
    if (totalBytesBefore > 0) {
        const savedBytes = totalBytesBefore - totalBytesAfter;
        const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
        const reductionPercent = ((savedBytes / totalBytesBefore) * 100).toFixed(1);
        console.log(`\n💾 Storage Optimization:`);
        console.log(`   Before: ${(totalBytesBefore / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   After: ${(totalBytesAfter / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`   Saved: ${savedMB} MB (${reductionPercent}% reduction)`);
    }

    if (failedSpells.length > 0) {
        console.log(`\n⚠️  ${failedSpells.length} spell icons could not be processed:`);
        failedSpells.forEach(spell => {
            const localizedName = uiSpriteToLocalizedName.get(spell) || 'N/A';
            console.log(`   - ${spell} (${localizedName})`);
        });
        console.log('\n   These spells will use the generic fallback icon (SPELL_GENERIC.png).');
    }
}

// Run
processAllSpells().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
import fs from 'fs';
import path from 'path';
import {
    downloadFile,
    DownloadResult,
    DownloadStatus,
    handleFileBuffer,
    handleReplacing,
    printSummary,
    processBufferWithSharp
} from "./common";

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

function buildLocalizationMap(localizationData: any): Map<string, string> {
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

function extractUiSprites(uiSprites: Set<string>, spellsArray: any) {
    if (!spellsArray) return;

    const arr = Array.isArray(spellsArray) ? spellsArray : [spellsArray];

    for (const spell of arr) {
        const uiSprite = spell['@uisprite'];

        if (uiSprite && uiSprite.trim()) {
            uiSprites.add(uiSprite.trim());
        }
    }
}

function buildUiSpriteMap(localizationMap: Map<string, string>, uiSpriteToLocalizedName: Map<string, string>, spellsArray: any) {
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
        console.log('Usage: node download-and-optimize-spell-icons.js [--replace-existing] [--no-optimize] [--only-upgrade]');
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
    const uiSprites = new Set<string>();
    // Process all spell types
    extractUiSprites(uiSprites, spellsData.spells.passivespell);
    extractUiSprites(uiSprites, spellsData.spells.activespell);
    extractUiSprites(uiSprites, spellsData.spells.togglespell);
    console.log(`✅ Found ${uiSprites.size} unique spell uisprites\n`);

    // Build reverse map: uisprite -> localized name (for API calls)
    const uiSpriteToLocalizedName = new Map<string, string>();
    // Build the map
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.passivespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.activespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.togglespell);
    console.log(`✅ Built uisprite->localized name map: ${uiSpriteToLocalizedName.size} mappings\n`);

    const uiSpritesArray = Array.from(uiSprites);
    return {uiSpritesArray, uiSpriteToLocalizedName};
}

async function processUiSprite(
    sprite: string,
    index: number,
    total: number,
    uiSpriteToLocalizedName: Map<string, string>
): Promise<{
    downloaded: boolean,
    failed: boolean,
    optimizeFail: boolean,
    didReplace: boolean,
    didSkip: boolean,
    didOptimize: boolean
}> {
    const filename = `${sprite}.png`;
    const localizedFilename = `${uiSpriteToLocalizedName.get(sprite)}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    console.log();

    let res: DownloadResult;
    res = handleReplacing(outputPath, replaceExisting);
    if (res.status === DownloadStatus.EXISTS) {
        console.log(` ⏭️️ [${index + 1}/${total}] ${res.message}\n`);
        return {
            downloaded: false,
            failed: false,
            optimizeFail: false,
            didReplace: false,
            didSkip: true,
            didOptimize: false
        };
    }

    const url = `${CDN_BASE_URL}${filename}`;
    res = await downloadFile(url, outputPath);
    if (res.status === DownloadStatus.NOT_FOUND && localizedFilename !== filename && localizedFilename !== 'undefined.png') {
        const localizedUrl = `${CDN_BASE_URL}${localizedFilename}`;
        console.log(`🔄 404 : Trying localized filename: ${localizedFilename}`);
        res = await downloadFile(localizedUrl, outputPath);
    }

    if (res.status == DownloadStatus.SUCCESS) {
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
        console.log(` ⏭️️ [${index + 1}/${total}] ${res.message}`);
        return {
            downloaded: true,
            failed: false,
            optimizeFail: false,
            didReplace: false,
            didSkip: true,
            didOptimize: false
        };
    }
    if (res.status == DownloadStatus.ERROR) {
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
    if (res.status == DownloadStatus.OPTIMIZED || res.status == DownloadStatus.SUCCESS) {
        console.log(`🖼️️ [${index + 1}/${total}] ${res.message} (${res.size})`);
    }

    res = handleFileBuffer(res.buffer!, outputPath);
    console.log(`💾 [${index + 1}/${total}] ${res.message}`);

    return {
        downloaded: true,
        failed: false,
        optimizeFail: false,
        didReplace: true,
        didSkip: false,
        didOptimize: res.status == DownloadStatus.OPTIMIZED,
    };
}

async function main() {
    const {uiSpritesArray, uiSpriteToLocalizedName} = initPrerequisites();

    let downloaded = 0;
    let completed = 0;
    let optimizeFail = 0;
    let failed = 0;
    let optimized = 0;
    let replaced = 0;
    let skipped = 0;
    const now = Date.now();

    for (let i = 0; i < uiSpritesArray.length; i++) {
        const {
            downloaded: didDownload,
            failed: didFail,
            optimizeFail: didOptimizeFail,
            didReplace,
            didSkip,
            didOptimize
        } = await processUiSprite(
            uiSpritesArray[i],
            i,
            uiSpritesArray.length,
            uiSpriteToLocalizedName
        );

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
        completed,
        downloaded,
        replaced,
        skipped,
        optimized,
        failed,
        optimizeFail,
        outputDir: OUTPUT_DIR
    });
    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});

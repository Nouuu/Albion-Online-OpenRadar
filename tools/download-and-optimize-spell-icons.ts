import fs from 'fs';
import path from 'path';
import {downloadFile, DownloadResult, DownloadStatus, handleImageBuffer, handleReplacing, printSummary} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const OUTPUT_DIR = path.join('web/images/Spells');
const CDN_BASE_URL = 'https://render.albiononline.com/v1/spell/';

// Image optimization settings
const MAX_IMAGE_SIZE = 128; // Max width/height in pixels
const IMAGE_QUALITY = 85;   // WEBP quality (1-100)

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
        console.log('Usage: tsx download-and-optimize-spell-icons.ts [--replace-existing] [--no-optimize] [--only-upgrade]');
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
    console.log('🔮 Unified Spell Icon Downloader & Optimizer');
    console.log('=============================================\n');

    parseArgs();

    if (optimize) console.log(`⚙️ Image optimization is ENABLED`);
    if (replaceExisting) console.log(`⚙️ Existing icons will be REPLACED`);
    if (onlyUpgrade) console.log(`⚙️ Only UPGRADE existing icons if new version is larger`);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    // Download spells.json from GitHub
    console.log(`📥 Downloading spells.json from GitHub...`);
    const spellsRes = await downloadFile(`${GITHUB_RAW_BASE}/spells.json`);
    if (spellsRes.status !== DownloadStatus.SUCCESS || !spellsRes.buffer) {
        console.error('❌ Failed to download spells.json');
        process.exit(1);
    }
    const spellsData = JSON.parse(spellsRes.buffer.toString('utf8'));
    console.log(`✅ Downloaded spells.json\n`);

    // Download localization.json from GitHub
    console.log(`📥 Downloading localization.json from GitHub... (this may take a moment)`);
    const locRes = await downloadFile(`${GITHUB_RAW_BASE}/localization.json`);
    if (locRes.status !== DownloadStatus.SUCCESS || !locRes.buffer) {
        console.error('❌ Failed to download localization.json');
        process.exit(1);
    }
    const localizationMap = buildLocalizationMap(JSON.parse(locRes.buffer.toString('utf8')));
    console.log(`✅ Loaded ${localizationMap.size} localizations\n`);

    const uiSprites = new Set<string>();
    extractUiSprites(uiSprites, spellsData.spells.passivespell);
    extractUiSprites(uiSprites, spellsData.spells.activespell);
    extractUiSprites(uiSprites, spellsData.spells.togglespell);
    console.log(`✅ Found ${uiSprites.size} unique spell uisprites\n`);

    const uiSpriteToLocalizedName = new Map<string, string>();
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.passivespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.activespell);
    buildUiSpriteMap(localizationMap, uiSpriteToLocalizedName, spellsData.spells.togglespell);
    console.log(`✅ Built uisprite->localized name map: ${uiSpriteToLocalizedName.size} mappings\n`);

    return {uiSpritesArray: Array.from(uiSprites), uiSpriteToLocalizedName};
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
    const filename = `${sprite}.webp`;
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

    // Try sprite name first (most reliable), then localized name as fallback
    const url = `${CDN_BASE_URL}${sprite}.png`;
    res = await downloadFile(url);

    // If sprite name fails and we have a localized name, try that
    const localizedName = uiSpriteToLocalizedName.get(sprite);
    if (res.status === DownloadStatus.NOT_FOUND && localizedName && localizedName !== sprite) {
        const localizedUrl = `${CDN_BASE_URL}${localizedName}.png`;
        console.log(`🔄 Trying localized name: ${localizedName}`);
        res = await downloadFile(localizedUrl);
    }

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

const CONCURRENCY = 2; // Number of parallel downloads

async function main() {
    const {uiSpritesArray, uiSpriteToLocalizedName} = await initPrerequisites();

    let downloaded = 0;
    let completed = 0;
    let optimizeFail = 0;
    let failed = 0;
    let optimized = 0;
    let replaced = 0;
    let skipped = 0;
    const now = Date.now();

    // Process in batches of CONCURRENCY
    for (let i = 0; i < uiSpritesArray.length; i += CONCURRENCY) {
        const batch = uiSpritesArray.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map((sprite, batchIndex) =>
                processUiSprite(
                    sprite,
                    i + batchIndex,
                    uiSpritesArray.length,
                    uiSpriteToLocalizedName
                )
            )
        );

        for (const result of results) {
            if (result.downloaded) downloaded++;
            if (result.failed) failed++;
            if (result.optimizeFail) optimizeFail++;
            if (result.didReplace) replaced++;
            if (result.didSkip) skipped++;
            if (result.didOptimize) optimized++;
            completed++;
        }
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

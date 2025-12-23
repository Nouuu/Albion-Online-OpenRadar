import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {downloadFile, DownloadStatus, handleImageBuffer, handleReplacing, printSummary} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const ICONS_DIR = path.join('web/images', 'Items');
const CDN_BASE = 'https://render.albiononline.com/v1/item/';

const MAX_IMAGE_SIZE = 128;
const IMAGE_QUALITY = 85;

// Item patterns to exclude - not relevant for radar functionality
// (cosmetics, furniture, quest items, farming items, etc.)
const EXCLUDED_PATTERNS = [
    // Cosmetics and vanity
    /VANITY/i,
    /SKIN_/i,
    /UNIQUE_UNLOCK/i,
    /PLAYEREMOTE/i,
    /EMOTE_/i,
    // Furniture and decorations
    /FURNITURE/i,
    /DECORATION/i,
    /TROPHY/i,
    // Quest and event items
    /QUESTITEM/i,
    /TOKEN_/i,
    /TICKET_/i,
    /INVITATION/i,
    // Laborer journals
    /JOURNAL_/i,
    // Farming items (island only)
    /FARM_/i,
    /SEED_/i,
    /BABY_/i,
    /_GROWN/i,
    // Hideout items
    /HIDEOUT_/i,
    // Loot chests (visual duplicates per season)
    /LOOTCHEST_.*_S\d+$/i,
    /LOOTCHEST_.*_PH$/i,
    // Raw gathering materials - already have icons in web/images/Resources/
    /^T[1-8]_(FIBER|ORE|WOOD|HIDE|ROCK)(_LEVEL[1-4])?$/i,
    // Refined materials - crafting items, not shown on radar
    /^T[1-8]_(CLOTH|LEATHER|METALBAR|PLANKS|STONEBLOCK)(_LEVEL[1-4])?$/i,
    // Skillbooks, learning points - UI/progression items
    /SKILLBOOK/i,
    /LEARNINGPOINTS/i,
    // Treasure items - loot UI only
    /TREASURE/i,
    // All lootchests
    /LOOTCHEST/i,
    // Avatar items (UI only)
    /^UNIQUE_AVATAR/i,
    /^UNIQUE_AVATARRING/i,
    // Fish (consumables, not FISHING gear)
    /^T[1-8]_FISH_/i,
    // Meals (consumables)
    /MEAL_/i,
    // Silver bags
    /SILVERBAG/i,
    // Alchemy ingredients
    /ALCHEMY_/i,
    // GvG season rewards
    /GVGSEASON/i,
];

function isExcludedItem(itemName: string): boolean {
    return EXCLUDED_PATTERNS.some(pattern => pattern.test(itemName));
}

// Hash tracking for deduplication
const seenHashes = new Map<string, string>(); // hash -> first item name

let optimize = true;
let replaceExisting = false;
let onlyUpgrade = false;


function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: tsx download-and-optimize-item-icons.ts [options]');
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
    console.log('Albion Online Item Icons Downloader and Optimizer Started');
    console.log('=======================================================\n');

    parseArgs();

    if (optimize) console.log('⚙️  Image optimization is ENABLED\n');
    if (replaceExisting) console.log('🔧  Replace existing files: ENABLED\n');
    if (onlyUpgrade) console.log('⬆️  Only upgrade existing files: ENABLED\n');

    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, {recursive: true});
        console.log(`✅ Created directory: ${ICONS_DIR}\n`);
    }

    console.log(`📥 Downloading items.xml from GitHub...`);
    const res = await downloadFile(`${GITHUB_RAW_BASE}/items.xml`);
    if (res.status !== DownloadStatus.SUCCESS || !res.buffer) {
        console.error('❌ Failed to download items.xml');
        process.exit(1);
    }
    console.log(`✅ Downloaded items.xml\n`);

    const xmlContent = res.buffer.toString('utf-8');
    const uniqueNameRegex = /uniquename="([^"]+)"/g;
    const uniqueNames = new Set<string>();
    let match;
    while ((match = uniqueNameRegex.exec(xmlContent)) !== null) {
        uniqueNames.add(match[1]);
    }
    console.log(`📋 Found ${uniqueNames.size} unique items in XML`);

    // Filter out excluded items
    const filteredItems = Array.from(uniqueNames).filter(item => !isExcludedItem(item));
    const excludedCount = uniqueNames.size - filteredItems.length;
    console.log(`🚫 Excluded ${excludedCount} items (cosmetics, furniture, quest items, etc.)`);
    console.log(`✅ ${filteredItems.length} items to process\n`);

    return {uniqueItems: filteredItems};
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
    didOptimize: boolean,
    didDedupe: boolean
}> {
    const filename = item + '.webp';
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
            didOptimize: false,
            didDedupe: false
        };
    }

    const url = `${CDN_BASE}${item}.png`;
    res = await downloadFile(url);

    const result = await handleImageBuffer(
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

    // Hash-based deduplication: check if this image is a duplicate
    if (result.downloaded && fs.existsSync(outputPath)) {
        const fileBuffer = fs.readFileSync(outputPath);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        if (seenHashes.has(hash)) {
            // Duplicate found - delete this file
            fs.unlinkSync(outputPath);
            console.log(`🔄 [${index + 1}/${total}] Duplicate of ${seenHashes.get(hash)} - removed`);
            return {...result, didDedupe: true};
        } else {
            seenHashes.set(hash, item);
        }
    }

    return {...result, didDedupe: false};
}

const CONCURRENCY = 2; // Number of parallel downloads

async function main() {
    const {uniqueItems} = await initPrerequisites();

    let completed = 0;
    let downloaded = 0;
    let optimizeFail = 0;
    let failed = 0;
    let optimized = 0;
    let replaced = 0;
    let skipped = 0;
    let deduped = 0;
    const now = Date.now();

    // Process in batches of CONCURRENCY
    for (let i = 0; i < uniqueItems.length; i += CONCURRENCY) {
        const batch = uniqueItems.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map((item, batchIndex) =>
                processItemIcon(item, i + batchIndex, uniqueItems.length)
            )
        );

        for (const result of results) {
            if (result.downloaded) downloaded++;
            if (result.failed) failed++;
            if (result.optimizeFail) optimizeFail++;
            if (result.didReplace) replaced++;
            if (result.didSkip) skipped++;
            if (result.didOptimize) optimized++;
            if (result.didDedupe) deduped++;
            completed++;
        }
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
    });

    // Print deduplication stats
    if (deduped > 0) {
        console.log(`\n🔄 Deduplication: ${deduped} duplicate images removed`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('❌ An error occurred:', err);
    process.exit(1);
});
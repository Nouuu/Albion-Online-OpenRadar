import fs from 'fs';
import path from 'path';
import {downloadFile, DownloadStatus} from "./common";

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/refs/heads/master';
const OUTPUT_DIR = 'web/ao-bin-dumps';

// Zone types and their PvP classification
type PvpType = 'safe' | 'yellow' | 'red' | 'black';

interface ZoneInfo {
    name: string;
    type: string;
    pvpType: PvpType;
    tier: number;
    file: string;
}

// ============================================================================
// Minified Data Structures
// ============================================================================

/**
 * Minified item: { n: name, p: itempower }
 * Index in array = sequential ID (1-based in original, 0-based in minified)
 */
interface MinifiedItem {
    n: string;
    p: number;
    t?: string;
    cat?: string;
    slot?: string;
    h2?: boolean;
}

/**
 * Minified mob: { u: uniqueName, t: tier, c: category, n: namelocatag, l?: lootType, lt?: lootTier }
 * Index in array = typeId - 15 (MobsDatabase.OFFSET)
 */
interface MinifiedMob {
    u: string;
    t: number;
    c?: string;
    n?: string;
    l?: string;
    lt?: number;
    fame?: number;
    hp?: number;
    avatar?: string;
    danger?: string;
}

/**
 * Minified spell: { n: uniqueName, i: uiSprite }
 * Index in array = sequential spell ID
 */
interface MinifiedSpell {
    n: string;  // uniqueName
    i?: string; // uiSprite (icon) - optional
    t?: string; // type (passivespell, activespell, togglespell)
}

/**
 * Minified harvestables with tier details
 */
interface HarvestableTier {
    tier: number;
    item: string;
    respawn: number;
    harvest: number;
    tool: boolean;
    maxcharges?: number;
    startcharges?: number;
    chargeup?: number;
}

type MinifiedHarvestables = Record<string, HarvestableTier[]>;

// ============================================================================
// Minification Functions
// ============================================================================

function minifyItems(rawData: any): MinifiedItem[] {
    const items: MinifiedItem[] = [];
    const itemsRoot = rawData?.items;
    if (!itemsRoot) return items;

    const itemTypes = [
        'simpleitem', 'equipmentitem', 'weapon', 'consumableitem',
        'consumablefrominventoryitem', 'farmableitem', 'mount',
        'furnitureitem', 'trackingitem', 'journalitem'
    ];

    for (const itemType of itemTypes) {
        if (!itemsRoot[itemType]) continue;

        const typeItems = Array.isArray(itemsRoot[itemType])
            ? itemsRoot[itemType]
            : [itemsRoot[itemType]];

        for (const item of typeItems) {
            const uniqueName = item['@uniquename'];
            if (!uniqueName) continue;

            const itempower = parseInt(item['@itempower'] || '0');

            if (itempower > 0) {
                const minItem: MinifiedItem = {n: uniqueName, p: itempower, t: itemType};
                if (item['@shopcategory']) minItem.cat = item['@shopcategory'];
                if (item['@slottype']) minItem.slot = item['@slottype'];
                if (item['@twohanded'] === 'true') minItem.h2 = true;
                items.push(minItem);
            }

            if (item.enchantments?.enchantment) {
                const enchantments = Array.isArray(item.enchantments.enchantment)
                    ? item.enchantments.enchantment
                    : [item.enchantments.enchantment];

                for (const enchant of enchantments) {
                    const enchantLevel = parseInt(enchant['@enchantmentlevel'] || '0');
                    const enchantPower = parseInt(enchant['@itempower'] || '0');

                    if (enchantPower > 0) {
                        const minItem: MinifiedItem = {
                            n: `${uniqueName}@${enchantLevel}`,
                            p: enchantPower,
                            t: itemType
                        };
                        if (item['@shopcategory']) minItem.cat = item['@shopcategory'];
                        if (item['@slottype']) minItem.slot = item['@slottype'];
                        if (item['@twohanded'] === 'true') minItem.h2 = true;
                        items.push(minItem);
                    }
                }
            }
        }
    }

    return items;
}

function minifyMobs(rawData: any): MinifiedMob[] {
    const mobs: MinifiedMob[] = [];
    const mobsRoot = rawData?.Mobs || rawData;
    const mobArray = mobsRoot?.Mob || mobsRoot?.Mobs?.Mob || [];

    if (!Array.isArray(mobArray)) return mobs;

    for (const mob of mobArray) {
        const uniqueName = mob['@uniquename'] || '';
        const tier = parseInt(mob['@tier']) || 0;
        const category = mob['@mobtypecategory'] || mob['@category'] || '';
        const namelocatag = mob['@namelocatag'] || '';

        const minMob: MinifiedMob = {
            u: uniqueName,
            t: tier
        };

        // Add category if present
        if (category) {
            minMob.c = category;
        }

        // Add namelocatag if present (useful for display)
        if (namelocatag) {
            minMob.n = namelocatag;
        }

        const fame = parseInt(mob['@fame']) || 0;
        if (fame > 0) minMob.fame = fame;

        const hp = parseInt(mob['@hitpointsmax']) || 0;
        if (hp > 0) minMob.hp = hp;

        if (mob['@avatar']) minMob.avatar = mob['@avatar'];
        if (mob['@dangerstate']) minMob.danger = mob['@dangerstate'];

        const harvestable = mob?.Loot?.Harvestable;
        if (harvestable) {
            const lootType = harvestable['@type'];
            const lootTier = parseInt(harvestable['@tier']) || tier;

            if (lootType) {
                minMob.l = lootType;
                minMob.lt = lootTier;
            }
        }

        mobs.push(minMob);
    }

    return mobs;
}

function minifySpells(rawData: any): MinifiedSpell[] {
    const spells: MinifiedSpell[] = [];
    const spellsRoot = rawData?.spells;
    if (!spellsRoot) return spells;

    // Process in order: passive, active, toggle (same order as SpellsDatabase)
    const spellTypes = ['passivespell', 'activespell', 'togglespell'];

    for (const spellType of spellTypes) {
        if (!spellsRoot[spellType]) continue;

        const typeSpells = Array.isArray(spellsRoot[spellType])
            ? spellsRoot[spellType]
            : [spellsRoot[spellType]];

        for (const spell of typeSpells) {
            const uniqueName = spell['@uniquename'];
            if (!uniqueName) continue;

            const minSpell: MinifiedSpell = {n: uniqueName, t: spellType};

            const uiSprite = spell['@uisprite'];
            if (uiSprite) {
                minSpell.i = uiSprite;
            }

            spells.push(minSpell);
        }
    }

    return spells;
}

function minifyHarvestables(rawData: any): MinifiedHarvestables {
    const result: MinifiedHarvestables = {};
    const aoHarvestables = rawData?.['AO-Harvestables'];
    if (!aoHarvestables?.Harvestable) return result;

    const harvestables = Array.isArray(aoHarvestables.Harvestable)
        ? aoHarvestables.Harvestable
        : [aoHarvestables.Harvestable];

    for (const harvestable of harvestables) {
        const resourceType = harvestable['@resource'];
        if (!resourceType) continue;

        if (!result[resourceType]) {
            result[resourceType] = [];
        }

        if (harvestable.Tier) {
            const tiers = Array.isArray(harvestable.Tier)
                ? harvestable.Tier
                : [harvestable.Tier];

            for (const tierData of tiers) {
                const tier = parseInt(tierData['@tier']);
                if (isNaN(tier)) continue;

                const tierEntry: HarvestableTier = {
                    tier,
                    item: tierData['@item'] || '',
                    respawn: parseInt(tierData['@respawntimeseconds']) || 0,
                    harvest: parseInt(tierData['@harvesttimeseconds']) || 0,
                    tool: tierData['@requirestool'] === 'true'
                };
                const maxcharges = parseInt(tierData['@maxchargesperharvest']);
                if (maxcharges > 0) tierEntry.maxcharges = maxcharges;
                const startcharges = parseInt(tierData['@startcharges']);
                if (startcharges > 0) tierEntry.startcharges = startcharges;
                const chargeup = parseFloat(tierData['@chargeupchance']);
                if (chargeup > 0) tierEntry.chargeup = chargeup;
                result[resourceType].push(tierEntry);
            }
        }
    }

    for (const key of Object.keys(result)) {
        result[key].sort((a, b) => a.tier - b.tier);
    }

    return result;
}

// ============================================================================
// Zone Processing (unchanged)
// ============================================================================

function getPvpType(type: string): PvpType {
    if (!type) return 'safe';
    const t = type.toUpperCase();

    // Safe zones (check first - exceptions)
    if (t.startsWith('PLAYERCITY_')) return 'safe';
    if (t.includes('ISLAND')) return 'safe';
    if (['HIDEOUT', 'TUNNEL_HIDEOUT', 'TUNNEL_HIDEOUT_DEEP'].includes(t)) return 'safe';
    if (['SAFEAREA', 'STARTAREA', 'STARTINGCITY', 'TUTORIAL',
        'PASSAGE_SAFEAREA', 'DUNGEON_SAFEAREA'].includes(t)) return 'safe';
    if (t.includes('EXPEDITION')) return 'safe';
    if (t.startsWith('ARENA_')) return 'safe';
    if (t === 'TUNNEL_ROYAL') return 'safe';

    // Red zones (check before black - TUNNEL_ROYAL_RED)
    if (t.includes('RED')) return 'red';

    // Yellow zones
    if (t.includes('YELLOW')) return 'yellow';
    if (t.includes('HELL') && t.includes('NON_LETHAL')) return 'yellow';

    // Black zones
    if (t.includes('BLACK')) return 'black';
    if (t.startsWith('TUNNEL_')) return 'black';  // Roads of Avalon
    if (t.includes('CORRUPTED_DUNGEON')) return 'black';
    if (t.includes('HELL') && t.includes('LETHAL')) return 'black';

    return 'safe';
}

function extractTier(file: string): number {
    if (!file) return 0;
    const tierMatch = file.match(/_T(\d+)_/);
    return tierMatch ? parseInt(tierMatch[1], 10) : 0;
}

async function processWorldJson(): Promise<{ success: boolean, zonesCount: number }> {
    const worldJsonUrl = `${GITHUB_RAW_BASE}/cluster/world.json`;
    const outputPath = path.join(OUTPUT_DIR, 'zones.json');

    console.log('\n📍 Processing world.json for zone data...');

    const res = await downloadFile(worldJsonUrl);
    if (res.status !== DownloadStatus.SUCCESS || !res.buffer) {
        console.error(`❌ Failed to download world.json: ${res.message}`);
        return {success: false, zonesCount: 0};
    }

    console.log(`✅ Downloaded world.json (${res.size})`);

    try {
        const worldData = JSON.parse(res.buffer.toString('utf-8'));
        const clusters = worldData?.world?.clusters?.cluster || [];

        if (!Array.isArray(clusters)) {
            console.error('❌ Invalid world.json structure: clusters.cluster is not an array');
            return {success: false, zonesCount: 0};
        }

        const zones: Record<string, ZoneInfo> = {};

        for (const cluster of clusters) {
            const id = cluster['@id'];
            if (!id) continue;
            if (id.toLowerCase().includes('debug')) continue;

            const displayName = cluster['@displayname'] || id;
            const type = cluster['@type'] || '';
            const file = cluster['@file'] || '';
            const filename = file.replace('.cluster.xml', '');

            zones[id] = {
                name: displayName,
                type: type,
                pvpType: getPvpType(type),
                tier: extractTier(file),
                file: filename
            };
        }

        fs.writeFileSync(outputPath, JSON.stringify(zones));
        console.log(`💾 Generated zones.json with ${Object.keys(zones).length} zones`);

        const pvpCounts = {safe: 0, yellow: 0, red: 0, black: 0};
        for (const zone of Object.values(zones)) {
            pvpCounts[zone.pvpType]++;
        }
        console.log(`   🛡️ Safe: ${pvpCounts.safe} | 🔶 Yellow: ${pvpCounts.yellow} | ⚔️ Red: ${pvpCounts.red} | 💀 Black: ${pvpCounts.black}`);

        return {success: true, zonesCount: Object.keys(zones).length};
    } catch (error) {
        console.error(`❌ Failed to parse world.json: ${error}`);
        return {success: false, zonesCount: 0};
    }
}

// ============================================================================
// Main Processing
// ============================================================================

interface ProcessResult {
    name: string;
    success: boolean;
    originalSize: number;
    minifiedSize: number;
    itemCount?: number;
}

async function downloadAndMinify<T>(
    filename: string,
    minifyFn: (data: any) => T,
    outputFilename: string
): Promise<ProcessResult> {
    const url = `${GITHUB_RAW_BASE}/${filename}`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log(`\n📥 Downloading ${filename}...`);

    const res = await downloadFile(url);
    if (res.status !== DownloadStatus.SUCCESS || !res.buffer) {
        console.error(`❌ Failed to download ${filename}: ${res.message}`);
        return {name: filename, success: false, originalSize: 0, minifiedSize: 0};
    }

    const originalSize = res.buffer.length;
    console.log(`✅ Downloaded ${filename} (${formatSize(originalSize)})`);

    try {
        const rawData = JSON.parse(res.buffer.toString('utf-8'));
        const minified = minifyFn(rawData);

        const minifiedJson = JSON.stringify(minified);
        fs.writeFileSync(outputPath, minifiedJson);

        const minifiedSize = Buffer.byteLength(minifiedJson);
        const reduction = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        const count = Array.isArray(minified) ? minified.length : Object.keys(minified as object).length;

        console.log(`💾 Saved ${outputFilename} (${formatSize(minifiedSize)}, -${reduction}%, ${count} entries)`);

        return {
            name: filename,
            success: true,
            originalSize,
            minifiedSize,
            itemCount: count
        };
    } catch (error) {
        console.error(`❌ Failed to process ${filename}: ${error}`);
        return {name: filename, success: false, originalSize, minifiedSize: 0};
    }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function main() {
    console.log('Albion Online Data Updater');
    console.log('==========================');
    console.log('Downloading and minifying game data...\n');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, {recursive: true});
        console.log(`✅ Created directory: ${OUTPUT_DIR}\n`);
    }

    const startTime = Date.now();
    const results: ProcessResult[] = [];

    // Process each data file with minification
    results.push(await downloadAndMinify('items.json', minifyItems, 'items.min.json'));
    results.push(await downloadAndMinify('mobs.json', minifyMobs, 'mobs.min.json'));
    results.push(await downloadAndMinify('spells.json', minifySpells, 'spells.min.json'));
    results.push(await downloadAndMinify('harvestables.json', minifyHarvestables, 'harvestables.min.json'));

    // Process zones
    const zonesResult = await processWorldJson();
    results.push({
        name: 'world.json',
        success: zonesResult.success,
        originalSize: 0,
        minifiedSize: 0,
        itemCount: zonesResult.zonesCount
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary');
    console.log('='.repeat(60));

    let totalOriginal = 0;
    let totalMinified = 0;
    let successCount = 0;
    let failCount = 0;

    for (const r of results) {
        if (r.success) {
            successCount++;
            totalOriginal += r.originalSize;
            totalMinified += r.minifiedSize;
            if (r.originalSize > 0) {
                console.log(`   ✅ ${r.name}: ${formatSize(r.originalSize)} → ${formatSize(r.minifiedSize)} (${r.itemCount} entries)`);
            } else {
                console.log(`   ✅ ${r.name}: ${r.itemCount} entries`);
            }
        } else {
            failCount++;
            console.log(`   ❌ ${r.name}: FAILED`);
        }
    }

    if (totalOriginal > 0) {
        const reduction = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
        console.log(`\n   📦 Total: ${formatSize(totalOriginal)} → ${formatSize(totalMinified)} (${reduction}% reduction)`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ⏱️ Completed in ${elapsed}s`);
    console.log(`   ✅ Success: ${successCount} | ❌ Failed: ${failCount}`);

    console.log('\n💡 Note: localization.json and items.xml are fetched on-demand by icon download scripts');
    console.log('='.repeat(60) + '\n');

    process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});

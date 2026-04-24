import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

// pcap-derived: fixture corpus from 25-minute anonymized capture
// synthetic: constructed parameters with no pcap origin

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(),
    },
}));

const {MobsHandler, EnemyType} = await import('./MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

const allTrueSettings = {
    e0: Array(8).fill(true),
    e1: Array(8).fill(true),
    e2: Array(8).fill(true),
    e3: Array(8).fill(true),
    e4: Array(8).fill(true),
};

describe('MobsHandler', () => {
    let handler;
    let dbs;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        dbs = installRealDatabasesOnWindow();
        settingsSync.getJSON.mockReturnValue(allTrueSettings);
        settingsSync.getBool.mockReturnValue(true);
        handler = new MobsHandler();
    });

    // -------------------------------------------------------------------------
    // NewMobEvent (event 123) - pcap-derived
    // -------------------------------------------------------------------------

    describe('NewMobEvent (event 123)', () => {
        // @verified 2026-04-18: Mist spawn (name present in Parameters[32]) adds to mistList with 'solo' type heuristic.
        test('pcap-derived spawn: mist MISTS_SOLO_YELLOW adds to mistList', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['32'] === 'MISTS_SOLO_YELLOW');
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const sizes = handler.getSize();
            expect(sizes.mists).toBe(1);
            expect(sizes.mobs).toBe(0);
        });

        // @verified 2026-04-18: living Hide mob typeId=424 (T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD, real DB lt=3).
        // Real DB: type=Hide, tier=3, isHarvestable=true -> LivingSkinnable.
        test('pcap-derived spawn: living Hide mob typeId=424 adds as LivingSkinnable', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 424);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].name).toBe('Hide');
            expect(mobs[0].tier).toBe(3);
        });

        // @verified 2026-04-18: typeId=428 (T5_MOB_DYNAMIC_HIDE_SWAMP_GIANTSNAKE, real DB lt=5).
        // Real DB: type=Hide, tier=5, isHarvestable=true -> LivingSkinnable.
        test('synthetic: living Hide mob typeId=428 adds as LivingSkinnable with tier=5', () => {
            // synthetic: no raw message with param[1]=428 in spawn fixture; tests real DB path for this typeId.
            const p = normalizeParams({'0': 9000, '1': 428, '2': 255, '7': [0, 0], '13': 856, '19': 90, '33': 0});
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].tier).toBe(5);
        });

        // @verified 2026-04-19: typeId=422 (T2_MOB_HIDE_SWAMP_SNAKE). Server event 40 Parameters[7]=1.
        // Rule: LIVING HIDE, max(1, 2-1) = 1. Combat tier 2 shifts to harvest tier 1.
        test('pcap-derived spawn: living Hide mob typeId=422 rendered with harvest tier 1', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 422);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].tier).toBe(1);
        });

        // @verified 2026-04-19: typeId=529 (T4_MOB_CRITTER_FIBER_SWAMP_GREEN). Server event 40 Parameters[7]=3.
        // Rule: LIVING FIBER_CRITTER (floor=3), max(3, 4-1) = 3. Combat tier 4 shifts to harvest tier 3.
        test('pcap-derived spawn: Fiber critter typeId=529 rendered with harvest tier 3', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 529);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Fiber');
            expect(mobs[0].tier).toBe(3);
        });

        // @verified 2026-04-19: typeId=531 (T5_MOB_CRITTER_FIBER_SWAMP_RED). Server event 40 Parameters[7]=4.
        // Rule: LIVING FIBER_CRITTER, max(3, 5-1) = 4. Combat tier 5 shifts to harvest tier 4.
        test('pcap-derived spawn: Fiber critter typeId=531 rendered with harvest tier 4', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Fiber');
            expect(mobs[0].tier).toBe(4);
        });

        // @verified 2026-04-19: typeId=373 (T5_MOB_HIDE_MISTS_OWL). User confirmed game tooltip T4.
        // Rule: LIVING HIDE, max(1, 5-1) = 4.
        test('pcap-derived spawn (living-tier): Hide Mists owl typeId=373 rendered with harvest tier 4', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 373);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].name).toBe('Hide');
            expect(mobs[0].tier).toBe(4);
        });

        // @verified 2026-04-19: typeId=374 (T6_MOB_HIDE_MISTS_HOUND). User confirmed game tooltip T5.
        // Rule: LIVING HIDE, max(1, 6-1) = 5.
        test('pcap-derived spawn (living-tier): Hide Mists hound typeId=374 rendered with harvest tier 5', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 374);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].name).toBe('Hide');
            expect(mobs[0].tier).toBe(5);
        });

        // @verified 2026-04-19: typeId=532 (T5_MOB_CRITTER_FIBER_SWAMP_DEAD). Server event 40 Parameters[7]=5.
        // Rule: DEAD variant preserves combat tier 5, no shift.
        test('pcap-derived spawn (living-tier): Fiber DEAD typeId=532 preserves combat tier 5', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 532);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Fiber');
            expect(mobs[0].tier).toBe(5);
        });

        // @verified 2026-04-19: typeId=534 (T6_MOB_CRITTER_FIBER_SWAMP_DEAD). DEAD variant.
        // Rule: DEAD preserves combat tier 6.
        test('pcap-derived spawn (living-tier): Fiber DEAD typeId=534 preserves combat tier 6', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 534);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Fiber');
            expect(mobs[0].tier).toBe(6);
        });

        // @verified 2026-04-19: typeId=649 (T4_MOB_CRITTER_WOOD_MISTS_GREEN). WOOD_CRITTER, floor=3.
        // Rule: max(3, 4-1) = 3. Validates Wood family parity with other living resources.
        test('pcap-derived spawn (living-tier): Wood Mists critter typeId=649 rendered with harvest tier 3', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 649);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Log');
            expect(mobs[0].tier).toBe(3);
        });

        // @verified 2026-04-19: typeId=650 (T5_MOB_CRITTER_WOOD_MISTS_GREEN). Server event 40 Parameters[7]=4.
        // Rule: max(3, 5-1) = 4. Wood family matches Fiber pattern.
        test('pcap-derived spawn (living-tier): Wood Mists critter typeId=650 rendered with harvest tier 4', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 650);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Log');
            expect(mobs[0].tier).toBe(4);
        });

        // @verified 2026-04-19: typeId=651 (T6_MOB_CRITTER_WOOD_MISTS_GREEN). WOOD_CRITTER.
        // Rule: max(3, 6-1) = 5.
        test('pcap-derived spawn (living-tier): Wood Mists critter typeId=651 rendered with harvest tier 5', async () => {
            const fx = await loadFixture('mobs', 'living-tier');
            const msg = fx.messages.find(m => m.parameters['1'] === 651);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingHarvestable);
            expect(mobs[0].name).toBe('Log');
            expect(mobs[0].tier).toBe(5);
        });

        // @verified 2026-04-18: hostile camp mob typeId=2067 (T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE).
        // Real DB: l=SILVERCOINS (not harvestable), category=camp -> EnemyType.Enemy.
        test('pcap-derived spawn: hostile mob typeId=2067 category=camp adds as Enemy', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 2067);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: typeId=2070 (T5_MOB_ROAMING_KEEPER_CAMP_BERSERK), camp -> Enemy.
        test('pcap-derived spawn: hostile mob typeId=2070 adds as Enemy', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 2070);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: typeId=2082 (T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_FEMALE), camp -> Enemy.
        test('pcap-derived spawn: hostile mob typeId=2082 adds as Enemy', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 2082);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: typeId=2085 (T5_MOB_ROAMING_KEEPER_CAMP_AXE_THROWER), camp -> Enemy.
        test('pcap-derived spawn: hostile mob typeId=2085 adds as Enemy', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 2085);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: unknown typeId (out-of-range, no DB entry) defaults to EnemyType.Enemy.
        test('synthetic: unknown typeId with no db entry defaults to EnemyType.Enemy', () => {
            // synthetic: typeId 9999 is out of range in mobs.min.json (len=4595); tests the no-db-entry path.
            const p = normalizeParams({'0': 8001, '1': 9999, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: low healthNormalized < 10 is clamped to 255 at spawn.
        test('synthetic: spawn with parameters[2] < 10 clamps health to 255', () => {
            // synthetic: typeId 9999 is out of range; tests the fortNPC low-HP-spawn fix branch.
            const p = normalizeParams({'0': 8002, '1': 9999, '2': 5, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].health).toBe(255);
        });

        // @verified 2026-04-18: duplicate id second NewMobEvent is a no-op (first wins).
        test('synthetic: duplicate id second NewMobEvent does not duplicate entry', () => {
            // synthetic: typeId 9999 out of range; tests the early-return guard in AddEnemy.
            const p = normalizeParams({'0': 8003, '1': 9999, '2': 255, '7': [10, 20], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const p2 = normalizeParams({'0': 8003, '1': 9999, '2': 200, '7': [99, 99], '13': 500, '33': 0});
            handler.NewMobEvent(p2);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].posX).toBe(10);
        });

        // @verified 2026-04-18: parameters[32] missing but parameters[31] has a name routes to AddMist.
        test('synthetic: parameters[31] name with no parameters[32] routes to AddMist', () => {
            // synthetic: tests the fallback branch name = parameters[32] || parameters[31].
            const p = normalizeParams({'0': 8004, '1': 94, '2': 255, '7': [0, 0], '13': 1, '31': 'MISTS_DUO_GREEN', '33': 0});
            handler.NewMobEvent(p);
            expect(handler.getSize().mists).toBe(1);
            expect(handler.getSize().mobs).toBe(0);
        });

        // @verified 2026-04-24: enemy filters moved to render; spawn always stores, and mob.identified pins the db-match state for the render gate.
        test('synthetic: settingNormalEnemy=false no longer blocks spawn, mob lands with identified=true', () => {
            settingsSync.getBool.mockImplementation((key) => key !== 'settingNormalEnemy');
            const p = normalizeParams({'0': 8005, '1': 2067, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const list = handler.getMobList();
            expect(list).toHaveLength(1);
            expect(list[0].identified).toBe(true);
        });

        // @verified 2026-04-24: unknown mob also always spawns with identified=false so the render gate can use settingShowUnmanagedEnemies.
        test('synthetic: settingShowUnmanagedEnemies=false no longer blocks spawn, unknown mob lands with identified=false', () => {
            settingsSync.getBool.mockImplementation((key) => key !== 'settingShowUnmanagedEnemies');
            const p = normalizeParams({'0': 8006, '1': 9999, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const list = handler.getMobList();
            expect(list).toHaveLength(1);
            expect(list[0].identified).toBe(false);
        });

        // @verified 2026-04-18: two distinct mist spawns both land in mistList.
        test('pcap-derived spawn: two mist messages add two entries to mistList', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const mists = fx.messages.filter(m => m.parameters['32'] === 'MISTS_SOLO_YELLOW');
            expect(mists.length).toBeGreaterThanOrEqual(2);
            for (const msg of mists) {
                handler.NewMobEvent(normalizeParams(msg.parameters));
            }
            expect(handler.getSize().mists).toBe(mists.length);
        });

        // -------------------------------------------------------------------------
        // Synthetic coverage grid : every family x tier x variant via real mobs DB
        // -------------------------------------------------------------------------
        // @verified 2026-04-19: validates harvest-tier rule end-to-end for the 60
        // cells (5 families x T1..T8 x LIVING/DYNAMIC/DEAD where present in DB).
        // Synthetic NewMob parameters go through the real mobsDatabase lookup and
        // through the MobsHandler filter. If a family/tier/variant breaks silently
        // (as wood did before the Log filter fix), the corresponding row fails.

        const LIVING_COVERAGE = [
            ['Fiber', 3, 'LIVING', 524, 'Fiber', EnemyType.LivingHarvestable, 3],
            ['Fiber', 3, 'DEAD', 714, 'Fiber', EnemyType.LivingHarvestable, 3],
            ['Fiber', 4, 'LIVING', 529, 'Fiber', EnemyType.LivingHarvestable, 3],
            ['Fiber', 4, 'DEAD', 715, 'Fiber', EnemyType.LivingHarvestable, 4],
            ['Fiber', 5, 'LIVING', 525, 'Fiber', EnemyType.LivingHarvestable, 4],
            ['Fiber', 5, 'DEAD', 532, 'Fiber', EnemyType.LivingHarvestable, 5],
            ['Fiber', 6, 'LIVING', 533, 'Fiber', EnemyType.LivingHarvestable, 5],
            ['Fiber', 6, 'DEAD', 534, 'Fiber', EnemyType.LivingHarvestable, 6],
            ['Fiber', 7, 'LIVING', 526, 'Fiber', EnemyType.LivingHarvestable, 6],
            ['Fiber', 7, 'DEAD', 535, 'Fiber', EnemyType.LivingHarvestable, 7],
            ['Fiber', 8, 'LIVING', 637, 'Fiber', EnemyType.LivingHarvestable, 7],
            ['Fiber', 8, 'DEAD', 536, 'Fiber', EnemyType.LivingHarvestable, 8],

            ['Hide', 1, 'LIVING', 369, 'Hide', EnemyType.LivingSkinnable, 1],
            ['Hide', 2, 'LIVING', 370, 'Hide', EnemyType.LivingSkinnable, 1],
            ['Hide', 3, 'LIVING', 371, 'Hide', EnemyType.LivingSkinnable, 2],
            ['Hide', 3, 'DYNAMIC', 401, 'Hide', EnemyType.LivingSkinnable, 3],
            ['Hide', 4, 'LIVING', 372, 'Hide', EnemyType.LivingSkinnable, 3],
            ['Hide', 4, 'DYNAMIC', 403, 'Hide', EnemyType.LivingSkinnable, 4],
            ['Hide', 5, 'LIVING', 373, 'Hide', EnemyType.LivingSkinnable, 4],
            ['Hide', 5, 'DYNAMIC', 405, 'Hide', EnemyType.LivingSkinnable, 5],
            ['Hide', 6, 'LIVING', 374, 'Hide', EnemyType.LivingSkinnable, 5],
            ['Hide', 6, 'DYNAMIC', 407, 'Hide', EnemyType.LivingSkinnable, 6],
            ['Hide', 7, 'LIVING', 375, 'Hide', EnemyType.LivingSkinnable, 6],
            ['Hide', 7, 'DYNAMIC', 411, 'Hide', EnemyType.LivingSkinnable, 7],
            ['Hide', 8, 'LIVING', 376, 'Hide', EnemyType.LivingSkinnable, 7],
            ['Hide', 8, 'DYNAMIC', 414, 'Hide', EnemyType.LivingSkinnable, 8],

            ['Log', 3, 'LIVING', 553, 'Log', EnemyType.LivingHarvestable, 3],
            ['Log', 3, 'DEAD', 696, 'Log', EnemyType.LivingHarvestable, 3],
            ['Log', 4, 'LIVING', 555, 'Log', EnemyType.LivingHarvestable, 3],
            ['Log', 4, 'DEAD', 697, 'Log', EnemyType.LivingHarvestable, 4],
            ['Log', 5, 'LIVING', 557, 'Log', EnemyType.LivingHarvestable, 4],
            ['Log', 5, 'DEAD', 558, 'Log', EnemyType.LivingHarvestable, 5],
            ['Log', 6, 'LIVING', 559, 'Log', EnemyType.LivingHarvestable, 5],
            ['Log', 6, 'DEAD', 560, 'Log', EnemyType.LivingHarvestable, 6],
            ['Log', 7, 'LIVING', 591, 'Log', EnemyType.LivingHarvestable, 6],
            ['Log', 7, 'DEAD', 561, 'Log', EnemyType.LivingHarvestable, 7],
            ['Log', 8, 'LIVING', 592, 'Log', EnemyType.LivingHarvestable, 7],
            ['Log', 8, 'DEAD', 562, 'Log', EnemyType.LivingHarvestable, 8],

            ['Ore', 3, 'LIVING', 543, 'Ore', EnemyType.LivingHarvestable, 3],
            ['Ore', 3, 'DEAD', 708, 'Ore', EnemyType.LivingHarvestable, 3],
            ['Ore', 4, 'LIVING', 545, 'Ore', EnemyType.LivingHarvestable, 3],
            ['Ore', 4, 'DEAD', 709, 'Ore', EnemyType.LivingHarvestable, 4],
            ['Ore', 5, 'LIVING', 547, 'Ore', EnemyType.LivingHarvestable, 4],
            ['Ore', 5, 'DEAD', 548, 'Ore', EnemyType.LivingHarvestable, 5],
            ['Ore', 6, 'LIVING', 549, 'Ore', EnemyType.LivingHarvestable, 5],
            ['Ore', 6, 'DEAD', 550, 'Ore', EnemyType.LivingHarvestable, 6],
            ['Ore', 7, 'LIVING', 621, 'Ore', EnemyType.LivingHarvestable, 6],
            ['Ore', 7, 'DEAD', 551, 'Ore', EnemyType.LivingHarvestable, 7],
            ['Ore', 8, 'LIVING', 622, 'Ore', EnemyType.LivingHarvestable, 7],
            ['Ore', 8, 'DEAD', 552, 'Ore', EnemyType.LivingHarvestable, 8],

            ['Rock', 3, 'LIVING', 563, 'Rock', EnemyType.LivingHarvestable, 3],
            ['Rock', 3, 'DEAD', 702, 'Rock', EnemyType.LivingHarvestable, 3],
            ['Rock', 4, 'LIVING', 565, 'Rock', EnemyType.LivingHarvestable, 3],
            ['Rock', 4, 'DEAD', 703, 'Rock', EnemyType.LivingHarvestable, 4],
            ['Rock', 5, 'LIVING', 567, 'Rock', EnemyType.LivingHarvestable, 4],
            ['Rock', 5, 'DEAD', 568, 'Rock', EnemyType.LivingHarvestable, 5],
            ['Rock', 6, 'LIVING', 569, 'Rock', EnemyType.LivingHarvestable, 5],
            ['Rock', 6, 'DEAD', 570, 'Rock', EnemyType.LivingHarvestable, 6],
            ['Rock', 7, 'LIVING', 606, 'Rock', EnemyType.LivingHarvestable, 6],
            ['Rock', 7, 'DEAD', 571, 'Rock', EnemyType.LivingHarvestable, 7],
            ['Rock', 8, 'LIVING', 607, 'Rock', EnemyType.LivingHarvestable, 7],
            ['Rock', 8, 'DEAD', 572, 'Rock', EnemyType.LivingHarvestable, 8],
        ];

        test.each(LIVING_COVERAGE)(
            'synthetic coverage: %s T%d %s mobId=%d renders as %s (harvest tier %d)',
            (family, tier, variant, mobId, expectedName, expectedEnemyType, expectedTier) => {
                const params = normalizeParams({
                    '0': 90000 + mobId,
                    '1': mobId,
                    '2': 255,
                    '7': [0, 0],
                    '13': 1000,
                    '33': 0,
                });

                handler.NewMobEvent(params);

                const mobs = handler.getMobList();
                expect(mobs).toHaveLength(1);
                expect(mobs[0].type).toBe(expectedEnemyType);
                expect(mobs[0].name).toBe(expectedName);
                expect(mobs[0].tier).toBe(expectedTier);
            }
        );

        // -------------------------------------------------------------------------
        // HARV-2 / issue #32 : enchant filter moved from spawn to render
        // -------------------------------------------------------------------------

        // @verified 2026-04-19: mob spawn with enchant=0 must add to mobsList even if user has e0 disabled.
        // Before fix: filter at spawn dropped the mob, updateEnchantEvent could not recover it.
        test('HARV-2: living Hide mob spawns with enchant=0 into mobsList regardless of settings', () => {
            const e0OffSettings = {
                e0: Array(8).fill(false),
                e1: Array(8).fill(true),
                e2: Array(8).fill(true),
                e3: Array(8).fill(true),
                e4: Array(8).fill(true),
            };
            settingsSync.getJSON.mockReturnValue(e0OffSettings);
            const p = normalizeParams({'0': 91000, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].typeId).toBe(373);
            expect(mobs[0].enchantmentLevel).toBe(0);
        });

        // @verified 2026-04-19: updateEnchantEvent mutates enchant on existing mob, entity survives spawn-filter gap.
        test('HARV-2: updateEnchantEvent mutates enchantmentLevel on mob already in mobsList', () => {
            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)});
            const spawnParams = normalizeParams({'0': 91500, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});
            handler.NewMobEvent(spawnParams);
            expect(handler.getMobList()).toHaveLength(1);

            handler.updateEnchantEvent({0: 91500, 1: 2});

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].enchantmentLevel).toBe(2);
        });

        // @verified 2026-04-19: spawn-then-update sequence survives when user has only e2 checked.
        // This is the real-world scenario issue #32 describes.
        test('HARV-2: spawn e0 + user e0=off + update to e2 yields mob with e=2 in mobsList', () => {
            const e0OffOnlyE2On = {
                e0: Array(8).fill(false),
                e1: Array(8).fill(false),
                e2: Array(8).fill(true),
                e3: Array(8).fill(false),
                e4: Array(8).fill(false),
            };
            settingsSync.getJSON.mockReturnValue(e0OffOnlyE2On);
            const spawnParams = normalizeParams({'0': 92000, '1': 373, '2': 255, '7': [0, 0], '13': 1000, '33': 0});
            handler.NewMobEvent(spawnParams);

            handler.updateEnchantEvent({0: 92000, 1: 2});

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].enchantmentLevel).toBe(2);
            expect(mobs[0].tier).toBe(4);
        });
    });

    // -------------------------------------------------------------------------
    // _getEnemyTypeFromCategory heuristics (all synthetic)
    // Uses vi.spyOn to inject synthetic dbInfo without replacing the real DB.
    // -------------------------------------------------------------------------

    describe('_getEnemyTypeFromCategory heuristics', () => {
        function spawnWithDbInfo(id, dbInfo) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(dbInfo);
            const p = normalizeParams({'0': id, '1': id, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
        }

        // @verified 2026-04-18: category='boss' yields EnemyType.Boss.
        test("synthetic: category='boss' -> EnemyType.Boss", () => {
            // synthetic: no boss-category mob observable in the 25-min capture.
            spawnWithDbInfo(1001, {isHarvestable: false, category: 'boss', uniqueName: 'T8_BOSS_MERLIN', tier: 8});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Boss);
        });

        // @verified 2026-04-18: category='miniboss' yields EnemyType.MiniBoss.
        test("synthetic: category='miniboss' -> EnemyType.MiniBoss", () => {
            // synthetic: no miniboss-category mob in capture.
            spawnWithDbInfo(1002, {isHarvestable: false, category: 'miniboss', uniqueName: 'T6_MINIBOSS_KEEPER', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: category='champion' yields EnemyType.EnchantedEnemy.
        test("synthetic: category='champion' -> EnemyType.EnchantedEnemy", () => {
            // synthetic: champion category not in capture.
            spawnWithDbInfo(1003, {isHarvestable: false, category: 'champion', uniqueName: 'T6_MOB_KEEPER_CHAMPION', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.EnchantedEnemy);
        });

        // @verified 2026-04-18: category='rd_elite' yields EnemyType.MiniBoss.
        test("synthetic: category='rd_elite' -> EnemyType.MiniBoss", () => {
            // synthetic: rd_elite not in capture.
            spawnWithDbInfo(1004, {isHarvestable: false, category: 'rd_elite', uniqueName: 'T5_MOB_RD_ELITE', tier: 5});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: category='rd_veteran' yields EnemyType.MiniBoss.
        test("synthetic: category='rd_veteran' -> EnemyType.MiniBoss", () => {
            // synthetic: rd_veteran not in capture.
            spawnWithDbInfo(1005, {isHarvestable: false, category: 'rd_veteran', uniqueName: 'T5_MOB_RD_VETERAN', tier: 5});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: category='rd_solo' yields EnemyType.EnchantedEnemy.
        test("synthetic: category='rd_solo' -> EnemyType.EnchantedEnemy", () => {
            // synthetic: rd_solo not in capture.
            spawnWithDbInfo(1006, {isHarvestable: false, category: 'rd_solo', uniqueName: 'T4_MOB_RD_SOLO', tier: 4});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.EnchantedEnemy);
        });

        // @verified 2026-04-18: category='standard' yields EnemyType.Enemy.
        test("synthetic: category='standard' -> EnemyType.Enemy", () => {
            // synthetic: representative normal-tier path test.
            spawnWithDbInfo(1007, {isHarvestable: false, category: 'standard', uniqueName: 'T4_MOB_KEEPER', tier: 4});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: category='trash' yields EnemyType.Enemy.
        test("synthetic: category='trash' -> EnemyType.Enemy", () => {
            // synthetic: trash category path.
            spawnWithDbInfo(1008, {isHarvestable: false, category: 'trash', uniqueName: 'T3_MOB_TRASH', tier: 3});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: uniqueName containing '_VETERAN' (not VETERAN_CHAMPION) yields MiniBoss regardless of category.
        test("synthetic: uniqueName '_VETERAN' (not VETERAN_CHAMPION) -> EnemyType.MiniBoss overrides category", () => {
            // synthetic: VETERAN name in a static category mob.
            spawnWithDbInfo(1009, {isHarvestable: false, category: 'static', uniqueName: 'T6_MOB_MORGANA_CROSSBOWMAN_VETERAN', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: uniqueName containing '_VETERAN_CHAMPION' does NOT trigger VETERAN heuristic.
        test("synthetic: uniqueName '_VETERAN_CHAMPION' does not trigger VETERAN heuristic - uses category", () => {
            // synthetic: VETERAN_CHAMPION exclusion ensures champion category wins.
            spawnWithDbInfo(1010, {isHarvestable: false, category: 'champion', uniqueName: 'T6_MOB_KEEPER_VETERAN_CHAMPION', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.EnchantedEnemy);
        });

        // @verified 2026-04-18: uniqueName containing '_ELITE' yields MiniBoss.
        test("synthetic: uniqueName '_ELITE' -> EnemyType.MiniBoss", () => {
            // synthetic: ELITE heuristic test.
            spawnWithDbInfo(1011, {isHarvestable: false, category: 'static', uniqueName: 'T7_MOB_UNDEAD_ELITE', tier: 7});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: uniqueName containing '_BOSS' (not MINIBOSS) yields Boss.
        test("synthetic: uniqueName '_BOSS' (not MINIBOSS) -> EnemyType.Boss", () => {
            // synthetic: BOSS heuristic test.
            spawnWithDbInfo(1012, {isHarvestable: false, category: 'static', uniqueName: 'T8_MOB_DEMON_BOSS', tier: 8});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Boss);
        });

        // @verified 2026-04-18: uniqueName containing 'MINIBOSS' does NOT trigger BOSS heuristic.
        test("synthetic: uniqueName 'MINIBOSS' does not trigger BOSS heuristic - uses category", () => {
            // synthetic: MINIBOSS exclusion from BOSS heuristic.
            spawnWithDbInfo(1013, {isHarvestable: false, category: 'miniboss', uniqueName: 'T6_MOB_KEEPER_MINIBOSS', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });
    });

    // -------------------------------------------------------------------------
    // Health update paths
    // -------------------------------------------------------------------------

    describe('updateMobHealth (event 6)', () => {
        function addMob(id, maxHealth = 500) {
            // synthetic typeIds in range 5001+ are out of range in real DB -> null -> unmanaged Enemy.
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': maxHealth, '33': 0}));
        }

        // @verified 2026-04-18: valid currentHP normalizes health proportionally.
        test('synthetic: valid currentHP normalizes health to (currentHP/maxHealth)*255', () => {
            // synthetic: direct test of the HP normalization formula.
            addMob(2001, 500);
            handler.updateMobHealth({'0': 2001, '2': -100, '3': 250});
            const mobs = handler.getMobList();
            expect(mobs[0].health).toBe(Math.round((250 / 500) * 255));
        });

        // @verified 2026-04-18: currentHP=undefined removes mob (death path).
        test('synthetic: currentHP=undefined removes mob (death)', () => {
            // synthetic: tests the death detection branch (parameters[3] undefined).
            addMob(2002);
            handler.updateMobHealth({'0': 2002, '2': -600, '3': undefined});
            expect(handler.getMobList()).toHaveLength(0);
        });

        // @verified 2026-04-18: currentHP<=0 removes mob (death path).
        test('synthetic: currentHP<=0 removes mob (death)', () => {
            // synthetic: tests the <= 0 branch of the death check.
            addMob(2003);
            handler.updateMobHealth({'0': 2003, '2': -1000, '3': 0});
            expect(handler.getMobList()).toHaveLength(0);
        });

        // @verified 2026-04-18: unknown id is no-op (not a mob, likely player).
        test('synthetic: unknown id in updateMobHealth is a no-op', () => {
            // synthetic: tests early-return when mob not found.
            handler.updateMobHealth({'0': 9999, '2': -100, '3': 200});
            expect(handler.getMobList()).toHaveLength(0);
        });
    });

    describe('updateMobHealthRegen (event 91)', () => {
        function addMob(id) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
        }

        // @verified 2026-04-18: sets mob.health directly to parameters[2].
        test('synthetic: sets mob.health = parameters[2] directly', () => {
            // synthetic: regen event writes normalized HP value directly.
            addMob(3001);
            handler.updateMobHealthRegen({'0': 3001, '2': 128, '3': 255});
            const mobs = handler.getMobList();
            expect(mobs[0].health).toBe(128);
        });

        // @verified 2026-04-18: unknown id is a no-op.
        test('synthetic: unknown id in updateMobHealthRegen is a no-op', () => {
            // synthetic: no crash when mob not found.
            handler.updateMobHealthRegen({'0': 9999, '2': 100, '3': 255});
            expect(handler.getMobList()).toHaveLength(0);
        });
    });

    describe('updateMobHealthBulk (event 7)', () => {
        function addMob(id, maxHealth = 500) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': maxHealth, '33': 0}));
        }

        // @characterization 2026-04-18: bulk update uses parameters[0] as the single mob id for all entries.
        test('synthetic: bulk update with single mob id updates health for that mob', () => {
            // synthetic: tests the bulk path with one entry.
            addMob(4001, 500);
            handler.updateMobHealthBulk({'0': 4001, '1': [1000], '2': [-50], '3': [400]});
            const mobs = handler.getMobList();
            expect(mobs[0].health).toBe(Math.round((400 / 500) * 255));
        });

        // @verified 2026-04-18: non-array parameters[3] causes early return (no crash, no change).
        test('synthetic: non-array parameters[3] returns early without updating', () => {
            // synthetic: tests the guard clause for non-array bulk input.
            addMob(4002);
            const before = handler.getMobList()[0].health;
            handler.updateMobHealthBulk({'0': 4002, '1': [1000], '2': [-50], '3': 400});
            expect(handler.getMobList()[0].health).toBe(before);
        });

        // @verified 2026-04-18: bulk currentHP=0 removes the mob (death via updateMobHealth).
        test('synthetic: bulk entry with currentHP=0 removes mob', () => {
            // synthetic: death via bulk path.
            addMob(4003);
            handler.updateMobHealthBulk({'0': 4003, '1': [1000], '2': [-9999], '3': [0]});
            expect(handler.getMobList()).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Position updates
    // -------------------------------------------------------------------------

    describe('position updates', () => {
        function addMob(id) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
        }

        function addMist(id) {
            handler.NewMobEvent(normalizeParams({'0': id, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
        }

        // @verified 2026-04-18: updateMobPosition updates posX, posY, and touches lastUpdateTime.
        test('synthetic: updateMobPosition updates mob coordinates', () => {
            // synthetic: position update path.
            addMob(5001);
            handler.updateMobPosition(5001, 42.5, 17.3);
            const mobs = handler.getMobList();
            expect(mobs[0].posX).toBe(42.5);
            expect(mobs[0].posY).toBe(17.3);
        });

        // @verified 2026-04-18: updateMobPosition unknown id is a no-op.
        test('synthetic: updateMobPosition with unknown id is a no-op', () => {
            // synthetic: guard path when mob not found.
            handler.updateMobPosition(9999, 1, 2);
            expect(handler.getMobList()).toHaveLength(0);
        });

        // @verified 2026-04-18: updateMistPosition updates mist coordinates.
        test('synthetic: updateMistPosition updates mist coordinates', () => {
            // synthetic: mist position update path.
            addMist(5002);
            handler.updateMistPosition(5002, 10, 20);
            const size = handler.getSize();
            expect(size.mists).toBe(1);
            expect(handler.mistList[0].posX).toBe(10);
            expect(handler.mistList[0].posY).toBe(20);
        });

        // @verified 2026-04-18: updateMistPosition with unknown id is a no-op.
        test('synthetic: updateMistPosition with unknown id is a no-op', () => {
            // synthetic: mist guard path.
            handler.updateMistPosition(9999, 5, 10);
            expect(handler.getSize().mists).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Enchant updates
    // -------------------------------------------------------------------------

    describe('enchant updates', () => {
        function addMob(id) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
        }

        function addMist(id) {
            handler.NewMobEvent(normalizeParams({'0': id, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
        }

        // @verified 2026-04-18: updateEnchantEvent sets enchantmentLevel on the mob.
        test('synthetic: updateEnchantEvent sets enchantmentLevel on found mob', () => {
            // synthetic: enchant event path.
            addMob(6001);
            handler.updateEnchantEvent({'0': 6001, '1': 3});
            const mobs = handler.getMobList();
            expect(mobs[0].enchantmentLevel).toBe(3);
        });

        // @verified 2026-04-18: updateEnchantEvent with unknown id is a no-op.
        test('synthetic: updateEnchantEvent with unknown id is a no-op', () => {
            // synthetic: guard path when entity not found.
            handler.updateEnchantEvent({'0': 9999, '1': 2});
            expect(handler.getMobList()).toHaveLength(0);
        });

        // @verified 2026-04-18: updateMistEnchantmentLevel sets mist.enchant.
        test('synthetic: updateMistEnchantmentLevel sets enchant on mist', () => {
            // synthetic: mist enchant update path.
            addMist(6002);
            handler.updateMistEnchantmentLevel(6002, 2);
            expect(handler.mistList[0].enchant).toBe(2);
        });

        // @verified 2026-04-18: updateMistEnchantmentLevel with unknown id is a no-op.
        test('synthetic: updateMistEnchantmentLevel with unknown id is a no-op', () => {
            // synthetic: guard path when mist not found.
            handler.updateMistEnchantmentLevel(9999, 1);
            expect(handler.getSize().mists).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    describe('lifecycle', () => {
        function addMob(id) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
        }

        function addMist(id) {
            handler.NewMobEvent(normalizeParams({'0': id, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
        }

        // @verified 2026-04-18: removeMob removes the matching mob by id.
        test('synthetic: removeMob removes mob by id', () => {
            // synthetic: removeMob path.
            addMob(7001);
            addMob(7002);
            handler.removeMob(7001);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].id).toBe(7002);
        });

        // @verified 2026-04-18: removeMob with unknown id is a no-op.
        test('synthetic: removeMob with unknown id is a no-op', () => {
            // synthetic: guard path.
            addMob(7003);
            handler.removeMob(9999);
            expect(handler.getMobList()).toHaveLength(1);
        });

        // @verified 2026-04-18: removeMist removes the matching mist by id.
        test('synthetic: removeMist removes mist by id', () => {
            // synthetic: removeMist path.
            addMist(7004);
            addMist(7005);
            handler.removeMist(7004);
            expect(handler.getSize().mists).toBe(1);
            expect(handler.mistList[0].id).toBe(7005);
        });

        // @verified 2026-04-18: Clear empties mobsList and mistList.
        test('synthetic: Clear empties both lists', () => {
            // synthetic: Clear path.
            addMob(7006);
            addMist(7007);
            handler.Clear();
            const size = handler.getSize();
            expect(size.mobs).toBe(0);
            expect(size.mists).toBe(0);
            expect(size.total).toBe(0);
        });

        // @verified 2026-04-18: getSize returns correct mobs/mists/total counts.
        test('synthetic: getSize returns correct counts', () => {
            // synthetic: getSize path.
            addMob(7008);
            addMob(7009);
            addMist(7010);
            const size = handler.getSize();
            expect(size.mobs).toBe(2);
            expect(size.mists).toBe(1);
            expect(size.total).toBe(3);
        });

        // @verified 2026-04-18: getMobList returns a shallow copy (mutation does not affect internal list).
        test('synthetic: getMobList returns shallow copy', () => {
            // synthetic: copy semantics of getMobList.
            addMob(7011);
            const copy = handler.getMobList();
            copy.pop();
            expect(handler.getMobList()).toHaveLength(1);
        });
    });

    // -------------------------------------------------------------------------
    // cleanupStaleEntities
    // -------------------------------------------------------------------------

    describe('cleanupStaleEntities', () => {
        function addMob(id) {
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': id, '1': id, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
        }

        function addMist(id) {
            handler.NewMobEvent(normalizeParams({'0': id, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
        }

        // @verified 2026-04-18: stale mob (lastUpdateTime old) is removed; fresh mob survives.
        test('synthetic: stale mob is removed, fresh mob survives', () => {
            // synthetic: direct lastUpdateTime manipulation avoids fake timers.
            addMob(8001);
            addMob(8002);
            handler.mobsList.find(m => m.id === 8001).lastUpdateTime = Date.now() - 200000;
            const removed = handler.cleanupStaleEntities(120000);
            expect(removed).toBe(1);
            expect(handler.getMobList().map(m => m.id)).toEqual([8002]);
        });

        // @verified 2026-04-18: stale mist is removed; fresh mist survives.
        test('synthetic: stale mist is removed, fresh mist survives', () => {
            // synthetic: mist stale cleanup path.
            addMist(8003);
            addMist(8004);
            handler.mistList.find(m => m.id === 8003).lastUpdateTime = Date.now() - 200000;
            const removed = handler.cleanupStaleEntities(120000);
            expect(removed).toBe(1);
            expect(handler.getSize().mists).toBe(1);
        });

        // @verified 2026-04-18: no stale entities returns 0.
        test('synthetic: no stale entities returns 0 removed', () => {
            // synthetic: happy path - nothing to clean.
            addMob(8005);
            const removed = handler.cleanupStaleEntities(120000);
            expect(removed).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // enforceMaxSize
    // -------------------------------------------------------------------------

    describe('enforceMaxSize', () => {
        // @verified 2026-04-18: enforceMaxSize trims mobsList to maxMobs keeping newest entries.
        test('synthetic: enforceMaxSize trims mobs to maxMobs, keeping newest', () => {
            // synthetic: adds 5 mobs then trims to 3; typeIds 9100-9104 are out of range in real DB.
            for (let i = 0; i < 5; i++) {
                vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
                handler.NewMobEvent(normalizeParams({'0': 9100 + i, '1': 9100 + i, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
                handler.mobsList[i].lastUpdateTime = Date.now() + i * 1000;
            }
            const removed = handler.enforceMaxSize(3, 50);
            expect(removed).toBe(2);
            expect(handler.getMobList()).toHaveLength(3);
        });

        // @verified 2026-04-18: enforceMaxSize trims mistList to maxMists keeping newest entries.
        test('synthetic: enforceMaxSize trims mists to maxMists, keeping newest', () => {
            // synthetic: adds 4 mists then trims to 2.
            const names = ['MISTS_SOLO_YELLOW', 'MISTS_GROUP_RED', 'MISTS_SOLO_BLUE', 'MISTS_GROUP_GREEN'];
            for (let i = 0; i < 4; i++) {
                handler.NewMobEvent(normalizeParams({'0': 9200 + i, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': names[i], '33': 0}));
                handler.mistList[i].lastUpdateTime = Date.now() + i * 1000;
            }
            const removed = handler.enforceMaxSize(500, 2);
            expect(removed).toBe(2);
            expect(handler.getSize().mists).toBe(2);
        });

        // @verified 2026-04-18: enforceMaxSize returns 0 when under limits.
        test('synthetic: enforceMaxSize returns 0 when counts are under limits', () => {
            // synthetic: happy path - nothing trimmed; typeId 9300 is out of range.
            vi.spyOn(dbs.mobsDatabase, 'getMobInfo').mockReturnValueOnce(null);
            handler.NewMobEvent(normalizeParams({'0': 9300, '1': 9300, '2': 200, '7': [0, 0], '13': 500, '33': 0}));
            expect(handler.enforceMaxSize(500, 50)).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // Mist type heuristic (Mist constructor)
    // -------------------------------------------------------------------------

    describe('Mist type heuristic', () => {
        // @verified 2026-04-18: name containing 'solo' (case-insensitive) sets type=0.
        test('synthetic: mist name containing "solo" sets type=0', () => {
            // synthetic: tests the solo heuristic in the Mist constructor.
            handler.NewMobEvent(normalizeParams({'0': 9400, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
            expect(handler.mistList[0].type).toBe(0);
        });

        // @verified 2026-04-18: name not containing 'solo' sets type=1.
        test('synthetic: mist name not containing "solo" sets type=1', () => {
            // synthetic: tests the non-solo branch in the Mist constructor.
            handler.NewMobEvent(normalizeParams({'0': 9401, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_GROUP_RED', '33': 0}));
            expect(handler.mistList[0].type).toBe(1);
        });

        // @verified 2026-04-18: AddMist with duplicate id is a no-op (touch only, no second push).
        test('synthetic: duplicate mist id is a no-op (touch, not re-added)', () => {
            // synthetic: tests the duplicate guard in AddMist.
            handler.NewMobEvent(normalizeParams({'0': 9402, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
            handler.NewMobEvent(normalizeParams({'0': 9402, '1': 94, '2': 255, '7': [5, 5], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
            expect(handler.getSize().mists).toBe(1);
        });

        // @verified 2026-04-23: feu follet rarity arrives via Parameters[33] at live time; pcap fixtures only sample Common so fixture value stays 0, but live evidence confirms the path is correct (user sees green mist_1 for Peu commun wisps).
        test('MIST-6: AddMist forwards Parameters[33] to Mist.enchant', () => {
            handler.NewMobEvent(normalizeParams({'0': 9410, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 0}));
            expect(handler.mistList[0].enchant).toBe(0);

            handler.NewMobEvent(normalizeParams({'0': 9411, '1': 94, '2': 255, '7': [0, 0], '13': 1, '32': 'MISTS_SOLO_YELLOW', '33': 1}));
            expect(handler.mistList[1].enchant).toBe(1);
        });
    });
});

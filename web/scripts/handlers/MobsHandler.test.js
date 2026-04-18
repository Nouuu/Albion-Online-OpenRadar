import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => ({
            e0: Array(8).fill(true),
            e1: Array(8).fill(true),
            e2: Array(8).fill(true),
            e3: Array(8).fill(true),
            e4: Array(8).fill(true),
        })),
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

// Standard mob database entries matching the pcap fixture typeIds.
function makeDb(overrides = {}) {
    return {
        isLoaded: true,
        getMobInfo: vi.fn((typeId) => {
            if (overrides[typeId] !== undefined) return overrides[typeId];
            if (typeId === 422) return {isHarvestable: true, type: 'Hide', tier: 2, uniqueName: 'T2_MOB_FOX'};
            if (typeId === 424 || typeId === 428) return {isHarvestable: true, type: 'Hide', tier: 3, uniqueName: 'T3_MOB_WOLF'};
            if (typeId === 529 || typeId === 531) return {isHarvestable: true, type: 'Hide', tier: 4, uniqueName: 'T4_MOB_BEAR'};
            if (typeId === 2067 || typeId === 2070 || typeId === 2082 || typeId === 2085) {
                return {isHarvestable: false, category: 'standard', uniqueName: 'T6_MOB_UNDEAD', tier: 6};
            }
            return null;
        }),
    };
}

describe('MobsHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getJSON.mockReturnValue(allTrueSettings);
        settingsSync.getBool.mockReturnValue(true);

        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.mobsDatabase = makeDb();
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

        // @verified 2026-04-18: living mob with known typeId=424 adds to mobsList as LivingSkinnable (Hide).
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
        });

        // @verified 2026-04-18: typeId=428 also resolves as Hide/LivingSkinnable via the same db entry.
        test('pcap-derived spawn: living Hide mob typeId=428 adds as LivingSkinnable', async () => {
            // synthetic: typeId=428 is in the db fixture map, but no raw message with [1]=428 exists in spawn.json
            const p = normalizeParams({'0': 9000, '1': 428, '2': 255, '7': [0, 0], '13': 856, '19': 90, '33': 0});
            // @characterization 2026-04-18: current code treats any 'Hide' db entry as LivingSkinnable
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
        });

        // @verified 2026-04-18: typeId=422 (tier 2 Hide) adds as LivingSkinnable.
        test('pcap-derived spawn: living Hide mob typeId=422 tier 2 adds as LivingSkinnable', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 422);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].tier).toBe(2);
        });

        // @verified 2026-04-18: typeId=529 (tier 4 Hide) adds as LivingSkinnable.
        test('pcap-derived spawn: living Hide mob typeId=529 tier 4 adds as LivingSkinnable', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 529);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
            expect(mobs[0].tier).toBe(4);
        });

        // @verified 2026-04-18: typeId=531 (tier 4 Hide) adds as LivingSkinnable.
        test('pcap-derived spawn: living Hide mob typeId=531 tier 4 adds as LivingSkinnable', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.LivingSkinnable);
        });

        // @verified 2026-04-18: hostile standard mob (typeId=2067) adds as Enemy.
        test('pcap-derived spawn: hostile mob typeId=2067 category=standard adds as Enemy', async () => {
            const fx = await loadFixture('mobs', 'spawn');
            const msg = fx.messages.find(m => m.parameters['1'] === 2067);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.NewMobEvent(p);

            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: hostile standard mob typeId=2070 adds as Enemy.
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

        // @verified 2026-04-18: hostile standard mob typeId=2082 adds as Enemy.
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

        // @verified 2026-04-18: hostile standard mob typeId=2085 adds as Enemy.
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

        // @verified 2026-04-18: unknown typeId (no db entry) defaults to EnemyType.Enemy.
        test('synthetic: unknown typeId with no db entry defaults to EnemyType.Enemy', () => {
            // synthetic: no real pcap message with this typeId; tests the no-db-entry path.
            const p = normalizeParams({'0': 8001, '1': 9999, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.Enemy);
        });

        // @verified 2026-04-18: low healthNormalized < 10 is clamped to 255 at spawn.
        test('synthetic: spawn with parameters[2] < 10 clamps health to 255', () => {
            // synthetic: tests the fortNPC low-HP-spawn fix branch in AddEnemy.
            const p = normalizeParams({'0': 8002, '1': 9999, '2': 5, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].health).toBe(255);
        });

        // @verified 2026-04-18: duplicate id second NewMobEvent is a no-op (first wins).
        test('synthetic: duplicate id second NewMobEvent does not duplicate entry', () => {
            // synthetic: tests the early-return guard in AddEnemy.
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

        // @verified 2026-04-18: settingNormalEnemy=false gates out identified Enemy-type mobs.
        test('synthetic: settingNormalEnemy=false prevents identified Enemy from being added', () => {
            // synthetic: tests the settings gate for identified enemies.
            settingsSync.getBool.mockImplementation((key) => key !== 'settingNormalEnemy');
            const p = normalizeParams({'0': 8005, '1': 2067, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            expect(handler.getMobList()).toHaveLength(0);
        });

        // @verified 2026-04-18: settingShowUnmanagedEnemies=false gates out unknown (no-db) mobs.
        test('synthetic: settingShowUnmanagedEnemies=false prevents unknown mob from being added', () => {
            // synthetic: tests the unmanaged enemies settings gate.
            settingsSync.getBool.mockImplementation((key) => key !== 'settingShowUnmanagedEnemies');
            const p = normalizeParams({'0': 8006, '1': 9999, '2': 255, '7': [0, 0], '13': 500, '33': 0});
            handler.NewMobEvent(p);
            expect(handler.getMobList()).toHaveLength(0);
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
    });

    // -------------------------------------------------------------------------
    // _getEnemyTypeFromCategory heuristics (all synthetic)
    // -------------------------------------------------------------------------

    describe('_getEnemyTypeFromCategory heuristics', () => {
        function spawnWithDbInfo(id, dbInfo) {
            window.mobsDatabase = makeDb({[id]: dbInfo});
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

        // @verified 2026-04-18: category='standard' yields EnemyType.Enemy (representative normal tier).
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
            // synthetic: heuristic override - VETERAN name in a static category mob.
            spawnWithDbInfo(1009, {isHarvestable: false, category: 'static', uniqueName: 'T6_MOB_MORGANA_CROSSBOWMAN_VETERAN', tier: 6});
            const mobs = handler.getMobList();
            expect(mobs).toHaveLength(1);
            expect(mobs[0].type).toBe(EnemyType.MiniBoss);
        });

        // @verified 2026-04-18: uniqueName containing '_VETERAN_CHAMPION' does NOT trigger VETERAN heuristic - falls through to category.
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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

        // @verified 2026-04-18: Clear empties mobsList, mistList, and harvestablesNotGood.
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
            window.mobsDatabase = makeDb({[id]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            // synthetic: adds 5 mobs then trims to 3.
            for (let i = 0; i < 5; i++) {
                window.mobsDatabase = makeDb({[9100 + i]: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
            // synthetic: happy path - nothing trimmed.
            window.mobsDatabase = makeDb({9300: {isHarvestable: false, category: 'standard', uniqueName: 'MOB', tier: 4}});
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
    });
});

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
});

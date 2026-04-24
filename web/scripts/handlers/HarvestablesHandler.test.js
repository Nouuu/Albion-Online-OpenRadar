import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

// pcap-derived: fixture corpus from 25-minute anonymized capture
// synthetic: constructed parameters with no pcap origin

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(),
        getNumber: vi.fn((_k, d) => d),
    },
}));

const {HarvestablesHandler} = await import('./HarvestablesHandler.js');
const {MobsHandler} = await import('./MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

const allTrueSettings = {
    e0: Array(8).fill(true),
    e1: Array(8).fill(true),
    e2: Array(8).fill(true),
    e3: Array(8).fill(true),
    e4: Array(8).fill(true),
};

function withE0Off() {
    return {
        e0: Array(8).fill(false),
        e1: Array(8).fill(true),
        e2: Array(8).fill(true),
        e3: Array(8).fill(true),
        e4: Array(8).fill(true),
    };
}

const allFalseSettings = {
    e0: Array(8).fill(false),
    e1: Array(8).fill(false),
    e2: Array(8).fill(false),
    e3: Array(8).fill(false),
    e4: Array(8).fill(false),
};

describe('HarvestablesHandler', () => {
    let handler;
    let dbs;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        dbs = installRealDatabasesOnWindow();
        settingsSync.getJSON.mockReturnValue(allTrueSettings);
        settingsSync.getBool.mockReturnValue(true);
        handler = new HarvestablesHandler(null);
    });

    describe('newHarvestableObject (event 40)', () => {
        // @verified 2026-04-18: server Parameters[7]=3 and real DB lt=3 both agree for mobId=424.
        test('pcap-derived single-spawn: Hide toad mobId=424 stores tier 3 matching server and DB', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 424);
            expect(msg, 'fixture should contain mobId=424').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].tier).toBe(3);
            expect(list[0].stringType).toBe('Hide');
        });

        // @verified 2026-04-18: server Parameters[7]=5 and real DB lt=5 both agree for mobId=428.
        test('pcap-derived single-spawn: Hide snake mobId=428 stores tier 5 matching server and DB', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 428);
            expect(msg, 'fixture should contain mobId=428').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].tier).toBe(5);
            expect(list[0].stringType).toBe('Hide');
        });

        // @verified 2026-04-18: static Fiber typeNumber=14, tier=5, enchant=1; real DB maps typeNumber 14 to FIBER.
        test('pcap-derived single-spawn: static Fiber tier=5 enchant=1 stored with stringType Fiber', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['5'] === 14 && m.parameters['7'] === 5);
            expect(msg, 'fixture should contain static Fiber tier=5').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].tier).toBe(5);
            expect(list[0].charges).toBe(1);
            expect(list[0].stringType).toBe('Fiber');
        });

        // @verified 2026-04-18: static Log typeNumber=0, tier=4, enchant=2; real DB maps typeNumber 0 to WOOD.
        test('pcap-derived single-spawn: static Log tier=4 enchant=2 stored with stringType Log', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['5'] === 0 && m.parameters['7'] === 4);
            expect(msg, 'fixture should contain static Log tier=4').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].stringType).toBe('Log');
            expect(list[0].tier).toBe(4);
        });

        // @verified 2026-04-18: living Hide mob=424, mobileTypeId routed through real MobsDB.getResourceInfo.
        test('pcap-derived single-spawn: living Hide mob=424 stringType from real MobsDB', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 424);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);
            const spy = vi.spyOn(dbs.mobsDatabase, 'getResourceInfo');

            handler.newHarvestableObject(p[0], p);

            expect(spy).toHaveBeenCalledWith(424);
            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].stringType).toBe('Hide');
        });

        // @verified 2026-04-18: living Hide mob=531, server tier=4 stored from Parameters[7].
        test('pcap-derived single-spawn: living Fiber critter mob=531 id stored correctly', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].id).toBe(p[0]);
            expect(list[0].tier).toBe(4);
        });

        // @verified 2026-04-18: living Hide mob=428 tier=5 enchant=0 spawns; charges=0 from Parameters[11]=0.
        test('pcap-derived single-spawn: living Hide mob=428 tier=5 enchant=0 spawns', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 428);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].tier).toBe(5);
            expect(list[0].charges).toBe(0);
        });

        // @verified 2026-04-18: static Fiber tier=4 enchant=1 size stored from Parameters[10].
        test('pcap-derived single-spawn: static Fiber tier=4 enchant=1 size stored from param[10]', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['5'] === 14 && m.parameters['7'] === 4 && m.parameters['6'] === -1);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].size).toBe(p[10]);
        });

        // @verified 2026-04-18: spawning same id twice updates charges and does not duplicate.
        test('pcap-derived single-spawn: same id spawned twice updates, does not duplicate', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const first = fx.messages.find(m => m.parameters['6'] === 529);
            expect(first).toBeDefined();
            const p = normalizeParams(first.parameters);

            handler.newHarvestableObject(p[0], p);
            expect(handler.getSize()).toBe(1);

            const updated = {...p, 11: 2};
            handler.newHarvestableObject(p[0], updated);

            expect(handler.getSize()).toBe(1);
            expect(handler.getHarvestableList()[0].charges).toBe(2);
        });

        // @verified 2026-04-24: HARV-4, spawn-time filter removed; entities always land in the list.
        // Render-time filter (HarvestablesDrawing) is now the only gate so checkbox toggles are instant.
        test('HARV-4: settings off for tier/enchant no longer blocks spawn, entity lands in list', () => {
            settingsSync.getJSON.mockReturnValue(allFalseSettings);

            const p = {
                0: 9999, 5: 14, 6: -1, 7: 4,
                8: [-307.5, 59.5], 10: 3, 11: 1
            };

            handler.newHarvestableObject(p[0], p);

            expect(handler.getHarvestableList()).toHaveLength(1);
            expect(handler.getHarvestableList()[0].id).toBe(9999);
        });

        // @verified 2026-04-18: Parameters[11] undefined defaults charges to 0.
        test('synthetic: missing Parameters[11] defaults charges to 0', () => {
            const p = {
                0: 1001, 5: 14, 6: -1, 7: 4,
                8: [-307.5, 59.5], 10: 3
            };

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].charges).toBe(0);
        });

        // @verified 2026-04-18: Parameters[10] undefined defaults size to 0.
        test('synthetic: missing Parameters[10] defaults size to 0', () => {
            const p = {
                0: 1002, 5: 14, 6: -1, 7: 4,
                8: [-307.5, 59.5], 11: 1
            };

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].size).toBe(0);
        });

        // @verified 2026-04-18: posX and posY are read from Parameters[8][0] and [8][1].
        test('synthetic: posX posY extracted from Parameters[8] array', () => {
            const p = {
                0: 1003, 5: 14, 6: -1, 7: 4,
                8: [-111.5, 222.5], 10: 2, 11: 0
            };

            handler.newHarvestableObject(p[0], p);

            const e = handler.getHarvestableList()[0];
            expect(e.posX).toBe(-111.5);
            expect(e.posY).toBe(222.5);
        });
    });

    describe('newHarvestableObject tier divergence (event 40)', () => {
        // @characterization 2026-04-18: HarvestablesHandler stores Parameters[7]=3 for mobId=529;
        // MobsHandler stores dbInfo.tier=4 from real MobsDB for the same creature.
        // Divergence pending #58 overlay to resolve ground truth.
        test('characterization: Fiber critter mobId=529 HarvestablesHandler stores server tier (3), not DB tier (4)', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 529);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const harv = handler.getHarvestableList()[0];
            expect(harv).toBeDefined();
            expect(harv.tier).toBe(3);
        });

        // @characterization 2026-04-18: HarvestablesHandler stores Parameters[7]=4 for mobId=531;
        // MobsHandler stores dbInfo.tier=5 from real MobsDB for the same creature.
        // Divergence pending #58 overlay to resolve ground truth.
        test('characterization: Fiber critter mobId=531 HarvestablesHandler stores server tier (4), not DB tier (5)', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const harv = handler.getHarvestableList()[0];
            expect(harv).toBeDefined();
            expect(harv.tier).toBe(4);
        });

        // @verified 2026-04-19: MobsHandler and HarvestablesHandler converge on harvest tier for Fiber critter mobId=529.
        // MobsHandler uses getLivingHarvestTier rule (max(3, 4-1) = 3); HarvestablesHandler uses server Parameters[7]=3.
        test('MobsHandler and HarvestablesHandler agree on harvest tier 3 for Fiber critter mobId=529', async () => {
            const mobsHandler = new MobsHandler();

            const mobParams = {
                0: 8403,
                1: 529,
                2: 255,
                7: [-358.25, 15.5],
                13: 1000,
                33: 0
            };
            mobsHandler.NewMobEvent(mobParams);

            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 529);
            const p = normalizeParams(msg.parameters);
            handler.newHarvestableObject(p[0], p);

            const mob = mobsHandler.mobsList.find(m => m.id === 8403);
            const harv = handler.getHarvestableList()[0];
            expect(mob).toBeDefined();
            expect(harv).toBeDefined();
            expect(mob.tier).toBe(3);
            expect(harv.tier).toBe(3);
            expect(mob.tier).toBe(harv.tier);
        });

        // @verified 2026-04-19: MobsHandler and HarvestablesHandler converge on harvest tier for Fiber critter mobId=531.
        // MobsHandler uses getLivingHarvestTier rule (max(3, 5-1) = 4); HarvestablesHandler uses server Parameters[7]=4.
        test('MobsHandler and HarvestablesHandler agree on harvest tier 4 for Fiber critter mobId=531', async () => {
            const mobsHandler = new MobsHandler();

            const mobParams = {
                0: 9358,
                1: 531,
                2: 255,
                7: [-364.47, 194.42],
                13: 1000,
                33: 0
            };
            mobsHandler.NewMobEvent(mobParams);

            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            const p = normalizeParams(msg.parameters);
            handler.newHarvestableObject(p[0], p);

            const mob = mobsHandler.mobsList.find(m => m.id === 9358);
            const harv = handler.getHarvestableList()[0];
            expect(mob).toBeDefined();
            expect(harv).toBeDefined();
            expect(mob.tier).toBe(4);
            expect(harv.tier).toBe(4);
            expect(mob.tier).toBe(harv.tier);
        });
    });

    describe('newHarvestableObject pinned bugs', () => {
        // @verified 2026-04-19: mobileTypeId=-1 sentinel routes as static and skips the mobsDatabase lookup.
        test('pcap-derived single-spawn: static with mobileTypeId=-1 does not trigger mobsDatabase lookup', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === -1);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);
            const spy = vi.spyOn(dbs.mobsDatabase, 'getResourceInfo');

            handler.newHarvestableObject(p[0], p);

            expect(spy).not.toHaveBeenCalledWith(-1);
        });

        // @verified 2026-04-19: living Fiber/Hide with e0 off appears after event 46 enchant update (#32 fix).
        test('issue #30/#32: living Fiber with e0 off appears after event 46 enchant update to e=2', async () => {
            settingsSync.getJSON.mockImplementation(key => {
                if (key === 'settingLivingFiberEnchants') return withE0Off();
                return allTrueSettings;
            });

            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 529);
            const p = normalizeParams(msg.parameters);
            const pWithE0 = {...p, 11: 0};

            handler.newHarvestableObject(p[0], pWithE0);
            handler.HarvestUpdateEvent({0: p[0], 1: p[10] ?? 3, 2: 2});

            const stored = handler.getHarvestableList().find(h => h.id === p[0]);
            expect(stored).toBeDefined();
            expect(stored.charges).toBe(2);
        });

        // @verified 2026-04-19: event 46 re-gate uses stored stringType + mobileTypeId; a living Fiber
        // is no longer dropped when static Hide settings are disabled because the re-gate consults the
        // living Fiber settings instead.
        test('HarvestUpdateEvent preserves living Fiber when static settings are all disabled', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 529);
            const p = normalizeParams(msg.parameters);
            handler.newHarvestableObject(p[0], p);
            expect(handler.getHarvestableList().find(h => h.id === p[0])).toBeDefined();

            // Static-only disablement: Static* keys false, Living* keys unchanged (all true).
            settingsSync.getJSON.mockImplementation(key =>
                typeof key === 'string' && key.startsWith('settingStatic') ? allFalseSettings : allTrueSettings
            );

            handler.HarvestUpdateEvent({0: p[0], 1: p[10] ?? 3, 2: 2});

            expect(handler.getHarvestableList().find(h => h.id === p[0])).toBeDefined();
        });

        // @verified 2026-04-19: contract test, addHarvestable without mobileTypeId stores null.
        test('synthetic contract: Harvestable defaults mobileTypeId to null when omitted', () => {
            handler.addHarvestable(9001, 0, 4, 10, 20, 0, 3);
            const stored = handler.getHarvestableList().find(e => e.id === 9001);
            expect(stored).toBeDefined();
            expect(stored.mobileTypeId).toBeNull();
        });

        // @verified 2026-04-19: living harvestable spawn with charges=0 stays in list when e0 setting is off (#32).
        // Before fix: shouldDisplayHarvestable dropped it at spawn, event 46 could not recover.
        test('HARV-2: living fiber spawn with charges=0 is kept in list even when e0 setting is off', async () => {
            settingsSync.getJSON.mockImplementation(key => {
                if (key === 'settingLivingFiberEnchants') {
                    return {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
                }
                return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            });

            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);
            p[11] = 0;

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].charges).toBe(0);
        });

        // @verified 2026-04-19: HarvestUpdateEvent mutates charges without removing entity even when new enchant setting is off (#32).
        test('HARV-2: HarvestUpdateEvent mutates charges without removing entity when setting for new enchant is off', async () => {
            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)});
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 531);
            const p = normalizeParams(msg.parameters);
            p[11] = 0;
            handler.newHarvestableObject(p[0], p);
            expect(handler.getHarvestableList()).toHaveLength(1);

            settingsSync.getJSON.mockReturnValue({e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(false), e3: Array(8).fill(true), e4: Array(8).fill(true)});

            handler.HarvestUpdateEvent({0: p[0], 1: 5, 2: 2});

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].charges).toBe(2);
        });

        // @verified 2026-04-24: HARV-4, carcass with mobileTypeId!=null no longer filtered at spawn.
        // The former isLiving=true early-return is gone; Hide carcasses always land in the list and
        // the static filter at HarvestablesDrawing decides visibility.
        test('HARV-4: Hide carcass mobileTypeId=424 spawns with all static settings off still lands in list', async () => {
            settingsSync.getJSON.mockReturnValue(allFalseSettings);
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 424);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const stored = handler.getHarvestableList().find(h => h.id === p[0]);
            expect(stored).toBeDefined();
            expect(stored.mobileTypeId).toBe(424);
        });

        // @verified 2026-04-24: HARV-4, batch-spawn (event 38) also bypasses settings filter at spawn.
        test('HARV-4: newSimpleHarvestableObject batch ignores settings at spawn, all entities land in list', async () => {
            settingsSync.getJSON.mockReturnValue(allFalseSettings);
            const fx = await loadFixture('harvestables', 'batch-spawn');
            const p = normalizeParams(fx.messages[0].parameters);
            const ids = p[0];

            handler.newSimpleHarvestableObject(p);

            expect(handler.getHarvestableList()).toHaveLength(ids.length);
        });

        // @verified 2026-04-24: HARV-4, UpdateHarvestable path also ignores settings at spawn.
        test('HARV-4: UpdateHarvestable on new id with all settings off still creates entity', () => {
            settingsSync.getJSON.mockReturnValue(allFalseSettings);

            handler.UpdateHarvestable(7777, 14, 4, 10, 20, 1, 3, -1);

            const stored = handler.getHarvestableList().find(h => h.id === 7777);
            expect(stored).toBeDefined();
            expect(stored.charges).toBe(1);
        });

        // @verified 2026-04-19: pcap-composed regression, static resource re-gate still keeps the entity
        // when its static settings are enabled. Ensures the stored-value refactor did not break the
        // static path, which was working before HARV-3.
        test('pcap-composed: static resource enchant re-gate keeps entity with static settings enabled', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['0'] === 3203);
            expect(msg, 'fixture should contain static id=3203').toBeDefined();
            const p = normalizeParams(msg.parameters);
            handler.newHarvestableObject(p[0], p);
            const spawned = handler.getHarvestableList().find(h => h.id === 3203);
            expect(spawned).toBeDefined();
            expect(spawned.mobileTypeId).toBe(-1);

            // Force an enchant change distinct from spawn enchant (p[11]=2) to trigger the re-gate.
            handler.HarvestUpdateEvent({0: 3203, 1: p[10] ?? 1, 2: 3});

            const stored = handler.getHarvestableList().find(h => h.id === 3203);
            expect(stored).toBeDefined();
            expect(stored.charges).toBe(3);
        });
    });

    describe('newSimpleHarvestableObject (event 38/39) batch path', () => {
        // @verified 2026-04-18: all entities from the first batch message land in the list with enchant=0.
        test('pcap-derived batch-spawn: first batch message adds all entities with enchant=0', async () => {
            const fx = await loadFixture('harvestables', 'batch-spawn');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);
            const ids = p[0];

            handler.newSimpleHarvestableObject(p);

            const list = handler.getHarvestableList();
            expect(list.length).toBe(ids.length);
            list.forEach(e => expect(e.charges).toBe(0));
        });

        // @verified 2026-04-18: Buffer-shaped parameters unwrap via ["data"] and ids are recorded correctly.
        test('pcap-derived batch-spawn: Buffer-shaped Parameters[1]/[2]/[4] unwrap correctly', async () => {
            const fx = await loadFixture('harvestables', 'batch-spawn');
            const p = normalizeParams(fx.messages[0].parameters);
            const firstId = p[0][0];

            handler.newSimpleHarvestableObject(p);

            const found = handler.getHarvestableList().find(e => e.id === firstId);
            expect(found).toBeDefined();
        });

        // @verified 2026-04-18: second batch message adds its 8 entities.
        test('pcap-derived batch-spawn: second batch message adds its entities', async () => {
            const fx = await loadFixture('harvestables', 'batch-spawn');
            const p = normalizeParams(fx.messages[1].parameters);

            handler.newSimpleHarvestableObject(p);

            expect(handler.getSize()).toBe(8);
        });

        // @verified 2026-04-18: third batch message adds its 4 entities.
        test('pcap-derived batch-spawn: third batch message adds its entities', async () => {
            const fx = await loadFixture('harvestables', 'batch-spawn');
            const p = normalizeParams(fx.messages[2].parameters);

            handler.newSimpleHarvestableObject(p);

            expect(handler.getSize()).toBe(4);
        });

        // @verified 2026-04-18: missing Parameters[0] causes early return, nothing is added.
        test('synthetic: missing Parameters[0] causes early return, list empty', () => {
            const p = {
                1: {type: 'Buffer', data: [14]},
                2: {type: 'Buffer', data: [4]},
                3: [-307.5, 59.5],
                4: {type: 'Buffer', data: [2]},
            };

            handler.newSimpleHarvestableObject(p);

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: empty Parameters[0] array causes early return after unwrap.
        test('synthetic: empty Parameters[0] array causes early return', () => {
            const p = {
                0: [],
                1: {type: 'Buffer', data: []},
                2: {type: 'Buffer', data: []},
                3: [],
                4: {type: 'Buffer', data: []},
            };

            handler.newSimpleHarvestableObject(p);

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: plain array Parameters (no Buffer wrapper) also accepted.
        test('synthetic: plain array Parameters (no Buffer wrapper) accepted', () => {
            const p = {
                0: [5001, 5002],
                1: [14, 14],
                2: [4, 5],
                3: [-100, -200, -110, -210],
                4: [2, 3],
            };

            handler.newSimpleHarvestableObject(p);

            expect(handler.getSize()).toBe(2);
        });
    });

    describe('HarvestUpdateEvent (event 46)', () => {
        function seedHarvestable(id, size = 3, charges = 0) {
            const p = {
                0: id, 5: 14, 6: -1, 7: 4,
                8: [-307.5, 59.5], 10: size, 11: charges
            };
            handler.newHarvestableObject(id, p);
        }

        // @verified 2026-04-18: size update on existing entity changes size field and refreshes lastUpdateTime.
        test('pcap-derived state-update: size change on existing entity updates size', async () => {
            const fx = await loadFixture('harvestables', 'state-update');
            const msg = fx.messages.find(m => m.parameters['1'] === 3);
            const p = normalizeParams(msg.parameters);
            const id = p[0];
            seedHarvestable(id, 5);

            const before = handler.getHarvestableList().find(e => e.id === id).lastUpdateTime;
            handler.HarvestUpdateEvent(p);

            const e = handler.getHarvestableList().find(h => h.id === id);
            expect(e).toBeDefined();
            expect(e.size).toBe(3);
            expect(e.lastUpdateTime).toBeGreaterThanOrEqual(before);
        });

        // @verified 2026-04-18: newSize=0 (not undefined) keeps entity but sets size to 0.
        test('pcap-derived state-update: newSize=0 keeps entity in list with size 0', async () => {
            const fx = await loadFixture('harvestables', 'state-update');
            const msg = fx.messages.find(m => m.parameters['1'] === 0 && m.parameters['2'] === 0);
            const p = normalizeParams(msg.parameters);
            seedHarvestable(p[0], 2);

            handler.HarvestUpdateEvent(p);

            const e = handler.getHarvestableList().find(h => h.id === p[0]);
            expect(e).toBeDefined();
            expect(e.size).toBe(0);
        });

        // @verified 2026-04-18: enchant change on existing entity updates charges field.
        test('pcap-derived state-update: enchant change updates charges', async () => {
            const fx = await loadFixture('harvestables', 'state-update');
            const msg = fx.messages.find(m => m.parameters['2'] === 2);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);
            seedHarvestable(p[0], 3, 0);

            handler.HarvestUpdateEvent(p);

            const e = handler.getHarvestableList().find(h => h.id === p[0]);
            expect(e).toBeDefined();
            expect(e.charges).toBe(2);
        });

        // @verified 2026-04-24: post-enchant re-gate removed in #32 fix; entity is never dropped
        // by HarvestUpdateEvent on enchant change. Filter is applied at render time instead.
        test('synthetic: enchant update does not remove entity even when settings block new enchant', () => {
            seedHarvestable(9001, 3, 0);
            settingsSync.getJSON.mockReturnValue(allFalseSettings);

            handler.HarvestUpdateEvent({0: 9001, 1: 2, 2: 1});

            expect(handler.getSize()).toBe(1);
        });

        // @verified 2026-04-18: newSize===undefined triggers removal of the entity.
        test('synthetic: newSize undefined (depletion) removes entity from list', () => {
            seedHarvestable(9002, 2);

            handler.HarvestUpdateEvent({0: 9002, 1: undefined, 2: 0});

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: unknown id is a no-op, no throw, list unchanged.
        test('synthetic: unknown id is no-op', () => {
            seedHarvestable(9003, 1);

            handler.HarvestUpdateEvent({0: 99999, 1: 0, 2: 0});

            expect(handler.getSize()).toBe(1);
        });

        // @verified 2026-04-18: consecutive size decrements from corpus simulate multi-harvest sequence.
        test('pcap-derived state-update: consecutive decrements on same id reflect each size', async () => {
            const fx = await loadFixture('harvestables', 'state-update');
            const msgs = fx.messages.filter(m => m.parameters['0'] === 2525);
            expect(msgs.length).toBeGreaterThanOrEqual(2);
            seedHarvestable(2525, 4);

            for (const m of msgs) {
                handler.HarvestUpdateEvent(normalizeParams(m.parameters));
            }

            const e = handler.getHarvestableList().find(h => h.id === 2525);
            const lastSize = normalizeParams(msgs[msgs.length - 1].parameters)[1];
            if (lastSize === undefined) {
                expect(e).toBeUndefined();
            } else {
                expect(e).toBeDefined();
                expect(e.size).toBe(lastSize);
            }
        });
    });

    describe('harvestFinished (event 61)', () => {
        // @characterization 2026-04-18: current code logs the id but makes no state change;
        // spec-intent ambiguous from code alone.
        test('pcap-derived finished: harvestFinished makes no state change', async () => {
            const fx = await loadFixture('harvestables', 'finished');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);

            const p40 = {
                0: p[3], 5: 14, 6: -1, 7: 4,
                8: [-307.5, 59.5], 10: 3, 11: 0
            };
            handler.newHarvestableObject(p[3], p40);
            expect(handler.getSize()).toBe(1);

            handler.harvestFinished(p);

            expect(handler.getSize()).toBe(1);
        });

        // @characterization 2026-04-18: harvestFinished logs Event61_HarvestFinished with id from Parameters[3].
        test('pcap-derived finished: harvestFinished logs id from Parameters[3]', async () => {
            const fx = await loadFixture('harvestables', 'finished');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);

            handler.harvestFinished(p);

            expect(window.logger.debug).toHaveBeenCalledWith(
                expect.anything(),
                'Event61_HarvestFinished',
                {id: p[3]}
            );
        });
    });

    describe('removeHarvestable', () => {
        // @verified 2026-04-18: removes the entity with the matching id.
        test('synthetic: removeHarvestable removes entity by id', () => {
            const p = {0: 1, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(1, p);
            expect(handler.getSize()).toBe(1);

            handler.removeHarvestable(1);

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: removing an unknown id is a no-op, does not throw.
        test('synthetic: removeHarvestable unknown id is no-op', () => {
            const p = {0: 2, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(2, p);

            handler.removeHarvestable(9999);

            expect(handler.getSize()).toBe(1);
        });
    });

    describe('Clear', () => {
        // @verified 2026-04-18: Clear empties harvestableList regardless of prior size.
        test('synthetic: Clear empties the list', () => {
            const p = {0: 1, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(1, p);
            handler.newHarvestableObject(2, {...p, 0: 2});
            expect(handler.getSize()).toBe(2);

            handler.Clear();

            expect(handler.getSize()).toBe(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-18: entities older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: cleanupStaleEntities removes old entities, keeps fresh', () => {
            const now = Date.now();

            const p = {0: 10, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(10, p);
            handler.newHarvestableObject(11, {...p, 0: 11});

            const list = handler.harvestableList;
            list[0].lastUpdateTime = now - 200000;
            list[1].lastUpdateTime = now - 10;

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.getSize()).toBe(1);
            expect(handler.getHarvestableList()[0].id).toBe(11);
        });

        // @verified 2026-04-18: returns 0 when nothing is stale.
        test('synthetic: cleanupStaleEntities returns 0 when all fresh', () => {
            const p = {0: 20, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(20, p);

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(0);
            expect(handler.getSize()).toBe(1);
        });
    });

    describe('enforceMaxSize', () => {
        // @verified 2026-04-18: trims list to maxSize, keeping newest entries.
        test('synthetic: enforceMaxSize trims to maxSize keeping newest', () => {
            const now = Date.now();
            for (let i = 0; i < 5; i++) {
                const p = {0: i + 100, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
                handler.newHarvestableObject(i + 100, p);
                handler.harvestableList[i].lastUpdateTime = now + i;
            }

            const removed = handler.enforceMaxSize(3);

            expect(removed).toBe(2);
            expect(handler.getSize()).toBe(3);
        });

        // @verified 2026-04-18: returns 0 when list is at or below maxSize.
        test('synthetic: enforceMaxSize no-op when size within limit', () => {
            const p = {0: 200, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(200, p);

            const removed = handler.enforceMaxSize(10);

            expect(removed).toBe(0);
            expect(handler.getSize()).toBe(1);
        });
    });

    describe('getHarvestableList', () => {
        // @verified 2026-04-18: returns a shallow copy, not the internal reference.
        test('synthetic: getHarvestableList returns a copy not the internal array', () => {
            const p = {0: 300, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(300, p);

            const copy = handler.getHarvestableList();
            copy.push({id: 9999});

            expect(handler.getSize()).toBe(1);
        });
    });

    describe('getSize', () => {
        // @verified 2026-04-18: returns 0 for a fresh handler.
        test('synthetic: getSize returns 0 initially', () => {
            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: returns correct count after adds.
        test('synthetic: getSize matches entity count after adds', () => {
            const p = {0: 400, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 2, 11: 0};
            handler.newHarvestableObject(400, p);
            handler.newHarvestableObject(401, {...p, 0: 401});

            expect(handler.getSize()).toBe(2);
        });
    });

    describe('updateHarvestable', () => {
        // @verified 2026-04-18: decrements size by count.
        test('synthetic: updateHarvestable decrements size by count', () => {
            const p = {0: 500, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 5, 11: 0};
            handler.newHarvestableObject(500, p);

            handler.updateHarvestable(500, 2);

            expect(handler.getHarvestableList()[0].size).toBe(3);
        });

        // @verified 2026-04-18: removes entity when size reaches 0.
        test('synthetic: updateHarvestable removes entity when size reaches 0', () => {
            const p = {0: 501, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 1, 11: 0};
            handler.newHarvestableObject(501, p);

            handler.updateHarvestable(501, 1);

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: removes entity when size goes negative.
        test('synthetic: updateHarvestable removes entity when size goes below 0', () => {
            const p = {0: 502, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 1, 11: 0};
            handler.newHarvestableObject(502, p);

            handler.updateHarvestable(502, 5);

            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: unknown id is no-op.
        test('synthetic: updateHarvestable unknown id is no-op', () => {
            const p = {0: 503, 5: 14, 6: -1, 7: 4, 8: [-10, 10], 10: 3, 11: 0};
            handler.newHarvestableObject(503, p);

            handler.updateHarvestable(9999, 1);

            expect(handler.getSize()).toBe(1);
        });
    });

    describe('removeNotInRange', () => {
        // @verified 2026-04-18: entities farther than 80 units are removed.
        test('synthetic: removeNotInRange filters entities beyond 80 units', () => {
            const near = {0: 600, 5: 14, 6: -1, 7: 4, 8: [0, 0], 10: 2, 11: 0};
            const far  = {0: 601, 5: 14, 6: -1, 7: 4, 8: [200, 200], 10: 2, 11: 0};
            handler.newHarvestableObject(600, near);
            handler.newHarvestableObject(601, far);

            handler.removeNotInRange(0, 0);

            expect(handler.getSize()).toBe(1);
            expect(handler.getHarvestableList()[0].id).toBe(600);
        });

        // @verified 2026-04-18: entities within 80 units are kept.
        test('synthetic: removeNotInRange keeps entities within 80 units', () => {
            const p = {0: 602, 5: 14, 6: -1, 7: 4, 8: [50, 0], 10: 2, 11: 0};
            handler.newHarvestableObject(602, p);

            handler.removeNotInRange(0, 0);

            expect(handler.getSize()).toBe(1);
        });

        // @verified 2026-04-18: entities with size===undefined are removed regardless of distance.
        test('synthetic: removeNotInRange removes entities with size undefined', () => {
            const p = {0: 603, 5: 14, 6: -1, 7: 4, 8: [0, 0], 10: 2, 11: 0};
            handler.newHarvestableObject(603, p);
            handler.harvestableList[0].size = undefined;

            handler.removeNotInRange(0, 0);

            expect(handler.getSize()).toBe(0);
        });
    });
});

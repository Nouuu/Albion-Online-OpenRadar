// synthetic + pcap-derived: the first describe stubs entity shapes to reach the living/static filter gate; the second
// replays real NewMob payloads through MobsHandler so the living path is proven on decoded state, not on a hand-built mob.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

vi.mock('./SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
        getNumber: vi.fn((_k, d) => d ?? 0),
    },
}));
vi.mock('./CanvasManager.js', () => ({
    CanvasManager: class { initialize() { return {contexts: {}}; } destroy() {} },
}));
vi.mock('../data/ZonesDatabase.js', () => ({default: {zones: {}}, ZonesDatabase: class {}}));

const {RadarRenderer} = await import('./RadarRenderer.js');
const {EnemyType} = await import('../handlers/MobsHandler.js');
const settingsSync = (await import('./SettingsSync.js')).default;

function makeRenderer({harvestableList = [], mobsList = []} = {}) {
    return new RadarRenderer({
        handlers: {
            harvestablesHandler: {harvestableList},
            mobsHandler: {mobsList},
        },
        drawings: {},
        drawingUtils: {detectClusters: vi.fn(() => [])},
    });
}

function allTrue() {
    return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
}

function allFalse() {
    return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
}

describe('RadarRenderer._collectClusterCandidates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete window.EnemyType;
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
    });

    // @verified 2026-04-24: pure-static harvestable with Static settings off is dropped from cluster input so
    // cluster rings stop surrounding entities the drawings already skip (Important #1 in PR #82 review).
    test('pure static harvestable with Static off is excluded from cluster candidates', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingStaticFiberEnchants' ? allFalse() : null);
        const renderer = makeRenderer({
            harvestableList: [{id: 1, stringType: 'Fiber', tier: 4, charges: 0, mobileTypeId: -1, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(0);
    });

    // @verified 2026-04-24: pure-static harvestable with Static on is kept.
    test('pure static harvestable with Static on is kept in cluster candidates', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingStaticFiberEnchants' ? allTrue() : null);
        const renderer = makeRenderer({
            harvestableList: [{id: 1, stringType: 'Fiber', tier: 4, charges: 0, mobileTypeId: -1, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(1);
    });

    // @verified 2026-04-24: living harvestable (mobileTypeId=real typeId) consults Living key, not Static.
    test('living harvestable with Living on but Static off is kept', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return allTrue();
            if (key === 'settingStaticFiberEnchants') return allFalse();
            return null;
        });
        const renderer = makeRenderer({
            harvestableList: [{id: 2, stringType: 'Fiber', tier: 4, charges: 0, mobileTypeId: 529, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(1);
    });

    // @verified 2026-08-02: living mob with Living on reaches the cluster input, so cluster rings surround
    // living resources the same way they surround static ones.
    test('living mob with Living on is kept in cluster candidates', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return allTrue();
            if (key === 'settingStaticFiberEnchants') return allFalse();
            return null;
        });
        const renderer = makeRenderer({
            mobsList: [{id: 11, name: 'Fiber', tier: 4, enchantmentLevel: 0, type: EnemyType.LivingHarvestable, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(1);
    });

    // @verified 2026-08-02: skinnable living mob (Hide) with Living on reaches the cluster input.
    test('living skinnable mob with Living on is kept in cluster candidates', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingLivingHideEnchants' ? allTrue() : null);
        const renderer = makeRenderer({
            mobsList: [{id: 12, name: 'Hide', tier: 6, enchantmentLevel: 2, type: EnemyType.LivingSkinnable, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(1);
    });

    // @verified 2026-04-24: living mob with Living off is excluded even if Static is on, matching MobsDrawing.
    test('living mob with Living off is excluded from cluster candidates', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return allFalse();
            if (key === 'settingStaticFiberEnchants') return allTrue();
            return null;
        });
        const renderer = makeRenderer({
            mobsList: [{id: 10, name: 'Fiber', tier: 4, enchantmentLevel: 0, type: EnemyType.LivingHarvestable, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(0);
    });

    // @verified 2026-04-24: hostile (non-living) mob is never considered a cluster candidate regardless of settings.
    test('hostile mob is excluded from cluster candidates', () => {
        settingsSync.getJSON.mockReturnValue(allTrue());
        const renderer = makeRenderer({
            mobsList: [{id: 20, name: 'T5_MOB_KEEPER', tier: 5, enchantmentLevel: 0, type: EnemyType.Enemy, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(0);
    });

    // @verified 2026-04-24: batch-spawn sentinel mobileTypeId=null routes as pure-static.
    test('batch-spawn harvestable (mobileTypeId=null) is gated by Static setting', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingStaticFiberEnchants' ? allTrue() : null);
        const renderer = makeRenderer({
            harvestableList: [{id: 3, stringType: 'Fiber', tier: 4, charges: 0, mobileTypeId: null, hX: 1, hY: 1}],
        });

        expect(renderer._collectClusterCandidates()).toHaveLength(1);
    });
});

const LIVING_KEYS = [
    'settingLivingHideEnchants',
    'settingLivingWoodEnchants',
    'settingLivingRockEnchants',
    'settingLivingOreEnchants',
    'settingLivingFiberEnchants',
];

describe('RadarRenderer._collectClusterCandidates on decoded MobsHandler state', () => {
    let mobsList;

    beforeEach(async () => {
        vi.clearAllMocks();
        delete window.EnemyType;
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();

        const {MobsHandler} = await import('../handlers/MobsHandler.js');
        const handler = new MobsHandler();
        const fixture = await loadFixture('mobs', 'living-tier');
        for (const message of fixture.messages) {
            handler.NewMobEvent(normalizeParams(message.parameters));
        }

        mobsList = handler.mobsList;
    });

    // @verified 2026-08-02: the 19 living resources decoded from the capture (Hide, Log, Rock, Ore, Fiber, T1-T5)
    // all reach the cluster input when every Living setting is on. The synthetic cases above passed while this path
    // returned nothing, because the filter read a global the tests set themselves and production never did.
    test('every living resource from a real capture reaches the cluster input', () => {
        settingsSync.getJSON.mockImplementation(key => LIVING_KEYS.includes(key) ? allTrue() : null);
        const renderer = makeRenderer({mobsList});

        const living = mobsList.filter(
            m => m.type === EnemyType.LivingHarvestable || m.type === EnemyType.LivingSkinnable
        );

        expect(living).toHaveLength(30);
        expect(renderer._collectClusterCandidates()).toHaveLength(30);
    });

    // @verified 2026-09-03: per-family gating holds on decoded state. The 2026-09-03 capture carries 10 Hide,
    // 4 Log, 8 Rock, 4 Ore, 4 Fiber, so enabling one family admits exactly that family.
    test.each([
        ['settingLivingHideEnchants', 'Hide', 10],
        ['settingLivingWoodEnchants', 'Log', 4],
        ['settingLivingRockEnchants', 'Rock', 8],
        ['settingLivingOreEnchants', 'Ore', 4],
        ['settingLivingFiberEnchants', 'Fiber', 4],
    ])('%s alone admits only the %s living resources (%i)', (settingKey, family, expected) => {
        settingsSync.getJSON.mockImplementation(key => key === settingKey ? allTrue() : null);
        const renderer = makeRenderer({mobsList});

        const candidates = renderer._collectClusterCandidates();

        expect(candidates).toHaveLength(expected);
        expect(candidates.every(c => c.name === family)).toBe(true);
    });

    // @verified 2026-08-02: the same decoded state yields no candidate when every Living setting is off.
    test('living resources from a real capture are dropped when Living is off', () => {
        settingsSync.getJSON.mockImplementation(key => LIVING_KEYS.includes(key) ? allFalse() : null);
        const renderer = makeRenderer({mobsList});

        expect(renderer._collectClusterCandidates()).toHaveLength(0);
    });
});

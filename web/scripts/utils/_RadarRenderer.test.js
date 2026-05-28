// synthetic: narrow coverage of _collectClusterCandidates(); assertions only reach the living/static filter gate,
// so no pcap fixture is needed and the full RadarRenderer setup (canvas, game loop, zones) is stubbed out.

import {describe, test, expect, beforeEach, vi} from 'vitest';

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
vi.mock('../data/ZonesDatabase.js', () => ({default: {zones: {}}}));

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
        window.EnemyType = EnemyType;
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

describe('RadarRenderer Player Trail', () => {
    let renderer;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        renderer = makeRenderer();
        renderer.drawingUtils.calculateDistance = (x1, y1, x2, y2) => {
            const dx = x2 - x1; const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        };
        renderer.drawingUtils.getScaledSize = vi.fn((x) => x);
        renderer.drawingUtils.transformPoint = vi.fn((x, y) => ({ x: x + 100, y: y + 100 }));
    });

    test('initializes playerPath as empty array', () => {
        expect(renderer.playerPath).toEqual([]);
    });

    test('adds position to playerPath when player moves', () => {
        renderer.setLocalPlayerPosition(10, 10);
        expect(renderer.playerPath).toHaveLength(1);
        expect(renderer.playerPath[0].x).toBe(10);
        expect(renderer.playerPath[0].y).toBe(10);

        // Moving less than 1m shouldn't add a point
        renderer.setLocalPlayerPosition(10.5, 10);
        expect(renderer.playerPath).toHaveLength(1);

        // Moving >= 1m should add a point
        renderer.setLocalPlayerPosition(12, 10);
        expect(renderer.playerPath).toHaveLength(2);
        expect(renderer.playerPath[1].x).toBe(12);
    });

    test('clears playerPath on map change', () => {
        renderer.setLocalPlayerPosition(10, 10);
        renderer.setLocalPlayerPosition(20, 20);
        expect(renderer.playerPath).toHaveLength(2);

        renderer.setMap({ id: 'test_map' });
        expect(renderer.playerPath).toEqual([]);
    });

    test('drawPlayerTrail filters expired points', () => {
        const now = Date.now();
        vi.useFakeTimers();
        vi.setSystemTime(now);

        renderer.playerPath = [
            { x: 10, y: 10, time: now - 200 * 1000 }, // 200s old (expired, limit is 180s by default)
            { x: 15, y: 15, time: now - 100 * 1000 }, // 100s old (keep)
            { x: 20, y: 20, time: now }               // 0s old (keep)
        ];

        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            lineWidth: 0,
            lineCap: '',
            lineJoin: '',
            shadowBlur: 0,
            shadowColor: '',
            strokeStyle: ''
        };

        settingsSync.getNumber.mockReturnValue(180); // 180 seconds limit
        renderer.drawPlayerTrail(ctx);

        // Expired point should be removed
        expect(renderer.playerPath).toHaveLength(2);
        expect(renderer.playerPath[0].x).toBe(15);

        // Should draw line segment connecting the 2 remaining points
        expect(ctx.beginPath).toHaveBeenCalled();
        expect(ctx.moveTo).toHaveBeenCalled();
        expect(ctx.lineTo).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();

        vi.useRealTimers();
    });
});


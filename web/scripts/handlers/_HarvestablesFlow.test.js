// pcap-derived: real fixture messages through EventRouter into the real mobs and harvestables handlers and the drawing.

import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import * as EventRouter from '../core/EventRouter.js';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow, loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
        getFloat: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('../drawings/HarvestablesDrawing.js');
const {HarvestablesHandler} = await import('./HarvestablesHandler.js');
const {MobsHandler, EnemyType} = await import('./MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function allTrue() {
    return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
}

function buildDrawing() {
    const drawing = new HarvestablesDrawing();
    drawing.DrawCustomImage = vi.fn();
    drawing.drawResourceBadge = vi.fn();
    drawing.transformPoint = vi.fn((x, y) => ({x, y}));
    drawing.drawText = vi.fn();
    drawing.drawDistanceIndicator = vi.fn();
    drawing.drawResourceCountBadge = vi.fn();
    drawing.calculateDistance = vi.fn(() => 10);
    drawing.getScaledSize = vi.fn(s => s);
    drawing.getMarkerSize = vi.fn(s => s);
    return drawing;
}

async function fixtureParams(handler, scenario, pick) {
    const fix = await loadFixture(handler, scenario);
    return normalizeParams(fix.messages.find(m => pick(m.parameters)).parameters);
}

describe('harvestable detection flow', () => {
    let mobsHandler;
    let harvestablesHandler;
    let drawing;
    let map;

    beforeAll(() => {
        defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
        defaultZonesDatabase.loaded = true;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
        mobsHandler = new MobsHandler();
        harvestablesHandler = new HarvestablesHandler(mobsHandler);
        drawing = buildDrawing();
        map = {id: -1, hX: 0, hY: 0, isBZ: false};
        EventRouter.reset();
        EventRouter.init({
            handlers: {mobsHandler, harvestablesHandler},
            map,
            radarRenderer: {setLocalPlayerPosition: vi.fn(), setMap: vi.fn()},
        });
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesLivingHide' ? allTrue() : null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceCount');
    });

    // @verified 2026-11-14: a NewMob whose mob drops a resource is listed as a living resource (Hide as skinnable, the others as harvestable)
    test.each([
        ['spawn', 396, EnemyType.LivingSkinnable],
        ['spawn', 564, EnemyType.LivingSkinnable],
        ['living-tier', 676, EnemyType.LivingHarvestable],
        ['living-tier', 694, EnemyType.LivingHarvestable],
    ])('NewMob from mobs/%s with mob key %i is listed as enemy type %i', async (scenario, mobKey, expectedType) => {
        const p = await fixtureParams('mobs', scenario, q => q[1] === mobKey);

        EventRouter.onEvent(p);

        const listed = mobsHandler.getMobList().filter(m => m.id === p[0]);
        expect(listed).toHaveLength(1);
        expect(listed[0].type).toBe(expectedType);
    });

    // @verified 2026-11-14: a harvestable spawn carrying a mob key is added to the list and drawn with its count badge
    test('event 40 with a mob key is drawn with the count badge', async () => {
        const p = await fixtureParams('harvestables', 'mob-critter', q => q[6] === 564);

        EventRouter.onEvent(p);
        drawing.invalidate({}, harvestablesHandler.getHarvestableList());

        expect(harvestablesHandler.getHarvestableList().map(h => h.id)).toEqual([p[0]]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith({}, expect.any(Number), expect.any(Number), 'hide_3_0', 'Resources', 32);
        expect(drawing.drawResourceCountBadge).toHaveBeenCalledTimes(1);
    });

    // @verified 2026-11-14: a living Fiber node is drawn after its spawn and no longer drawn once its charge level update reports 0
    test('event 46 with charge level 0 stops drawing a spawned Fiber critter', async () => {
        const fix = await loadFixture('harvestables', 'depleted');
        const [spawn, depleted] = fix.messages.map(m => normalizeParams(m.parameters));
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesLivingFiber' ? allTrue() : null);

        EventRouter.onEvent(spawn);
        drawing.invalidate({}, harvestablesHandler.getHarvestableList());
        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);

        EventRouter.onEvent(depleted);
        drawing.invalidate({}, harvestablesHandler.getHarvestableList());
        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);
    });

    // @verified 2026-11-14: a Join response between two spawns of the same mob id leaves one mob holding the second spawn values
    test('Join between two NewMob events of the same id keeps one mob with the second position', async () => {
        const fix = await loadFixture('mobs', 'named-non-mist');
        const [first, second] = fix.messages.filter(m => m.parameters['0'] === 65878).map(m => normalizeParams(m.parameters));
        const join = (await loadFixture('router', 'join-finished')).messages[0];
        const clearHandlers = () => {
            harvestablesHandler.Clear();
            mobsHandler.Clear();
        };

        EventRouter.onEvent(first);
        EventRouter.onResponse(normalizeParams(join.parameters), clearHandlers);
        EventRouter.onEvent(second);

        const listed = mobsHandler.getMobList();
        expect(listed).toHaveLength(1);
        expect([listed[0].posX, listed[0].posY]).toEqual(second[7]);
    });

    // @verified 2026-11-14: a Join response between two spawns of the same harvestable id leaves one node holding the second spawn values; the second message is a real capture message given the first id
    test('Join between two event 40 spawns of the same id keeps one harvestable with the second tier', async () => {
        const first = await fixtureParams('harvestables', 'mob-critter', q => q[6] === 564);
        const second = {...await fixtureParams('harvestables', 'mob-critter', q => q[6] === 566), 0: first[0]};
        const join = (await loadFixture('router', 'join-finished')).messages[0];
        const clearHandlers = () => {
            harvestablesHandler.Clear();
            mobsHandler.Clear();
        };

        EventRouter.onEvent(first);
        EventRouter.onResponse(normalizeParams(join.parameters), clearHandlers);
        EventRouter.onEvent(second);

        const listed = harvestablesHandler.getHarvestableList();
        expect(listed).toHaveLength(1);
        expect([listed[0].id, listed[0].tier, listed[0].chargeLevel]).toEqual([first[0], second[7], second[10]]);
    });
});

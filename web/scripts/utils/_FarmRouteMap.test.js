// synthetic: pure geometry and filtering of the farm route map; zone bounds come from the real zones.json.
import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import zonesDatabase from '../data/ZonesDatabase.js';

const here = dirname(fileURLToPath(import.meta.url));

function matrix(value) {
    return Object.fromEntries(['e0', 'e1', 'e2', 'e3', 'e4'].map(e => [e, Array(8).fill(value)]));
}

vi.mock('./SettingsSync.js', () => ({
    default: {getJSON: vi.fn(() => ({}))},
}));
vi.mock('./ImageCache.js', () => ({
    default: {GetPreloadedImage: vi.fn(() => null), preloadImageAndAddToList: vi.fn(() => Promise.resolve())},
}));

const {mapView, worldToMap, visibleNodes, tierColor, drawFarmRouteMap, rememberNodes, savedNodes, resetFarmRoute} = await import('./FarmRouteMap.js');
const settingsSync = (await import('./SettingsSync.js')).default;

const ZONE = '1000';

describe('FarmRouteMap', () => {
    beforeAll(() => {
        zonesDatabase.zones = JSON.parse(readFileSync(join(here, '..', '..', 'ao-bin-dumps', 'zones.json'), 'utf8'));
        zonesDatabase.loaded = true;
    });

    beforeEach(() => {
        settingsSync.getJSON.mockReturnValue(matrix(true));
    });

    test('the center of the zone lands in the middle of the canvas', () => {
        const view = mapView(ZONE, 400);
        const point = worldToMap(view, view.center.x, view.center.y);
        expect(point.x).toBeCloseTo(200);
        expect(point.y).toBeCloseTo(200);
    });

    test('world axes turn like the game map: +x goes right and down, +y goes right and up', () => {
        const view = mapView(ZONE, 400);
        const plusX = worldToMap(view, view.center.x + 100, view.center.y);
        const plusY = worldToMap(view, view.center.x, view.center.y + 100);
        expect(plusX.x).toBeGreaterThan(200);
        expect(plusX.y).toBeGreaterThan(200);
        expect(plusY.x).toBeGreaterThan(200);
        expect(plusY.y).toBeLessThan(200);
    });

    test('the zone corners land on the diamond vertices', () => {
        const view = mapView(ZONE, 400);
        const half = zonesDatabase.getMapAssetExtent(ZONE) / 2;
        for (const [dx, dy] of [[half, half], [-half, -half], [half, -half], [-half, half]]) {
            const {x, y} = worldToMap(view, view.center.x + dx, view.center.y + dy);
            expect(x === 200 || y === 200).toBe(true);
            expect(Math.abs(x - 200) + Math.abs(y - 200)).toBeCloseTo(200);
        }
    });

    test('a zone without bounds fits the view to the saved nodes and the player', () => {
        const points = [{posX: 1000, posY: -500}, {posX: 1400, posY: -300}, {posX: 1200, posY: -400}];
        const view = mapView('@NO-SUCH-ZONE', 400, points);
        expect(view.hasMap).toBe(false);
        for (const p of points) {
            const {x, y} = worldToMap(view, p.posX, p.posY);
            expect(Math.abs(x - 200) + Math.abs(y - 200)).toBeLessThan(200);
        }
        const middle = worldToMap(view, 1200, -400);
        expect(middle.x).toBeCloseTo(200);
        expect(middle.y).toBeCloseTo(200);
    });

    test('a Mist does not use the bounds of the zone it was entered from', () => {
        zonesDatabase.setMistOverride('@MISTS@test', ZONE);
        try {
            const view = mapView('@MISTS@test', 400, [{posX: 5000, posY: 5000}, {posX: 5100, posY: 5050}]);
            expect(view.hasMap).toBe(false);
            expect(view.center.x).toBeCloseTo(5050);
        } finally {
            zonesDatabase.clearMistOverride('@MISTS@test');
        }
    });

    test('a zone without bounds and without points falls back to a small view around the origin', () => {
        const view = mapView('@NO-SUCH-ZONE', 400);
        expect(worldToMap(view, 0, 0)).toEqual({x: 200, y: 200});
    });

    test('tiers use the game colors: T4 blue, T5 red, T6 orange, T7 yellow, T8 white', () => {
        expect([4, 5, 6, 7, 8].map(tierColor)).toEqual(['#3b82f6', '#ef4444', '#f97316', '#facc15', '#ffffff']);
        expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(tierColor)).size).toBe(8);
    });

    test('visibleNodes drops depleted nodes and nodes the resource filters hide', () => {
        const ore = {stringType: 'Ore', tier: 5, charges: 0, size: 3, mobileTypeId: null};
        const depleted = {...ore, size: 0};
        expect(visibleNodes([ore, depleted])).toEqual([ore]);

        settingsSync.getJSON.mockReturnValue(matrix(false));
        expect(visibleNodes([ore])).toEqual([]);
    });

    test('drawFarmRouteMap draws one marker per visible node plus the player and returns the node count', () => {
        const ctx = {
            fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
            save: vi.fn(), restore: vi.fn(), translate: vi.fn(), transform: vi.fn(), drawImage: vi.fn(),
        };
        const canvas = {width: 400, height: 400, getContext: () => ctx};
        const nodes = [
            {id: 101, stringType: 'Ore', tier: 5, charges: 0, size: 3, posX: 0, posY: 0, mobileTypeId: null},
            {id: 102, stringType: 'Fiber', tier: 4, charges: 1, size: 2, posX: 50, posY: 50, mobileTypeId: null},
        ];

        const count = drawFarmRouteMap(canvas, {mapId: ZONE, lpX: 10, lpY: 10, harvestables: nodes});

        expect(count).toBe(2);
        expect(ctx.arc).toHaveBeenCalledTimes(3);
        expect(ctx.fillText).toHaveBeenCalledWith('5', expect.any(Number), expect.any(Number));
    });

    describe('saved nodes', () => {
        const ore = {id: 1, stringType: 'Ore', tier: 5, charges: 0, size: 3, posX: 10, posY: 20, mobileTypeId: null, lastUpdateTime: 1000};

        test('a node stays marked after the radar list forgets it', () => {
            rememberNodes('saved-a', [ore]);
            rememberNodes('saved-a', []);
            expect(savedNodes('saved-a').map(n => n.id)).toEqual([1]);
        });

        test('a node that is later depleted keeps its mark', () => {
            rememberNodes('saved-b', [ore]);
            rememberNodes('saved-b', [{...ore, size: 0}]);
            expect(savedNodes('saved-b')).toHaveLength(1);
        });

        test('zones keep their own nodes', () => {
            rememberNodes('saved-c', [ore]);
            expect(savedNodes('saved-d')).toEqual([]);
        });

        test('reset clears the zone and only nodes reported after it come back', () => {
            rememberNodes('saved-e', [ore]);
            resetFarmRoute('saved-e');
            expect(savedNodes('saved-e')).toEqual([]);

            rememberNodes('saved-e', [ore]);
            expect(savedNodes('saved-e')).toEqual([]);

            rememberNodes('saved-e', [{...ore, id: 2, lastUpdateTime: Date.now() + 1}]);
            expect(savedNodes('saved-e').map(n => n.id)).toEqual([2]);
        });
    });
});

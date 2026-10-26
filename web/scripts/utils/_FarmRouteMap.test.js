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

const {mapView, worldToMap, visibleNodes, drawFarmRouteMap} = await import('./FarmRouteMap.js');
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

    test('world axes turn like the radar: +x goes right and down, +y goes right and up', () => {
        const view = mapView(ZONE, 400);
        const plusX = worldToMap(view, view.center.x + 100, view.center.y);
        const plusY = worldToMap(view, view.center.x, view.center.y + 100);
        expect(plusX.x).toBeGreaterThan(200);
        expect(plusX.y).toBeGreaterThan(200);
        expect(plusY.x).toBeGreaterThan(200);
        expect(plusY.y).toBeLessThan(200);
    });

    test('the zone corners stay inside the canvas', () => {
        const view = mapView(ZONE, 400);
        const half = zonesDatabase.getMapAssetExtent(ZONE) / 2;
        for (const [dx, dy] of [[half, half], [-half, -half], [half, -half], [-half, half]]) {
            const {x, y} = worldToMap(view, view.center.x + dx, view.center.y + dy);
            expect(x).toBeGreaterThanOrEqual(-0.001);
            expect(x).toBeLessThanOrEqual(400.001);
            expect(y).toBeGreaterThanOrEqual(-0.001);
            expect(y).toBeLessThanOrEqual(400.001);
        }
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
            {stringType: 'Ore', tier: 5, charges: 0, size: 3, posX: 0, posY: 0, mobileTypeId: null},
            {stringType: 'Fiber', tier: 4, charges: 1, size: 2, posX: 50, posY: 50, mobileTypeId: null},
        ];

        const count = drawFarmRouteMap(canvas, {mapId: ZONE, lpX: 10, lpY: 10, harvestables: nodes});

        expect(count).toBe(2);
        expect(ctx.arc).toHaveBeenCalledTimes(3);
        expect(ctx.fillText).toHaveBeenCalledWith('5', expect.any(Number), expect.any(Number));
    });
});

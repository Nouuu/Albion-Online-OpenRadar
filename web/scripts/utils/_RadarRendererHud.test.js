// pcap-derived: router/change-cluster-bz.json (zone 0317, black), router/change-cluster.json (zone "0000", safe),
// players/spawn.json and harvestables/batch-spawn.json, replayed through real handlers and EventRouter.
import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';
import {createRecordingContext} from '../__fixtures__/recordingContext.js';
import * as EventRouter from '../core/EventRouter.js';
import zonesDatabase from '../data/ZonesDatabase.js';

const here = dirname(fileURLToPath(import.meta.url));
const zonesJsonPath = join(here, '..', '..', 'ao-bin-dumps', 'zones.json');

function allTrue() {
    return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
}

vi.mock('./SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(),
        getFloat: vi.fn(),
        getNumber: vi.fn(),
        getJSON: vi.fn(() => allTrue()),
    },
}));

vi.mock('./ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(() => null),
        preloadImageAndAddToList: vi.fn(() => Promise.resolve()),
    },
}));

const {RadarRenderer} = await import('./RadarRenderer.js');
const {DrawingUtils} = await import('./DrawingUtils.js');
const {HarvestablesDrawing} = await import('../drawings/HarvestablesDrawing.js');
const {HarvestablesHandler} = await import('../handlers/HarvestablesHandler.js');
const {PlayersHandler} = await import('../handlers/PlayersHandler.js');
const settingsSync = (await import('./SettingsSync.js')).default;

beforeAll(() => {
    zonesDatabase.zones = JSON.parse(readFileSync(zonesJsonPath, 'utf8'));
    zonesDatabase.loaded = true;
});

function makeCanvas(size = 500) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
}

const DEFAULT_BOOL = {
    settingRadarHudZoneInfo: true,
    settingRadarHudStats: true,
    settingAlertBorder: false,
    settingAlertFlash: false,
    settingAlertSound: false,
    settingPlayersDetect: true,
};

function mockSettings({bool = {}, float = {}, number = {}} = {}) {
    const bools = {...DEFAULT_BOOL, ...bool};
    settingsSync.getBool.mockImplementation(key => bools[key] ?? false);
    settingsSync.getFloat.mockImplementation(key => float[key] ?? 1);
    settingsSync.getNumber.mockImplementation(key => number[key] ?? 500);
}

describe('RadarRenderer HUD gates and zone guard', () => {
    let map;
    let handlers;
    let renderer;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        EventRouter.reset();
        zonesDatabase.clearAllMistOverrides();

        map = {id: -1, hX: 0, hY: 0, isBZ: false};
        handlers = {playersHandler: new PlayersHandler()};
        renderer = new RadarRenderer({handlers, drawings: {}, drawingUtils: new DrawingUtils()});
        renderer.setMap(map);
        ctx = createRecordingContext(makeCanvas(500));
        renderer.contexts = {uiCanvas: ctx};

        EventRouter.init({handlers, map, radarRenderer: renderer});
    });

    // @verified 2026-09-24: pcap-derived. router/change-cluster-bz.json sets zone 0317 (black); players/spawn.json
    // feeds 8 passive players who all count as threats in a black zone, arming the border and the flash.
    test('zone info and stats off leaves only rings, threat border and flash', async () => {
        mockSettings({bool: {
            settingRadarHudZoneInfo: false, settingRadarHudStats: false,
            settingAlertBorder: true, settingAlertFlash: true,
        }});

        const bz = await loadFixture('router', 'change-cluster-bz');
        EventRouter.onResponse(normalizeParams(bz.messages[0].parameters), vi.fn());
        expect(map.id).toBe('0317');

        const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(1000);
        const spawn = await loadFixture('players', 'spawn');
        for (const message of spawn.messages) {
            EventRouter.onEvent(normalizeParams(message.parameters));
        }
        nowSpy.mockReturnValue(1150);

        renderer.renderUI();

        const strokeRects = ctx.calls.filter(c => c[0] === 'strokeRect');
        expect(strokeRects).toEqual([['strokeRect', 3, 3, 494, 494]]);

        const fillRects = ctx.calls.filter(c => c[0] === 'fillRect');
        expect(fillRects).toEqual([['fillRect', 0, 0, 500, 500]]);

        expect(ctx.calls.some(c => (c[0] === 'fillRect' || c[0] === 'strokeRect') && c[1] === 10 && c[2] === 10)).toBe(false);
        expect(ctx.calls.some(c => c[0] === 'fillText' && c[1] === '10m')).toBe(true);

        nowSpy.mockRestore();
    });

    // @verified 2026-09-24: zone info alone off leaves the stats box (y=10, x!=10) intact.
    test('zone info off alone hides only the zone box', () => {
        renderer.setMap({id: '0317'});
        mockSettings({bool: {settingRadarHudZoneInfo: false, settingRadarHudStats: true}});

        renderer.renderUI();

        expect(ctx.calls.some(c => c[0] === 'strokeRect' && c[1] === 10 && c[2] === 10)).toBe(false);
        expect(ctx.calls.some(c => c[0] === 'strokeRect' && c[2] === 10 && c[1] !== 10)).toBe(true);
    });

    // @verified 2026-09-24: stats alone off leaves the zone box (10,10) intact.
    test('stats off alone hides only the stats box', () => {
        renderer.setMap({id: '0317'});
        mockSettings({bool: {settingRadarHudZoneInfo: true, settingRadarHudStats: false}});

        renderer.renderUI();

        expect(ctx.calls.some(c => c[0] === 'strokeRect' && c[1] === 10 && c[2] === 10)).toBe(true);
        expect(ctx.calls.some(c => c[0] === 'strokeRect' && c[2] === 10 && c[1] !== 10)).toBe(false);
    });

    // @verified 2026-09-24: the -1 sentinel (cold-start map object) must never draw the zone box.
    test('map.id -1 draws no zone box', () => {
        mockSettings();
        renderer.renderZoneInfo(ctx);
        expect(ctx.calls).toHaveLength(0);
    });

    // @verified 2026-09-24: pcap-derived. router/change-cluster.json message[0] carries zone "0000", a valid
    // zone id distinct from the -1 sentinel, and must draw the zone box.
    test('zone "0000" draws the zone box', async () => {
        mockSettings();
        const fix = await loadFixture('router', 'change-cluster');
        EventRouter.onResponse(normalizeParams(fix.messages[0].parameters), vi.fn());
        expect(map.id).toBe('0000');

        renderer.renderZoneInfo(ctx);

        expect(ctx.calls.some(c => c[0] === 'strokeRect' && c[1] === 10 && c[2] === 10)).toBe(true);
    });
});

describe('RadarRenderer and DrawingUtils single zoom source', () => {
    let renderer;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        renderer = new RadarRenderer({handlers: {}, drawings: {}, drawingUtils: new DrawingUtils()});
        ctx = createRecordingContext(makeCanvas(500));
    });

    // @verified 2026-09-24: getZoomLevel is the single zoom source, no innerWidth override.
    test('getZoomLevel ignores innerWidth and returns the registry zoom', () => {
        window.innerWidth = 390;
        mockSettings({float: {settingRadarZoom: 2}});

        expect(renderer.drawingUtils.getZoomLevel()).toBe(2);
    });

    // @verified 2026-09-24: the 10 m ring radius scales with the single zoom source and the 20 m ring
    // is dropped once it no longer fits inside the canvas, independent of innerWidth.
    test('10 m ring radius scales with zoom and drops the 20 m ring', () => {
        window.innerWidth = 390;
        mockSettings({float: {settingRadarZoom: 2}});

        renderer.renderDistanceRings(ctx);

        const arcs = ctx.calls.filter(c => c[0] === 'arc');
        expect(arcs).toHaveLength(1);
        expect(arcs[0][3]).toBeCloseTo(166.67, 2);
        expect(ctx.calls.some(c => c[0] === 'fillText' && c[1] === '10m')).toBe(true);
        expect(ctx.calls.some(c => c[0] === 'fillText' && c[1] === '20m')).toBe(false);
    });

    // @verified 2026-09-24: pcap-derived. harvestables/batch-spawn.json fed through the real handler; doubling
    // the registry zoom must double every drawn entity's pixel offset from the canvas center.
    test('harvestable draw offsets from center double when zoom doubles', async () => {
        installRealDatabasesOnWindow();
        const handler = new HarvestablesHandler();
        const fixture = await loadFixture('harvestables', 'batch-spawn');
        for (const message of fixture.messages) {
            handler.newSimpleHarvestableObject(normalizeParams(message.parameters));
        }

        const drawing = new HarvestablesDrawing();
        drawing.interpolate(handler.harvestableList, 0, 0, 1);

        mockSettings({float: {settingRadarZoom: 1}});
        const ctxZoom1 = createRecordingContext(makeCanvas(500));
        drawing.invalidate(ctxZoom1, handler.harvestableList);
        const arcsZoom1 = ctxZoom1.calls.filter(c => c[0] === 'arc');

        mockSettings({float: {settingRadarZoom: 2}});
        const ctxZoom2 = createRecordingContext(makeCanvas(500));
        drawing.invalidate(ctxZoom2, handler.harvestableList);
        const arcsZoom2 = ctxZoom2.calls.filter(c => c[0] === 'arc');

        expect(arcsZoom1.length).toBeGreaterThan(0);
        expect(arcsZoom2).toHaveLength(arcsZoom1.length);

        const center = 250;
        for (let i = 0; i < arcsZoom1.length; i++) {
            const [, x1, y1] = arcsZoom1[i];
            const [, x2, y2] = arcsZoom2[i];
            expect(x2 - center).toBeCloseTo((x1 - center) * 2, 5);
            expect(y2 - center).toBeCloseTo((y1 - center) * 2, 5);
        }
    });
});

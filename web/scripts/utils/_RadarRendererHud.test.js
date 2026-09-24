// pcap-derived: router/change-cluster-bz.json (zone 0317, black), router/change-cluster.json (zone "0000", safe),
// players/spawn.json, replayed through real handlers and EventRouter.
import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {createRecordingContext} from '../__fixtures__/recordingContext.js';
import * as EventRouter from '../core/EventRouter.js';
import zonesDatabase from '../data/ZonesDatabase.js';

const here = dirname(fileURLToPath(import.meta.url));
const zonesJsonPath = join(here, '..', '..', 'ao-bin-dumps', 'zones.json');

vi.mock('./SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(),
        getFloat: vi.fn(),
        getNumber: vi.fn(),
        getJSON: vi.fn(() => null),
    },
}));

const {RadarRenderer} = await import('./RadarRenderer.js');
const {DrawingUtils} = await import('./DrawingUtils.js');
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

describe('RadarRenderer HUD gates and zone guard (US2, FR-019, FR-020)', () => {
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

    // @verified 2026-09-24: FR-020, the -1 sentinel (cold-start map object) must never draw the zone box.
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

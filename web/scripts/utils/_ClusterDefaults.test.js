// pcap-derived: harvestables/batch-spawn.json through EventRouter into a real HarvestablesHandler.
// Real SettingsSync with only the Clusters toggle stored, so radius and minimum size read their registry defaults.
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

vi.mock('./CanvasManager.js', () => ({
    CanvasManager: class { initialize() { return {contexts: {}}; } clearDynamicLayers() {} destroy() {} },
}));

const EventRouter = await import('../core/EventRouter.js');
const {HarvestablesHandler} = await import('../handlers/HarvestablesHandler.js');
const {DrawingUtils} = await import('./DrawingUtils.js');
const {RadarRenderer} = await import('./RadarRenderer.js');
const settingsSync = (await import('./SettingsSync.js')).default;

function recordingContext(texts) {
    const methods = {
        measureText: () => ({width: 10}),
        createLinearGradient: () => ({addColorStop() {}}),
        fillText: text => texts.push(text),
    };
    return new Proxy({}, {
        get: (_target, prop) => methods[prop] ?? (() => {}),
        set: () => true,
    });
}

describe('cluster defaults on a profile without cluster keys', () => {
    beforeEach(() => {
        localStorage.clear();
        EventRouter.reset();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
    });

    // @verified 2026-09-24: cluster radius 30 m and minimum size 2 are the registry defaults.
    test('clusters use radius 30 and minimum size 2 and the info box shows R:30m', async () => {
        const harvestablesHandler = new HarvestablesHandler(null);
        EventRouter.init({handlers: {harvestablesHandler}, map: {id: -1}, radarRenderer: null});
        const fixture = await loadFixture('harvestables', 'batch-spawn');
        for (const message of fixture.messages) EventRouter.onEvent(normalizeParams(message.parameters));

        const drawingUtils = new DrawingUtils();
        for (const entity of harvestablesHandler.harvestableList) drawingUtils.interpolateEntity(entity, 0, 0, 1);
        const detectClusters = vi.spyOn(drawingUtils, 'detectClusters');
        settingsSync.setBool('settingRadarResourceClusters', true);

        const texts = [];
        const renderer = new RadarRenderer({handlers: {harvestablesHandler}, drawings: {}, drawingUtils});
        renderer.contexts = {drawCanvas: recordingContext(texts)};
        renderer.render();

        expect(detectClusters).toHaveBeenCalledTimes(1);
        const [candidates, radius, minSize] = detectClusters.mock.calls[0];
        expect(candidates.length).toBeGreaterThan(0);
        expect([radius, minSize]).toEqual([30, 2]);
        expect(detectClusters.mock.results[0].value.length).toBeGreaterThan(0);
        expect(texts.some(text => text.includes('R:30m'))).toBe(true);
    });
});

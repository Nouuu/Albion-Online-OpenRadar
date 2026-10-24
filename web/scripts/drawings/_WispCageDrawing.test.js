// pcap-derived fixture: web/scripts/__fixtures__/ws/wispcage/spawn.json, dispatched via handler.newCageEvent
// (fixture carries event code 530, current EventCodes.NewCagedObject is 533, drift left as is)

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRecordingContext} from '../__fixtures__/recordingContext.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getFloat: vi.fn(() => 1),
        getNumber: vi.fn(() => 500),
    },
}));
vi.mock('../utils/ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(src => ({src})),
        preloadImageAndAddToList: vi.fn(),
    },
}));

const {WispCageHandler} = await import('../handlers/WispCageHandler.js');
const {WispCageDrawing} = await import('./WispCageDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function drawnSrcs(ctx) {
    return ctx.calls.filter(c => c[0] === 'drawImage').map(c => c[1].src);
}

describe('WispCageDrawing', () => {
    let handler;
    let drawing;
    let ctx;

    beforeEach(async () => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(false);
        settingsSync.getFloat.mockReturnValue(1);
        settingsSync.getNumber.mockReturnValue(500);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};

        handler = new WispCageHandler();
        drawing = new WispCageDrawing();
        installRecordingContext();
        ctx = document.createElement('canvas').getContext('2d');

        const fx = await loadFixture('wispcage', 'spawn');
        for (const msg of fx.messages) {
            handler.newCageEvent(normalizeParams(msg.parameters));
        }
    });

    test('pcap-derived: settingMistsWispCages=false still adds cages 1340, 1348 and 1382', () => {
        expect(handler.cages.map(c => c.id).sort()).toEqual([1340, 1348, 1382]);
    });

    test('synthetic: cageOpenedEvent removes cage 1340 while the filter is off', () => {
        handler.cageOpenedEvent({0: 1340});

        expect(handler.cages.map(c => c.id).sort()).toEqual([1348, 1382]);
    });

    test('pcap-derived: filter off draws nothing, filter on draws exactly 1348 and 1382', () => {
        handler.cageOpenedEvent({0: 1340});

        drawing.draw(ctx, handler.cages);
        expect(drawnSrcs(ctx)).toHaveLength(0);

        settingsSync.getBool.mockReturnValue(true);
        drawing.draw(ctx, handler.cages);

        expect(drawnSrcs(ctx)).toHaveLength(2);
    });
});

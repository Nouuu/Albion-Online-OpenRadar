// synthetic: ctx.drawImage call inspection. Per-zone size resolution is exercised via stubbed
// zonesDatabase.getZoneSize - the actual upstream values for the same ids are covered in the
// _ZonesDatabase.test.js suite that loads zones.json.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getFloat: vi.fn(() => null),
    },
}));

vi.mock('../utils/ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(() => ({ width: 800, height: 800 })),
        preloadImageAndAddToList: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../data/ZonesDatabase.js', () => ({
    default: {
        getZoneSize: vi.fn(() => [825, 825]),
    },
}));

const {MapDrawing} = await import('./MapsDrawing.js');
const zonesDatabase = (await import('../data/ZonesDatabase.js')).default;

function buildCtx() {
    return {
        width: 500,
        height: 500,
        fillStyle: '',
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
    };
}

describe('MapsDrawing per-zone size', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MapDrawing();
        drawing.getZoomLevel = vi.fn(() => 1.0);
        drawing.getCanvasCenter = vi.fn(() => 250);
        ctx = buildCtx();
    });

    // @verified 2026-05-12: synthetic. Legacy baseline 825 -> 825*4*1.0 = 3300 canvas pixels.
    test('full-size square zone draws image at 825 * scaleFactor', () => {
        zonesDatabase.getZoneSize.mockReturnValueOnce([825, 825]);
        const map = {id: 1000, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const call = ctx.drawImage.mock.calls[0];
        const drawnSize = call[3];
        expect(drawnSize).toBeCloseTo(3300, 6);
        expect(call[4]).toBeCloseTo(3300, 6);
    });

    // @verified 2026-05-12: synthetic. Brecilien Bank-shaped 450x450 -> 450*4 = 1800 canvas pixels,
    // not the legacy 3300. Regression guard for the small sub-zone class.
    test('small square sub-zone draws image at 450 * scaleFactor', () => {
        zonesDatabase.getZoneSize.mockReturnValueOnce([450, 450]);
        const map = {id: 5002, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const call = ctx.drawImage.mock.calls[0];
        expect(call[3]).toBeCloseTo(1800, 6);
        expect(call[4]).toBeCloseTo(1800, 6);
    });

    // @verified 2026-05-12: synthetic. Brecilien main shape 812x1040 -> max(W,H)=1040 -> 1040*4=4160.
    // Keeps the image square; documented limitation in the design spec.
    test('rectangular zone draws image at max(W,H) * scaleFactor', () => {
        zonesDatabase.getZoneSize.mockReturnValueOnce([812, 1040]);
        const map = {id: 5000, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const call = ctx.drawImage.mock.calls[0];
        expect(call[3]).toBeCloseTo(4160, 6);
        expect(call[4]).toBeCloseTo(4160, 6);
    });

    // @verified 2026-05-12: synthetic. Zoom multiplier passes through both player position and map size
    // so they stay aligned.
    test('zoom multiplier scales both player position and map size consistently', () => {
        zonesDatabase.getZoneSize.mockReturnValueOnce([450, 450]);
        drawing.getZoomLevel.mockReturnValue(2.0);
        const map = {id: 5002, hX: 100, hY: 50};

        drawing.draw(ctx, map);

        // scaleFactor = 4 * 2.0 = 8
        const translateCalls = ctx.translate.mock.calls;
        const lastTranslate = translateCalls[translateCalls.length - 1];
        expect(lastTranslate[0]).toBeCloseTo(-100 * 8, 6);
        expect(lastTranslate[1]).toBeCloseTo(50 * 8, 6);

        const call = ctx.drawImage.mock.calls[0];
        expect(call[3]).toBeCloseTo(450 * 8, 6);
    });

    // @verified 2026-05-12: synthetic. Negative id is the "no map" sentinel from MapH(-1) at boot.
    test('skips draw when map id is negative', () => {
        const map = {id: -1, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

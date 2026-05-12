// synthetic: ctx.drawImage and ctx.translate inspection. The map asset is drawn at the cluster's
// minimapBounds extent and its center is translated to match the bounds midpoint in cluster coords.
// Real-zone values for the same ids live in _ZonesDatabase.test.js.

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
        getMapBoundsSize: vi.fn(() => [830, 830]),
        getMapBoundsCenter: vi.fn(() => [0, 0]),
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

function lastTranslate(ctx) {
    const calls = ctx.translate.mock.calls;
    return calls[calls.length - 1];
}

describe('MapsDrawing per-zone bounds', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MapDrawing();
        drawing.getZoomLevel = vi.fn(() => 1.0);
        drawing.getCanvasCenter = vi.fn(() => 250);
        ctx = buildCtx();
    });

    // @verified 2026-05-12: synthetic. Default 830x830 bounds match the legacy outdoor baseline.
    test('default bounds draw image at 830 * scaleFactor square with no center offset', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([830, 830]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([0, 0]);
        const map = {id: '0212', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(3320, 6);
        expect(drawCall[4]).toBeCloseTo(3320, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-13: synthetic. Non-square plaza (550x450) with bounds center (-120, 20).
    // The offset shifts so the asset's pixel center (which maps to bounds midpoint) aligns with
    // the player's actual cluster position.
    test('non-square plaza draws at W * sf x H * sf with bounds-center offset', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([550, 450]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([-120, 20]);
        const map = {id: '5001', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(550 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(450 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-(0 - -120) * 4, 6);
        expect(tr[1]).toBeCloseTo((0 + 20) * 4, 6);
    });

    // @verified 2026-05-13: synthetic. Player at the asset center sees no extra shift over legacy.
    test('player at asset center reduces translation to zero', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([550, 450]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([-120, 20]);
        const map = {id: '5001', hX: -120, hY: -20};

        drawing.draw(ctx, map);

        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-13: synthetic. Brecilien Bank asset shape (450x450 with center (-60, 0)).
    test('square bank shape applies horizontal asset-center shift', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([450, 450]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([-60, 0]);
        const map = {id: '5002', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(450 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(450 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-(0 - -60) * 4, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-13: synthetic. Tetford Market asset shape (70x70 center (0, 80)).
    test('tiny offset asset bounds compute the asset-center translation', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([70, 70]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([0, 80]);
        const map = {id: '0007', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(70 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(70 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(80 * 4, 6);
    });

    // @verified 2026-05-13: synthetic. Zoom multiplier flows through W, H, and offsets uniformly.
    test('zoom multiplier scales W, H, player offset and asset offset uniformly', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([550, 450]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([-120, 20]);
        drawing.getZoomLevel.mockReturnValue(2.0);
        const map = {id: '5001', hX: 10, hY: -5};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(550 * 8, 6);
        expect(drawCall[4]).toBeCloseTo(450 * 8, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-(10 - -120) * 8, 6);
        expect(tr[1]).toBeCloseTo((-5 + 20) * 8, 6);
    });

    // @verified 2026-05-12: synthetic. Negative id is the "no map" sentinel from MapH(-1) at boot.
    test('skips draw when map id is negative', () => {
        const map = {id: -1, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

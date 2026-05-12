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
    test('default bounds draw image at 830 * scaleFactor and apply no center offset', () => {
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

    // @verified 2026-05-12: synthetic. Brecilien plaza shape (400x400 centered).
    test('centered small bounds draw at 400 * scaleFactor with no offset', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([400, 400]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([0, 0]);
        const map = {id: '5001', hX: 50, hY: -30};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(1600, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-50 * 4, 6);
        expect(tr[1]).toBeCloseTo(-30 * 4, 6);
    });

    // @verified 2026-05-12: synthetic. Brecilien Bank shape (170x170 with bounds center (5, -75)).
    // Player at lpX=10, lpY=20 (hY = -lpY = -20). Image must be translated so bounds center (5, -75)
    // lands at image origin: translate(-(hX - cx) * sf, (hY + cy) * sf) = (-(10-5)*4, (-20 + -75)*4)
    // = (-20, -380).
    test('offset small bounds apply center offset to the translation', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([170, 170]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([5, -75]);
        const map = {id: '5002', hX: 10, hY: -20};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(170 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-(10 - 5) * 4, 6);
        expect(tr[1]).toBeCloseTo((-20 + -75) * 4, 6);
    });

    // @verified 2026-05-12: synthetic. Brecilien main shape (700x700 with bounds center (95, -5)).
    // Player at hX=0, hY=0. With offsetX = (0 - 95) * 4 = -380 passed to DrawImageMap,
    // the inner ctx.translate(-offsetX, offsetY) yields translate(380, -20).
    test('offset rectangular-cluster bounds still use bounds center, not @size', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([700, 700]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([95, -5]);
        const map = {id: '5000', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(700 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(95 * 4, 6);
        expect(tr[1]).toBeCloseTo(-5 * 4, 6);
    });

    // @verified 2026-05-12: synthetic. Zoom multiplier flows through size and offset uniformly.
    test('zoom multiplier scales size, player offset and bounds offset uniformly', () => {
        zonesDatabase.getMapBoundsSize.mockReturnValueOnce([170, 170]);
        zonesDatabase.getMapBoundsCenter.mockReturnValueOnce([5, -75]);
        drawing.getZoomLevel.mockReturnValue(2.0);
        const map = {id: '5002', hX: 10, hY: -20};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(170 * 8, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-(10 - 5) * 8, 6);
        expect(tr[1]).toBeCloseTo((-20 + -75) * 8, 6);
    });

    // @verified 2026-05-12: synthetic. Negative id is the "no map" sentinel from MapH(-1) at boot.
    test('skips draw when map id is negative', () => {
        const map = {id: -1, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

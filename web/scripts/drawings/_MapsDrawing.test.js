// synthetic: ctx.drawImage and ctx.translate inspection.
// Asset pixel center sits at cluster (0, 0) for every cluster (legacy invariant). The asset's
// game-unit extent is the smallest symmetric box around (0, 0) that fits the rendered content.
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
        getMapAssetExtent: vi.fn(() => 825),
        getMapAssetCenter: vi.fn(() => ({x: 0, y: 0})),
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

describe('MapsDrawing per-zone asset extent', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MapDrawing();
        drawing.getZoomLevel = vi.fn(() => 1.0);
        drawing.getCanvasCenter = vi.fn(() => 250);
        ctx = buildCtx();
    });

    // @verified 2026-05-13: synthetic. Default 825 extent matches the legacy baseline confirmed
    // to center almost every cluster correctly.
    test('default extent draws image as 825 * sf square with legacy translate', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(825);
        const map = {id: '0212', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(825 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(825 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-14: synthetic. Symmetric bounds (center 0, 0), player at origin.
    test('symmetric center, player at origin: no translate', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(400);
        zonesDatabase.getMapAssetCenter.mockReturnValueOnce({x: 0, y: 0});
        const map = {id: '5001', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(400 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(400 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-14: synthetic. 5002 Bank: extent 170, center (5, -75). Player at origin.
    // adjX = (0 - 5) * 4 = -20, ctx.translate(-adjX, adjY) -> tr[0] = +20.
    // adjY = (0 + (-75)) * 4 = -300 -> tr[1] = -300.
    test('asymmetric center applies offset on translate at origin', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(170);
        zonesDatabase.getMapAssetCenter.mockReturnValueOnce({x: 5, y: -75});
        const map = {id: '5002', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(170 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(170 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(20, 6);
        expect(tr[1]).toBeCloseTo(-300, 6);
    });

    // @verified 2026-05-14: synthetic. Player at lpX=6.15, lpY=-72.08 (so hX=6.15, hY=72.08).
    // 5002 center (5, -75). adjX = (6.15 - 5) * 4 = 4.6, adjY = (72.08 + (-75)) * 4 = -11.68.
    // tr[0] = -4.6, tr[1] = -11.68.
    test('player at bounds midpoint cancels offset', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(170);
        zonesDatabase.getMapAssetCenter.mockReturnValueOnce({x: 5, y: -75});
        const map = {id: '5002', hX: 6.15, hY: 72.08};

        drawing.draw(ctx, map);

        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-4.6, 6);
        expect(tr[1]).toBeCloseTo(-11.68, 6);
    });

    // @verified 2026-05-14: synthetic. Symmetric center (0, 0) reduces to legacy translate.
    test('symmetric center uses legacy translate(-hX*sf, hY*sf)', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(170);
        zonesDatabase.getMapAssetCenter.mockReturnValueOnce({x: 0, y: 0});
        const map = {id: '5002', hX: 50, hY: -30};

        drawing.draw(ctx, map);

        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-50 * 4, 6);
        expect(tr[1]).toBeCloseTo(-30 * 4, 6);
    });

    // @verified 2026-05-14: synthetic. Zoom multiplier scales size and offset uniformly.
    // adjX = (10 - 5) * 8 = 40, adjY = (-5 + (-75)) * 8 = -640.
    test('zoom multiplier scales size and offset uniformly', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(170);
        zonesDatabase.getMapAssetCenter.mockReturnValueOnce({x: 5, y: -75});
        drawing.getZoomLevel.mockReturnValue(2.0);
        const map = {id: '5002', hX: 10, hY: -5};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(170 * 8, 6);
        expect(drawCall[4]).toBeCloseTo(170 * 8, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-40, 6);
        expect(tr[1]).toBeCloseTo(-640, 6);
    });

    // @verified 2026-05-13: synthetic. Negative id is the "no map" sentinel from MapH(-1) at boot.
    test('skips draw when map id is negative', () => {
        const map = {id: -1, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

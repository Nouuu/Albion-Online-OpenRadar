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

    // @verified 2026-05-13: synthetic. Brecilien plaza extent 790; legacy translate, no asset
    // offset.
    test('plaza extent 790 draws square at 790 * sf with no asset offset', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(790);
        const map = {id: '5001', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(790 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(790 * 4, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(0, 6);
        expect(tr[1]).toBeCloseTo(0, 6);
    });

    // @verified 2026-05-13: synthetic. Player movement uses translate(-hX*sf, hY*sf), the legacy
    // formula proven correct by the user-baseline observation.
    test('player movement uses legacy translate(-hX*sf, hY*sf)', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(570);
        const map = {id: '5002', hX: 50, hY: -30};

        drawing.draw(ctx, map);

        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-50 * 4, 6);
        expect(tr[1]).toBeCloseTo(-30 * 4, 6);
    });

    // @verified 2026-05-13: synthetic. Tetford Market extent 230; image fits the canvas instead
    // of being stretched to the legacy 825 (3.6x over-stretch).
    test('tiny extent 230 draws square at 230 * sf', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(230);
        const map = {id: '0007', hX: 0, hY: 0};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(230 * 4, 6);
        expect(drawCall[4]).toBeCloseTo(230 * 4, 6);
    });

    // @verified 2026-05-13: synthetic. Zoom multiplier flows through size and player offset.
    test('zoom multiplier scales size and player offset uniformly', () => {
        zonesDatabase.getMapAssetExtent.mockReturnValueOnce(790);
        drawing.getZoomLevel.mockReturnValue(2.0);
        const map = {id: '5001', hX: 10, hY: -5};

        drawing.draw(ctx, map);

        const drawCall = ctx.drawImage.mock.calls[0];
        expect(drawCall[3]).toBeCloseTo(790 * 8, 6);
        expect(drawCall[4]).toBeCloseTo(790 * 8, 6);
        const tr = lastTranslate(ctx);
        expect(tr[0]).toBeCloseTo(-10 * 8, 6);
        expect(tr[1]).toBeCloseTo(-5 * 8, 6);
    });

    // @verified 2026-05-13: synthetic. Negative id is the "no map" sentinel from MapH(-1) at boot.
    test('skips draw when map id is negative', () => {
        const map = {id: -1, hX: 0, hY: 0};

        drawing.draw(ctx, map);

        expect(ctx.drawImage).not.toHaveBeenCalled();
    });
});

// synthetic: unit tests on DrawingUtils helpers (size scaling, image rendering, badge primitives).

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('./SettingsSync.js', () => ({
    default: {
        getFloat: vi.fn(() => null),
        getNumber: vi.fn(() => 500),
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
    },
}));

vi.mock('./ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(),
        preloadImageAndAddToList: vi.fn(() => Promise.resolve()),
    },
}));

const {DrawingUtils} = await import('./DrawingUtils.js');
const settingsSync = (await import('./SettingsSync.js')).default;
const imageCache = (await import('./ImageCache.js')).default;

describe('DrawingUtils marker scaling helpers', () => {
    let utils;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        utils = new DrawingUtils();
        utils.getZoomLevel = vi.fn(() => 1.0);
        utils.getCanvasScale = vi.fn(() => 1.0);
    });

    // @verified 2026-05-01: default returns 1.0 when settingIconSize is unset (backward compat).
    test('getIconSizeMultiplier returns 1.0 when settingIconSize is unset', () => {
        settingsSync.getFloat.mockReturnValue(null);
        expect(utils.getIconSizeMultiplier()).toBe(1.0);
    });

    // @verified 2026-05-01: returns the configured value when settingIconSize is set.
    test('getIconSizeMultiplier returns configured value', () => {
        settingsSync.getFloat.mockImplementation(key => key === 'settingIconSize' ? 1.5 : null);
        expect(utils.getIconSizeMultiplier()).toBe(1.5);
    });

    // @verified 2026-05-01: NaN/0 fallback to 1.0 to keep markers visible.
    test('getIconSizeMultiplier falls back to 1.0 when value is 0 or NaN', () => {
        settingsSync.getFloat.mockReturnValue(0);
        expect(utils.getIconSizeMultiplier()).toBe(1.0);
        settingsSync.getFloat.mockReturnValue(NaN);
        expect(utils.getIconSizeMultiplier()).toBe(1.0);
    });

    // @verified 2026-05-01: getMarkerSize composes getScaledSize with the icon multiplier.
    test('getMarkerSize equals base * iconSize * zoom * canvasScale', () => {
        settingsSync.getFloat.mockImplementation(key => key === 'settingIconSize' ? 2.0 : null);
        utils.getZoomLevel = vi.fn(() => 1.5);
        utils.getCanvasScale = vi.fn(() => 0.8);
        expect(utils.getMarkerSize(40)).toBeCloseTo(40 * 2.0 * 1.5 * 0.8);
    });

    // @verified 2026-05-01: with default multiplier and unit zoom/scale, getMarkerSize returns base.
    test('getMarkerSize returns base when all factors are 1', () => {
        settingsSync.getFloat.mockReturnValue(null);
        expect(utils.getMarkerSize(40)).toBe(40);
        expect(utils.getMarkerSize(7)).toBe(7);
    });

    // @verified 2026-05-01: getScaledSize unchanged, does not include the icon multiplier (overlay sizing).
    test('getScaledSize does not apply iconSize multiplier (overlays unaffected)', () => {
        settingsSync.getFloat.mockImplementation(key => key === 'settingIconSize' ? 2.0 : null);
        utils.getZoomLevel = vi.fn(() => 1.5);
        utils.getCanvasScale = vi.fn(() => 0.8);
        expect(utils.getScaledSize(40)).toBeCloseTo(40 * 1.5 * 0.8);
    });
});

describe('DrawingUtils.DrawCustomImage uses marker scaling', () => {
    let utils;
    let ctx;
    let preloadedImage;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        utils = new DrawingUtils();
        utils.getZoomLevel = vi.fn(() => 1.0);
        utils.getCanvasScale = vi.fn(() => 1.0);
        utils.drawFilledCircle = vi.fn();
        ctx = {drawImage: vi.fn()};
        preloadedImage = {width: 1, height: 1};
    });

    // @verified 2026-05-01: with a preloaded image, ctx.drawImage uses getMarkerSize-derived size.
    test('drawImage size equals getMarkerSize(size) when iconSize=1.0', () => {
        settingsSync.getFloat.mockReturnValue(null);
        imageCache.GetPreloadedImage.mockReturnValue(preloadedImage);
        utils.DrawCustomImage(ctx, 100, 100, 'fiber_5_2', 'Resources', 40);
        expect(ctx.drawImage).toHaveBeenCalledWith(preloadedImage, 100 - 20, 100 - 20, 40, 40);
    });

    // @verified 2026-05-01: iconSize=2.0 doubles the rendered image size, not the overlay size.
    test('drawImage size scales with iconSize multiplier', () => {
        settingsSync.getFloat.mockImplementation(key => key === 'settingIconSize' ? 2.0 : null);
        imageCache.GetPreloadedImage.mockReturnValue(preloadedImage);
        utils.DrawCustomImage(ctx, 100, 100, 'fiber_5_2', 'Resources', 40);
        expect(ctx.drawImage).toHaveBeenCalledWith(preloadedImage, 100 - 40, 100 - 40, 80, 80);
    });

    // @verified 2026-05-01: when the image is missing (null), the loading-fallback circle uses getMarkerSize too.
    test('loading-fallback circle uses getMarkerSize(10) and the royal blue color', () => {
        settingsSync.getFloat.mockImplementation(key => key === 'settingIconSize' ? 1.5 : null);
        imageCache.GetPreloadedImage.mockReturnValue(null);
        utils.DrawCustomImage(ctx, 100, 100, 'fiber_5_2', 'Resources', 40);
        expect(utils.drawFilledCircle).toHaveBeenCalledWith(ctx, 100, 100, 15, '#4169E1');
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    // @verified 2026-05-01: undefined imageName is a no-op (existing contract).
    test('DrawCustomImage is a no-op when imageName is undefined', () => {
        utils.DrawCustomImage(ctx, 100, 100, undefined, 'Resources', 40);
        expect(ctx.drawImage).not.toHaveBeenCalled();
        expect(utils.drawFilledCircle).not.toHaveBeenCalled();
    });
});

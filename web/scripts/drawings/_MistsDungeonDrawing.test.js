// synthetic: drawing pipeline contract; canvas pixels not asserted (DrawingUtils mocked).

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {getBool: vi.fn(() => true)},
}));
vi.mock('../utils/ImageCache.js', () => ({
    default: {GetPreloadedImage: vi.fn(() => ({})), preloadImageAndAddToList: vi.fn()},
}));

const {MistsDungeonDrawing} = await import('./MistsDungeonDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MistsDungeonDrawing', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        drawing = new MistsDungeonDrawing();
        drawing.transformPoint = vi.fn(() => ({x: 100, y: 200}));
        drawing.DrawCustomImage = vi.fn();
        drawing.interpolateEntity = vi.fn();
    });

    // @verified 2026-05-14: synthetic. interpolate calls interpolateEntity per portal.
    test('interpolate calls interpolateEntity per portal', () => {
        const portals = [
            {id: 1, hX: 0, hY: 0, drawName: 'mists_abbey'},
            {id: 2, hX: 0, hY: 0, drawName: 'mists_abbey'},
        ];

        drawing.interpolate(portals, 0, 0, 0.5);

        expect(drawing.interpolateEntity).toHaveBeenCalledTimes(2);
    });

    // @verified 2026-05-14: synthetic. draw routes each portal through DrawCustomImage.
    test('draw renders each portal via DrawCustomImage with size 32', () => {
        const portals = [
            {id: 1, hX: 10, hY: 20, drawName: 'mists_abbey'},
            {id: 2, hX: 30, hY: 40, drawName: 'mists_abbey'},
        ];
        ctx = {};

        drawing.draw(ctx, portals);

        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(2);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 100, 200, 'mists_abbey', 'Resources', 32);
    });

    // @verified 2026-05-14: synthetic. Setting off skips draw entirely.
    test('draw skips entirely when settingShowKnightfallAbbey is false', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowKnightfallAbbey');
        const portals = [{id: 1, hX: 0, hY: 0, drawName: 'mists_abbey'}];

        drawing.draw({}, portals);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-05-14: synthetic. Portals without drawName are skipped (defensive).
    test('draw skips portal entries with no drawName', () => {
        drawing.draw({}, [{id: 1, hX: 0, hY: 0, drawName: undefined}]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });
});

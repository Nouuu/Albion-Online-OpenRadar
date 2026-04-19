// synthetic: wisp entity and settings mock constructed for drawing unit tests

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {MistsWispDrawing} = await import('./MistsWispDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MistsWispDrawing', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MistsWispDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawText = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
    });

    // @verified 2026-04-19: master gate settingWispSpawn=false skips all render calls.
    test('renders nothing when settingWispSpawn is false', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-19: settingWispSpawn=true renders wisp_sign image at transformed point.
    test('renders wisp_sign image when settingWispSpawn is true', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'wisp_sign', 'Resources', 20
        );
    });

    // @verified 2026-04-19: debug overlay settingWispSpawnDebugID=true draws id as text below the wisp.
    test('renders debug ID text when settingWispSpawnDebugID is true', () => {
        settingsSync.getBool.mockImplementation(key =>
            key === 'settingWispSpawn' || key === 'settingWispSpawnDebugID');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.drawText).toHaveBeenCalledWith(10, 38, '42', ctx);
    });

    // @verified 2026-04-19: settingWispSpawnDebugID=false suppresses the text overlay.
    test('does not render debug ID when settingWispSpawnDebugID is false', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingWispSpawn');
        const wisp = {id: 42, hX: 10, hY: 20};

        drawing.invalidate(ctx, [wisp]);

        expect(drawing.drawText).not.toHaveBeenCalled();
    });

    // @verified 2026-04-19: interpolate delegates to interpolateEntity per wisp in the collection.
    test('interpolate delegates to interpolateEntity per wisp', () => {
        const wisps = [{id: 1}, {id: 2}];

        drawing.interpolate(wisps, 0, 0, 0.5);

        expect(drawing.interpolateEntity).toHaveBeenCalledTimes(2);
    });
});

// synthetic: mist entities constructed to cover filter gates and debug overlay.

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
        drawing.drawTextItems = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
    });

    // @verified 2026-04-23: master gate settingWispSpawn=false skips all feu follet rendering.
    test('MIST-1: settingWispSpawn=false skips all feu follets regardless of filters', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingWispSpawn');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: solo E0 feu follet renders mist_0 when settingMistSolo+settingMistE0 pass.
    test('MIST-1: solo enchant 0 renders mist_0', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 223827, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_0', 'Resources', 21
        );
    });

    // @verified 2026-04-23: enchant filter gate. settingMistE0=false skips an E0 feu follet.
    test('MIST-1: settingMistE0=false skips the E0 feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistE0');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: type filter gate. settingMistSolo=false skips a solo feu follet even with E0 on.
    test('MIST-1: settingMistSolo=false skips solo feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: duo type uses settingMistDuo gate.
    test('MIST-1: duo feu follet renders when settingMistDuo=true', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 1, hX: 10, hY: 20, type: 1, enchant: 1};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_1', 'Resources', 21
        );
    });

    // @verified 2026-04-23: duo feu follet skipped when settingMistDuo=false.
    test('MIST-1: settingMistDuo=false skips duo feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistDuo');
        const mist = {id: 1, hX: 10, hY: 20, type: 1, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: settingWispSpawnDebugID=true draws id text below the mist.
    test('MIST-1: settingWispSpawnDebugID=true draws id text below', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 223827, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.drawTextItems).toHaveBeenCalledWith(
            expect.any(Number), 46, '223827', ctx, '10px', '#CCCCCC'
        );
    });

    // @verified 2026-04-23: settingWispSpawnDebugID=false suppresses the id text overlay.
    test('MIST-1: settingWispSpawnDebugID=false does not draw id text', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingWispSpawnDebugID');
        const mist = {id: 223827, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: interpolate delegates to interpolateEntity per mist in the collection.
    test('interpolate delegates to interpolateEntity per mist', () => {
        const mists = [{id: 1}, {id: 2}];

        drawing.interpolate(mists, 0, 0, 0.5);

        expect(drawing.interpolateEntity).toHaveBeenCalledTimes(2);
    });
});

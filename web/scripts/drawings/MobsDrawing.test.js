import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {MobsDrawing} = await import('./MobsDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MobsDrawing mist rendering', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MobsDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
    });

    test('MIST-1: MISTS_SOLO_YELLOW with settingMistE0=true and settingMistSolo=true renders mist_0', () => {
        settingsSync.getBool.mockImplementation(key => true);
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_0', 'Resources', 21
        );
    });

    test('MIST-1: settingMistE0=false skips the mist render', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistE0');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    test('MIST-1: settingMistSolo=false skips solo mist even with E0=true', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });
});

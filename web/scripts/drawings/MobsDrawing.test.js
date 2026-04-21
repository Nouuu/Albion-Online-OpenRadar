import {describe, test, expect, beforeEach, vi} from 'vitest';

// pcap-derived: none
// synthetic: mist entity constructed for gate isolation

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
        drawing.drawTextItems = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 10}))};
    });

    // @verified 2026-04-19: mist rendered when settingMistE0=true AND settingMistSolo=true (gate passes).
    test('MIST-1: MISTS_SOLO_YELLOW with settingMistE0=true and settingMistSolo=true renders mist_0', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_0', 'Resources', 21
        );
    });

    // @verified 2026-04-19: enchant gate correctly skips mist when settingMistE0=false.
    test('MIST-1: settingMistE0=false skips the mist render', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistE0');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-19: solo type gate skips render when settingMistSolo=false regardless of enchant.
    test('MIST-1: settingMistSolo=false skips solo mist even with E0=true', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [], [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });
});

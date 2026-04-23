// synthetic: chest entities constructed to cover each rarity gate in ChestsDrawing.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {ChestsDrawing} = await import('./ChestsDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('ChestsDrawing', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new ChestsDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        ctx = {};
    });

    // @verified 2026-04-23: setting key is settingChestGreen (no stray 's'). Regression guard for fix 893a6884.
    test('settingChestGreen=true with standard chestName renders green asset', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingChestGreen');
        const chest = {hX: 10, hY: 20, chestName: 'TREASURE_STANDARD_01'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'green', 'Resources', 35);
    });

    // @verified 2026-04-23: setting key is settingChestBlue (no stray 's').
    test('settingChestBlue=true with uncommon chestName renders blue asset', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingChestBlue');
        const chest = {hX: 10, hY: 20, chestName: 'TREASURE_UNCOMMON_02'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'blue', 'Resources', 35);
    });

    // @verified 2026-04-23: setting key is settingChestPurple (no stray 's').
    test('settingChestPurple=true with rare chestName renders rare asset', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingChestPurple');
        const chest = {hX: 10, hY: 20, chestName: 'TREASURE_RARE_03'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'rare', 'Resources', 35);
    });

    // @verified 2026-04-23: setting key is settingChestYellow (no stray 's').
    test('settingChestYellow=true with legendary chestName renders legendary asset', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingChestYellow');
        const chest = {hX: 10, hY: 20, chestName: 'TREASURE_LEGENDARY_04'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'legendary', 'Resources', 35);
    });

    // @verified 2026-04-23: color-named suffix (green/blue/rare/legendary keywords) also triggers the corresponding branch.
    test('chestName with color keyword triggers matching rarity branch', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const chest = {hX: 5, hY: 5, chestName: 'SWAMP_RED_LOOTCHEST_GREEN_01'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 5, 5, 'green', 'Resources', 35);
    });

    // @verified 2026-04-23: all settings off skip every chest entirely.
    test('all settings off skips every chest', () => {
        settingsSync.getBool.mockImplementation(() => false);
        const chest = {hX: 10, hY: 20, chestName: 'TREASURE_STANDARD_01'};

        drawing.invalidate(ctx, [chest]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: interpolate delegates to interpolateEntity per chest.
    test('interpolate delegates to interpolateEntity per chest', () => {
        const chests = [{id: 1}, {id: 2}];

        drawing.interpolate(chests, 0, 0, 0.5);

        expect(drawing.interpolateEntity).toHaveBeenCalledTimes(2);
    });
});

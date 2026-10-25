// synthetic: mist entities constructed to cover filter gates and debug overlay.

import {describe, test, expect, beforeEach, vi} from 'vitest';

const {registryDefault} = await vi.hoisted(() => import('../utils/SettingsRegistry.js'));

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getFloat: vi.fn(key => registryDefault(key)),
    },
}));

const {MistsWispDrawing, WISP_RARITIES} = await import('./MistsWispDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MistsWispDrawing', () => {
    let drawing;
    let ctx;
    let rings;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MistsWispDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawTextItems = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        rings = [];
        ctx = {
            font: '', measureText: vi.fn(() => ({width: 12})),
            save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
            stroke: vi.fn(() => rings.push({color: ctx.strokeStyle, glow: ctx.shadowBlur ?? 0, width: ctx.lineWidth})),
        };
    });

    // @verified 2026-04-23: master gate settingMistsWisps=false skips all feu follet rendering.
    test('MIST-1: settingMistsWisps=false skips all feu follets regardless of filters', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsWisps');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: solo E0 feu follet renders mist_0 when settingMistsSolo+settingMistsEnchant0 pass.
    test('MIST-1: solo enchant 0 renders mist_0', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 223827, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_0', 'Resources', 21
        );
    });

    // @verified 2026-04-23: enchant filter gate. settingMistsEnchant0=false skips an E0 feu follet.
    test('MIST-1: settingMistsEnchant0=false skips the E0 feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsEnchant0');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: type filter gate. settingMistsSolo=false skips a solo feu follet even with E0 on.
    test('MIST-1: settingMistsSolo=false skips solo feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsSolo');
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: duo type uses settingMistsDuo gate.
    test('MIST-1: duo feu follet renders when settingMistsDuo=true', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 1, hX: 10, hY: 20, type: 1, enchant: 1};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(
            ctx, 10, 20, 'mist_1', 'Resources', 21
        );
    });

    // @verified 2026-04-23: duo feu follet skipped when settingMistsDuo=false.
    test('MIST-1: settingMistsDuo=false skips duo feu follet', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsDuo');
        const mist = {id: 1, hX: 10, hY: 20, type: 1, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-23: settingDebugMistsWispIds=true draws id text below the mist.
    test('MIST-1: settingDebugMistsWispIds=true draws id text below', () => {
        settingsSync.getBool.mockImplementation(() => true);
        const mist = {id: 223827, hX: 10, hY: 20, type: 0, enchant: 0};

        drawing.invalidate(ctx, [mist]);

        expect(drawing.drawTextItems).toHaveBeenCalledWith(
            expect.any(Number), 46, '223827', ctx, '10px', '#CCCCCC'
        );
    });

    // @verified 2026-04-23: settingDebugMistsWispIds=false suppresses the id text overlay.
    test('MIST-1: settingDebugMistsWispIds=false does not draw id text', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingDebugMistsWispIds');
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

    // @verified 2026-09-24: a mist without an enchant value must not read an undefined-suffixed setting key.
    test('a mist with an undefined enchant does not read an undefined-suffixed setting key', () => {
        const error = vi.fn();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error};
        settingsSync.getBool.mockImplementation(key => {
            if (key.includes('undefined')) error('SettingsSyncUnknownKey', {key});
            return true;
        });
        const mist = {id: 1, hX: 10, hY: 20, type: 0, enchant: undefined};

        drawing.invalidate(ctx, [mist]);

        expect(error).not.toHaveBeenCalled();
    });

    describe('rarity ring', () => {
        // @verified 2026-10-25: rarity ladder from NewMob Parameters[34], colors from the in-game wisp trail
        // (white, green, blue, purple, golden yellow); a Peu commun portal was observed live with value 1.
        test.each([
            [0, 'Common', '#ffffff', false],
            [1, 'Uncommon', '#4ade80', false],
            [2, 'Rare', '#3b82f6', false],
            [3, 'Epic', '#a855f7', true],
            [4, 'Legendary', '#facc15', true],
        ])('rarity %d (%s) draws a %s ring, glow=%s, under the matching orb', (rarity, name, color, glow) => {
            settingsSync.getBool.mockImplementation(() => true);

            drawing.invalidate(ctx, [{id: 1, hX: 10, hY: 20, type: 0, enchant: rarity}]);

            expect(WISP_RARITIES[rarity].name).toBe(name);
            expect(rings).toHaveLength(1);
            expect(rings[0].color).toBe(color);
            expect(rings[0].glow > 0).toBe(glow);
            expect(ctx.arc).toHaveBeenCalledWith(10, 20, expect.any(Number), 0, 2 * Math.PI);
            expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'mist_' + rarity, 'Resources', 21);
            expect(ctx.arc.mock.invocationCallOrder[0]).toBeLessThan(drawing.DrawCustomImage.mock.invocationCallOrder[0]);
        });

        test('a higher rarity gets a thicker ring', () => {
            settingsSync.getBool.mockImplementation(() => true);

            drawing.invalidate(ctx, [0, 1, 2, 3, 4].map(enchant => ({id: enchant, hX: 0, hY: 0, type: 0, enchant})));

            const widths = rings.map(ring => ring.width);
            expect(widths).toEqual([...widths].sort((a, b) => a - b));
            expect(new Set(widths).size).toBe(5);
        });

        test('a filtered rarity draws neither ring nor orb', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistsEnchant4');

            drawing.invalidate(ctx, [{id: 1, hX: 10, hY: 20, type: 0, enchant: 4}, {id: 2, hX: 30, hY: 40, type: 0, enchant: 3}]);

            expect(rings.map(ring => ring.color)).toEqual(['#a855f7']);
            expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);
        });

        test('an unknown rarity value draws the orb without a ring and does not throw', () => {
            settingsSync.getBool.mockImplementation(() => true);

            expect(() => drawing.invalidate(ctx, [{id: 1, hX: 10, hY: 20, type: 0, enchant: 7}])).not.toThrow();
            expect(rings).toHaveLength(0);
        });
    });
});

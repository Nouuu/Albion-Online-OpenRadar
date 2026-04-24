// synthetic: living mobs constructed to cover render-time filter gates.
// No pcap fixture needed; filter logic is deterministic from entity + settings.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
    },
}));

const {MobsDrawing} = await import('./MobsDrawing.js');
const {EnemyType} = await import('../handlers/MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MobsDrawing living resource filter at render', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new MobsDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawTextItems = vi.fn();
        drawing.drawFilledCircle = vi.fn();
        drawing.drawDistanceIndicator = vi.fn();
        drawing.drawHealthBar = vi.fn();
        drawing.getEnemyColor = vi.fn(() => '#ffffff');
        drawing.getEnemyTypeName = vi.fn(() => 'unknown');
        drawing.getScaledSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
        settingsSync.getBool.mockReturnValue(true);
    });

    function livingMob({id = 1, tier = 4, enchant = 0, name = 'Fiber'} = {}) {
        return {
            id, typeId: 529, hX: 10, hY: 20, tier,
            enchantmentLevel: enchant, name,
            type: name === 'Hide' ? EnemyType.LivingSkinnable : EnemyType.LivingHarvestable,
            getCurrentHP: () => 100, maxHealth: 100,
        };
    }

    // @verified 2026-04-24: living mob with enchant=0 is skipped when settings e0 for family is off.
    test('living Fiber e0 is skipped when settingLivingFiberEnchants.e0 is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 0})], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: living mob with enchant=2 is rendered when settings e2 for family+tier is on.
    test('living Fiber e2 is rendered when settingLivingFiberEnchants.e2[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 40);
    });

    // @verified 2026-04-24: living Hide resolves via settingLivingHideEnchants correctly.
    test('living Hide e3 is rendered when settingLivingHideEnchants.e3[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingHideEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: [false, false, false, false, true, false, false, false], e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 5, enchant: 3, name: 'Hide'})], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_5_3', 'Resources', 40);
    });

    // @verified 2026-04-24: tier-specific off still blocks even if enchant setting is on for other tiers.
    test('living Fiber e2 T4 is skipped when settings e2 T4 is off (T5 on)', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, true, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: hostile enemy (non-living) is not subject to living filter; circle rendering path.
    test('hostile enemy (non-living) is not subject to living filter', () => {
        settingsSync.getJSON.mockReturnValue(null);
        const hostile = {
            id: 2, typeId: 2067, hX: 10, hY: 20, tier: 5, enchantmentLevel: 0,
            name: 'T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE',
            type: EnemyType.Enemy,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [hostile], []);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });
});

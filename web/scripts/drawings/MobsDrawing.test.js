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

describe('MobsDrawing DEAD critter routing (user live-test 2026-04-24: dead critters stay Living)', () => {
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

    function deadFiberMob({tier = 6, enchant = 0} = {}) {
        return {
            id: 5, typeId: 534, hX: 10, hY: 20, tier,
            enchantmentLevel: enchant, name: 'Fiber',
            type: EnemyType.LivingHarvestable,
            uniqueName: 'T6_MOB_CRITTER_FIBER_SWAMP_DEAD',
            getCurrentHP: () => 100, maxHealth: 100,
        };
    }

    function liveFiberMob({tier = 4, enchant = 0} = {}) {
        return {
            id: 6, typeId: 529, hX: 10, hY: 20, tier,
            enchantmentLevel: enchant, name: 'Fiber',
            type: EnemyType.LivingHarvestable,
            uniqueName: 'T4_MOB_CRITTER_FIBER_SWAMP_GREEN',
            getCurrentHP: () => 100, maxHealth: 100,
        };
    }

    // @verified 2026-04-24: user live-test confirmed DEAD critters must be controlled by Living,
    // not Static. Same semantic as live critters. Reason: in-game the carcass keeps the critter
    // identity and the user categorises it as a Living entity in the settings UI.
    test('DEAD Fiber T6 e0 renders when settingLivingFiberEnchants.e0 is on (Static has no effect)', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            if (key === 'settingStaticFiberEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            return null;
        });
        drawing.invalidate(ctx, [deadFiberMob()], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_6_0', 'Resources', 40);
    });

    // @verified 2026-04-24: DEAD carcass skipped when Living is off even if Static is on.
    test('DEAD Fiber T6 e0 is skipped when Living off, Static on (Static cannot rescue a living-routed entity)', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            if (key === 'settingStaticFiberEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            return null;
        });
        drawing.invalidate(ctx, [deadFiberMob()], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: live critter unchanged by DEAD routing; still gated by living settings.
    test('live Fiber T4 e0 renders when Living on (not Static); living path preserved', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticFiberEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            return null;
        });
        drawing.invalidate(ctx, [liveFiberMob()], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_0', 'Resources', 40);
    });

    // @verified 2026-04-24: live critter blocked when Living off, even if Static on (no cross-talk).
    test('live Fiber T4 e0 is skipped when Living off (Static on has no effect on live)', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticFiberEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            return null;
        });
        drawing.invalidate(ctx, [liveFiberMob()], []);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: DEAD carcass with enchant received after spawn (e2) rendered via Living filter.
    test('DEAD Fiber T7 e2 renders via settingLivingFiberEnchants.e2[6]=true', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, false, false, true, false], e3: Array(8).fill(false), e4: Array(8).fill(false)};
            if (key === 'settingStaticFiberEnchants') return null;
            return null;
        });
        const dead = {
            id: 7, typeId: 535, hX: 10, hY: 20, tier: 7,
            enchantmentLevel: 2, name: 'Fiber',
            type: EnemyType.LivingHarvestable,
            uniqueName: 'T7_MOB_CRITTER_FIBER_SWAMP_DEAD',
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [dead], []);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_7_2', 'Resources', 40);
    });
});

// pcap-derived: full-flow NewMobEvent -> drawing.invalidate using mobs/living-tier.json (typeIds 532/534 are real DEAD carcasses observed in capture).
// synthetic: synthetic entity constructors for edge cases where the corresponding mob was not observed in the 25-minute capture.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
        getNumber: vi.fn((_k, d) => d ?? 0),
    },
}));

const {MobsDrawing} = await import('./MobsDrawing.js');
const {EnemyType, MobsHandler} = await import('../handlers/MobsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MobsDrawing living resource filter at render', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
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
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: living mob with enchant=2 is rendered when settings e2 for family+tier is on.
    test('living Fiber e2 is rendered when settingLivingFiberEnchants.e2[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 40);
    });

    // @verified 2026-04-24: living Hide resolves via settingLivingHideEnchants correctly.
    test('living Hide e3 is rendered when settingLivingHideEnchants.e3[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingHideEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: [false, false, false, false, true, false, false, false], e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 5, enchant: 3, name: 'Hide'})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_5_3', 'Resources', 40);
    });

    // @verified 2026-04-24: tier-specific off still blocks even if enchant setting is on for other tiers.
    test('living Fiber e2 T4 is skipped when settings e2 T4 is off (T5 on)', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, true, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: hostile enemy (non-living) is not subject to living filter; circle rendering path.
    test('hostile enemy (non-living) is not subject to living filter', () => {
        settingsSync.getJSON.mockReturnValue(null);
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowMinimumHealthEnemies');
        const hostile = {
            id: 2, typeId: 2067, hX: 10, hY: 20, tier: 5, enchantmentLevel: 0,
            name: 'T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE', identified: true,
            type: EnemyType.Enemy,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [hostile]);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });
});

describe('MobsDrawing DEAD critter routing (user live-test 2026-04-24: dead critters stay Living)', () => {
    let drawing;
    let ctx;
    let mobsHandler;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
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
        mobsHandler = new MobsHandler();
    });

    function livingOn(family) {
        return {[`settingLiving${family}Enchants`]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}};
    }

    function livingOff(family) {
        return {[`settingLiving${family}Enchants`]: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}};
    }

    function staticOn(family) {
        return {[`settingStatic${family}Enchants`]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}};
    }

    function staticOff(family) {
        return {[`settingStatic${family}Enchants`]: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}};
    }

    function mockSettings(...maps) {
        const merged = Object.assign({}, ...maps);
        settingsSync.getJSON.mockImplementation(key => merged[key] ?? null);
    }

    // @verified 2026-04-24: pcap-derived, typeId=534 T6_MOB_CRITTER_FIBER_SWAMP_DEAD comes through
    // event 123 in mobs/living-tier.json. Full-flow MobsHandler -> drawing: Living Fiber T6 renders when
    // Living setting is on and Static setting is off. Pins the user live-test scenario end-to-end.
    test('pcap-derived full-flow: DEAD Fiber carcass typeId=534 renders via Living filter', async () => {
        const fx = await loadFixture('mobs', 'living-tier');
        const msg = fx.messages.find(m => m.parameters['1'] === 534);
        expect(msg).toBeDefined();
        const p = normalizeParams(msg.parameters);

        mockSettings(livingOn('Fiber'), staticOff('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'fiber_6_0', 'Resources', 40);
    });

    // @verified 2026-04-24: pcap-derived, Static filter has no effect on DEAD carcasses; turning Living off hides them.
    test('pcap-derived full-flow: DEAD Fiber carcass typeId=534 is skipped when Living off even if Static on', async () => {
        const fx = await loadFixture('mobs', 'living-tier');
        const msg = fx.messages.find(m => m.parameters['1'] === 534);
        const p = normalizeParams(msg.parameters);

        mockSettings(livingOff('Fiber'), staticOn('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: pcap-derived, second DEAD variant typeId=532 (T5 carcass) routes the same way.
    test('pcap-derived full-flow: DEAD Fiber carcass typeId=532 renders via Living T5 filter', async () => {
        const fx = await loadFixture('mobs', 'living-tier');
        const msg = fx.messages.find(m => m.parameters['1'] === 532);
        expect(msg).toBeDefined();
        const p = normalizeParams(msg.parameters);

        mockSettings(livingOn('Fiber'), staticOff('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'fiber_5_0', 'Resources', 40);
    });

    // @verified 2026-04-24: synthetic, carcass with post-spawn enchant is gated by the matching cell.
    // No DEAD carcass with enchant!=0 was observed in the capture; this pins the cell resolution for the
    // real runtime case where event 123 is followed by an enchant update.
    test('synthetic: DEAD Fiber T7 e2 renders via settingLivingFiberEnchants.e2[6]=true', () => {
        const settings = {
            settingLivingFiberEnchants: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, false, false, true, false], e3: Array(8).fill(false), e4: Array(8).fill(false)},
        };
        settingsSync.getJSON.mockImplementation(key => settings[key] ?? null);
        const dead = {
            id: 7, typeId: 535, hX: 10, hY: 20, tier: 7,
            enchantmentLevel: 2, name: 'Fiber',
            type: EnemyType.LivingHarvestable,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [dead]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_7_2', 'Resources', 40);
    });
});

describe('MobsDrawing minimum HP filter for hostile mobs (settingShowMinimumHealthEnemies + settingTextMinimumHealthEnemies)', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
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
    });

    function hostile({id = 1, maxHealth = 500, type = EnemyType.Enemy} = {}) {
        return {id, typeId: 9000, hX: 10, hY: 20, tier: 4, enchantmentLevel: 0, name: 'Hostile', identified: true, type, getCurrentHP: () => maxHealth, maxHealth};
    }

    // @verified 2026-04-24: when the filter is off, hostile mob below any value renders normally.
    test('filter off: hostile with maxHealth=100 still renders', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowMinimumHealthEnemies');
        settingsSync.getNumber.mockReturnValue(2100);

        drawing.invalidate(ctx, [hostile({maxHealth: 100})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, maxHealth below threshold skips the mob (no circle drawn).
    test('filter on: hostile with maxHealth=1000 below threshold=2100 is skipped', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingShowMinimumHealthEnemies' || key === 'settingEnemiesHealthBar');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingTextMinimumHealthEnemies' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 1000})]);

        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, maxHealth above threshold renders normally.
    test('filter on: hostile with maxHealth=3000 above threshold=2100 renders', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingShowMinimumHealthEnemies' || key === 'settingEnemiesHealthBar' || key === 'settingNormalEnemy');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingTextMinimumHealthEnemies' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 3000})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, boss (high tier hostile) with high HP still renders.
    test('filter on: boss with maxHealth=50000 above threshold=2100 renders', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingShowMinimumHealthEnemies' || key === 'settingEnemiesHealthBar' || key === 'settingBossEnemy');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingTextMinimumHealthEnemies' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 50000, type: EnemyType.Boss})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter applies only to hostile types; living resource is unaffected.
    test('filter on: living resource is not gated by min HP filter', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingShowMinimumHealthEnemies' || key === 'settingEnemiesHealthBar');
        settingsSync.getJSON.mockImplementation(key => key === 'settingLivingFiberEnchants' ? {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)} : null);
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingTextMinimumHealthEnemies' ? 2100 : (d ?? 0));

        const living = {id: 20, typeId: 529, hX: 10, hY: 20, tier: 4, enchantmentLevel: 0, name: 'Fiber', type: EnemyType.LivingHarvestable, getCurrentHP: () => 100, maxHealth: 100};
        drawing.invalidate(ctx, [living]);

        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });
});

describe('MobsDrawing hostile/drone/events filter at render (moved from spawn)', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getNumber.mockImplementation((_k, d) => d ?? 0);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
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
    });

    function hostile({id = 1, type = EnemyType.Enemy, identified = true, maxHealth = 500} = {}) {
        return {id, typeId: 9000, hX: 10, hY: 20, tier: 4, enchantmentLevel: 0, name: identified ? 'Known' : null, identified, type, getCurrentHP: () => maxHealth, maxHealth};
    }

    // @verified 2026-04-24: identified Enemy is skipped at render when settingNormalEnemy is off.
    test('identified Enemy with settingNormalEnemy=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingNormalEnemy');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Enemy})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: identified Boss is skipped when settingBossEnemy is off.
    test('identified Boss with settingBossEnemy=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingBossEnemy');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Boss})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: identified EnchantedEnemy is drawn when settingEnchantedEnemy is on.
    test('identified EnchantedEnemy with settingEnchantedEnemy=true is drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowMinimumHealthEnemies');
        drawing.invalidate(ctx, [hostile({type: EnemyType.EnchantedEnemy})]);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: unidentified mob uses settingShowUnmanagedEnemies gate.
    test('unidentified mob with settingShowUnmanagedEnemies=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowUnmanagedEnemies');
        drawing.invalidate(ctx, [hostile({identified: false})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: Drone gated by settingAvaloneDrones.
    test('Drone with settingAvaloneDrones=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingAvaloneDrones');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Drone})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: Events type gated by settingShowEventEnemies.
    test('Events enemy with settingShowEventEnemies=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowEventEnemies');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Events, identified: true})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: lastVisibleCount reflects only mobs that passed the render gates.
    test('lastVisibleCount counts only rendered mobs after filters', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingNormalEnemy');
        const kept = hostile({id: 1, type: EnemyType.Enemy});
        const dropped = hostile({id: 2, type: EnemyType.Boss});
        drawing.invalidate(ctx, [kept, dropped]);
        expect(drawing.lastVisibleCount).toBe(1);
    });

    // @verified 2026-04-24: lastVisibleCount resets at the start of every invalidate.
    test('lastVisibleCount resets on each invalidate call', () => {
        settingsSync.getBool.mockImplementation(() => false);
        drawing.invalidate(ctx, [hostile({id: 1})]);
        expect(drawing.lastVisibleCount).toBe(0);

        settingsSync.getBool.mockImplementation(key => key === 'settingNormalEnemy' || key === 'settingEnemiesHealthBar');
        drawing.invalidate(ctx, [hostile({id: 2})]);
        expect(drawing.lastVisibleCount).toBe(1);
    });
});

// pcap-derived: full-flow NewMobEvent -> drawing.invalidate using mobs/living-tier.json (2026-07-05 Mists capture).
// synthetic: constructed entities or name-derived wire ids for variants not observed in the post-patch corpus.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

const {registryDefault} = await vi.hoisted(() => import('../utils/SettingsRegistry.js'));

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
        getNumber: vi.fn(key => registryDefault(key)),
        getFloat: vi.fn(() => null),
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
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
        settingsSync.getBool.mockImplementation(key => key !== 'settingRadarResourceTierBadges');
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
    test('living Fiber e0 is skipped when settingResourcesLivingFiber.e0 is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingFiber'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: living mob with enchant=2 is rendered when settings e2 for family+tier is on.
    test('living Fiber e2 is rendered when settingResourcesLivingFiber.e2[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingFiber'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 32);
    });

    // @verified 2026-04-24: living Hide resolves via settingResourcesLivingHide correctly.
    test('living Hide e3 is rendered when settingResourcesLivingHide.e3[tier-1] is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingHide'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: [false, false, false, false, true, false, false, false], e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 5, enchant: 3, name: 'Hide'})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_5_3', 'Resources', 32);
    });

    // @verified 2026-04-24: tier-specific off still blocks even if enchant setting is on for other tiers.
    test('living Fiber e2 T4 is skipped when settings e2 T4 is off (T5 on)', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingFiber'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, true, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: hostile enemy (non-living) is not subject to living filter; circle rendering path.
    test('hostile enemy (non-living) is not subject to living filter', () => {
        settingsSync.getJSON.mockReturnValue(null);
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesMinHealthFilter');
        const hostile = {
            id: 2, typeId: 2067, hX: 10, hY: 20, tier: 5, enchantmentLevel: 0,
            name: 'T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE', identified: true,
            type: EnemyType.Enemy,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [hostile]);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-05-01: settingRadarResourceTierBadges=true on a living harvestable draws a badge with isLiving=true.
    test('living Fiber e2 with settingRadarResourceTierBadges=true draws a Fiber badge with gold border', () => {
        drawing.drawResourceBadge = vi.fn();
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingFiber'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 2})]);
        expect(drawing.drawResourceBadge).toHaveBeenCalledWith(ctx, 10, 20, 32, 'Fiber', 4, 2, true);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-05-01: living Skinnable Hide with badges on routes to Hide category badge.
    test('living Hide e3 LivingSkinnable with settingRadarResourceTierBadges=true draws a Hide badge', () => {
        drawing.drawResourceBadge = vi.fn();
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingHide'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: [false, false, false, false, true, false, false, false], e4: Array(8).fill(false)}
                : null
        );
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        drawing.invalidate(ctx, [livingMob({tier: 5, enchant: 3, name: 'Hide'})]);
        expect(drawing.drawResourceBadge).toHaveBeenCalledWith(ctx, 10, 20, 32, 'Hide', 5, 3, true);
    });

    // @verified 2026-05-01: badge mode falls back to DrawCustomImage when getResourceCategory returns null on a living mob.
    // Stub category resolution to null even though the living filter passes, to exercise the safety branch.
    test('living mob badge mode falls back to DrawCustomImage when getResourceCategory returns null', () => {
        drawing.drawResourceBadge = vi.fn();
        drawing.getResourceCategory = vi.fn(() => null);
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingResourcesLivingFiber' ? {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)} : null
        );
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        drawing.invalidate(ctx, [livingMob({tier: 4, enchant: 0})]);
        expect(drawing.drawResourceBadge).not.toHaveBeenCalled();
        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-05-01: hostile NPC is unaffected by settingRadarResourceTierBadges (badges apply to living harvestables only).
    test('hostile NPC stays as colored circle even when settingRadarResourceTierBadges=true', () => {
        drawing.drawResourceBadge = vi.fn();
        settingsSync.getJSON.mockReturnValue(null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges' || key === 'settingEnemiesNormal' || key === 'settingEnemiesShowHealthBars');
        const hostile = {
            id: 2, typeId: 2067, hX: 10, hY: 20, tier: 5, enchantmentLevel: 0,
            name: 'T5_MOB_ROAMING_KEEPER_CAMP_UNPROVEN_MALE', identified: true,
            type: EnemyType.Enemy,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [hostile]);
        expect(drawing.drawResourceBadge).not.toHaveBeenCalled();
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
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
        settingsSync.getBool.mockImplementation(key => key !== 'settingRadarResourceTierBadges');
        mobsHandler = new MobsHandler();
    });

    function livingOn(family) {
        return {[`settingResourcesLiving${family}`]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}};
    }

    function livingOff(family) {
        return {[`settingResourcesLiving${family}`]: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}};
    }

    function staticOn(family) {
        return {[`settingResourcesStatic${family}`]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}};
    }

    function staticOff(family) {
        return {[`settingResourcesStatic${family}`]: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}};
    }

    function mockSettings(...maps) {
        const merged = Object.assign({}, ...maps);
        settingsSync.getJSON.mockImplementation(key => merged[key] ?? null);
    }

    // @verified 2026-09-03: pcap-derived, 2026-09-03 Mists capture, wire 416. Full-flow MobsHandler -> drawing:
    // the fairy dragon draws its Resources icon when settingEnemiesMistsFairyDragon is on, and nothing when it is off.
    test('full-flow: fairy dragon draws FAIRYDRAGON from Resources when settingEnemiesMistsFairyDragon is on', async () => {
        const fx = await loadFixture('mobs', 'mist-boss-spawn');
        const p = normalizeParams(fx.messages.find(m => m.parameters['1'] === 416).parameters);
        settingsSync.getBool.mockImplementation(key => key !== 'settingRadarResourceTierBadges');

        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'FAIRYDRAGON', 'Resources', expect.any(Number));
    });

    // @verified 2026-09-04: every Mists boss icon the drawing asks for exists on disk at the path
    // DrawCustomImage composes, so the embedded server can serve it.
    test.each([
        'T6_MOB_MISTS_FAIRYDRAGON',
        'T7_MOB_MISTS_GRIFFIN',
        'T5_MOB_MISTS_SPIDER',
        'T6_MOB_ARCANE_CRYSTALSPIDER_BOSS',
    ])('full-flow: %s asks for an icon that exists under web/images', (uniqueName) => {
        const typeId = window.mobsDatabase.getTypeIdByName(uniqueName);
        expect(typeId).not.toBeNull();
        settingsSync.getBool.mockImplementation(key => key !== 'settingRadarResourceTierBadges');

        mobsHandler.NewMobEvent(normalizeParams({'0': 95000 + typeId, '1': typeId, '2': 255, '7': [0, 0], '13': 3000, '34': 0}));
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);
        const [, , , imageName, folder] = drawing.DrawCustomImage.mock.calls[0];
        const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'images', folder, `${imageName}.webp`);
        expect(existsSync(file), file).toBe(true);
    });

    test('full-flow: fairy dragon is skipped when settingEnemiesMistsFairyDragon is off', async () => {
        const fx = await loadFixture('mobs', 'mist-boss-spawn');
        const p = normalizeParams(fx.messages.find(m => m.parameters['1'] === 416).parameters);
        settingsSync.getBool.mockImplementation(key => key !== 'settingRadarResourceTierBadges' && key !== 'settingEnemiesMistsFairyDragon');

        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-07-05: name-derived T6_MOB_CRITTER_FIBER_SWAMP_DEAD (no DEAD carcass observed
    // in the post-patch corpus). Full-flow MobsHandler -> drawing: Living Fiber T6 renders when
    // Living setting is on and Static setting is off. Pins the user live-test scenario end-to-end.
    test('full-flow: DEAD Fiber T6 carcass renders via Living filter', () => {
        const typeId = window.mobsDatabase.getTypeIdByName('T6_MOB_CRITTER_FIBER_SWAMP_DEAD');
        expect(typeId).not.toBeNull();
        const p = normalizeParams({'0': 9601, '1': typeId, '2': 255, '7': [0, 0], '13': 1000, '33': 0});

        mockSettings(livingOn('Fiber'), staticOff('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'fiber_6_0', 'Resources', 32);
    });

    // @verified 2026-07-05: Static filter has no effect on DEAD carcasses; turning Living off hides them.
    test('full-flow: DEAD Fiber T6 carcass is skipped when Living off even if Static on', () => {
        const typeId = window.mobsDatabase.getTypeIdByName('T6_MOB_CRITTER_FIBER_SWAMP_DEAD');
        const p = normalizeParams({'0': 9602, '1': typeId, '2': 255, '7': [0, 0], '13': 1000, '33': 0});

        mockSettings(livingOff('Fiber'), staticOn('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-07-05: second DEAD variant T5_MOB_CRITTER_FIBER_SWAMP_DEAD routes the same way.
    test('full-flow: DEAD Fiber T5 carcass renders via Living T5 filter', () => {
        const typeId = window.mobsDatabase.getTypeIdByName('T5_MOB_CRITTER_FIBER_SWAMP_DEAD');
        expect(typeId).not.toBeNull();
        const p = normalizeParams({'0': 9603, '1': typeId, '2': 255, '7': [0, 0], '13': 1000, '33': 0});

        mockSettings(livingOn('Fiber'), staticOff('Fiber'));
        mobsHandler.NewMobEvent(p);
        drawing.invalidate(ctx, mobsHandler.getMobList(), []);

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'fiber_5_0', 'Resources', 32);
    });

    // @verified 2026-04-24: synthetic, carcass with post-spawn enchant is gated by the matching cell.
    // No DEAD carcass with enchant!=0 was observed in the capture; this pins the cell resolution for the
    // real runtime case where event 123 is followed by an enchant update.
    test('synthetic: DEAD Fiber T7 e2 renders via settingResourcesLivingFiber.e2[6]=true', () => {
        const settings = {
            settingResourcesLivingFiber: {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, false, false, true, false], e3: Array(8).fill(false), e4: Array(8).fill(false)},
        };
        settingsSync.getJSON.mockImplementation(key => settings[key] ?? null);
        const dead = {
            id: 7, typeId: 535, hX: 10, hY: 20, tier: 7,
            enchantmentLevel: 2, name: 'Fiber',
            type: EnemyType.LivingHarvestable,
            getCurrentHP: () => 100, maxHealth: 100,
        };
        drawing.invalidate(ctx, [dead]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_7_2', 'Resources', 32);
    });
});

describe('MobsDrawing minimum HP filter for hostile mobs (settingEnemiesMinHealthFilter + settingEnemiesMinHealth)', () => {
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
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
    });

    function hostile({id = 1, maxHealth = 500, type = EnemyType.Enemy} = {}) {
        return {id, typeId: 9000, hX: 10, hY: 20, tier: 4, enchantmentLevel: 0, name: 'Hostile', identified: true, type, getCurrentHP: () => maxHealth, maxHealth};
    }

    // @verified 2026-04-24: when the filter is off, hostile mob below any value renders normally.
    test('filter off: hostile with maxHealth=100 still renders', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesMinHealthFilter');
        settingsSync.getNumber.mockReturnValue(2100);

        drawing.invalidate(ctx, [hostile({maxHealth: 100})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, maxHealth below threshold skips the mob (no circle drawn).
    test('filter on: hostile with maxHealth=1000 below threshold=2100 is skipped', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesMinHealthFilter' || key === 'settingEnemiesShowHealthBars');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingEnemiesMinHealth' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 1000})]);

        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, maxHealth above threshold renders normally.
    test('filter on: hostile with maxHealth=3000 above threshold=2100 renders', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesMinHealthFilter' || key === 'settingEnemiesShowHealthBars' || key === 'settingEnemiesNormal');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingEnemiesMinHealth' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 3000})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter on, boss (high tier hostile) with high HP still renders.
    test('filter on: boss with maxHealth=50000 above threshold=2100 renders', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesMinHealthFilter' || key === 'settingEnemiesShowHealthBars' || key === 'settingEnemiesBoss');
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingEnemiesMinHealth' ? 2100 : (d ?? 0));

        drawing.invalidate(ctx, [hostile({maxHealth: 50000, type: EnemyType.Boss})]);

        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: filter applies only to hostile types; living resource is unaffected.
    test('filter on: living resource is not gated by min HP filter', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesMinHealthFilter' || key === 'settingEnemiesShowHealthBars');
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesLivingFiber' ? {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)} : null);
        settingsSync.getNumber.mockImplementation((key, d) => key === 'settingEnemiesMinHealth' ? 2100 : (d ?? 0));

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
        settingsSync.getNumber.mockImplementation(key => registryDefault(key));
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
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        ctx = {font: '', measureText: vi.fn(() => ({width: 12}))};
    });

    function hostile({id = 1, type = EnemyType.Enemy, identified = true, maxHealth = 500} = {}) {
        return {id, typeId: 9000, hX: 10, hY: 20, tier: 4, enchantmentLevel: 0, name: identified ? 'Known' : null, identified, type, getCurrentHP: () => maxHealth, maxHealth};
    }

    // @verified 2026-04-24: identified Enemy is skipped at render when settingEnemiesNormal is off.
    test('identified Enemy with settingEnemiesNormal=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesNormal');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Enemy})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: identified Boss is skipped when settingEnemiesBoss is off.
    test('identified Boss with settingEnemiesBoss=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesBoss');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Boss})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: identified EnchantedEnemy is drawn when settingEnemiesChampion is on.
    test('identified EnchantedEnemy with settingEnemiesChampion=true is drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesMinHealthFilter');
        drawing.invalidate(ctx, [hostile({type: EnemyType.EnchantedEnemy})]);
        expect(drawing.drawFilledCircle).toHaveBeenCalled();
    });

    // @verified 2026-04-24: unidentified mob uses settingDebugEnemiesUnidentified gate.
    test('unidentified mob with settingDebugEnemiesUnidentified=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingDebugEnemiesUnidentified');
        drawing.invalidate(ctx, [hostile({identified: false})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: Drone gated by settingEnemiesAvalonianDrones.
    test('Drone with settingEnemiesAvalonianDrones=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesAvalonianDrones');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Drone})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: Events type gated by settingEnemiesEvent.
    test('Events enemy with settingEnemiesEvent=false is not drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesEvent');
        drawing.invalidate(ctx, [hostile({type: EnemyType.Events, identified: true})]);
        expect(drawing.drawFilledCircle).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: lastVisibleCount reflects only mobs that passed the render gates.
    test('lastVisibleCount counts only rendered mobs after filters', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesNormal');
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

        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesNormal' || key === 'settingEnemiesShowHealthBars');
        drawing.invalidate(ctx, [hostile({id: 2})]);
        expect(drawing.lastVisibleCount).toBe(1);
    });

    // @verified 2026-05-01: hostile NPC marker uses getMarkerSize(6), tighter than the previous getScaledSize(7).
    test('hostile NPC marker radius is getMarkerSize(6)', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingEnemiesNormal' || key === 'settingEnemiesShowHealthBars');
        drawing.invalidate(ctx, [hostile({id: 1, type: EnemyType.Enemy})]);
        expect(drawing.drawFilledCircle).toHaveBeenCalledWith(ctx, 10, 20, 6, expect.any(String));
        expect(drawing.getMarkerSize).toHaveBeenCalledWith(6);
    });

    // @verified 2026-09-24: a MistBoss-typed mob missing its mistBoss data must not read an undefined setting key.
    test('MistBoss without mistBoss data does not read an undefined setting key', () => {
        const error = vi.fn();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error};
        settingsSync.getBool.mockImplementation(key => {
            if (key === undefined) error('SettingsSyncUnknownKey', {key});
            return true;
        });
        const brokenMistBoss = hostile({id: 30, type: EnemyType.MistBoss});
        drawing.invalidate(ctx, [brokenMistBoss]);
        expect(error).not.toHaveBeenCalled();
    });
});

describe('MediumEnemy removal', () => {
    test('EnemyType has no MediumEnemy, and its old value gets no color and no name', () => {
        expect(EnemyType.MediumEnemy).toBeUndefined();
        expect(new MobsDrawing().getEnemyColor(3)).toBe('#4169E1');
        expect(new MobsHandler().getEnemyTypeName(3)).toBe('Unknown(3)');
    });
});

describe('MobsDrawing debug log category', () => {
    test('a hostile circle logs its draw details under MOBS', () => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        settingsSync.getBool.mockImplementation(key => key !== 'settingEnemiesMinHealthFilter');
        const drawing = new MobsDrawing();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.drawFilledCircle = vi.fn();
        drawing.drawTextItems = vi.fn();
        drawing.drawHealthBar = vi.fn();
        const mob = {id: 1, typeId: 5, type: EnemyType.Enemy, identified: true, hX: 0, hY: 0, maxHealth: 100, getCurrentHP: () => 50};
        drawing.invalidate({measureText: () => ({width: 1})}, [mob]);
        expect(window.logger.debug).toHaveBeenCalledWith('MOBS', 'mob_draw_details', expect.objectContaining({id: 1}));
    });
});

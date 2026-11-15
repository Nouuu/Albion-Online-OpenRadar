// pcap-derived: real handler.newHarvestableObject(fixture) -> drawing.invalidate(handler.getHarvestableList()) chain.
// synthetic: edge cases constructed to cover pure-static and tier/enchant grids.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
        getFloat: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('./HarvestablesDrawing.js');
const {HarvestablesHandler} = await import('../handlers/HarvestablesHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function buildDrawing() {
    const drawing = new HarvestablesDrawing();
    drawing.DrawCustomImage = vi.fn();
    drawing.drawResourceBadge = vi.fn();
    drawing.transformPoint = vi.fn((x, y) => ({x, y}));
    drawing.interpolateEntity = vi.fn();
    drawing.drawText = vi.fn();
    drawing.drawTextItems = vi.fn();
    drawing.getScaledFontSize = vi.fn(s => s);
    drawing.drawDistanceIndicator = vi.fn();
    drawing.drawResourceCountBadge = vi.fn();
    drawing.calculateDistance = vi.fn(() => 10);
    drawing.getScaledSize = vi.fn(s => s);
    drawing.getMarkerSize = vi.fn(s => s);
    return drawing;
}

function allTrue() {
    return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
}

function allFalse() {
    return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
}

describe('HarvestablesDrawing render-time routing', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
        drawing = buildDrawing();
        ctx = {};
    });

    // -------------------------------------------------------------------------
    // Pure static path: mobileTypeId=null/-1/65535 -> Static filter only
    // -------------------------------------------------------------------------

    // @verified 2026-04-24: pure static fiber plant (mobileTypeId=-1) renders when Static fiber is on.
    test('pure static Fiber T5 e2 (mobileTypeId=-1) renders under Static filter', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_5_2', 'Resources', 32);
    });

    // @verified 2026-04-24: pure static fiber plant is skipped when Static is off, Living on has no effect.
    test('pure static Fiber T5 e2 is skipped when Static off, Living on has no effect', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingResourcesStaticFiber') return allFalse();
            if (key === 'settingResourcesLivingFiber') return allTrue();
            return null;
        });
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: batch-spawn (mobileTypeId=null) is pure static, uses Static filter.
    test('batch-spawn Fiber (mobileTypeId=null) T4 e0 renders under Static filter', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        const entity = {id: 2, hX: 5, hY: 5, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Fiber', mobileTypeId: null, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 5, 5, 'fiber_4_0', 'Resources', 32);
    });

    // -------------------------------------------------------------------------
    // Live critter path: mobileTypeId references a live mob in MobsDatabase -> Living filter
    // -------------------------------------------------------------------------

    const livingCritterRows = [
        ['mob-critter', 564, 'Hide', 'hide_3_0'],
        ['mob-critter', 565, 'Hide', 'hide_4_0'],
        ['mob-critter', 566, 'Hide', 'hide_5_0'],
        ['mob-critter-48', 601, 'Hide', 'hide_5_3'],
        ['fiber-critter', 694, 'Fiber', 'fiber_4_0'],
    ];

    async function critterParams(scenario, mobKey) {
        const fx = await loadFixture('harvestables', scenario);
        const msg = fx.messages.find(m => m.parameters['6'] === mobKey);
        return normalizeParams(msg.parameters);
    }

    // @verified 2026-11-14: a live critter harvestable from a capture renders under its family Living filter (Hide for the cougars, Fiber for the Mists critter).
    test.each(livingCritterRows)('pcap-derived full-flow: %s mob key %i renders under Living %s filter as %s', async (scenario, mobKey, family, image) => {
        const p = await critterParams(scenario, mobKey);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === `settingResourcesLiving${family}`) return allTrue();
            if (key === `settingResourcesStatic${family}`) return allFalse();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), image, 'Resources', 32);
    });

    // @verified 2026-11-14: the same live critters are skipped when Living is off, even with Static on.
    test.each(livingCritterRows)('pcap-derived full-flow: %s mob key %i skipped when Living %s off, Static on', async (scenario, mobKey, family) => {
        const p = await critterParams(scenario, mobKey);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === `settingResourcesLiving${family}`) return allFalse();
            if (key === `settingResourcesStatic${family}`) return allTrue();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-09-03: pcap-composed. Live Ore critter mobileTypeId=715 (T7_MOB_CRITTER_ORE_MISTS_RED) from the
    // 2026-09-03 capture routes to Living. Every living node in that corpus arrives with size 0, so the size is
    // forced to 1 to reach the render gate.
    test('pcap-composed full-flow: live Ore critter mobileTypeId=715 renders under Living filter', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 715);
        const p = {...normalizeParams(msg.parameters), 10: 1};

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingResourcesLivingOre') return allTrue();
            if (key === 'settingResourcesStaticOre') return allFalse();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-09-03: pcap-composed, same node. Live Ore skipped when Living is off and Static is on.
    test('pcap-composed full-flow: live Ore critter mobileTypeId=715 skipped when Living off, Static on', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 715);
        const p = {...normalizeParams(msg.parameters), 10: 1};

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingResourcesLivingOre') return allFalse();
            if (key === 'settingResourcesStaticOre') return allTrue();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-11-14: a static node whose message lacks the mob type id key is drawn under its family Static setting and not under Living.
    test.each([
        ['Static on, Living off', allTrue(), allFalse(), true],
        ['Static off, Living on', allFalse(), allTrue(), false],
    ])('pcap-derived full-flow with the mob type id key deleted from the message: %s', async (_label, staticCell, livingCell, drawn) => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const p = normalizeParams(fx.messages[0].parameters);
        expect(p[6]).toBe(-1);
        delete p[6];
        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        const family = handler.getHarvestableList()[0].stringType;
        const staticKey = {Fiber: 'settingResourcesStaticFiber', Hide: 'settingResourcesStaticHide', Log: 'settingResourcesStaticWood', Ore: 'settingResourcesStaticOre', Rock: 'settingResourcesStaticRock'}[family];
        const livingKey = staticKey.replace('Static', 'Living');
        settingsSync.getJSON.mockImplementation(key => key === staticKey ? staticCell : key === livingKey ? livingCell : null);

        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(drawn ? 1 : 0);
    });

    // @verified 2026-11-14: a static node spawned empty draws nothing, then draws once its charge level update arrives.
    test('pcap-derived full-flow: empty static Fiber node is drawn only after its regrow update', async () => {
        const fx = await loadFixture('harvestables', 'empty-regrow');
        const spawn = normalizeParams(fx.messages.find(m => m.parameters['252'] === 40 && m.parameters['0'] === 2587).parameters);
        const regrow = normalizeParams(fx.messages.find(m => m.parameters['252'] === 46 && m.parameters['0'] === 2587).parameters);
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(spawn[0], spawn);
        drawing.invalidate(ctx, handler.getHarvestableList());
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();

        handler.HarvestUpdateEvent(regrow);
        drawing.invalidate(ctx, handler.getHarvestableList());
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, expect.any(Number), expect.any(Number), 'fiber_4_1', 'Resources', 32);
    });

    // @verified 2026-11-14: every empty static node of the capture (Ore, Fiber, Log) draws nothing before any update.
    test('pcap-derived full-flow: every node spawned empty draws nothing', async () => {
        const fx = await loadFixture('harvestables', 'empty-regrow');
        const handler = new HarvestablesHandler(null);
        for (const m of fx.messages.filter(msg => msg.parameters['252'] === 40)) {
            const p = normalizeParams(m.parameters);
            handler.newHarvestableObject(p[0], p);
        }
        settingsSync.getJSON.mockReturnValue(allTrue());

        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(handler.getHarvestableList()).toHaveLength(4);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Family coverage grid for pure static path
    // -------------------------------------------------------------------------

    // @verified 2026-04-24: static resolution covers 5 families via settingResourcesStatic{Family}.
    test.each([
        ['Fiber', 14, 'settingResourcesStaticFiber', 'fiber'],
        ['Hide', 20, 'settingResourcesStaticHide', 'hide'],
        ['Log', 2, 'settingResourcesStaticWood', 'log'],
        ['Ore', 24, 'settingResourcesStaticOre', 'ore'],
        ['Rock', 8, 'settingResourcesStaticRock', 'rock'],
    ])('pure static %s T3 e1 (mobileTypeId=-1) renders via %s', (family, typeNumber, settingKey, imagePrefix) => {
        settingsSync.getJSON.mockImplementation(key =>
            key === settingKey
                ? {e0: Array(8).fill(false), e1: [false, false, true, false, false, false, false, false], e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        const entity = {id: 99, hX: 1, hY: 2, chargeLevel: 3, tier: 3, rareState: 1, stringType: family, mobileTypeId: -1, position: typeNumber};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 1, 2, `${imagePrefix}_3_1`, 'Resources', 32);
    });

    // @verified 2026-04-24: lastVisibleCount reflects only harvestables passing the render gate.
    test('lastVisibleCount counts only rendered harvestables after filters', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        const kept = {id: 1, hX: 1, hY: 2, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        const dropped = {id: 2, hX: 3, hY: 4, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Hide', mobileTypeId: -1, position: 20};

        drawing.invalidate(ctx, [kept, dropped]);

        expect(drawing.lastVisibleCount).toBe(1);
    });

    // @verified 2026-04-24: lastVisibleCount resets on each invalidate call.
    test('lastVisibleCount resets on each invalidate call', () => {
        settingsSync.getJSON.mockReturnValue(allFalse());
        drawing.invalidate(ctx, [{id: 1, hX: 1, hY: 2, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Fiber', mobileTypeId: -1, position: 14}]);
        expect(drawing.lastVisibleCount).toBe(0);

        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        drawing.invalidate(ctx, [{id: 2, hX: 1, hY: 2, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Fiber', mobileTypeId: -1, position: 14}]);
        expect(drawing.lastVisibleCount).toBe(1);
    });

    // -------------------------------------------------------------------------
    // Resource color badges toggle (settingRadarResourceTierBadges)
    // -------------------------------------------------------------------------

    // @verified 2026-05-01: badges off (default) keeps the existing image rendering path.
    test('settingRadarResourceTierBadges=false renders the game icon as before', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        settingsSync.getBool.mockReturnValue(false);
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_5_2', 'Resources', 32);
        expect(drawing.drawResourceBadge).not.toHaveBeenCalled();
    });

    // @verified 2026-05-01: badges on routes static harvestables to drawResourceBadge with the correct category.
    test('settingRadarResourceTierBadges=true draws a Fiber badge with tier+enchant for static harvestable', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.drawResourceBadge).toHaveBeenCalledWith(ctx, 10, 20, 32, 'Fiber', 5, 2, false);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-05-01: badge mode covers all 5 categories via getResourceCategory(stringType).
    test.each([
        ['Fiber', 14, 'settingResourcesStaticFiber', 'Fiber'],
        ['Hide', 20, 'settingResourcesStaticHide', 'Hide'],
        ['Log', 2, 'settingResourcesStaticWood', 'Wood'],
        ['Ore', 24, 'settingResourcesStaticOre', 'Ore'],
        ['Rock', 8, 'settingResourcesStaticRock', 'Rock'],
    ])('badge mode renders %s as category %s', (stringType, typeNumber, settingKey, expectedCategory) => {
        settingsSync.getJSON.mockImplementation(key => key === settingKey ? allTrue() : null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        const entity = {id: 99, hX: 1, hY: 2, chargeLevel: 3, tier: 3, rareState: 1, stringType, mobileTypeId: -1, position: typeNumber};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.drawResourceBadge).toHaveBeenCalledWith(ctx, 1, 2, 32, expectedCategory, 3, 1, false);
    });

    // @verified 2026-05-01: badge mode falls back to DrawCustomImage when getResourceCategory returns null.
    // Stub category resolution to null even though stringType passes the static filter, to exercise the safety branch.
    test('badge mode falls back to DrawCustomImage when getResourceCategory returns null', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');
        drawing.getResourceCategory = vi.fn(() => null);
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.drawResourceBadge).not.toHaveBeenCalled();
        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-09-03: pcap-derived full-flow test: real handler -> drawing chain produces a badge
    // in badge mode. Static Fiber T6 node with rare state from the 2026-09-03 capture; the living nodes in that
    // corpus all arrive with size 0 and are skipped at render.
    test('pcap-derived full-flow: static Fiber node renders as badge under settingRadarResourceTierBadges', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['5'] === 14 && m.parameters['7'] === 6 && m.parameters['10'] > 0);
        expect(msg).toBeDefined();
        const p = normalizeParams(msg.parameters);

        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceTierBadges');

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.drawResourceBadge).toHaveBeenCalled();
        const call = drawing.drawResourceBadge.mock.calls[0];
        expect(call[3]).toBe(32);                  // baseSize
        expect(call[4]).toBe('Fiber');             // category
        expect(typeof call[5]).toBe('number');     // tier
        expect(typeof call[6]).toBe('number');     // enchant
        expect(call[7]).toBe(false);               // static, not living
    });
});

describe('HarvestablesDrawing type ID overlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticFiber' ? allTrue() : null);
    });

    test('draws the type ID when settingDebugResourcesTypeId is on', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesTypeId');
        const drawing = buildDrawing();
        const ctx = {measureText: text => ({width: text.length * 4})};
        drawing.invalidate(ctx, [{id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14}]);
        expect(drawing.drawTextItems).toHaveBeenCalledWith(6, 40, '14', ctx, '10px', '#CCCCCC');
        expect(settingsSync.getBool).not.toHaveBeenCalledWith('livingResourcesID');
    });

    test('draws no type ID when settingDebugResourcesTypeId is off', () => {
        settingsSync.getBool.mockImplementation(() => false);
        const drawing = buildDrawing();
        drawing.invalidate({}, [{id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 14}]);
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });
});

describe('HarvestablesDrawing distance badge against its tooltip', () => {
    function badgeFill(distance) {
        const drawing = new HarvestablesDrawing();
        drawing.getScaledFontSize = () => 9;
        drawing.getScaledSize = size => size;
        drawing.getMarkerSize = size => size;
        const fills = [];
        const ctx = {
            save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
            stroke() {}, fillText() {},
            measureText: text => ({width: text.length}),
            fill() { fills.push(this.fillStyle); },
        };
        drawing.drawDistanceIndicator(ctx, 0, 0, distance);
        return fills[0] ?? 'hidden';
    }

    test.each([
        [6, 'hidden'],
        [27, 'rgba(0,200,0,0.85)'],
        [30, 'rgba(255,200,0,0.85)'],
        [57, 'rgba(255,200,0,0.85)'],
        [60, 'rgba(255,100,0,0.85)'],
    ])('%s game units draws %s: hidden within 2 m, green under 10 m, yellow 10 to 19 m, orange from 20 m', (distance, fill) => {
        expect(badgeFill(distance)).toBe(fill);
    });
});

describe('HarvestablesDrawing static family from the position', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
        drawing = buildDrawing();
        ctx = {measureText: vi.fn(text => ({width: text.length * 4}))};
        settingsSync.getBool.mockReturnValue(false);
        settingsSync.getJSON.mockReturnValue(allTrue());
    });

    test('@verified 2026-11-15: synthetic: an empty stringType at position 0 draws nothing, whatever its position', () => {
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: '', mobileTypeId: -1, position: 0};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    test.each([
        [19, 'Fiber', true],
        [59, '', false],
        [200, '', false],
    ])('@verified 2026-11-15: synthetic: a real static event 40 message with position set to %i (19 is Fiber, 59 and 200 have no family) is stored as "%s" and drawn=%s', async (position, family, drawn) => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const p = {...normalizeParams(fx.messages.find(m => m.parameters['6'] === -1).parameters), 5: position, 10: 3};

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(handler.getHarvestableList()[0].stringType).toBe(family);
        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(drawn ? 1 : 0);
    });

    test('@verified 2026-11-15: pcap-derived full-flow: ore-dynamic-single event 40 position 28 node with charge above 0 draws ore_5_1', async () => {
        const fx = await loadFixture('harvestables', 'ore-dynamic-single');
        const p = normalizeParams(fx.messages[0].parameters);

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage.mock.calls.map(c => c[3])).toEqual(['ore_5_1']);
    });

    test('@verified 2026-11-15: pcap-derived full-flow: Show DB Name draws T5_ORE_DYNAMIC@1 in the living resource style for the ore-dynamic-single node', async () => {
        const fx = await loadFixture('harvestables', 'ore-dynamic-single');
        const p = normalizeParams(fx.messages[0].parameters);
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesDbName');

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        const [node] = handler.getHarvestableList();
        drawing.invalidate(ctx, [node]);

        const text = 'T5_ORE_DYNAMIC@1';
        expect(drawing.drawText).not.toHaveBeenCalled();
        expect(drawing.drawTextItems.mock.calls).toEqual([[node.hX - text.length * 2, node.hY + 32, text, ctx, '9px', '#FFD700']]);
    });

    test('@verified 2026-11-15: pcap-derived full-flow: Show ID draws the position of the ore-dynamic-single node in the living id style', async () => {
        const fx = await loadFixture('harvestables', 'ore-dynamic-single');
        const p = normalizeParams(fx.messages[0].parameters);
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesTypeId');

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        const [node] = handler.getHarvestableList();
        drawing.invalidate(ctx, [node]);

        expect(drawing.drawText).not.toHaveBeenCalled();
        expect(drawing.drawTextItems.mock.calls).toEqual([[node.hX - 4, node.hY + 20, '28', ctx, '10px', '#CCCCCC']]);
    });

    test('@verified 2026-11-15: pcap-derived full-flow: Show DB Name and the position text together draw the name 12 below the position', async () => {
        const fx = await loadFixture('harvestables', 'ore-dynamic-single');
        const p = normalizeParams(fx.messages[0].parameters);
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesDbName' || key === 'settingDebugResourcesTypeId');

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        const [position, [, nameY, name]] = drawing.drawTextItems.mock.calls;
        expect(position[2]).toBe('28');
        expect(name).toBe('T5_ORE_DYNAMIC@1');
        expect(nameY).toBe(position[1] + 12);
    });

    test.each([
        ['on', ['T6_WOOD@2'], true],
        ['off', [], false],
    ])('@verified 2026-11-15: pcap-derived full-flow: a static position 0 node with Show DB Name %s draws %j', async (_label, texts, on) => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const p = {...normalizeParams(fx.messages.find(m => m.parameters['6'] === -1 && m.parameters['5'] === 0).parameters)};
        settingsSync.getBool.mockImplementation(key => on && key === 'settingDebugResourcesDbName');

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);
        expect(drawing.drawTextItems.mock.calls.map(c => c[2])).toEqual(texts);
    });

    test('@verified 2026-11-15: synthetic: Show DB Name draws the entry name without the @ part for rare state 0 (position 19)', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesDbName');
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 4, rareState: 0, stringType: 'Fiber', mobileTypeId: -1, position: 19};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.drawTextItems.mock.calls.map(c => c[2])).toEqual(['T4_FIBER_TREASURE']);
    });

    test('@verified 2026-11-15: synthetic: Show DB Name draws nothing for a position outside the shipped data', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesDbName');
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 3, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 999};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledTimes(1);
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    test('@verified 2026-11-15: synthetic: Show DB Name draws nothing for an empty node', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingDebugResourcesDbName');
        const entity = {id: 1, hX: 10, hY: 20, chargeLevel: 0, tier: 5, rareState: 2, stringType: 'Fiber', mobileTypeId: -1, position: 19};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    test.each([
        [0, ['ore_5_0']],
        [1, ['ore_5_0']],
        [2, ['ore_4_0']],
    ])('@verified 2026-11-15: pcap-derived full-flow: ore-dynamic-batch event 39 message %i position 28 nodes with charge above 0 draw %j', async (index, images) => {
        const fx = await loadFixture('harvestables', 'ore-dynamic-batch');
        const p = normalizeParams(fx.messages[index].parameters);
        settingsSync.getJSON.mockImplementation(key => key === 'settingResourcesStaticOre' ? allTrue() : null);

        const handler = new HarvestablesHandler(null);
        handler.newSimpleHarvestableObject(p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage.mock.calls.map(c => c[3])).toEqual(images);
    });
});

describe('HarvestablesDrawing count badge from the game data yields', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        installRealDatabasesOnWindow();
        drawing = buildDrawing();
        ctx = {};
        settingsSync.getBool.mockImplementation(key => key === 'settingRadarResourceCount');
        settingsSync.getJSON.mockReturnValue(allTrue());
    });

    test('@verified 2026-11-15: synthetic: a real static spawn set to a T1 WOOD node at charge level 2 draws a count badge of 2', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const p = {...normalizeParams(fx.messages.find(m => m.parameters['6'] === -1).parameters), 5: 0, 7: 1, 10: 2};

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.drawResourceCountBadge).toHaveBeenCalledTimes(1);
        expect(drawing.drawResourceCountBadge.mock.calls[0][3]).toBe(2);
    });

    test.each([
        [2, 1, 5, 50],
        [0, 1, 2, 2],
        [7, 1, 2, 2],
        [7, 7, 8, 8],
    ])('@verified 2026-11-15: pcap-derived: the batch spawn node at position %i tier %i charge level %i draws a count badge of %i', async (position, tier, chargeLevel, count) => {
        const fx = await loadFixture('harvestables', 'count-variants');
        const p = normalizeParams(fx.messages.find(m => m.parameters['252'] === 39).parameters);
        const positions = p[1].data ?? p[1];
        const tiers = p[2].data ?? p[2];
        const charges = p[4].data ?? p[4];
        const indexes = positions.map((_, i) => i).filter(i => positions[i] === position && tiers[i] === tier && charges[i] === chargeLevel);
        expect(indexes.length).toBeGreaterThan(0);

        const handler = new HarvestablesHandler(null);
        handler.newSimpleHarvestableObject(p);
        const ids = indexes.map(i => p[0][i]);
        drawing.invalidate(ctx, handler.getHarvestableList().filter(h => ids.includes(h.id)));

        expect(drawing.drawResourceCountBadge).toHaveBeenCalledTimes(ids.length);
        for (const call of drawing.drawResourceCountBadge.mock.calls) expect(call[3]).toBe(count);
    });
});

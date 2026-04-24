// pcap-derived: real handler.newHarvestableObject(fixture) -> drawing.invalidate(handler.getHarvestableList()) chain.
// synthetic: edge cases constructed to cover pure-static and tier/enchant grids.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRealDatabasesOnWindow} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('./HarvestablesDrawing.js');
const {HarvestablesHandler} = await import('../handlers/HarvestablesHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function buildDrawing() {
    const drawing = new HarvestablesDrawing();
    drawing.DrawCustomImage = vi.fn();
    drawing.transformPoint = vi.fn((x, y) => ({x, y}));
    drawing.interpolateEntity = vi.fn();
    drawing.drawText = vi.fn();
    drawing.drawDistanceIndicator = vi.fn();
    drawing.drawResourceCountBadge = vi.fn();
    drawing.calculateDistance = vi.fn(() => 10);
    drawing.calculateRealResources = vi.fn(() => 5);
    drawing.getScaledSize = vi.fn(s => s);
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
        settingsSync.getJSON.mockImplementation(key => key === 'settingStaticFiberEnchants' ? allTrue() : null);
        const entity = {id: 1, hX: 10, hY: 20, size: 3, tier: 5, charges: 2, stringType: 'Fiber', mobileTypeId: -1, type: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_5_2', 'Resources', 40);
    });

    // @verified 2026-04-24: pure static fiber plant is skipped when Static is off, Living on has no effect.
    test('pure static Fiber T5 e2 is skipped when Static off, Living on has no effect', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticFiberEnchants') return allFalse();
            if (key === 'settingLivingFiberEnchants') return allTrue();
            return null;
        });
        const entity = {id: 1, hX: 10, hY: 20, size: 3, tier: 5, charges: 2, stringType: 'Fiber', mobileTypeId: -1, type: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: batch-spawn (mobileTypeId=null) is pure static, uses Static filter.
    test('batch-spawn Fiber (mobileTypeId=null) T4 e0 renders under Static filter', () => {
        settingsSync.getJSON.mockImplementation(key => key === 'settingStaticFiberEnchants' ? allTrue() : null);
        const entity = {id: 2, hX: 5, hY: 5, size: 3, tier: 4, charges: 0, stringType: 'Fiber', mobileTypeId: null, type: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 5, 5, 'fiber_4_0', 'Resources', 40);
    });

    // -------------------------------------------------------------------------
    // Live critter path: mobileTypeId references a live mob in MobsDatabase -> Living filter
    // -------------------------------------------------------------------------

    // @verified 2026-04-24: live Fiber critter (mobileTypeId=529 T4_MOB_CRITTER_FIBER_SWAMP_GREEN) routes to Living.
    test('pcap-derived full-flow: live Fiber critter mobileTypeId=529 renders under Living filter', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 529 && m.parameters['10'] > 0);
        expect(msg).toBeDefined();
        const p = normalizeParams(msg.parameters);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return allTrue();
            if (key === 'settingStaticFiberEnchants') return allFalse();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-04-24: live Fiber critter skipped when Living is off even if Static is on (wrong routing guard).
    test('pcap-derived full-flow: live Fiber critter mobileTypeId=529 skipped when Living off, Static on', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 529 && m.parameters['10'] > 0);
        const p = normalizeParams(msg.parameters);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return allFalse();
            if (key === 'settingStaticFiberEnchants') return allTrue();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: live Hide DYNAMIC critter (mobileTypeId=424 T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD) routes to Living.
    test('pcap-derived full-flow: live Hide critter mobileTypeId=424 renders under Living filter', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 424 && m.parameters['10'] > 0);
        const p = normalizeParams(msg.parameters);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingHideEnchants') return allTrue();
            if (key === 'settingStaticHideEnchants') return allFalse();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-04-24: live Hide skipped when Living is off and Static is on.
    test('pcap-derived full-flow: live Hide critter mobileTypeId=424 skipped when Living off, Static on', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 424 && m.parameters['10'] > 0);
        const p = normalizeParams(msg.parameters);

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingHideEnchants') return allFalse();
            if (key === 'settingStaticHideEnchants') return allTrue();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Dead critter carcass path: mobileTypeId references a _DEAD mob -> Static filter
    // -------------------------------------------------------------------------

    // @verified 2026-04-24: synthetic Parameters matching capture-70 event 40 shape for typeId=532
    // (T5_MOB_CRITTER_FIBER_SWAMP_DEAD). Committed fixture is capped at 25 messages and does not
    // contain a DEAD variant; full capture-70 pcap extraction confirmed 4 occurrences of 532.
    // Real mobsDatabase resolves uniqueName and the _DEAD$ regex routes to the Static filter.
    test('full-flow: dead Fiber carcass mobileTypeId=532 renders under Static filter', () => {
        const p = {0: 9001, 5: 11, 6: 532, 7: 5, 8: [0, 0], 10: 3, 11: 0};  // size=3 so drawing does not skip

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticFiberEnchants') return allTrue();
            if (key === 'settingLivingFiberEnchants') return allFalse();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).toHaveBeenCalled();
    });

    // @verified 2026-04-24: dead Fiber carcass skipped when Static off even if Living is on.
    test('full-flow: dead Fiber carcass mobileTypeId=532 skipped when Static off, Living on', () => {
        const p = {0: 9001, 5: 11, 6: 532, 7: 5, 8: [0, 0], 10: 3, 11: 0};  // size=3 so drawing does not skip

        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticFiberEnchants') return allFalse();
            if (key === 'settingLivingFiberEnchants') return allTrue();
            return null;
        });

        const handler = new HarvestablesHandler(null);
        handler.newHarvestableObject(p[0], p);
        drawing.invalidate(ctx, handler.getHarvestableList());

        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Family coverage grid for pure static path
    // -------------------------------------------------------------------------

    // @verified 2026-04-24: static resolution covers 5 families via settingStatic{Family}Enchants.
    test.each([
        ['Fiber', 14, 'settingStaticFiberEnchants', 'fiber'],
        ['Hide', 20, 'settingStaticHideEnchants', 'hide'],
        ['Log', 2, 'settingStaticWoodEnchants', 'log'],
        ['Ore', 24, 'settingStaticOreEnchants', 'ore'],
        ['Rock', 8, 'settingStaticRockEnchants', 'rock'],
    ])('pure static %s T3 e1 (mobileTypeId=-1) renders via %s', (family, typeNumber, settingKey, imagePrefix) => {
        settingsSync.getJSON.mockImplementation(key =>
            key === settingKey
                ? {e0: Array(8).fill(false), e1: [false, false, true, false, false, false, false, false], e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        const entity = {id: 99, hX: 1, hY: 2, size: 3, tier: 3, charges: 1, stringType: family, mobileTypeId: -1, type: typeNumber};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 1, 2, `${imagePrefix}_3_1`, 'Resources', 40);
    });
});

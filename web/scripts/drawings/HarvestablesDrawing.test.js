// synthetic: static + carcass harvestables constructed to cover render-time filter gates.
// pcap-derived: Hide toad mobileTypeId=424 fixture from harvestables/single-spawn.

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('./HarvestablesDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('HarvestablesDrawing static filter at render', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new HarvestablesDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.interpolateEntity = vi.fn();
        drawing.drawText = vi.fn();
        drawing.drawDistanceIndicator = vi.fn();
        drawing.drawResourceCountBadge = vi.fn();
        drawing.calculateDistance = vi.fn(() => 10);
        drawing.calculateRealResources = vi.fn(() => 5);
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
        settingsSync.getBool.mockReturnValue(false);
    });

    function carcassHarvestable({tier = 6, charges = 0, stringType = 'Hide', mobileTypeId = 424} = {}) {
        return {id: 1, hX: 10, hY: 20, size: 3, tier, charges, stringType, mobileTypeId, type: 18};
    }

    function staticSentinel({tier = 5, charges = 2, stringType = 'Fiber'} = {}) {
        return {id: 2, hX: 30, hY: 40, size: 3, tier, charges, stringType, mobileTypeId: -1, type: 14};
    }

    function batchSpawn({tier = 4, charges = 0, stringType = 'Fiber'} = {}) {
        return {id: 3, hX: 5, hY: 5, size: 3, tier, charges, stringType, mobileTypeId: null, type: 14};
    }

    // @verified 2026-04-24: static resource with Static settings on renders normally.
    test('static Fiber T5 e2 renders when settingStaticFiberEnchants e2 T5 is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingStaticFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, true, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [staticSentinel({tier: 5, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 30, 40, 'fiber_5_2', 'Resources', 40);
    });

    // @verified 2026-04-24: static resource with Static settings off is skipped.
    test('static Fiber T5 e2 is skipped when settingStaticFiberEnchants e2 T5 is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingStaticFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [staticSentinel({tier: 5, charges: 2})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: carcass (mobileTypeId=424) uses static filter, not living. Core HARV-4 fix.
    test('Hide carcass mobileTypeId=424 T6 e0 renders under Static only (Living ignored)', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticHideEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            if (key === 'settingLivingHideEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            return null;
        });
        drawing.invalidate(ctx, [carcassHarvestable({tier: 6, charges: 0})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_6_0', 'Resources', 40);
    });

    // @verified 2026-04-24: carcass blocked when Static is off, even if Living on (no cross-talk).
    test('Hide carcass mobileTypeId=424 T6 e0 skipped when Static off and Living on', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingStaticHideEnchants') return {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)};
            if (key === 'settingLivingHideEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            return null;
        });
        drawing.invalidate(ctx, [carcassHarvestable({tier: 6, charges: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: enchanted carcass (Hide T6 e2) renders under static settings after enchant update.
    test('Hide carcass T6 e2 renders via settingStaticHideEnchants e2 T6', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingStaticHideEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, false, false, true, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [carcassHarvestable({tier: 6, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'hide_6_2', 'Resources', 40);
    });

    // @verified 2026-04-24: batch-spawn static (mobileTypeId=null) follows static filter like the sentinel path.
    test('static Fiber batch (mobileTypeId=null) T4 e0 renders under Static settings', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingStaticFiberEnchants'
                ? {e0: Array(8).fill(true), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [batchSpawn({tier: 4, charges: 0})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 5, 5, 'fiber_4_0', 'Resources', 40);
    });

    // @verified 2026-04-24: batch-spawn skipped when Static off.
    test('static Fiber batch (mobileTypeId=null) T4 e0 skipped when Static off', () => {
        settingsSync.getJSON.mockReturnValue(null);
        drawing.invalidate(ctx, [batchSpawn({tier: 4, charges: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: all 5 families resolve via their Static key (covers Fiber/Hide/Log/Ore/Rock).
    test.each([
        ['Fiber', 'settingStaticFiberEnchants', 'fiber'],
        ['Hide', 'settingStaticHideEnchants', 'hide'],
        ['Log', 'settingStaticWoodEnchants', 'log'],
        ['Ore', 'settingStaticOreEnchants', 'ore'],
        ['Rock', 'settingStaticRockEnchants', 'rock'],
    ])('static %s T3 e1 renders via %s key', (family, settingKey, imagePrefix) => {
        settingsSync.getJSON.mockImplementation(key =>
            key === settingKey
                ? {e0: Array(8).fill(false), e1: [false, false, true, false, false, false, false, false], e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        const entity = {id: 99, hX: 1, hY: 2, size: 3, tier: 3, charges: 1, stringType: family, mobileTypeId: -1, type: 14};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 1, 2, `${imagePrefix}_3_1`, 'Resources', 40);
    });

    // @verified 2026-04-24: pcap-derived, real Hide toad mobileTypeId=424 from single-spawn corpus.
    test('pcap-derived: Hide toad mobileTypeId=424 renders under Static settings with real fixture data', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        const msg = fx.messages.find(m => m.parameters['6'] === 424);
        expect(msg).toBeDefined();
        const p = normalizeParams(msg.parameters);
        const tier = p[7];
        const charges = p[11] ?? 0;

        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingStaticHideEnchants'
                ? {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );

        const entity = {id: p[0], hX: 10, hY: 20, size: 3, tier, charges, stringType: 'Hide', mobileTypeId: 424, type: p[5]};
        drawing.invalidate(ctx, [entity]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, `hide_${tier}_${charges}`, 'Resources', 40);
    });

    // @verified 2026-04-24: Living settings key is not consulted at all for harvestables.
    test('Living settings alone never render a harvestable (isolation assertion)', () => {
        settingsSync.getJSON.mockImplementation(key => {
            if (key === 'settingLivingFiberEnchants') return {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)};
            return null;
        });
        drawing.invalidate(ctx, [staticSentinel({tier: 5, charges: 2})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });
});

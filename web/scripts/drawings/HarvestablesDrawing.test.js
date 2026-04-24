// synthetic: living + static harvestables constructed to cover render-time filter gates.
// No pcap fixture needed; filter logic is deterministic from entity + settings.

import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
        getJSON: vi.fn(() => null),
    },
}));

const {HarvestablesDrawing} = await import('./HarvestablesDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('HarvestablesDrawing living filter at render', () => {
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

    function livingHarvestable({tier = 4, charges = 0, stringType = 'Fiber', mobileTypeId = 529} = {}) {
        return {id: 1, hX: 10, hY: 20, size: 3, tier, charges, stringType, mobileTypeId, type: 11};
    }

    function staticHarvestable({tier = 5, charges = 2, stringType = 'Fiber'} = {}) {
        return {id: 2, hX: 30, hY: 40, size: 3, tier, charges, stringType, mobileTypeId: -1, type: 11};
    }

    // @verified 2026-04-24: living harvestable with charges=0 is skipped when settings e0 for living family is off.
    test('living Fiber e0 is skipped when settings e0 for living fiber is off', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)}
                : null
        );
        drawing.invalidate(ctx, [livingHarvestable({tier: 4, charges: 0})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: living harvestable with charges=2 is rendered when settings e2 T4 for living fiber is on.
    test('living Fiber e2 is rendered when settings e2 T4 is on', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: [false, false, false, true, false, false, false, false], e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [livingHarvestable({tier: 4, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fiber_4_2', 'Resources', 40);
    });

    // @verified 2026-04-24: static harvestable rendering is not affected by living filter (all living settings off).
    test('static Fiber rendering is unaffected by living filter', () => {
        settingsSync.getJSON.mockImplementation(key =>
            key === 'settingLivingFiberEnchants'
                ? {e0: Array(8).fill(false), e1: Array(8).fill(false), e2: Array(8).fill(false), e3: Array(8).fill(false), e4: Array(8).fill(false)}
                : null
        );
        drawing.invalidate(ctx, [staticHarvestable({tier: 5, charges: 2})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 30, 40, 'fiber_5_2', 'Resources', 40);
    });
});

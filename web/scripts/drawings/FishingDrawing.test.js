// synthetic: render-time gate on settingFishing + settingResourceCount; filter logic is deterministic from entity + settings.
import {describe, test, expect, beforeEach, vi} from 'vitest';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => null),
        getNumber: vi.fn((_k, d) => d ?? 0),
    },
}));

const {FishingDrawing} = await import('./FishingDrawing.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function makePool({id = 1, sizeSpawned = 1, total = 5} = {}) {
    return {id, hX: 10, hY: 20, sizeSpawned, sizeLeftToSpawn: total - sizeSpawned, totalSize: total, type: 'FishingNodeSwarm'};
}

describe('FishingDrawing render-time filter', () => {
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        drawing = new FishingDrawing();
        drawing.DrawCustomImage = vi.fn();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.drawText = vi.fn();
        drawing.getScaledSize = vi.fn(s => s);
        ctx = {};
    });

    // @verified 2026-04-24: settingFishing=false hides every pool at render time.
    test('settingFishing=false draws nothing', () => {
        settingsSync.getBool.mockImplementation(() => false);
        drawing.draw(ctx, [makePool({id: 1}), makePool({id: 2})]);
        expect(drawing.DrawCustomImage).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: settingFishing=true renders pool icons.
    test('settingFishing=true draws pool icons', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingFishing');
        drawing.draw(ctx, [makePool({id: 1})]);
        expect(drawing.DrawCustomImage).toHaveBeenCalledWith(ctx, 10, 20, 'fish', 'Resources', 18);
    });

    // @verified 2026-04-24: settingResourceCount still independently gates the count text.
    test('settingResourceCount=false does not call drawText even when fishing is on', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingFishing');
        drawing.draw(ctx, [makePool({id: 1, sizeSpawned: 3, total: 5})]);
        expect(drawing.drawText).not.toHaveBeenCalled();
    });

    // @verified 2026-04-24: settingResourceCount=true calls drawText with sizeSpawned/totalSize format.
    test('settingResourceCount=true calls drawText with n/total', () => {
        settingsSync.getBool.mockImplementation(key => key === 'settingFishing' || key === 'settingResourceCount');
        drawing.draw(ctx, [makePool({id: 1, sizeSpawned: 3, total: 5})]);
        expect(drawing.drawText).toHaveBeenCalledWith(10, 38, '3/5', ctx);
    });
});

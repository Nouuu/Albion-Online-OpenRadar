// pcap-derived fixture: web/scripts/__fixtures__/ws/dungeons/spawn.json, dispatched through EventRouter.onEvent
// synthetic: message 1 (T7_KEEPER) with Parameters[3] and Parameters[9] swapped, for the type/enchant matrix

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {installRecordingContext} from '../__fixtures__/recordingContext.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getFloat: vi.fn(() => 1),
        getNumber: vi.fn(() => 500),
    },
}));
vi.mock('../utils/ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(src => ({src})),
        preloadImageAndAddToList: vi.fn(),
    },
}));

const {DungeonsHandler} = await import('../handlers/DungeonsHandler.js');
const {DungeonsDrawing} = await import('./DungeonsDrawing.js');
const EventRouter = await import('../core/EventRouter.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

function drawnSrcs(ctx) {
    return ctx.calls.filter(c => c[0] === 'drawImage').map(c => c[1].src);
}

function newCtx() {
    installRecordingContext();
    return document.createElement('canvas').getContext('2d');
}

describe('DungeonsDrawing', () => {
    let dungeonsHandler;
    let mistsDungeonHandler;
    let drawing;
    let ctx;

    beforeEach(async () => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        settingsSync.getFloat.mockReturnValue(1);
        settingsSync.getNumber.mockReturnValue(500);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};

        dungeonsHandler = new DungeonsHandler();
        mistsDungeonHandler = {addPortal: vi.fn()};
        drawing = new DungeonsDrawing();
        ctx = newCtx();

        EventRouter.reset();
        EventRouter.init({
            handlers: {
                playersHandler: {}, mobsHandler: {}, harvestablesHandler: {}, chestsHandler: {},
                dungeonsHandler, fishingHandler: {}, wispCageHandler: {}, mistsDungeonHandler,
            },
            map: {id: -1, hX: 0, hY: 0, isBZ: false},
            radarRenderer: null,
        });

        const fx = await loadFixture('dungeons', 'spawn');
        for (const msg of fx.messages) {
            EventRouter.onEvent(normalizeParams(msg.parameters));
        }
    });

    test('pcap-derived: T7_KEEPER and MISTS_DUO_BLACK land in dungeonsHandler, Knightfall routes to mistsDungeonHandler instead', () => {
        expect(dungeonsHandler.dungeonList.map(d => d.id).sort((a, b) => a - b)).toEqual([5418, 41517]);
        expect(mistsDungeonHandler.addPortal).toHaveBeenCalledWith(2579, 205, 225, 'MISTS_DUNGEON_SOLO_YELLOW');
    });

    test('pcap-derived: settingDungeonsGroup=false drops the T7_KEEPER image, MISTS_DUO_BLACK still drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonsGroup');

        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_1.webp'))).toBe(false);
        expect(drawnSrcs(ctx).some(s => s.includes('group_2.webp'))).toBe(true);
    });

    test('pcap-derived: settingDungeonsGroup back to true draws T7_KEEPER again with no new event', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonsGroup');
        drawing.draw(ctx, dungeonsHandler.dungeonList);
        ctx.calls.length = 0;

        settingsSync.getBool.mockReturnValue(true);
        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_1.webp'))).toBe(true);
    });

    test('pcap-derived: settingMistsDuo=false drops the MISTS_DUO_BLACK image, T7_KEEPER still drawn', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsDuo');

        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_2.webp'))).toBe(false);
        expect(drawnSrcs(ctx).some(s => s.includes('group_1.webp'))).toBe(true);
    });

    test('pcap-derived: settingMistsDuo back to true draws MISTS_DUO_BLACK again with no new event', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsDuo');
        drawing.draw(ctx, dungeonsHandler.dungeonList);
        ctx.calls.length = 0;

        settingsSync.getBool.mockReturnValue(true);
        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_2.webp'))).toBe(true);
    });

    test('pcap-derived: settingMistsEnchant2=false drops the MISTS_DUO_BLACK image', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsEnchant2');

        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_2.webp'))).toBe(false);
    });

    test('pcap-derived: settingMistsEnchant2 back to true draws MISTS_DUO_BLACK again with no new event', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingMistsEnchant2');
        drawing.draw(ctx, dungeonsHandler.dungeonList);
        ctx.calls.length = 0;

        settingsSync.getBool.mockReturnValue(true);
        drawing.draw(ctx, dungeonsHandler.dungeonList);

        expect(drawnSrcs(ctx).some(s => s.includes('group_2.webp'))).toBe(true);
    });
});

describe('synthetic dungeon type variants at draw time (message 1 with Parameters[3] and [9] swapped)', () => {
    let baseParams;
    let handler;
    let drawing;
    let ctx;

    beforeEach(async () => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        settingsSync.getFloat.mockReturnValue(1);
        settingsSync.getNumber.mockReturnValue(500);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};

        const fx = await loadFixture('dungeons', 'spawn');
        baseParams = normalizeParams(fx.messages[0].parameters);
        handler = new DungeonsHandler();
        drawing = new DungeonsDrawing();
        ctx = newCtx();
    });

    test.each([
        ['Dungeons Solo', 'T5_PORTAL_ROYAL_SOLO', 1, ['settingDungeonsSolo', 'settingDungeonsEnchant1'], 'dungeon_1'],
        ['Dungeons Corrupted', 'CORRUPTED_SOLO_NONLETHAL', 0, ['settingDungeonsCorrupted'], 'corrupt'],
        ['Dungeons Hellgate', 'HELLGATE_2V2_NON_LETHAL', 0, ['settingDungeonsHellgate'], 'hellgate'],
        ['Dungeons Group enchant 0', 'T5_MORGANA', 0, ['settingDungeonsGroup', 'settingDungeonsEnchant0'], 'group_0'],
        ['Dungeons Group enchant 3', 'T5_MORGANA', 3, ['settingDungeonsGroup', 'settingDungeonsEnchant3'], 'group_3'],
        ['Dungeons Group enchant 4', 'T5_MORGANA', 4, ['settingDungeonsGroup', 'settingDungeonsEnchant4'], 'group_4'],
        ['Mists Solo', 'MISTS_SOLO_YELLOW', 0, ['settingMistsSolo', 'settingMistsEnchant0'], 'dungeon_0'],
    ])('synthetic: %s keeps the entry and gates it at draw time', (label, name, enchant, gateKeys, drawName) => {
        handler.dungeonEvent({...baseParams, 3: name, 9: enchant});
        expect(handler.dungeonList).toHaveLength(1);

        settingsSync.getBool.mockImplementation(key => !gateKeys.includes(key));
        drawing.draw(ctx, handler.dungeonList);
        expect(drawnSrcs(ctx).some(s => s.includes(`${drawName}.webp`))).toBe(false);

        ctx.calls.length = 0;
        settingsSync.getBool.mockReturnValue(true);
        drawing.draw(ctx, handler.dungeonList);
        expect(drawnSrcs(ctx).some(s => s.includes(`${drawName}.webp`))).toBe(true);
    });
});

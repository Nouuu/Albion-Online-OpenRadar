// pcap-derived: router/change-cluster-bz.json (zone 0317), players/spawn.json and dungeons/spawn.json through EventRouter,
// chests/spawn.json through addChestEvent. Real SettingsSync over an empty store; ImageCache stubbed, the radar markup mounted.
import {beforeAll, describe, expect, test, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {defaultZonesDatabase, loadRealZonesDatabase} from '../__fixtures__/realDatabases.js';
import {installRecordingContext} from '../__fixtures__/recordingContext.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../utils/ImageCache.js', () => ({
    default: {GetPreloadedImage: vi.fn(src => ({src})), preloadImageAndAddToList: vi.fn()},
}));

const EventRouter = await import('./EventRouter.js');
const PlayerListRenderer = await import('./PlayerListRenderer.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;
const {PlayersHandler} = await import('../handlers/PlayersHandler.js');
const {DungeonsHandler} = await import('../handlers/DungeonsHandler.js');
const {ChestsHandler} = await import('../handlers/ChestsHandler.js');
const {DungeonsDrawing} = await import('../drawings/DungeonsDrawing.js');

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

describe('fresh profile full flow', () => {
    test('@verified 2026-10-08: with no setting changed, zone 0317 lists the 8 players, draws 5418 and 41517 and stores the chest', async () => {
        localStorage.clear();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.settingsSync = settingsSync;
        mountPage('radar');
        const playersHandler = new PlayersHandler();
        const dungeonsHandler = new DungeonsHandler();
        const chestsHandler = new ChestsHandler();
        EventRouter.reset();
        EventRouter.init({
            handlers: {playersHandler, dungeonsHandler, chestsHandler},
            map: {id: -1, hX: 0, hY: 0, isBZ: false},
            radarRenderer: {setLocalPlayerPosition: vi.fn(), setMap: vi.fn()},
        });

        const cluster = await loadFixture('router', 'change-cluster-bz');
        EventRouter.onResponse(normalizeParams(cluster.messages[0].parameters), vi.fn());
        for (const [handler, scenario] of [['players', 'spawn'], ['dungeons', 'spawn']]) {
            const fx = await loadFixture(handler, scenario);
            for (const message of fx.messages) EventRouter.onEvent(normalizeParams(message.parameters));
        }
        const chests = await loadFixture('chests', 'spawn');
        chestsHandler.addChestEvent(normalizeParams(chests.messages[0].parameters));

        PlayerListRenderer.reset();
        PlayerListRenderer.update(playersHandler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        installRecordingContext();
        const ctx = document.createElement('canvas').getContext('2d');
        new DungeonsDrawing().draw(ctx, dungeonsHandler.dungeonList);

        expect(window.currentMapId).toBe('0317');
        expect(document.querySelectorAll('#hostileList [data-player-id]')).toHaveLength(8);
        expect(dungeonsHandler.dungeonList.map(d => d.id)).toEqual([5418, 41517]);
        expect(ctx.calls.filter(c => c[0] === 'drawImage').map(c => c[1].src))
            .toEqual([expect.stringContaining('group_1.webp'), expect.stringContaining('group_2.webp')]);
        expect(chestsHandler.chestsList.map(c => c.id)).toEqual([chests.messages[0].parameters['0']]);
        expect(window.logger.error).not.toHaveBeenCalled();
    });
});

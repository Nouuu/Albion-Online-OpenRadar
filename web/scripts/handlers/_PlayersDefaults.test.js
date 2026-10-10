// pcap-derived: router/change-cluster-bz.json (zone 0317) then players/spawn.json (8 NewCharacter events).
// Real SettingsSync over an empty store, so every read is a registry default.
import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import * as EventRouter from '../core/EventRouter.js';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {defaultZonesDatabase, loadRealZonesDatabase} from '../__fixtures__/realDatabases.js';
import {PlayersHandler} from './PlayersHandler.js';

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

describe('player defaults on a fresh profile', () => {
    let playersHandler;

    beforeEach(() => {
        localStorage.clear();
        EventRouter.reset();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        playersHandler = new PlayersHandler();
        const map = {id: -1, hX: 0, hY: 0, isBZ: false};
        EventRouter.init({handlers: {playersHandler}, map, radarRenderer: {setLocalPlayerPosition: vi.fn(), setMap: vi.fn()}});
    });

    // @verified 2026-09-24: the three player types and detection default on per the settings registry table.
    test('every spawned player of a black zone is listed', async () => {
        const cluster = await loadFixture('router', 'change-cluster-bz');
        EventRouter.onResponse(normalizeParams(cluster.messages[0].parameters), vi.fn());
        const spawn = await loadFixture('players', 'spawn');
        for (const message of spawn.messages) EventRouter.onEvent(normalizeParams(message.parameters));

        const {hostile, faction, passive} = playersHandler.getPlayersByType();
        expect(window.currentMapId).toBe('0317');
        expect(hostile).toHaveLength(8);
        expect([...faction, ...passive]).toEqual([]);
        expect(window.logger.error).not.toHaveBeenCalled();
    });
});

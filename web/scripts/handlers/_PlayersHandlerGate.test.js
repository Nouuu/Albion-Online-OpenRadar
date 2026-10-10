import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';
import settingsSync from '../utils/SettingsSync.js';
import {PlayersHandler} from './PlayersHandler.js';

// synthetic: players built from spawn parameters, no capture involved
// real data: zones from web/ao-bin-dumps/zones.json, settings through the real SettingsSync over happy-dom localStorage

const FILTER_KEYS = ['settingPassivePlayers', 'settingFactionPlayers', 'settingDangerousPlayers'];

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

describe('PlayersHandler on real settings and zones', () => {
    let handler;

    beforeEach(() => {
        [...FILTER_KEYS, 'ignoreList'].forEach(key => settingsSync.remove(key));
        settingsSync.setBool('settingShowPlayers', true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = '2203';

        handler = new PlayersHandler();
        handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.handleNewPlayerEvent(2, {1: 'Faction', 8: '', 53: 5, 51: null, 40: [], 43: []});
        handler.handleNewPlayerEvent(3, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});
    });

    describe('getFilteredPlayers', () => {
        // @verified 2026-09-23: SettingsSync.getBool returns false for a key never written, and the players page shows
        // that key as an unticked checkbox, so an untouched class filter hides its class like one set to false.
        test.each([
            ['unset', null, []],
            ['false', false, []],
            ['true', true, [1, 2, 3]],
        ])('synthetic: class filters %s in a red zone', (_label, value, ids) => {
            if (value !== null) FILTER_KEYS.forEach(key => settingsSync.setBool(key, value));

            expect(handler.getFilteredPlayers().map(p => p.id)).toEqual(ids);
        });

        // @verified 2026-09-23: each class filter of the players page gates its own class only outside a black zone.
        test.each([
            ['settingPassivePlayers', [1]],
            ['settingFactionPlayers', [2]],
            ['settingDangerousPlayers', [3]],
        ])('synthetic: only %s ticked in a red zone', (key, ids) => {
            settingsSync.setBool(key, true);

            expect(handler.getFilteredPlayers().map(p => p.id)).toEqual(ids);
        });

        // @verified 2026-09-23: in a black zone every player is a threat, so the dangerous filter alone governs the list.
        test.each([
            ['unset', null, []],
            ['true', true, [1, 2, 3]],
        ])('synthetic: dangerous filter %s in a black zone', (_label, value, ids) => {
            window.currentMapId = '3316';
            if (value !== null) settingsSync.setBool('settingDangerousPlayers', value);

            expect(handler.getFilteredPlayers().map(p => p.id)).toEqual(ids);
        });
    });
});

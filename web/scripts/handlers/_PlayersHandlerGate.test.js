// synthetic: players built from spawn parameters, no capture involved
// real data: zones from web/ao-bin-dumps/zones.json, settings through the real SettingsSync over happy-dom localStorage

import {describe, test, expect, beforeAll, beforeEach, afterEach, vi} from 'vitest';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';
import settingsSync from '../utils/SettingsSync.js';
import {PlayersHandler} from './PlayersHandler.js';

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

    describe('isDangerous', () => {
        // @verified 2026-09-23: the spawn alert gate, isPlayerThreat on the zone of zones.json: black every player,
        // red and yellow faction 255 only, safe and an unknown map nobody.
        test.each([
            ['3316', 'black', [1, 2, 3]],
            ['2203', 'red', [3]],
            ['0212', 'yellow', [3]],
            ['1000', 'safe', []],
            [null, 'safe', []],
        ])('synthetic: map %s (%s) makes %j dangerous', (mapId, pvpType, ids) => {
            window.currentMapId = mapId;

            expect(defaultZonesDatabase.getPvpType(mapId)).toBe(pvpType);
            expect(handler.playersList.filter(p => handler.isDangerous(p)).map(p => p.id)).toEqual(ids);
        });

        // @verified 2026-09-23: the ignore list clears the spawn alert on nickname, guild or alliance, so it clears
        // the danger too, even in a black zone.
        test.each([
            ['nickname', 'Enemy'],
            ['guild', 'EnemyGuild'],
            ['alliance', 'EnemyAlliance'],
        ])('synthetic: a hostile ignored by %s is not dangerous in a black zone', (_label, entry) => {
            window.currentMapId = '3316';
            handler.handleNewPlayerEvent(4, {1: 'Enemy', 8: 'EnemyGuild', 53: 255, 51: 'EnemyAlliance', 40: [], 43: []});
            settingsSync.setJSON('ignoreList', [entry]);

            expect(handler.isDangerous(handler.getPlayer(4))).toBe(false);
            expect(handler.isDangerous(handler.getPlayer(3))).toBe(true);
        });
    });

    describe('getPlayer', () => {
        // @verified 2026-09-23: lookup by id in the players list.
        test('synthetic: returns the listed player and undefined for an unknown id', () => {
            expect(handler.getPlayer(2).nickname).toBe('Faction');
            expect(handler.getPlayer(99)).toBeUndefined();
        });
    });

    describe('action and attack timestamps', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        // @verified 2026-09-23: a player seen at spawn has not acted and has not attacked yet.
        test('synthetic: a new player starts with lastActionAt and attackingUntil at 0', () => {
            expect(handler.getPlayer(1).lastActionAt).toBe(0);
            expect(handler.getPlayer(1).attackingUntil).toBe(0);
        });

        // @verified 2026-09-23: an action orders the list and keeps the player from stale cleanup.
        test('synthetic: noteAction stamps lastActionAt and refreshes lastUpdateTime', () => {
            vi.useFakeTimers();
            vi.advanceTimersByTime(5000);

            handler.noteAction(1);

            expect(handler.getPlayer(1).lastActionAt).toBe(Date.now());
            expect(handler.getPlayer(1).lastUpdateTime).toBe(Date.now());
        });

        // @verified 2026-09-23: the attacker flag lasts 10 seconds from the last hit and counts as an action.
        test('synthetic: flagAttacker holds the flag 10 seconds and stamps the action', () => {
            vi.useFakeTimers();
            vi.advanceTimersByTime(5000);

            handler.flagAttacker(3);

            expect(handler.getPlayer(3).attackingUntil).toBe(Date.now() + 10000);
            expect(handler.getPlayer(3).lastActionAt).toBe(Date.now());
        });

        // @verified 2026-09-23: an id absent from the list changes nothing.
        test('synthetic: noteAction and flagAttacker ignore an unknown id', () => {
            handler.noteAction(99);
            handler.flagAttacker(99);

            expect(handler.getSize()).toBe(3);
            expect(handler.playersList.every(p => p.lastActionAt === 0 && p.attackingUntil === 0)).toBe(true);
        });
    });
});

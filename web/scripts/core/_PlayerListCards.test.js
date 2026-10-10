// pcap-derived: the mount-up of the players/mounted fixture
// synthetic: the spawns that seed the players, and the dismount the fixture does not carry
// real data: zones from web/ao-bin-dumps/zones.json, map 1000 (Lymhurst, safe), module settings through the real SettingsSync

import {describe, test, expect, beforeAll, beforeEach, afterEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';
import settingsSync from '../utils/SettingsSync.js';
import {PlayersHandler} from '../handlers/PlayersHandler.js';
import * as PlayerListRenderer from './PlayerListRenderer.js';

const HANDLER_KEYS = ['settingShowPlayers', 'settingPassivePlayers'];

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

beforeEach(() => {
    HANDLER_KEYS.forEach(key => settingsSync.setBool(key, true));
    window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
    window.currentMapId = '1000';
    window.settingsSync = {getBool: () => false};
    document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div></div>';
    PlayerListRenderer.reset();
});

describe('an existing player card follows the mount state', () => {
    let handler;

    const render = async () => {
        PlayerListRenderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
    };

    const cardsOf = id => document.querySelectorAll(`[data-player-id="${id}"]`);

    beforeEach(() => {
        handler = new PlayersHandler();
    });

    // @verified 2026-09-23: the Mounted badge shows the rider's current state, and the list refresh hash in Utils.js
    // already carries mounted, so a mount-up must reach a card that is already on screen.
    test('pcap-derived mounted: an existing card gains the Mounted badge', async () => {
        const fx = await loadFixture('players', 'mounted');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];
        handler.handleNewPlayerEvent(id, {1: 'Rider', 8: '', 53: 0, 51: null, 40: [], 43: []});
        await render();
        expect(cardsOf(id)[0].textContent).not.toContain('Mounted');

        handler.handleMountedPlayerEvent(id, normalizeParams(msg.parameters));
        await render();

        expect(cardsOf(id)).toHaveLength(1);
        expect(cardsOf(id)[0].textContent).toContain('Mounted');
    });

    // @verified 2026-09-23: a dismount clears the badge of a card already on screen.
    test('synthetic: an existing card loses the Mounted badge on dismount', async () => {
        handler.handleNewPlayerEvent(7, {1: 'Rider', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.handleMountedPlayerEvent(7, {11: true});
        await render();
        expect(cardsOf(7)[0].textContent).toContain('Mounted');

        handler.handleMountedPlayerEvent(7, {11: false});
        await render();

        expect(cardsOf(7)).toHaveLength(1);
        expect(cardsOf(7)[0].textContent).not.toContain('Mounted');
    });
});

// synthetic: players spawned in map 1000, actions and hits stamped through PlayersHandler; only Date is faked, so the
// sections still render on a real animation frame

describe('players list order and attack flag', () => {
    let handler;

    const spawn = id => handler.handleNewPlayerEvent(id, {1: `P${id}`, 8: '', 53: 0, 51: null, 40: [], 43: []});
    const cards = list => [...document.querySelectorAll(`#${list} [data-player-id]`)];
    const order = list => cards(list).map(card => Number(card.dataset.playerId));
    const badge = (card, text) => [...card.querySelectorAll('span')].find(span => span.textContent === text);
    const render = async () => {
        PlayerListRenderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
    };

    beforeEach(() => {
        vi.useFakeTimers({toFake: ['Date']});
        vi.setSystemTime(1_000_000);
        handler = new PlayersHandler();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // @verified 2026-09-23: players without an action keep their arrival order.
    test('synthetic: players without an action keep their arrival order', async () => {
        [1, 2, 3].forEach(spawn);

        await render();

        expect(order('passiveList')).toEqual([1, 2, 3]);
    });

    // @verified 2026-09-23: the latest action comes first in its section.
    test('synthetic: the latest action comes first', async () => {
        [1, 2, 3].forEach(spawn);
        vi.setSystemTime(1_001_000);
        handler.noteAction(2);
        vi.setSystemTime(1_002_000);
        handler.noteAction(3);

        await render();

        expect(order('passiveList')).toEqual([3, 2, 1]);
    });

    // @verified 2026-09-23: an existing card is moved, not rebuilt, when the order changes.
    test('synthetic: an action moves the existing card to the top', async () => {
        [1, 2, 3].forEach(spawn);
        await render();
        const third = cards('passiveList')[2];

        vi.setSystemTime(1_001_000);
        handler.noteAction(3);
        await render();

        expect(order('passiveList')).toEqual([3, 1, 2]);
        expect(cards('passiveList')[0]).toBe(third);
    });

    // @verified 2026-09-23: an existing card gains the Attacking you badge in the error colour next to Mounted and a red
    // ring, and moves to the top of its section.
    test('synthetic: a flagged attacker shows the badge and the ring at the top of its section', async () => {
        [1, 2].forEach(spawn);
        handler.updatePlayerMounted(2, true);
        await render();
        expect(badge(cards('passiveList')[1], 'Attacking you')).toBeUndefined();

        handler.flagAttacker(2);
        await render();

        const card = cards('passiveList')[0];
        const attacking = badge(card, 'Attacking you');
        expect(card.dataset.playerId).toBe('2');
        expect(attacking.classList.contains('text-error')).toBe(true);
        expect(attacking.parentElement).toBe(badge(card, 'Mounted').parentElement);
        expect(card.classList.contains('ring-2')).toBe(true);
        expect(card.classList.contains('ring-error')).toBe(true);
    });

    // @verified 2026-09-23: the badge and the ring leave 10 s after the last hit.
    test('synthetic: the badge and the ring are gone 10 s after the hit', async () => {
        spawn(1);
        handler.flagAttacker(1);
        vi.setSystemTime(1_009_999);
        await render();
        expect(badge(cards('passiveList')[0], 'Attacking you')).toBeDefined();

        vi.setSystemTime(1_010_000);
        await render();

        const card = cards('passiveList')[0];
        expect(badge(card, 'Attacking you')).toBeUndefined();
        expect(card.classList.contains('ring-error')).toBe(false);
    });

    describe('whatever the actions switch', () => {
        afterEach(() => {
            settingsSync.remove('settingShowPlayerActions');
        });

        // @verified 2026-09-23: the actions switch hides the radar markers only; with the page global bound to the real
        // SettingsSync, as base.gohtml does, the list keeps its order by last action and the attack flag either way.
        test.each([false, true])('synthetic: settingShowPlayerActions %s keeps the order by last action, the badge and the ring', async (on) => {
            window.settingsSync = settingsSync;
            settingsSync.setBool('settingShowPlayerActions', on);
            [1, 2, 3].forEach(spawn);
            vi.setSystemTime(1_001_000);
            handler.noteAction(2);
            vi.setSystemTime(1_002_000);
            handler.flagAttacker(3);

            await render();

            const top = cards('passiveList')[0];
            expect(order('passiveList')).toEqual([3, 2, 1]);
            expect(badge(top, 'Attacking you').classList.contains('text-error')).toBe(true);
            expect(top.classList.contains('ring-error')).toBe(true);
        });
    });
});

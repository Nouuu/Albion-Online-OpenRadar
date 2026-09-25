import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';
import settingsSync from '../utils/SettingsSync.js';
import {PlayersHandler} from '../handlers/PlayersHandler.js';
import * as PlayerListRenderer from './PlayerListRenderer.js';

// pcap-derived: the mount-up of the players/mounted fixture
// synthetic: the spawns that seed the players, and the dismount the fixture does not carry
// real data: zones from web/ao-bin-dumps/zones.json, map 1000 (Lymhurst, safe), module settings through the real SettingsSync

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

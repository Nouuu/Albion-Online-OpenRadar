import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealItemsDatabase} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getNumber: vi.fn((_k, d) => d),
        getJSON: vi.fn(() => null),
    },
}));

vi.mock('../data/ZonesDatabase.js', () => ({
    default: {
        getPvpType: vi.fn(() => 'safe'),
    },
}));

const {PlayersHandler} = await import('../handlers/PlayersHandler.js');

// pcap-derived: web/scripts/__fixtures__/ws/players/equipment.json message 0.
// Slot layout measured on 10390 real arrays: 0 main hand, 1 off hand, 2 head,
// 3 armor, 4 shoes, 5 bag, 6 cape, 7 mount, 8 potion, 9 food.
// Expected names come from upstream formatted/items.txt.

describe('equipment reaches the renderer with the right items', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = 'safe-zone-01';
        window.itemsDatabase = loadRealItemsDatabase();
        window.settingsSync = {getBool: () => true};
        handler = new PlayersHandler();
    });

    // @verified 2026-07-24: the head, armor and shoes slots of a real player resolve to armour, not weapons.
    test('pcap-derived equipment resolves to the gatherer set the player wore', async () => {
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        const player = handler.playersList[0];
        const resolved = player.equipments.map(itemId => window.itemsDatabase.getItemById(itemId)?.name ?? null);

        expect(resolved[2]).toBe('T8_HEAD_GATHERER_FIBER');
        expect(resolved[3]).toBe('T8_ARMOR_GATHERER_FIBER');
        expect(resolved[4]).toBe('T8_SHOES_GATHERER_FIBER');
        expect(resolved[7]).toBe('T6_MOUNT_GIANTSTAG_MOOSE');
    });

    // @verified 2026-07-24: average item power is computed from the combat slots of the real set.
    test('pcap-derived equipment yields an item power from the combat slots', async () => {
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        const ip = handler.playersList[0].getAverageItemPower();

        expect(ip).toBeGreaterThan(0);
    });

    // @verified 2026-07-24: the rendered markup carries the icon path of the head slot item.
    test('rendered markup points at the head slot icon', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div></div>';
        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.body.innerHTML).toContain('/images/Items/T8_HEAD_GATHERER_FIBER.webp');
    });
});

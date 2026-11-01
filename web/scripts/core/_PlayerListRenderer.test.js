import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealItemsDatabase, loadRealSpellsDatabase} from '../__fixtures__/realDatabases.js';

const {registryDefault} = await vi.hoisted(() => import('../utils/SettingsRegistry.js'));

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getNumber: vi.fn(key => registryDefault(key)),
        getJSON: vi.fn(() => null),
    },
}));

vi.mock('../data/ZonesDatabase.js', () => ({
    default: {
        getPvpType: vi.fn(() => 'safe'),
    },
}));

const {PlayersHandler} = await import('../handlers/PlayersHandler.js');

// pcap-derived: the equipment fixture from the 2026-07-24 capture
// synthetic: the spawn parameters that seed the player before the equipment message

describe('player equipment resolves to the correct items', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = 'safe-zone-01';
        window.itemsDatabase = loadRealItemsDatabase();
        window.settingsSync = {getBool: () => true};
        handler = new PlayersHandler();
    });

    // @verified 2026-09-03: the head, armor and shoes slots of a real player resolve to armour, not weapons.
    // Same T4.1 set as the 2026-08-02 capture, now carried by its Dragonfire ids.
    test('pcap-derived equipment resolves to the gear set the player wore', async () => {
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        const player = handler.playersList[0];
        const resolved = player.equipments.map(itemId => window.itemsDatabase.getItemById(itemId)?.name ?? null);

        expect(resolved[2]).toBe('T4_HEAD_LEATHER_SET2@1');
        expect(resolved[3]).toBe('T4_ARMOR_LEATHER_SET1@1');
        expect(resolved[4]).toBe('T4_SHOES_PLATE_SET3@1');
        expect(resolved[7]).toBe('T4_MOUNT_HORSE');
    });

    // @verified 2026-08-02: each combat slot carries its own item power, so a wrong mapping cannot hide inside the average.
    test('pcap-derived equipment yields an item power from the combat slots', async () => {
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        const equipment = handler.playersList[0].equipments;
        const itemPower = index => window.itemsDatabase.getItemById(equipment[index])?.itempower ?? null;

        expect(itemPower(0)).toBe(800);
        expect(itemPower(1)).toBe(800);
        expect(itemPower(2)).toBe(800);
        expect(itemPower(3)).toBe(800);
        expect(itemPower(4)).toBe(800);

        const ip = handler.playersList[0].getAverageItemPower();
        expect(ip).toBe(800);
    });

    // @verified 2026-08-02: the rendered markup carries the icon path of the head slot item.
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

        expect(document.body.innerHTML).toContain('/images/Items/T4_HEAD_LEATHER_SET2.webp');
    });

    test('the card and its equipment icons carry phone-landscape compact classes', async () => {
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

        const card = document.querySelector('[data-player-id]');
        expect(card.className).toContain('phone-landscape:p-1.5');
        expect(card.className).toContain('phone-landscape:pl-2.5');
        const icon = document.querySelector('[data-player-id] img');
        expect(icon.className).toContain('phone-landscape:w-4');
        expect(icon.className).toContain('phone-landscape:h-4');
        const pill = icon.closest('.inline-flex');
        expect(pill.className).toContain('phone-landscape:gap-0.5');
        expect(pill.className).toContain('phone-landscape:px-1');
        expect(pill.className).toContain('phone-landscape:py-0.5');
        const tier = pill.querySelector('span');
        expect(tier.className).toContain('phone-landscape:text-[9px]');
        const equipWrapper = pill.parentElement;
        expect(equipWrapper.className).toContain('phone-landscape:gap-0.5');
        expect(equipWrapper.className).toContain('phone-landscape:mt-0.5');
        expect(equipWrapper.className).toContain('phone-landscape:pt-0.5');
    });

    test('equipment tier and IP text never go below 9px, even under phone-landscape', async () => {
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

        const pill = document.querySelector('[data-player-id] .inline-flex');
        for (const span of pill.querySelectorAll('span')) {
            expect(span.className).not.toMatch(/text-\[[0-8]px\]/);
        }
    });

    test('the guild row and the IP/mounted row stay separate sibling rows, in the original order', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        window.settingsSync = {getBool: () => true};
        const id = 900500;
        handler.handleNewPlayerEvent(id, {1: 'Merged', 8: 'Some Guild', 53: 0, 51: null, 40: [], 43: []});
        handler.updatePlayerMounted(id, true);

        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div></div>';
        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        const card = document.querySelector('[data-player-id]');
        expect(card.querySelector('.basis-full')).toBeNull();
        const header = card.firstElementChild.nextElementSibling;
        const nameColumn = header.firstElementChild;
        const guildRow = nameColumn.lastElementChild;
        expect(guildRow.innerHTML).toContain('[Some Guild]');
        expect(guildRow.innerHTML).not.toContain('>Mounted<');
        const ipMountedRow = header.nextElementSibling;
        expect(ipMountedRow.innerHTML).toContain('>Mounted<');
        expect(ipMountedRow.className).toContain('phone-landscape:mt-0');
        expect(ipMountedRow.className).not.toContain('phone-landscape:contents');
    });

    test('with the real SettingsSync default, the ID line is hidden', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        window.settingsSync = {getBool: key => registryDefault(key)};
        const id = 900700;
        handler.handleNewPlayerEvent(id, {1: 'RealDefault', 8: '', 53: 0, 51: null, 40: [], 43: []});

        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div></div>';
        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.body.innerHTML).not.toContain(`ID: ${id}`);
    });
});

// pcap-derived: the equipment, faction-spawn and mounted fixtures from the 2026-07-24 capture
// synthetic: spawn parameters for the spells, health bar, equipment, mounted and ID debug scenarios, not isolated in the corpus

describe('player card refreshes on a display setting change without a new spawn', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = 'safe-zone-01';
        window.itemsDatabase = loadRealItemsDatabase();
        handler = new PlayersHandler();
        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div></div>';
    });

    test('card shows equipment after Show equipment is ticked, on the next refresh, without a new spawn', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        const fx = await loadFixture('players', 'equipment');
        const msg = fx.messages[0];
        const id = msg.parameters['0'];

        window.settingsSync = {getBool: key => key !== 'settingPlayersShowEquipment'};
        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.updateItems(id, normalizeParams(msg.parameters));

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).not.toContain('/images/Items/T4_HEAD_LEATHER_SET2.webp');

        window.settingsSync = {getBool: () => true};
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).toContain('/images/Items/T4_HEAD_LEATHER_SET2.webp');
    });

    // @verified 2026-10-10: the spells row appears on the next refresh after Show spells is ticked, with no new spawn.
    test('card shows spells after Show spells is ticked, on the next refresh, without a new spawn', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        window.spellsDatabase = await loadRealSpellsDatabase();
        window.settingsSync = {getBool: key => key !== 'settingPlayersShowSpells'};

        const id = 90001;
        handler.handleNewPlayerEvent(id, {1: 'Caster', 8: '', 53: 0, 51: null, 40: [], 43: [1, 2]});

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).not.toContain('/images/Spells/PASSIVE_NOATTACK.webp');

        window.settingsSync = {getBool: () => true};
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).toContain('/images/Spells/PASSIVE_NOATTACK.webp');
        expect(document.body.innerHTML).toContain('/images/Spells/PASSIVE_DAZE.webp');
    });

    test.each([
        ['settingPlayersShowGuild', '[Treasure Map]', async () => {
            const msg = (await loadFixture('players', 'faction-spawn')).messages[3];
            handler.handleNewPlayerEvent(msg.parameters['0'], normalizeParams(msg.parameters));
        }],
        ['settingPlayersShowTotalIp', 'IP 800', async () => {
            const msg = (await loadFixture('players', 'equipment')).messages[0];
            handler.handleNewPlayerEvent(msg.parameters['0'], {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.updateItems(msg.parameters['0'], normalizeParams(msg.parameters));
        }],
        ['settingPlayersShowMounted', '>Mounted<', async () => {
            const msg = (await loadFixture('players', 'mounted')).messages[0];
            handler.handleNewPlayerEvent(msg.parameters['0'], {1: 'Rider', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleMountedPlayerEvent(msg.parameters['0'], normalizeParams(msg.parameters));
        }],
        ['settingDebugPlayersIds', 'ID: ', async () => {
            handler.handleNewPlayerEvent(900099, {1: 'Debuggable', 8: '', 53: 0, 51: null, 40: [], 43: []});
        }],
    ])('@verified 2026-09-26: %s off hides %s, and ticking it shows it on the next refresh without a new spawn', async (key, text, seed) => {
        const renderer = await import('./PlayerListRenderer.js');
        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div>'
            + '<div id="playersFaction"><div id="factionList"></div></div></div>';
        window.settingsSync = {getBool: name => name !== key};
        await seed();

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.querySelectorAll('[data-player-id]')).toHaveLength(1);
        expect(document.body.innerHTML).not.toContain(text);

        window.settingsSync = {getBool: () => true};
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).toContain(text);
    });

    test('card shows a health bar once health becomes available, on the next refresh, without a new spawn', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        window.settingsSync = {getBool: () => true};

        const id = 90002;
        handler.handleNewPlayerEvent(id, {1: 'Fresh', 8: '', 53: 0, 51: null, 40: [], 43: []});

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).not.toContain('data-health-bar');

        handler.UpdatePlayerHealth({0: id, 2: 80, 3: 100});
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.body.innerHTML).toContain('data-health-bar');
    });

    // @verified 2026-10-10: Show Health Bars is part of the card key, so ticking it rebuilds the card on the next refresh.
    // synthetic: a player with health, the corpus holds no health update.
    test('Show Health Bars off then on rebuilds the card with its bar on the next refresh', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        window.settingsSync = {getBool: key => key !== 'settingPlayersShowHealthBars'};
        const id = 90003;
        handler.handleNewPlayerEvent(id, {1: 'Hurt', 8: '', 53: 0, 51: null, 40: [], 43: []});
        handler.UpdatePlayerHealth({0: id, 2: 80, 3: 100});

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const first = document.querySelector('[data-player-id]');
        expect(document.body.innerHTML).not.toContain('data-health-bar');

        window.settingsSync = {getBool: () => true};
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.querySelector('[data-player-id]')).not.toBe(first);
        expect(document.body.innerHTML).toContain('data-health-bar');
    });

    // @verified 2026-10-10: equipment that arrives after the first render rebuilds the card on the next refresh.
    // pcap-derived: players/equipment.json message 0; synthetic: the bare spawn that precedes it.
    test('equipment arriving after the first render rebuilds the card on the next refresh', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        const msg = (await loadFixture('players', 'equipment')).messages[0];
        const id = msg.parameters['0'];
        window.settingsSync = {getBool: () => true};
        handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const first = document.querySelector('[data-player-id]');
        expect(document.body.innerHTML).not.toContain('/images/Items/T4_HEAD_LEATHER_SET2.webp');

        handler.updateItems(id, normalizeParams(msg.parameters));
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.querySelector('[data-player-id]')).not.toBe(first);
        expect(document.body.innerHTML).toContain('/images/Items/T4_HEAD_LEATHER_SET2.webp');
    });

    // @verified 2026-10-10: a repeat spawn that carries other spells rebuilds the card on the next refresh.
    // pcap-derived: the spell lists of players/spawn.json messages 0 and 1, replayed under one player id.
    test('spells changing on a repeat spawn rebuild the card on the next refresh', async () => {
        const renderer = await import('./PlayerListRenderer.js');
        const [one, two] = (await loadFixture('players', 'spawn')).messages.map(msg => normalizeParams(msg.parameters));
        window.spellsDatabase = await loadRealSpellsDatabase();
        window.settingsSync = {getBool: () => true};
        const names = list => list.filter(index => index > 0 && index !== 65535)
            .map(index => window.spellsDatabase.getSpellByIndex(index)?.uniqueName);
        const onlyTwo = names(two[43]).find(name => !names(one[43]).includes(name));
        expect(onlyTwo).toBeTruthy();
        handler.handleNewPlayerEvent(one[0], one);

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const first = document.querySelector('[data-player-id]');
        expect(document.body.innerHTML).not.toContain(`title="${onlyTwo}"`);

        handler.handleNewPlayerEvent(one[0], {...one, 43: two[43]});
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.querySelector('[data-player-id]')).not.toBe(first);
        expect(document.body.innerHTML).toContain(`title="${onlyTwo}"`);
    });

    // @verified 2026-11-01: name, guild, alliance, faction and mounted are part of the card key, so a change that
    // arrives after the first render shows on the next refresh. pcap-derived: players/mounted.json message 0; synthetic: the other changes.
    const spawn = {1: 'Before', 8: 'OldGuild', 53: 0, 51: null, 40: [], 43: []};
    test.each([
        ['mounted', '>Mounted<', spawn, async (id) => {
            const msg = (await loadFixture('players', 'mounted')).messages[0];
            handler.handleMountedPlayerEvent(id, normalizeParams(msg.parameters));
        }],
        ['nickname', '>After<', spawn, async (id) => handler.handleNewPlayerEvent(id, {...spawn, 1: 'After'})],
        ['guild', '[NewGuild]', spawn, async (id) => handler.handleNewPlayerEvent(id, {...spawn, 8: 'NewGuild'})],
        ['alliance', '&lt;ALLY&gt;', spawn, async (id) => handler.handleNewPlayerEvent(id, {...spawn, 51: 'ALLY'})],
        ['faction city', 'Lymhurst', {...spawn, 53: 1}, async (id) => handler.updatePlayerFaction(id, 2)],
    ])('%s changing after the first render shows %s on the next refresh', async (field, text, params, change) => {
        const renderer = await import('./PlayerListRenderer.js');
        document.body.innerHTML = '<div id="playersList"><div id="playersPassive"><div id="passiveList"></div></div>'
            + '<div id="playersFaction"><div id="factionList"></div></div></div>';
        window.settingsSync = {getBool: () => true};
        const id = 90100;
        handler.handleNewPlayerEvent(id, params);

        renderer.reset();
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(document.querySelectorAll('[data-player-id]')).toHaveLength(1);
        expect(document.body.innerHTML).not.toContain(text);

        await change(id);
        renderer.update(handler);
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(document.querySelectorAll('[data-player-id]')).toHaveLength(1);
        expect(document.body.innerHTML).toContain(text);
    });
});

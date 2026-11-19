// synthetic: PiP player panel geometry, data helpers and drawing, checked against a recording canvas context.
import {describe, expect, test} from 'vitest';
import {createRecordingContext} from '../__fixtures__/recordingContext.js';
import {
    PIP_PLAYERS_POSITIONS,
    PipPlayersPanel,
    collectPlayers,
    computeLayout,
    gearOf,
    readPanelSettings,
} from './PipPlayersPanel.js';

const ALL_OPTS = {equipment: true, spells: false, health: true, guild: true, ip: true, mounted: true};
const NO_OPTS = {equipment: false, spells: false, health: false, guild: false, ip: false, mounted: false};

const ITEMS = {
    101: {name: 'T6_MAIN_SWORD@2', tier: 6, enchant: 2},
    102: {name: 'T4_ARMOR_PLATE_SET1', tier: 4, enchant: 0},
    103: {name: 'T8_HEAD_CLOTH_SET3@4', tier: 8, enchant: 4},
    104: {name: 'T5_BAG', tier: 5, enchant: 0},
    105: {name: 'T7_POTION_HEAL', tier: 7, enchant: 0},
};
const itemsDb = {getItemById: id => ITEMS[id]};
const spellsDb = {getSpellByIndex: index => (index === 7 ? {uiSprite: 'SPELL_FIRE'} : null)};

function makePlayer(overrides = {}) {
    return {
        id: 1,
        nickname: 'Zed',
        guildName: 'Night',
        allianceName: 'Owls',
        faction: 255,
        mounted: false,
        detectedAt: 0,
        currentHealth: 0,
        initialHealth: 0,
        equipments: null,
        spells: null,
        getAverageItemPower: () => 1400,
        ...overrides,
    };
}

function newCtx() {
    return createRecordingContext(document.createElement('canvas'));
}

function textsOf(ctx) {
    return ctx.calls.filter(call => call[0] === 'fillText').map(call => call[1]);
}

function makePanel(loadIcon = () => null) {
    return new PipPlayersPanel({loadIcon, items: () => itemsDb, spells: () => spellsDb});
}

function modelOf(entries) {
    const counts = {hostile: 0, faction: 0, passive: 0};
    entries.forEach(({type}) => counts[type]++);
    return {entries, counts};
}

describe('computeLayout', () => {
    test('is null when the panel is off or the position is unknown', () => {
        expect(PIP_PLAYERS_POSITIONS).toEqual(['off', 'right', 'bottom']);
        expect(computeLayout('off', 500, ALL_OPTS)).toBeNull();
        expect(computeLayout('left', 500, ALL_OPTS)).toBeNull();
        expect(computeLayout(undefined, 500, ALL_OPTS)).toBeNull();
    });

    test('beside the radar widens the canvas and keeps the map height', () => {
        const layout = computeLayout('right', 500, ALL_OPTS);
        expect([layout.width, layout.height]).toEqual([810, 500]);
        expect(layout.panel).toEqual({x: 500, y: 0, w: 310, h: 500});
        expect([layout.cols, layout.rows, layout.capacity]).toEqual([1, 4, 4]);
    });

    test('under the radar makes the canvas taller and keeps the map width', () => {
        const layout = computeLayout('bottom', 500, ALL_OPTS);
        expect(layout.width).toBe(500);
        expect(layout.height).toBe(500 + layout.panel.h);
        expect(layout.panel).toMatchObject({x: 0, y: 500, w: 500});
        expect([layout.cols, layout.rows, layout.capacity]).toEqual([2, 2, 4]);
    });

    test('the panel fits inside the canvas and its cards fit inside the panel', () => {
        for (const position of ['right', 'bottom']) {
            for (const size of [300, 500, 900, 1200]) {
                const layout = computeLayout(position, size, ALL_OPTS);
                const {panel, m} = layout;
                const lastRow = layout.cardsTop + layout.rows * (layout.cardH + m.gap) - m.gap + m.pad;
                expect(panel.x + panel.w, `${position} ${size} width`).toBeLessThanOrEqual(layout.width);
                expect(panel.y + panel.h, `${position} ${size} height`).toBeLessThanOrEqual(layout.height);
                expect(lastRow, `${position} ${size} cards`).toBeLessThanOrEqual(panel.h);
            }
        }
    });

    test('gear tiles shrink on a narrow card but all six still fit', () => {
        const layout = computeLayout('bottom', 300, ALL_OPTS);
        const room = layout.cardW - 2 * layout.m.cardPadX - layout.m.accent;
        expect(layout.icon).toBeLessThan(layout.m.iconMax);
        expect(layout.icon).toBeGreaterThanOrEqual(layout.m.iconMin);
        expect(6 * layout.icon + 5 * layout.m.iconGap).toBeLessThanOrEqual(room);
    });

    test('a card grows with every extra row the display settings turn on', () => {
        const bare = computeLayout('right', 500, NO_OPTS).cardH;
        const withGear = computeLayout('right', 500, {...NO_OPTS, equipment: true}).cardH;
        const withSpells = computeLayout('right', 500, {...NO_OPTS, equipment: true, spells: true}).cardH;
        const withHealth = computeLayout('right', 500, {...NO_OPTS, equipment: true, spells: true, health: true}).cardH;
        expect(bare).toBeLessThan(withGear);
        expect(withGear).toBeLessThan(withSpells);
        expect(withSpells).toBeLessThan(withHealth);
    });

    test('a larger radar scales the panel with it', () => {
        expect(computeLayout('right', 1000, ALL_OPTS).panel.w).toBeGreaterThan(computeLayout('right', 500, ALL_OPTS).panel.w);
        expect(computeLayout('right', 1000, ALL_OPTS).cardH).toBeGreaterThan(computeLayout('right', 500, ALL_OPTS).cardH);
    });
});

describe('readPanelSettings', () => {
    const settings = values => ({
        get: key => values[key],
        getBool: key => values[key] === true,
    });

    test('reads the position and reuses the Players page display toggles', () => {
        const result = readPanelSettings(settings({
            settingRadarPipPlayers: 'bottom',
            settingPlayersShowEquipment: true,
            settingPlayersShowHealthBars: true,
        }));
        expect(result.position).toBe('bottom');
        expect(result.opts).toEqual({equipment: true, spells: false, health: true, guild: false, ip: false, mounted: false});
    });

    test('falls back to off for a missing store or an unknown value', () => {
        expect(readPanelSettings(undefined).position).toBe('off');
        expect(readPanelSettings(settings({settingRadarPipPlayers: 'top'})).position).toBe('off');
    });
});

describe('collectPlayers', () => {
    test('lists hostile first, then faction, then passive, with counts', () => {
        const [a, b, c, d] = [1, 2, 3, 4].map(id => makePlayer({id}));
        const handler = {getPlayersByType: () => ({hostile: [a], faction: [b, c], passive: [d]})};
        const {entries, counts} = collectPlayers(handler);
        expect(entries.map(({player, type}) => [player.id, type])).toEqual([[1, 'hostile'], [2, 'faction'], [3, 'faction'], [4, 'passive']]);
        expect(counts).toEqual({hostile: 1, faction: 2, passive: 1});
    });

    test('is empty without a handler', () => {
        expect(collectPlayers(null)).toEqual({entries: [], counts: {hostile: 0, faction: 0, passive: 0}});
    });
});

describe('gearOf', () => {
    test('keeps slots 0-4 and 8 like the Players page, strips the enchant suffix and builds the icon url', () => {
        const player = makePlayer({equipments: [101, 0, 103, 102, 0, 104, 0, 0, 105]});
        expect(gearOf(player, itemsDb)).toEqual([
            {baseName: 'T6_MAIN_SWORD', tier: 6, enchant: 2, url: '/images/Items/T6_MAIN_SWORD.webp'},
            {baseName: 'T8_HEAD_CLOTH_SET3', tier: 8, enchant: 4, url: '/images/Items/T8_HEAD_CLOTH_SET3.webp'},
            {baseName: 'T4_ARMOR_PLATE_SET1', tier: 4, enchant: 0, url: '/images/Items/T4_ARMOR_PLATE_SET1.webp'},
            {baseName: 'T7_POTION_HEAL', tier: 7, enchant: 0, url: '/images/Items/T7_POTION_HEAL.webp'},
        ]);
    });

    test('skips ids missing from the database and returns nothing without data', () => {
        expect(gearOf(makePlayer({equipments: [999, 101]}), itemsDb)).toHaveLength(1);
        expect(gearOf(makePlayer({equipments: null}), itemsDb)).toEqual([]);
        expect(gearOf(makePlayer({equipments: [101]}), null)).toEqual([]);
    });
});

describe('PipPlayersPanel.draw', () => {
    const NOW = 12_000;

    function drawOne(player, type, opts, loadIcon) {
        const ctx = newCtx();
        const layout = computeLayout('right', 500, opts);
        makePanel(loadIcon).draw(ctx, layout, modelOf([{player, type}]), NOW);
        return {ctx, texts: textsOf(ctx), layout};
    }

    test('draws the header with the title and a count per player type', () => {
        const {texts} = drawOne(makePlayer(), 'hostile', ALL_OPTS);
        expect(texts).toContain('PLAYERS');
        expect(texts).toContain('1');
    });

    test('draws name, type badge, guild, alliance, average IP and elapsed time', () => {
        const {texts} = drawOne(makePlayer(), 'hostile', ALL_OPTS);
        expect(texts).toEqual(expect.arrayContaining(['Zed', 'HOSTILE', '[Night]', '<Owls>', 'IP 1400', '12s']));
    });

    test('labels a faction player with their city', () => {
        const {texts} = drawOne(makePlayer({faction: 3}), 'faction', ALL_OPTS);
        expect(texts).toContain('⚔ BRIDGEWATCH');
    });

    test('shows "No Guild" when the guild is empty and guild display is on', () => {
        const {texts} = drawOne(makePlayer({guildName: ''}), 'passive', ALL_OPTS);
        expect(texts).toContain('No Guild');
    });

    test('hides guild, IP and the mounted chip when their display settings are off', () => {
        const {texts} = drawOne(makePlayer({mounted: true}), 'hostile', NO_OPTS);
        expect(texts).not.toContain('[Night]');
        expect(texts).not.toContain('IP 1400');
        expect(texts).not.toContain('MOUNT');
        expect(texts).toEqual(expect.arrayContaining(['Zed', '<Owls>']));
    });

    test('shows the mounted chip when the player is mounted and the setting is on', () => {
        expect(drawOne(makePlayer({mounted: true}), 'hostile', ALL_OPTS).texts).toContain('MOUNT');
        expect(drawOne(makePlayer({mounted: false}), 'hostile', ALL_OPTS).texts).not.toContain('MOUNT');
    });

    test('draws one tier label per gear tile, with the enchant', () => {
        const player = makePlayer({equipments: [101, 0, 103, 102]});
        const {texts} = drawOne(player, 'hostile', ALL_OPTS);
        expect(texts).toEqual(expect.arrayContaining(['T6.2', 'T8.4', 'T4']));
    });

    test('draws the item icon once it is loaded and a tier fallback before that', () => {
        const player = makePlayer({equipments: [101]});
        const image = {tag: 'icon'};

        const loaded = drawOne(player, 'hostile', ALL_OPTS, () => image);
        expect(loaded.ctx.calls.filter(call => call[0] === 'drawImage' && call[1] === image)).toHaveLength(1);

        const pending = drawOne(player, 'hostile', ALL_OPTS, () => null);
        expect(pending.ctx.calls.some(call => call[0] === 'drawImage')).toBe(false);
        expect(pending.texts.filter(text => text === 'T6')).toHaveLength(1);
    });

    test('says so when gear has not been detected yet, and omits gear when equipment display is off', () => {
        expect(drawOne(makePlayer({equipments: null}), 'hostile', ALL_OPTS).texts).toContain('Gear not detected yet');
        const hidden = drawOne(makePlayer({equipments: [101]}), 'hostile', {...ALL_OPTS, equipment: false}).texts;
        expect(hidden).not.toContain('Gear not detected yet');
        expect(hidden).not.toContain('T6.2');
    });

    test('draws the health percentage, or a dash when health is unknown', () => {
        expect(drawOne(makePlayer({currentHealth: 50, initialHealth: 200}), 'hostile', ALL_OPTS).texts).toContain('25%');
        expect(drawOne(makePlayer(), 'hostile', ALL_OPTS).texts).toContain('--');
        expect(drawOne(makePlayer({currentHealth: 50, initialHealth: 200}), 'hostile', {...ALL_OPTS, health: false}).texts).not.toContain('25%');
    });

    test('draws spell icons only when spell display is on', () => {
        const player = makePlayer({spells: [7, 8, 65535]});
        const image = {tag: 'spell'};
        const on = drawOne(player, 'hostile', {...ALL_OPTS, spells: true}, () => image);
        expect(on.ctx.calls.filter(call => call[0] === 'drawImage' && call[1] === image)).toHaveLength(1);
        const off = drawOne(player, 'hostile', {...ALL_OPTS, spells: false}, () => image);
        expect(off.ctx.calls.some(call => call[0] === 'drawImage' && call[1] === image)).toBe(false);
    });

    test('shows an empty state when no players are detected', () => {
        const ctx = newCtx();
        makePanel().draw(ctx, computeLayout('right', 500, ALL_OPTS), modelOf([]), NOW);
        expect(textsOf(ctx)).toEqual(expect.arrayContaining(['PLAYERS', 'No players detected', 'Scanning...']));
    });

    test('draws at most the layout capacity and reports how many are hidden', () => {
        const entries = [1, 2, 3, 4, 5, 6].map(id => ({player: makePlayer({id, nickname: `P${id}`}), type: 'hostile'}));
        const ctx = newCtx();
        const layout = computeLayout('right', 500, ALL_OPTS);
        makePanel().draw(ctx, layout, modelOf(entries), NOW);
        const texts = textsOf(ctx);
        expect(layout.capacity).toBe(4);
        expect(texts).toEqual(expect.arrayContaining(['P1', 'P2', 'P3', 'P4', '+2 more']));
        expect(texts).not.toContain('P5');
    });

    test('lays cards out in two columns when the panel sits under the radar', () => {
        const entries = [1, 2].map(id => ({player: makePlayer({id, nickname: `P${id}`}), type: 'passive'}));
        const ctx = newCtx();
        const layout = computeLayout('bottom', 500, ALL_OPTS);
        makePanel().draw(ctx, layout, modelOf(entries), NOW);
        const nameCalls = ctx.calls.filter(call => call[0] === 'fillText' && /^P[12]$/.test(call[1]));
        expect(nameCalls).toHaveLength(2);
        expect(nameCalls[0][3]).toBe(nameCalls[1][3]);
        expect(nameCalls[1][2]).toBeGreaterThan(nameCalls[0][2]);
        expect(nameCalls[0][3]).toBeGreaterThanOrEqual(layout.panel.y);
    });

    test('truncates very long names, guilds and alliances instead of drawing them in full', () => {
        const long = makePlayer({nickname: 'N'.repeat(60), guildName: 'G'.repeat(60), allianceName: 'A'.repeat(60)});
        const ctx = newCtx();
        const layout = computeLayout('right', 500, ALL_OPTS);
        makePanel().draw(ctx, layout, modelOf([{player: long, type: 'hostile'}]), NOW);
        const widest = Math.max(...textsOf(ctx).map(text => text.length));
        expect(widest).toBeLessThan(60);
    });
});

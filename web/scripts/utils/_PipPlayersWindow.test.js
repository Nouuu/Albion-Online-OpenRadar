import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PipPlayersWindow, escapeHtml, renderPlayersHtml} from './PipPlayersWindow.js';
import {collectPlayers} from './PipPlayersPanel.js';

const OPTS = {equipment: true, spells: false, health: true, guild: true, ip: true, mounted: true};
const NOW = 1_000_000;

const itemsDb = {
    getItemById: id => ({
        10: {name: 'T6_MAIN_SWORD@2', tier: 6, enchant: 2},
        11: {name: 'T4_ARMOR_PLATE_SET1', tier: 4, enchant: 0},
    }[id]),
};
const spellsDb = {getSpellByIndex: id => (id === 5 ? {uiSprite: 'SPELL_FIRE'} : null)};

function makePlayer(overrides = {}) {
    return {
        nickname: 'Alpha',
        guildName: 'Guild',
        allianceName: 'ALLY',
        faction: 0,
        mounted: false,
        equipments: [10, 11, 0, 0, 0],
        spells: [5],
        currentHealth: 80,
        initialHealth: 100,
        detectedAt: NOW - 5000,
        getAverageItemPower: () => 1234,
        ...overrides,
    };
}

function model(byType) {
    return collectPlayers({getPlayersByType: () => ({hostile: [], faction: [], passive: [], ...byType})});
}

const deps = {items: itemsDb, spells: spellsDb, resolveUrl: url => `http://host${url}`, now: NOW};

describe('escapeHtml', () => {
    it('escapes markup characters', () => {
        expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    });
});

describe('renderPlayersHtml', () => {
    it('shows a minimal idle state with no players', () => {
        const html = renderPlayersHtml(model({}), OPTS, deps);
        expect(html).toContain('No players detected');
        expect(html).not.toContain('pp-card');
    });

    it('renders name, type, guild, alliance, IP and elapsed', () => {
        const html = renderPlayersHtml(model({hostile: [makePlayer()]}), OPTS, deps);
        expect(html).toContain('Alpha');
        expect(html).toContain('pp-hostile');
        expect(html).toContain('[Guild]');
        expect(html).toContain('&lt;ALLY&gt;');
        expect(html).toContain('IP 1234');
        expect(html).toContain('>5s<');
        expect(html).toContain('1 hostile');
    });

    it('escapes hostile-controlled strings', () => {
        const html = renderPlayersHtml(model({hostile: [makePlayer({nickname: '<img src=x onerror=1>', guildName: '"><script>'})]}), OPTS, deps);
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;img src=x onerror=1&gt;');
    });

    it('renders gear tiles with tier and enchant and absolute icon urls', () => {
        const html = renderPlayersHtml(model({hostile: [makePlayer()]}), OPTS, deps);
        expect(html).toContain('http://host/images/Items/T6_MAIN_SWORD.webp');
        expect(html).toContain('http://host/images/Items/T4_ARMOR_PLATE_SET1.webp');
        expect(html).toContain('>T6.2<');
        expect(html).toContain('>T4<');
    });

    it('says gear is not detected when there is none', () => {
        const html = renderPlayersHtml(model({passive: [makePlayer({equipments: []})]}), OPTS, deps);
        expect(html).toContain('Gear not detected yet');
    });

    it('lists hostile before faction before passive', () => {
        const html = renderPlayersHtml(model({
            passive: [makePlayer({nickname: 'Pass'})],
            hostile: [makePlayer({nickname: 'Host'})],
            faction: [makePlayer({nickname: 'Fact', faction: 3})],
        }), OPTS, deps);
        expect(html.indexOf('Host')).toBeLessThan(html.indexOf('Fact'));
        expect(html.indexOf('Fact')).toBeLessThan(html.indexOf('Pass'));
        expect(html).toContain('⚔ Bridgewatch');
    });

    it('shows the MOUNT chip only when mounted and enabled', () => {
        const mounted = makePlayer({mounted: true});
        expect(renderPlayersHtml(model({hostile: [mounted]}), OPTS, deps)).toContain('MOUNT');
        expect(renderPlayersHtml(model({hostile: [mounted]}), {...OPTS, mounted: false}, deps)).not.toContain('MOUNT');
        expect(renderPlayersHtml(model({hostile: [makePlayer()]}), OPTS, deps)).not.toContain('MOUNT');
    });

    it('draws health with color thresholds and -- when unknown', () => {
        const at = hp => renderPlayersHtml(model({hostile: [makePlayer({currentHealth: hp})]}), OPTS, deps);
        expect(at(80)).toContain('80%');
        expect(at(80)).toContain('#4ade80');
        expect(at(50)).toContain('#fbbf24');
        expect(at(20)).toContain('#f87171');
        expect(renderPlayersHtml(model({hostile: [makePlayer({currentHealth: 0})]}), OPTS, deps)).toContain('>--<');
    });

    it('honours the display toggles', () => {
        const html = renderPlayersHtml(model({hostile: [makePlayer()]}),
            {equipment: false, spells: false, health: false, guild: false, ip: false, mounted: false}, deps);
        expect(html).not.toContain('pp-gear');
        expect(html).not.toContain('pp-health');
        expect(html).not.toContain('[Guild]');
        expect(html).not.toContain('IP 1234');
    });

    it('renders spells when enabled', () => {
        const html = renderPlayersHtml(model({hostile: [makePlayer()]}), {...OPTS, spells: true}, deps);
        expect(html).toContain('http://host/images/Spells/SPELL_FIRE.webp');
    });
});

function fakePipWindow() {
    const doc = document.implementation.createHTMLDocument('pip');
    const listeners = {};
    const win = {
        document: doc,
        addEventListener: (type, fn) => {
            listeners[type] = fn;
        },
        setInterval: vi.fn((fn, ms) => globalThis.setInterval(fn, ms)),
        clearInterval: vi.fn(id => globalThis.clearInterval(id)),
        setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
        close: vi.fn(() => listeners.pagehide?.()),
        fire: type => listeners[type]?.(),
    };
    return win;
}

describe('PipPlayersWindow', () => {
    let win;
    let byType;
    let manager;
    let instance;
    let events;
    let onChange;

    beforeEach(() => {
        vi.useFakeTimers();
        win = fakePipWindow();
        byType = {hostile: [], faction: [], passive: []};
        manager = {isActive: false, pipCanvas: {}, size: 100, drawRadarLayers: vi.fn()};
        events = [];
        onChange = e => events.push(e.detail.isOpen);
        document.addEventListener('pipPlayersWindowChange', onChange);
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({clearRect: vi.fn()});
        instance = new PipPlayersWindow({
            api: () => ({requestWindow: vi.fn().mockResolvedValue(win)}),
            settings: () => ({get: () => 'off', getBool: () => true}),
            handler: () => ({getPlayersByType: () => byType}),
            items: () => itemsDb,
            spells: () => spellsDb,
            manager: () => manager,
            now: () => NOW,
        });
    });

    afterEach(() => {
        instance.destroy();
        document.removeEventListener('pipPlayersWindowChange', onChange);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('is unsupported without the API', () => {
        expect(new PipPlayersWindow({api: () => undefined}).isSupported()).toBe(false);
        expect(instance.isSupported()).toBe(true);
    });

    it('opens, builds the document and shows the idle state', async () => {
        expect(await instance.open()).toBe(true);
        expect(instance.isOpen).toBe(true);
        expect(win.document.title).toBe('OpenRadar players');
        expect(win.document.querySelector('.pp-list').textContent).toContain('No players detected');
        expect(events).toEqual([true]);
    });

    it('fails cleanly when the browser refuses the window', async () => {
        const refusing = new PipPlayersWindow({api: () => ({requestWindow: vi.fn().mockRejectedValue(new Error('no gesture'))})});
        expect(await refusing.open()).toBe(false);
        expect(refusing.isOpen).toBe(false);
    });

    it('updates the list when players appear and disappear', async () => {
        await instance.open();
        byType.hostile = [makePlayer()];
        vi.advanceTimersByTime(600);
        const list = win.document.querySelector('.pp-list');
        expect(list.querySelectorAll('.pp-card')).toHaveLength(1);
        expect(list.textContent).toContain('Alpha');

        byType.hostile = [];
        vi.advanceTimersByTime(600);
        expect(list.textContent).toContain('No players detected');
    });

    it('keeps the cards and only refreshes the elapsed time between rebuilds', async () => {
        let now = NOW;
        instance.now = () => now;
        byType.hostile = [makePlayer()];
        await instance.open();
        const card = win.document.querySelector('.pp-card');
        now = NOW + 60_000;
        vi.advanceTimersByTime(600);
        expect(win.document.querySelector('.pp-card')).toBe(card);
        expect(card.querySelector('.pp-elapsed').textContent).toBe('1m');
    });

    it('stops its timer and reports closed when the window is hidden', async () => {
        await instance.open();
        win.fire('pagehide');
        expect(instance.isOpen).toBe(false);
        expect(win.clearInterval).toHaveBeenCalled();
        expect(events).toEqual([true, false]);
    });

    it('toggle closes an open window', async () => {
        await instance.open();
        expect(await instance.toggle()).toBe(false);
        expect(win.close).toHaveBeenCalled();
    });

    it('shows the map inside the window when the map PiP was closed by opening it', async () => {
        manager.isActive = true;
        const open = instance.open();
        await open;
        manager.isActive = false;
        vi.advanceTimersByTime(500);
        expect(instance.showMap).toBe(true);
        expect(win.document.querySelector('.pp-map').hidden).toBe(false);
        expect(manager.drawRadarLayers).toHaveBeenCalled();
    });

    it('leaves the map hidden when both windows coexist', async () => {
        manager.isActive = true;
        await instance.open();
        vi.advanceTimersByTime(500);
        expect(instance.showMap).toBe(false);
        expect(win.document.querySelector('.pp-map').hidden).toBe(true);
    });

    it('the Map button toggles the map', async () => {
        await instance.open();
        win.document.querySelector('.pp-btn').click();
        expect(instance.showMap).toBe(true);
        win.document.querySelector('.pp-btn').click();
        expect(instance.showMap).toBe(false);
    });
});

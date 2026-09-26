// synthetic: the radar template mounted with DatabaseLoader and WebSocketManager mocked, a fake ResizeObserver
// and a stubbed Fullscreen API; cross-tab writes go through a second SettingsSync instance.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync, {SettingsSync} from './SettingsSync.js';
import {clearHandlers, destroyRadarPage, initRadarPage} from './Utils.js';
import {registerBoundPage} from './SettingControls.js';
import {registerPage} from '../core/PageController.js';
import * as DatabaseLoader from '../core/DatabaseLoader.js';
import * as EventRouter from '../core/EventRouter.js';
import * as PlayerListRenderer from '../core/PlayerListRenderer.js';
import * as WebSocketManager from '../core/WebSocketManager.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));
vi.mock('../core/DatabaseLoader.js', () => ({load: vi.fn()}));
vi.mock('../core/WebSocketManager.js', () => ({
    connect: vi.fn(), disconnect: vi.fn(), setMessageCallback: vi.fn(), getStatus: vi.fn(),
}));
vi.mock('../core/PlayerListRenderer.js', async importOriginal => ({...await importOriginal(), update: vi.fn()}));

const RADAR_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../internal/templates/pages/radar.gohtml');
const KEYS = ['settingRadarSize', 'settingRadarHudStats', 'settingPlayersDetect'];

let page = null;
let observers = [];
let root = null;
let remote = null;

class FakeResizeObserver {
    constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
    }
}

function stub(target, prop, value) {
    Object.defineProperty(target, prop, {value, configurable: true});
}

function listenerCount() {
    return [...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0);
}

function snapshot() {
    const container = root.querySelector('#canvasContainer');
    return {
        container: container.style.cssText,
        canvases: [...container.querySelectorAll('canvas')].map(canvas => [canvas.width, canvas.height]),
        list: root.querySelector('#playersListContainer').style.display,
        stats: root.querySelector('#playerStats').className,
    };
}

function playersHidden() {
    return [
        root.querySelector('#playersListContainer').style.display === 'none',
        root.querySelector('#playerStats').classList.contains('!hidden'),
    ];
}

beforeAll(() => {
    window.onGlobalsReady = () => {};
    registerBoundPage('radar', {init: initRadarPage, destroy: destroyRadarPage});
    page = registerPage.mock.calls.find(([name]) => name === 'radar')[1];
});

beforeEach(() => {
    localStorage.clear();
    KEYS.forEach(key => settingsSync.remove(key));
    observers = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stub(document, 'fullscreenElement', null);
    stub(document, 'exitFullscreen', vi.fn(() => Promise.resolve()));
    DatabaseLoader.load.mockReset();
    DatabaseLoader.load.mockResolvedValue(undefined);
    PlayerListRenderer.update.mockClear();
    root = mountPage('radar');
    Object.defineProperty(root.querySelector('#radarLayout'), 'clientWidth', {value: 1000, configurable: true});
    Object.defineProperty(root, 'clientHeight', {value: 1000, configurable: true});
});

afterEach(async () => {
    await page.destroy();
    remote?.destroy();
    remote = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    KEYS.forEach(key => settingsSync.remove(key));
    document.body.innerHTML = '';
});

describe('radar page entry', () => {
    test('@verified 2026-09-24: the panel applies size when DatabaseLoader.load rejects', async () => {
        DatabaseLoader.load.mockRejectedValue(new Error('offline'));
        settingsSync.setNumber('settingRadarSize', 400);

        await expect(page.init()).rejects.toThrow('offline');

        const container = root.querySelector('#canvasContainer');
        expect(container.style.width).toBe('400px');
        expect(observers).toHaveLength(1);
    });

    test('@verified 2026-09-24: leaving after a failed load releases the panel and page listeners', async () => {
        DatabaseLoader.load.mockRejectedValue(new Error('offline'));
        const before = listenerCount();
        await expect(page.init()).rejects.toThrow('offline');

        await page.destroy();

        expect(listenerCount()).toBe(before);
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-24: init twice then destroy leaves nothing alive', async () => {
        const before = listenerCount();
        await page.init();
        const afterFirst = listenerCount();
        await page.init();

        expect(observers).toHaveLength(1);
        expect(listenerCount()).toBe(afterFirst);

        await page.destroy();
        const state = snapshot();

        document.body.dispatchEvent(new CustomEvent('htmx:afterSettle', {detail: {target: root}}));
        observers[0].callback([]);
        settingsSync.setBool('settingRadarHudStats', false);
        settingsSync.setBool('settingPlayersDetect', false);

        expect(snapshot()).toEqual(state);
        expect(listenerCount()).toBe(before);
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-24: destroy exits fullscreen when it is active', async () => {
        await page.init();
        stub(document, 'fullscreenElement', document.documentElement);

        await page.destroy();

        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-26: destroy releases the panel, exits fullscreen, releases the wake lock, then tears the radar down', async () => {
        const sentinel = {release: vi.fn(async () => {})};
        stub(navigator, 'wakeLock', {request: vi.fn(async () => sentinel)});
        stub(window, 'isSecureContext', true);
        await page.init();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        stub(document, 'fullscreenElement', document.documentElement);
        WebSocketManager.disconnect.mockClear();

        await page.destroy();
        stub(navigator, 'wakeLock', undefined);
        stub(window, 'isSecureContext', false);

        const order = [observers[0].disconnect, document.exitFullscreen, sentinel.release, WebSocketManager.disconnect]
            .map(fn => fn.mock.invocationCallOrder[0]);
        expect(order.every(Number.isFinite)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    test('@verified 2026-09-24: a throwing fullscreen exit still tears the radar down', async () => {
        await page.init();
        stub(document, 'fullscreenElement', document.documentElement);
        stub(document, 'exitFullscreen', vi.fn(() => { throw new Error('denied'); }));
        WebSocketManager.disconnect.mockClear();

        await expect(page.destroy()).rejects.toThrow('denied');

        expect(WebSocketManager.disconnect).toHaveBeenCalledTimes(1);
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
        stub(document, 'fullscreenElement', null);
    });

    test('@verified 2026-09-24: a throwing panel destroy still exits fullscreen and tears the radar down', async () => {
        await page.init();
        stub(document, 'fullscreenElement', document.documentElement);
        observers[0].disconnect.mockImplementationOnce(() => { throw new Error('observer'); });
        WebSocketManager.disconnect.mockClear();

        await expect(page.destroy()).rejects.toThrow('observer');

        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
        expect(WebSocketManager.disconnect).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-24: destroy leaves fullscreen alone when it is not active', async () => {
        await page.init();

        await page.destroy();

        expect(document.exitFullscreen).not.toHaveBeenCalled();
    });
});

describe('player detection listener', () => {
    test('@verified 2026-09-24: init hides the players list and stats when detection is off', async () => {
        settingsSync.setBool('settingPlayersDetect', false);

        await page.init();

        expect(playersHidden()).toEqual([true, true]);
    });

    test('@verified 2026-09-24: a change from another tab hides then shows the players and refreshes the list', async () => {
        await page.init();
        expect(playersHidden()).toEqual([false, false]);
        remote = new SettingsSync();

        remote.setBool('settingPlayersDetect', false);
        await vi.waitFor(() => expect(playersHidden()).toEqual([true, true]));
        expect(PlayerListRenderer.update).not.toHaveBeenCalled();

        remote.setBool('settingPlayersDetect', true);
        await vi.waitFor(() => expect(playersHidden()).toEqual([false, false]));
        expect(PlayerListRenderer.update).toHaveBeenCalledTimes(1);
        expect(PlayerListRenderer.update).toHaveBeenCalledWith(window.playersHandler);
    });

    test('@verified 2026-09-24: the listener is null safe when the players markup is gone', async () => {
        const error = vi.fn();
        vi.stubGlobal('logger', {error, warn: vi.fn(), info: vi.fn(), debug: vi.fn()});
        await page.init();
        root.querySelector('#playersListContainer').remove();
        root.querySelector('#playerStats').remove();

        settingsSync.setBool('settingPlayersDetect', false);

        expect(error).not.toHaveBeenCalled();
    });
});

describe('player list tick', () => {
    test('@verified 2026-09-24: the tick refreshes the list on every interval, even when nothing changed', async () => {
        vi.useFakeTimers({toFake: ['setInterval', 'clearInterval']});
        await page.init();

        await vi.advanceTimersByTimeAsync(1500);
        await vi.advanceTimersByTimeAsync(1500);

        expect(PlayerListRenderer.update).toHaveBeenCalledTimes(2);
    });
});

describe('radar.gohtml registration', () => {
    test('@verified 2026-09-24: the page registers initRadarPage and destroyRadarPage through registerBoundPage', () => {
        const template = readFileSync(RADAR_PATH, 'utf8');

        expect(template).toContain("registerBoundPage('radar', {init: initRadarPage, destroy: destroyRadarPage})");
        expect(template).not.toContain('settingsSync.on(');
    });
});

describe('static entity cleanup', () => {
    // pcap-derived: dungeons/spawn.json message[0] (dungeon), message[2] (Knightfall portal via mistsDungeon.addPortal),
    // chests/spawn.json message[0] via addChestEvent (fixture 252=391, current NewLootChest=393, code drift),
    // wispcage/spawn.json message[0].
    test('@verified 2026-09-24: clearHandlers after router/change-cluster.json empties dungeon, chest, cage and Knightfall lists', async () => {
        await page.init();

        const dungeonFix = await loadFixture('dungeons', 'spawn');
        window.handlers.dungeons.dungeonEvent(normalizeParams(dungeonFix.messages[0].parameters));
        const portal = normalizeParams(dungeonFix.messages[2].parameters);
        window.handlers.mistsDungeon.addPortal(portal[0], portal[1][0], portal[1][1], portal[16]);

        const chestFix = await loadFixture('chests', 'spawn');
        window.handlers.chests.addChestEvent(normalizeParams(chestFix.messages[0].parameters));

        const cageFix = await loadFixture('wispcage', 'spawn');
        window.handlers.wispCage.newCageEvent(normalizeParams(cageFix.messages[0].parameters));

        expect(window.handlers.dungeons.dungeonList).toHaveLength(1);
        expect(window.handlers.mistsDungeon.portalList).toHaveLength(1);
        expect(window.handlers.chests.chestsList).toHaveLength(1);
        expect(window.handlers.wispCage.cages).toHaveLength(1);

        const clusterFix = await loadFixture('router', 'change-cluster');
        const p = normalizeParams(clusterFix.messages[1].parameters);
        EventRouter.onResponse(p, () => clearHandlers(true));

        expect(window.handlers.dungeons.dungeonList).toHaveLength(0);
        expect(window.handlers.mistsDungeon.portalList).toHaveLength(0);
        expect(window.handlers.chests.chestsList).toHaveLength(0);
        expect(window.handlers.wispCage.cages).toHaveLength(0);
    });

    // synthetic: idle age crossing the 30 minute static-entity threshold, no fixture carries elapsed time.
    test('@verified 2026-09-24: a Knightfall portal idle 10 minutes stays, idle 31 minutes is removed by cleanupStaleEntities', async () => {
        vi.useFakeTimers({toFake: ['setInterval', 'clearInterval', 'Date']});
        await page.init();

        window.handlers.mistsDungeon.addPortal(2579, 205, 225, 'MISTS_DUNGEON_SOLO_YELLOW');

        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
        expect(window.handlers.mistsDungeon.portalList).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(21 * 60 * 1000);
        expect(window.handlers.mistsDungeon.portalList).toHaveLength(0);
    });
});

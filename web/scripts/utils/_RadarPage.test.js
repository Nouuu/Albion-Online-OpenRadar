// synthetic: the radar template mounted with DatabaseLoader and WebSocketManager mocked, a fake ResizeObserver
// and a stubbed Fullscreen API; cross-tab writes go through a second SettingsSync instance.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync, {SettingsSync} from './SettingsSync.js';
import {destroyRadarPage, initRadarPage} from './Utils.js';
import {registerBoundPage} from './SettingControls.js';
import {registerPage} from '../core/PageController.js';
import * as DatabaseLoader from '../core/DatabaseLoader.js';
import * as PlayerListRenderer from '../core/PlayerListRenderer.js';
import * as WebSocketManager from '../core/WebSocketManager.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));
vi.mock('../core/DatabaseLoader.js', () => ({load: vi.fn()}));
vi.mock('../core/WebSocketManager.js', () => ({
    connect: vi.fn(), disconnect: vi.fn(), setMessageCallback: vi.fn(), getStatus: vi.fn(),
}));
vi.mock('../core/PlayerListRenderer.js', async importOriginal => ({...await importOriginal(), update: vi.fn()}));

const RADAR_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../internal/templates/pages/radar.gohtml');
const KEYS = ['settingRadarSize', 'settingRadarRotation', 'settingRadarHudStats', 'settingPlayersDetect'];

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
    Object.defineProperty(root.querySelector('#canvasContainer').parentElement, 'clientWidth', {value: 1000, configurable: true});
    Object.defineProperty(root, 'clientHeight', {value: 1000, configurable: true});
});

afterEach(async () => {
    await page.destroy();
    remote?.destroy();
    remote = null;
    vi.unstubAllGlobals();
    KEYS.forEach(key => settingsSync.remove(key));
    document.body.innerHTML = '';
});

describe('radar page entry', () => {
    test('@verified 2026-09-24: the panel applies size and rotation when DatabaseLoader.load rejects', async () => {
        DatabaseLoader.load.mockRejectedValue(new Error('offline'));
        settingsSync.setNumber('settingRadarSize', 400);
        settingsSync.set('settingRadarRotation', '90');

        await expect(page.init()).rejects.toThrow('offline');

        const container = root.querySelector('#canvasContainer');
        expect([container.style.width, container.style.transform]).toEqual(['400px', 'rotate(90deg)']);
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
        settingsSync.set('settingRadarRotation', '90');
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

    test('@verified 2026-09-24: destroy releases the panel, then exits fullscreen, then tears the radar down', async () => {
        await page.init();
        stub(document, 'fullscreenElement', document.documentElement);
        WebSocketManager.disconnect.mockClear();

        await page.destroy();

        const order = [observers[0].disconnect, document.exitFullscreen, WebSocketManager.disconnect]
            .map(fn => fn.mock.invocationCallOrder[0]);
        expect(order.every(Number.isFinite)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
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

describe('radar.gohtml registration', () => {
    test('@verified 2026-09-24: the page registers initRadarPage and destroyRadarPage through registerBoundPage', () => {
        const template = readFileSync(RADAR_PATH, 'utf8');

        expect(template).toContain("registerBoundPage('radar', {init: initRadarPage, destroy: destroyRadarPage})");
        expect(template).not.toContain('settingsSync.on(');
    });
});

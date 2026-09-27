// synthetic: the settings template mounted with PageController mocked, fetch stubbed per endpoint, no real backend.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync from './SettingsSync.js';
import {registerBoundPage} from './SettingControls.js';
import {initSettingsPage} from './SettingsPage.js';
import {registerPage} from '../core/PageController.js';
import {NetworkSettingsHandler} from '../handlers/NetworkSettingsHandler.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));

const SETTINGS_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../internal/templates/pages/settings.gohtml');
const LOGGING = '/api/settings/logging';
const NETWORK = ['/api/network/interfaces', '/api/network/state'];

let page = null;
let root = null;
let loggingGet = null;

function json(body) {
    return Promise.resolve({ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('')});
}

function respond(url, options) {
    if (url === LOGGING && !options) return loggingGet ? loggingGet() : json({serverLogsEnabled: false, pcapRecording: false});
    if (url === LOGGING) return json({serverLogsEnabled: true, pcapRecording: false});
    if (url === NETWORK[0]) return json([]);
    return json({captureInterfaces: []});
}

function calls(url) {
    return fetch.mock.calls.filter(([called]) => called === url);
}

function listenerCount() {
    return [...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0);
}

function click(id) {
    root.querySelector(`#${id}`).dispatchEvent(new MouseEvent('click', {bubbles: true}));
}

beforeAll(() => {
    window.onGlobalsReady = () => {};
    registerBoundPage('settings', {init: initSettingsPage});
    page = registerPage.mock.calls.find(([name]) => name === 'settings')[1];
});

beforeEach(() => {
    localStorage.clear();
    loggingGet = null;
    vi.stubGlobal('fetch', vi.fn(respond));
    vi.useFakeTimers({toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout']});
    root = mountPage('settings');
    const dialog = root.ownerDocument.getElementById('modal-resetSettings');
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
});

afterEach(async () => {
    await page.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.toast;
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('settings page actions', () => {
    test('Export downloads the debug JSON with settings and backend values', async () => {
        const createObjectURL = vi.fn(() => 'blob:debug');
        vi.stubGlobal('URL', Object.assign(Object.create(URL), {createObjectURL, revokeObjectURL: vi.fn()}));
        const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await page.init();

        click('downloadLogsBtn');
        await vi.waitFor(() => expect(anchorClick).toHaveBeenCalledTimes(1));

        const anchor = anchorClick.mock.contexts[0];
        expect(anchor.download).toMatch(/^openradar-debug-.+\.json$/);
        const exported = JSON.parse(await createObjectURL.mock.calls[0][0].text());
        expect(exported.settings.settingLogLevel).toBe('WARN');
        expect(exported.backend).toEqual({serverLogsEnabled: false, pcapRecording: false});
        anchorClick.mockRestore();
    });

    test('Reset opens the modal and changes nothing until confirmed', async () => {
        settingsSync.setBool('settingPlayersHostile', false);
        await page.init();

        click('resetSettingsBtn');

        expect(root.ownerDocument.getElementById('modal-resetSettings').showModal).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('settingPlayersHostile')).toBe('false');
    });

    test('confirming the reset clears the settings, keeps the ignore list and reloads', async () => {
        const reload = vi.fn();
        vi.stubGlobal('location', {reload});
        window.toast = {success: vi.fn(), error: vi.fn()};
        settingsSync.setBool('settingPlayersHostile', false);
        settingsSync.setJSON('settingIgnoreList', ['Griefer']);
        await page.init();

        click('confirmResetSettings');

        expect(localStorage.getItem('settingPlayersHostile')).toBeNull();
        expect(localStorage.getItem('settingIgnoreList')).toBe('["Griefer"]');
        expect(window.toast.success).toHaveBeenCalledWith('Settings reset successfully');
        expect(reload).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    test('the network section polls every 5 s and keeps unapplied ticks', async () => {
        const load = vi.spyOn(NetworkSettingsHandler.prototype, 'load');
        await page.init();

        await vi.advanceTimersByTimeAsync(5000);

        expect(load.mock.calls).toEqual([[], [true]]);
        load.mockRestore();
    });
});

describe('settings page teardown', () => {
    test('init twice then destroy releases the listeners, the toggles and the poll', async () => {
        const before = listenerCount();
        await page.init();
        await page.init();

        await page.destroy();
        fetch.mockClear();
        await vi.advanceTimersByTimeAsync(15000);
        const toggle = root.querySelector('[data-setting="settingDebugBackendLogs"]');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', {bubbles: true}));
        click('confirmResetSettings');

        expect(fetch).not.toHaveBeenCalled();
        expect(listenerCount()).toBe(before);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('leaving during the backend toggles GET binds no network section and starts no poll', async () => {
        let release;
        loggingGet = () => new Promise(resolve => {
            release = () => resolve({ok: true, json: () => Promise.resolve({serverLogsEnabled: true, pcapRecording: true})});
        });
        const init = page.init();
        await vi.waitFor(() => expect(calls(LOGGING)).toHaveLength(1));

        await page.destroy();
        release();
        await init;
        await vi.advanceTimersByTimeAsync(15000);

        expect(calls(NETWORK[0])).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
        expect(root.querySelector('[data-setting="settingDebugBackendLogs"]').checked).toBe(false);
    });
});

describe('settings.gohtml registration', () => {
    test('the page registers initSettingsPage through registerBoundPage', () => {
        const template = readFileSync(SETTINGS_PATH, 'utf8');

        expect(template).toContain("registerBoundPage('settings', {init: initSettingsPage})");
    });
});

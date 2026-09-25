// synthetic: binder markup built inline, values read and written through real SettingsSync instances.

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {SettingsSync} from './SettingsSync.js';
import {applyEnemyPreset, bindSettingControls, registerBoundPage} from './SettingControls.js';
import {registerPage, reinitCurrentPage} from '../core/PageController.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));

let syncs = [];
let controller = null;

function newSync() {
    const sync = new SettingsSync();
    syncs.push(sync);
    return sync;
}

function mount(html) {
    document.body.innerHTML = `<main id="page-content">${html}</main>`;
    return document.getElementById('page-content');
}

function bind(root, sync) {
    controller = new AbortController();
    bindSettingControls(root, controller.signal, sync);
    return controller;
}

function fire(el, type) {
    el.dispatchEvent(new Event(type, {bubbles: true}));
}

function wildcardCount(sync) {
    return sync.listeners.get('*')?.length ?? 0;
}

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    controller?.abort();
    controller = null;
    syncs.forEach(sync => sync.destroy());
    syncs = [];
    document.body.innerHTML = '';
    localStorage.clear();
});

describe('bindSettingControls checkbox', () => {
    test('shows the registry default, writes on change', () => {
        const sync = newSync();
        const root = mount('<input type="checkbox" data-setting="settingEnemiesBoss">');
        bind(root, sync);
        const box = root.querySelector('input');

        expect(box.checked).toBe(true);
        box.checked = false;
        fire(box, 'change');

        expect(localStorage.getItem('settingEnemiesBoss')).toBe('false');
    });

    test('shows a stored value', () => {
        localStorage.setItem('settingEnemiesNormal', 'true');
        const root = mount('<input type="checkbox" data-setting="settingEnemiesNormal">');
        bind(root, newSync());

        expect(root.querySelector('input').checked).toBe(true);
    });
});

describe('bindSettingControls range', () => {
    const markup = `
        <input type="range" min="0.1" max="3" step="0.1" data-setting="settingRadarZoom">
        <span data-value-for="settingRadarZoom"></span>`;

    test('shows value and readout, writes on input', () => {
        const sync = newSync();
        const root = mount(markup);
        bind(root, sync);
        const slider = root.querySelector('input');
        const readout = root.querySelector('[data-value-for]');

        expect(slider.value).toBe('1');
        expect(readout.textContent).toBe('100%');

        slider.value = '1.5';
        fire(slider, 'input');

        expect(localStorage.getItem('settingRadarZoom')).toBe('1.5');
        expect(readout.textContent).toBe('150%');
    });

    test('readouts put a space before ms and px', () => {
        const root = mount(`<span data-value-for="settingAlertSoundCooldown"></span><span data-value-for="settingRadarSize"></span>`);
        bind(root, newSync());
        expect([...root.querySelectorAll('[data-value-for]')].map(el => el.textContent)).toEqual(['500 ms', '500 px']);
    });

    test('int slider writes with setNumber', () => {
        const sync = newSync();
        const root = mount('<input type="range" min="300" max="800" step="50" data-setting="settingRadarSize">');
        bind(root, sync);
        const slider = root.querySelector('input');

        slider.value = '650';
        fire(slider, 'input');

        expect(localStorage.getItem('settingRadarSize')).toBe('650');
    });

    const buttons = `
        <button type="button" data-nudge="settingRadarZoom" data-dir="-1"><i></i></button>
        <button type="button" data-nudge="settingRadarZoom" data-dir="1"><i></i></button>
        <button type="button" data-reset="settingRadarZoom"><i></i></button>`;

    function nudgeRow(stored) {
        if (stored !== undefined) localStorage.setItem('settingRadarZoom', stored);
        const root = mount(markup + buttons);
        bind(root, newSync());
        const [down, up, reset] = root.querySelectorAll('button');
        return {root, down, up, reset, slider: root.querySelector('input')};
    }

    test('nudge moves by the registry step and updates slider and readout', () => {
        const {root, down, up, slider} = nudgeRow('1.5');

        up.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('1.6');
        expect(slider.value).toBe('1.6');
        expect(root.querySelector('[data-value-for]').textContent).toBe('160%');

        down.querySelector('i').click();
        down.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('1.4');
    });

    test('nudge clamps at the registry max', () => {
        const {up} = nudgeRow('2.9');
        up.click();
        up.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('3');
    });

    test('nudge clamps at the registry min', () => {
        const {down} = nudgeRow('0.2');
        down.click();
        down.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('0.1');
    });

    test('reset writes the registry default', () => {
        const {reset, slider} = nudgeRow('2.5');

        reset.querySelector('i').click();

        expect(localStorage.getItem('settingRadarZoom')).toBe('1');
        expect(slider.value).toBe('1');
    });

    test('an int slider nudges with setNumber', () => {
        const root = mount('<input type="range" min="300" max="1200" step="50" data-setting="settingRadarSize">'
            + '<button type="button" data-nudge="settingRadarSize" data-dir="1"></button>');
        bind(root, newSync());

        root.querySelector('button').click();

        expect(localStorage.getItem('settingRadarSize')).toBe('550');
    });

    test.each([['missing', null], ['text', 'up'], ['zero', '0'], ['two', '2'], ['half', '0.5']])(
        'a nudge with a %s data-dir writes nothing', (_, dir) => {
            const root = mount(markup + `<button type="button" data-nudge="settingRadarZoom"${dir === null ? '' : ` data-dir="${dir}"`}></button>`);
            const sync = newSync();
            bind(root, sync);
            const broadcast = vi.spyOn(sync, 'broadcast');

            root.querySelector('button').click();

            expect(broadcast).not.toHaveBeenCalled();
            expect(localStorage.getItem('settingRadarZoom')).toBeNull();
        });

    test('nudge and reset on an unknown or backend key write nothing', () => {
        const root = mount('<button type="button" data-nudge="settingNope" data-dir="1"></button>'
            + '<button type="button" data-reset="settingNope"></button>'
            + '<button type="button" data-reset="settingDebugBackendLogs"></button>');
        const sync = newSync();
        bind(root, sync);
        const broadcast = vi.spyOn(sync, 'broadcast');

        root.querySelectorAll('button').forEach(button => button.click());

        expect(broadcast).not.toHaveBeenCalled();
    });
});

describe('bindSettingControls number (change only)', () => {
    function numberField(key, stored) {
        if (stored !== undefined) localStorage.setItem(key, stored);
        const sync = newSync();
        const root = mount(`<input type="number" data-setting="${key}">`);
        bind(root, sync);
        return {sync, input: root.querySelector('input')};
    }

    test('input events write nothing', () => {
        const {input} = numberField('settingRadarClusterRadius');
        input.value = '40';
        fire(input, 'input');

        expect(localStorage.getItem('settingRadarClusterRadius')).toBeNull();
    });

    test('cleared and left restores the stored value and writes nothing', () => {
        const {input} = numberField('settingRadarClusterRadius', '45');
        expect(input.value).toBe('45');

        input.value = '';
        fire(input, 'change');

        expect(input.value).toBe('45');
        expect(localStorage.getItem('settingRadarClusterRadius')).toBe('45');
    });

    test('non-numeric entry writes nothing', () => {
        const {input} = numberField('settingEnemiesMinHealth');
        input.value = 'abc';
        fire(input, 'change');

        expect(input.value).toBe('2100');
        expect(localStorage.getItem('settingEnemiesMinHealth')).toBeNull();
    });

    test('typing 5 in cluster radius stores and shows 10', () => {
        const {input} = numberField('settingRadarClusterRadius');
        input.value = '5';
        fire(input, 'change');

        expect(localStorage.getItem('settingRadarClusterRadius')).toBe('10');
        expect(input.value).toBe('10');
    });

    test('typing 50 in min HP stores and shows 100', () => {
        const {input} = numberField('settingEnemiesMinHealth');
        input.value = '50';
        fire(input, 'change');

        expect(localStorage.getItem('settingEnemiesMinHealth')).toBe('100');
        expect(input.value).toBe('100');
    });

    test('rounds to the step and clamps to max', () => {
        const {input} = numberField('settingRadarClusterRadius');
        input.value = '43';
        fire(input, 'change');
        expect(localStorage.getItem('settingRadarClusterRadius')).toBe('45');

        input.value = '4000';
        fire(input, 'change');
        expect(localStorage.getItem('settingRadarClusterRadius')).toBe('100');
        expect(input.value).toBe('100');
    });

    test('a focused number field is not rewritten by a change elsewhere', () => {
        const {sync, input} = numberField('settingEnemiesMinHealth');
        input.focus();
        input.value = '35';

        sync.setNumber('settingEnemiesMinHealth', 5000);

        expect(input.value).toBe('35');
    });
});

describe('bindSettingControls focus guard', () => {
    test.each([
        ['slider', '<input type="range" min="0.1" max="3" step="0.1" data-setting="settingRadarZoom">', el => el.value, '1', sync => sync.setFloat('settingRadarZoom', 2), '2'],
        ['checkbox', '<input type="checkbox" data-setting="settingEnemiesNormal">', el => el.checked, false, sync => sync.setBool('settingEnemiesNormal', true), true],
        ['select', '<select data-setting="settingLogLevel"></select>', el => el.value, 'WARN', sync => sync.set('settingLogLevel', 'DEBUG'), 'DEBUG'],
    ])('a focused %s is not rewritten by a change elsewhere, and catches up on blur', (_, markup, read, before, write, after) => {
        const sync = newSync();
        const root = mount(markup);
        bind(root, sync);
        const el = root.querySelector('[data-setting]');
        el.focus();

        write(sync);
        expect(read(el)).toBe(before);

        el.blur();
        expect(read(el)).toBe(after);
    });

    test('a focused number field catches up on blur', () => {
        const sync = newSync();
        const root = mount('<input type="number" data-setting="settingEnemiesMinHealth">');
        bind(root, sync);
        const input = root.querySelector('input');
        input.focus();

        sync.setNumber('settingEnemiesMinHealth', 5000);
        input.blur();

        expect(input.value).toBe('5000');
    });
});

describe('bindSettingControls select', () => {
    test('select fills options from the registry and writes on change', () => {
        const sync = newSync();
        const root = mount('<select data-setting="settingAlertSoundFile"></select>');
        bind(root, sync);
        const select = root.querySelector('select');

        expect([...select.options].map(o => o.value)).toContain('brass.wav');
        expect([...select.options].find(o => o.value === 'brass.wav').textContent).toBe('Brass');
        expect(select.value).toBe('player.wav');

        select.value = 'coin.wav';
        fire(select, 'change');

        expect(localStorage.getItem('settingAlertSoundFile')).toBe('coin.wav');
    });

    test('select without registry options lists the values', () => {
        const root = mount('<select data-setting="settingLogLevel"></select>');
        bind(root, newSync());
        const select = root.querySelector('select');

        expect([...select.options].map(o => o.value)).toEqual(['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG']);
        expect(select.value).toBe('WARN');
    });
});

describe('bindSettingControls matrix', () => {
    const KEY = 'settingResourcesStaticFiber';
    const ALL_ENCHANTS = ['e0', 'e1', 'e2', 'e3', 'e4'];

    function mountMatrix() {
        const sync = newSync();
        const root = mount(`<div data-setting="${KEY}"></div>`);
        bind(root, sync);
        return {sync, root, container: root.querySelector(`[data-setting="${KEY}"]`)};
    }

    test('generates the grid once and shows the default matrix', () => {
        const {container} = mountMatrix();

        expect(container.querySelector('[data-enchant="e0"][data-tier="0"]').checked).toBe(false);
        expect(container.querySelector('[data-enchant="e0"][data-tier="3"]').checked).toBe(true);
        expect(container.querySelector('[data-enchant="e4"][data-tier="3"]').checked).toBe(true);
    });

    test('a cell change re-reads the key before writing', () => {
        const {sync, container} = mountMatrix();
        const external = structuredClone(sync.getJSON(KEY));
        external.e0[0] = true;
        sync.setJSON(KEY, external);

        const cell = container.querySelector('[data-enchant="e0"][data-tier="4"]');
        cell.checked = false;
        fire(cell, 'change');

        const stored = sync.getJSON(KEY);
        expect(stored.e0[0]).toBe(true);
        expect(stored.e0[4]).toBe(false);
    });

    test('tier toggle only affects rendered cells for T1 to T3', () => {
        const {sync, container} = mountMatrix();
        const preset = structuredClone(sync.getJSON(KEY));
        preset.e1[0] = true;
        sync.setJSON(KEY, preset);

        container.querySelector('[data-tier-toggle="0"]').click();

        const stored = sync.getJSON(KEY);
        expect(stored.e0[0]).toBe(true);
        expect(stored.e1[0]).toBe(true);
    });

    test('tier toggle flips all rendered cells off then on for T4 to T8', () => {
        const {sync, container} = mountMatrix();

        container.querySelector('[data-tier-toggle="3"]').click();
        let stored = sync.getJSON(KEY);
        expect(ALL_ENCHANTS.every(e => stored[e][3] === false)).toBe(true);

        container.querySelector('[data-tier-toggle="3"]').click();
        stored = sync.getJSON(KEY);
        expect(ALL_ENCHANTS.every(e => stored[e][3] === true)).toBe(true);
    });

    test('reflects a remote write into the cells and the tier glyph', () => {
        const {sync, container} = mountMatrix();
        const next = structuredClone(sync.getJSON(KEY));
        next.e0[0] = true;
        sync.setJSON(KEY, next);

        expect(container.querySelector('[data-enchant="e0"][data-tier="0"]').checked).toBe(true);
        expect(container.querySelector('[data-tier-toggle="0"]').textContent).toContain('T1');
    });
});

describe('bindSettingControls reflection and teardown', () => {
    test('reflects a removal into the control', () => {
        localStorage.setItem('settingEnemiesBoss', 'false');
        const sync = newSync();
        const root = mount('<input type="checkbox" data-setting="settingEnemiesBoss">');
        bind(root, sync);
        const box = root.querySelector('input');
        expect(box.checked).toBe(false);

        sync.remove('settingEnemiesBoss');

        expect(box.checked).toBe(true);
    });

    test('reflects a write from another tab', async () => {
        const local = newSync();
        const remote = newSync();
        const root = mount('<input type="checkbox" data-setting="settingEnemiesNormal">');
        bind(root, local);

        remote.setBool('settingEnemiesNormal', true);
        await vi.waitFor(() => expect(root.querySelector('input').checked).toBe(true));
    });

    test('abort restores the listener count and releases DOM listeners', () => {
        const sync = newSync();
        const before = wildcardCount(sync);
        const root = mount('<input type="checkbox" data-setting="settingEnemiesNormal">');
        const ctrl = bind(root, sync);
        expect(wildcardCount(sync)).toBe(before + 1);

        ctrl.abort();
        const box = root.querySelector('input');
        box.checked = true;
        fire(box, 'change');

        expect(wildcardCount(sync)).toBe(before);
        expect(localStorage.getItem('settingEnemiesNormal')).toBeNull();
    });

    test('double bind on the same root leaves one set', () => {
        const sync = newSync();
        const before = wildcardCount(sync);
        const root = mount('<input type="range" min="300" max="800" step="50" data-setting="settingRadarSize">');
        const first = new AbortController();
        bindSettingControls(root, first.signal, sync);
        bind(root, sync);

        expect(wildcardCount(sync)).toBe(before + 1);
        const broadcast = vi.spyOn(sync, 'broadcast');
        const slider = root.querySelector('input');
        slider.value = '550';
        fire(slider, 'input');
        expect(broadcast).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('settingRadarSize')).toBe('550');

        controller.abort();
        expect(wildcardCount(sync)).toBe(before);
        first.abort();
        expect(wildcardCount(sync)).toBe(before);
    });

    test('ignores a data-setting outside the registry', () => {
        const sync = newSync();
        const root = mount('<input type="checkbox" data-setting="settingNotARealKey">');

        expect(() => bind(root, sync)).not.toThrow();
    });

    test('an already aborted signal registers nothing', () => {
        const sync = newSync();
        const root = mount('<input type="checkbox" data-setting="settingEnemiesBoss">');
        const before = wildcardCount(sync);
        const aborted = new AbortController();
        aborted.abort();

        expect(() => bindSettingControls(root, aborted.signal, sync)).not.toThrow();

        expect(wildcardCount(sync)).toBe(before);
        const box = root.querySelector('input');
        expect(box.checked).toBe(false);
        box.checked = true;
        fire(box, 'change');
        expect(localStorage.getItem('settingEnemiesBoss')).toBeNull();
    });
});

describe('registerBoundPage', () => {
    beforeEach(() => {
        vi.mocked(registerPage).mockClear();
        vi.mocked(reinitCurrentPage).mockClear();
        window.onGlobalsReady = callback => callback();
    });

    afterEach(() => {
        delete window.onGlobalsReady;
    });

    function handlersOf(name) {
        return vi.mocked(registerPage).mock.calls.find(([pageName]) => pageName === name)[1];
    }

    test('registers once per name, reinits the current page on every call', () => {
        registerBoundPage('once');
        registerBoundPage('once');

        expect(vi.mocked(registerPage).mock.calls.filter(([pageName]) => pageName === 'once')).toHaveLength(1);
        expect(reinitCurrentPage).toHaveBeenCalledTimes(2);
    });

    test('init binds #page-content and passes root and signal to the page init', async () => {
        const init = vi.fn();
        registerBoundPage('bound', {init});
        const root = mount('<input type="checkbox" data-setting="settingEnemiesBoss">');

        await handlersOf('bound').init();

        expect(root.querySelector('input').checked).toBe(true);
        expect(init).toHaveBeenCalledWith({root, signal: expect.any(AbortSignal)});
        expect(init.mock.calls[0][0].signal.aborted).toBe(false);
        await handlersOf('bound').destroy();
    });

    test('a second init aborts the first activation', async () => {
        const init = vi.fn();
        registerBoundPage('twice', {init});
        mount('');
        const handlers = handlersOf('twice');

        await handlers.init();
        await handlers.init();

        expect(init.mock.calls[0][0].signal.aborted).toBe(true);
        expect(init.mock.calls[1][0].signal.aborted).toBe(false);
    });

    test('destroy aborts before the page destroy runs', async () => {
        let seen = null;
        const init = vi.fn();
        const destroy = vi.fn(() => {
            seen = init.mock.calls[0][0].signal.aborted;
        });
        registerBoundPage('teardown', {init, destroy});
        mount('');
        const handlers = handlersOf('teardown');

        await handlers.init();
        await handlers.destroy();

        expect(destroy).toHaveBeenCalledTimes(1);
        expect(seen).toBe(true);
    });
});

describe('applyEnemyPreset', () => {
    const ENEMY_FILTER_KEYS = [
        'settingEnemiesAvalonianDrones',
        'settingEnemiesBoss',
        'settingEnemiesChampion',
        'settingEnemiesEvent',
        'settingEnemiesMiniBoss',
        'settingEnemiesMistsCrystalSpider',
        'settingEnemiesMistsFairyDragon',
        'settingEnemiesMistsGriffin',
        'settingEnemiesMistsVeilWeaver',
        'settingEnemiesNormal',
    ];

    function storedKeys() {
        return Object.keys(localStorage).filter(key => key !== 'settingSchemaVersion').sort();
    }

    test.each([['all', 'true'], ['clear', 'false']])('%s writes %s to exactly the 10 enemy filter keys', (name, stored) => {
        const sync = newSync();

        applyEnemyPreset(name, sync);

        expect(storedKeys()).toEqual(ENEMY_FILTER_KEYS);
        for (const key of ENEMY_FILTER_KEYS) expect(localStorage.getItem(key)).toBe(stored);
    });

    test.each(['bosses', 'miniboss', 'unknown'])('%s writes nothing', name => {
        const sync = newSync();

        applyEnemyPreset(name, sync);

        expect(storedKeys()).toEqual([]);
    });
});

describe('resources page', () => {
    test('binds ten resource grids headed Static and Living, T4 on by default', () => {
        const root = mountPage('resources');
        bind(root, newSync());

        expect(root.querySelectorAll('[data-enchant="e0"][data-tier="3"]')).toHaveLength(10);
        expect([...root.querySelectorAll('h4')].map(h => h.textContent.trim())).toEqual(
            ['Static', 'Living', 'Static', 'Living', 'Static', 'Living', 'Static', 'Living', 'Static', 'Living']);
        expect([...root.querySelectorAll('[data-enchant="e0"][data-tier="3"]')].every(cell => cell.checked)).toBe(true);
    });
});

describe('settings page backend toggles', () => {
    const BACKEND_KEYS = ['settingDebugBackendLogs', 'settingDebugPcapRecording'];

    test('ticking a backend toggle stores nothing in this browser', () => {
        const root = mountPage('settings');
        bind(root, newSync());

        for (const key of BACKEND_KEYS) {
            const toggle = root.querySelector(`[data-setting="${key}"]`);
            toggle.checked = true;
            fire(toggle, 'change');
        }

        expect(BACKEND_KEYS.map(key => localStorage.getItem(key))).toEqual([null, null]);
    });

    test('a stored or broadcast value never reaches a backend toggle', () => {
        BACKEND_KEYS.forEach(key => localStorage.setItem(key, 'true'));
        const sync = newSync();
        const root = mountPage('settings');
        bind(root, sync);
        const toggles = BACKEND_KEYS.map(key => root.querySelector(`[data-setting="${key}"]`));
        expect(toggles.map(toggle => toggle.checked)).toEqual([false, false]);

        BACKEND_KEYS.forEach(key => sync.handleMessage({type: 'setting-changed', key, value: 'true'}));

        expect(toggles.map(toggle => toggle.checked)).toEqual([false, false]);
    });
});

describe('bindSettingControls ignore list', () => {
    const KEY = 'settingIgnoreList';
    const markup = `<div data-setting="${KEY}">
        <input type="text" data-ignore-input>
        <button data-ignore-add>Add name</button>
        <span data-ignore-count></span>
        <p data-ignore-empty>The ignore list is empty</p>
        <div data-ignore-items></div>
    </div>`;

    function mountList(stored) {
        if (stored) localStorage.setItem(KEY, JSON.stringify(stored));
        const sync = newSync();
        const root = mount(markup);
        bind(root, sync);
        return {sync, root, input: root.querySelector('[data-ignore-input]')};
    }

    function names(root) {
        return [...root.querySelectorAll('[data-ignore-items] [data-ignore-name]')].map(el => el.textContent);
    }

    test('adding "treasure map" when "Treasure Map" exists is rejected', () => {
        const {sync, root, input} = mountList(['Treasure Map']);
        input.value = '  treasure map ';
        root.querySelector('[data-ignore-add]').click();

        expect(sync.getJSON(KEY)).toEqual(['Treasure Map']);
        expect(input.value).toBe('');
    });

    test('Enter adds the trimmed name, count and empty state follow', () => {
        const {sync, root, input} = mountList();
        expect(root.querySelector('[data-ignore-count]').textContent).toBe('0');
        expect(root.querySelector('[data-ignore-empty]').hidden).toBe(false);

        input.value = ' Nouuu ';
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));

        expect(sync.getJSON(KEY)).toEqual(['Nouuu']);
        expect(names(root)).toEqual(['Nouuu']);
        expect(root.querySelector('[data-ignore-count]').textContent).toBe('1');
        expect(root.querySelector('[data-ignore-empty]').hidden).toBe(true);
    });

    test('an empty name adds nothing', () => {
        const {root, input} = mountList();
        input.value = '   ';
        root.querySelector('[data-ignore-add]').click();

        expect(localStorage.getItem(KEY)).toBeNull();
    });

    test('rows render names as text, never as markup', () => {
        const {root} = mountList(['<img src=x onerror=alert(1)>']);

        expect(names(root)).toEqual(['<img src=x onerror=alert(1)>']);
        expect(root.querySelector('[data-ignore-items] img')).toBeNull();
    });

    test('remove deletes by value from the current list', async () => {
        const {sync, root} = mountList(['Alpha', 'Beta']);
        newSync().setJSON(KEY, ['Gamma', 'Alpha', 'Beta']);
        await vi.waitFor(() => expect(names(root)).toEqual(['Gamma', 'Alpha', 'Beta']));

        const alpha = [...root.querySelectorAll('[data-ignore-items] > *')].find(row => row.textContent.includes('Alpha'));
        alpha.querySelector('button').click();

        expect(sync.getJSON(KEY)).toEqual(['Gamma', 'Beta']);
    });
});

describe('ignorelist page', () => {
    test('shows the ignore list texts and binds the editor', () => {
        localStorage.setItem('settingIgnoreList', JSON.stringify(['Treasure Map']));
        const root = mountPage('ignorelist');
        bind(root, newSync());
        const text = root.textContent.replace(/\s+/g, ' ');

        expect(text).toContain('Names on this list never trigger the alert sound, the screen flash or the red border. Ignored players still appear in the player list.');
        expect(text).not.toContain("Manage players that won't trigger alerts or be shown on radar.");
        expect(text).not.toContain('A player name, a guild name or an alliance name all work.');
        expect([...root.querySelectorAll('h2')].map(h => h.textContent.trim())).toEqual(['Add name', 'Ignored names']);
        expect(root.querySelector('[data-ignore-add]').textContent.trim()).toBe('Add name');
        expect(root.querySelector('[data-ignore-input]').placeholder).toBe('Player, guild or alliance name');
        expect(root.querySelector('[data-ignore-empty]').textContent.trim()).toBe('The ignore list is empty');
        expect(root.querySelector('[data-ignore-items]').textContent).toContain('Treasure Map');
    });
});

describe('enemies page', () => {
    function mountEnemies() {
        const sync = newSync();
        const root = mountPage('enemies');
        bind(root, sync);
        return {sync, root};
    }

    function checkedStates(root) {
        return [...root.querySelectorAll('input[type="checkbox"][data-setting]')].map(el => [el.dataset.setting, el.checked]);
    }

    test.each([['all', true], ['clear', false]])('the %s preset button writes %s to every enemy filter', (name, value) => {
        const {sync, root} = mountEnemies();

        root.querySelector(`[data-enemy-preset="${name}"]`).click();

        for (const key of ['settingEnemiesNormal', 'settingEnemiesChampion', 'settingEnemiesBoss', 'settingEnemiesMistsGriffin',
            'settingEnemiesAvalonianDrones', 'settingEnemiesEvent']) {
            expect(sync.getBool(key)).toBe(value);
            expect(root.querySelector(`[data-setting="${key}"]`).checked).toBe(value);
        }
        expect(sync.getBool('settingEnemiesMinHealthFilter')).toBe(false);
        expect(localStorage.getItem('settingEnemiesShowHealthBars')).toBeNull();
    });

    test('the min HP field is enabled only while its filter is on', () => {
        const {sync, root} = mountEnemies();
        const filter = root.querySelector('[data-setting="settingEnemiesMinHealthFilter"]');
        const field = root.querySelector('[data-setting="settingEnemiesMinHealth"]');
        expect(field.disabled).toBe(true);

        filter.checked = true;
        fire(filter, 'change');
        expect(field.disabled).toBe(false);

        sync.setBool('settingEnemiesMinHealthFilter', false);
        expect(field.disabled).toBe(true);
    });

    test('turning on the min HP filter changes no other control', () => {
        const {root} = mountEnemies();
        const before = checkedStates(root).filter(([key]) => key !== 'settingEnemiesMinHealthFilter');
        const filter = root.querySelector('[data-setting="settingEnemiesMinHealthFilter"]');

        filter.checked = true;
        fire(filter, 'change');

        expect(checkedStates(root).filter(([key]) => key !== 'settingEnemiesMinHealthFilter')).toEqual(before);
        expect(Object.keys(localStorage).filter(key => key !== 'settingSchemaVersion')).toEqual(['settingEnemiesMinHealthFilter']);
    });
});

// synthetic: binder markup built inline, values read and written through real SettingsSync instances.

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {SettingsSync} from './SettingsSync.js';
import {bindSettingControls} from './SettingControls.js';

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
        <button data-nudge="settingRadarZoom" data-dir="-1">-</button>
        <button data-nudge="settingRadarZoom" data-dir="1">+</button>
        <button data-reset="settingRadarZoom">Reset</button>
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

    test('nudge steps and clamps, reset writes the default', () => {
        localStorage.setItem('settingRadarZoom', '2.9');
        const sync = newSync();
        const root = mount(markup);
        bind(root, sync);
        const slider = root.querySelector('input');
        const [down, up] = root.querySelectorAll('[data-nudge]');

        up.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('3');
        up.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('3');
        down.click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('2.9');
        expect(slider.value).toBe('2.9');

        root.querySelector('[data-reset]').click();
        expect(localStorage.getItem('settingRadarZoom')).toBe('1');
        expect(slider.value).toBe('1');
    });

    test('a focused slider still moves on nudge', () => {
        const sync = newSync();
        const root = mount(markup);
        bind(root, sync);
        const slider = root.querySelector('input');
        slider.focus();

        root.querySelectorAll('[data-nudge]')[1].click();

        expect(document.activeElement).toBe(slider);
        expect(slider.value).toBe('1.1');
        expect(root.querySelector('[data-value-for]').textContent).toBe('110%');
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

describe('bindSettingControls select and radio', () => {
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

    test('radio group shows and writes the enum value', () => {
        localStorage.setItem('settingRadarRotation', '180');
        const sync = newSync();
        const root = mount(`<div data-setting="settingRadarRotation">
            ${[0, 90, 180, 270].map(v => `<input type="radio" name="rot" value="${v}">`).join('')}
        </div>`);
        bind(root, sync);
        const radios = [...root.querySelectorAll('input')];

        expect(radios.filter(r => r.checked).map(r => r.value)).toEqual(['180']);

        radios[1].checked = true;
        fire(radios[1], 'change');

        expect(localStorage.getItem('settingRadarRotation')).toBe('90');
        expect(sync.get('settingRadarRotation')).toBe(90);
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
        const root = mount('<button data-nudge="settingRadarSize" data-dir="1">+</button>'
            + '<input type="range" min="300" max="800" step="50" data-setting="settingRadarSize">');
        const first = new AbortController();
        bindSettingControls(root, first.signal, sync);
        bind(root, sync);

        expect(wildcardCount(sync)).toBe(before + 1);
        root.querySelector('button').click();
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
});

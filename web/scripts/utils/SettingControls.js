import settingsSync from './SettingsSync.js';
import {registerPage, reinitCurrentPage} from '../core/PageController.js';
import {SETTINGS, registryEntry} from './SettingsRegistry.js';
import {generateResourceGrid, tierState} from './ResourcesHelper.js';

const GLYPHS = {all: '✓', some: '◐', none: '☐'};

function renderedEnchants(tier) {
    return tier < 3 ? ['e0'] : ['e0', 'e1', 'e2', 'e3', 'e4'];
}

const percent = value => `${Math.round(value * 100)}%`;

const READOUTS = {
    settingRadarZoom: percent,
    settingRadarIconSize: percent,
    settingAlertSoundVolume: percent,
    settingRadarSize: value => `${value}px`,
    settingAlertSoundCooldown: value => `${value}ms`,
};

function snap(entry, value) {
    const decimals = (String(entry.step).split('.')[1] ?? '').length;
    const stepped = entry.min + Math.round((value - entry.min) / entry.step) * entry.step;
    return Number(Math.min(entry.max, Math.max(entry.min, stepped)).toFixed(decimals));
}

function writeNumber(sync, entry, value) {
    if (entry.type === 'int') sync.setNumber(entry.key, value);
    else sync.setFloat(entry.key, value);
}

function showValue(el, entry, value) {
    el.value = String(value);
}

const KINDS = {
    checkbox: {
        show(el, entry, value) {
            el.checked = value;
        },
        listen(el, entry, sync, signal) {
            el.addEventListener('change', () => sync.setBool(entry.key, el.checked), {signal});
        },
    },
    range: {
        show: showValue,
        listen(el, entry, sync, signal) {
            el.addEventListener('input', () => writeNumber(sync, entry, snap(entry, Number(el.value))), {signal});
        },
    },
    number: {
        textEntry: true,
        show: showValue,
        listen(el, entry, sync, signal) {
            el.addEventListener('change', () => {
                const typed = el.value.trim() === '' ? NaN : Number(el.value);
                if (!Number.isFinite(typed)) {
                    el.value = String(sync.get(entry.key));
                    return;
                }
                const value = snap(entry, typed);
                el.value = String(value);
                writeNumber(sync, entry, value);
            }, {signal});
        },
    },
    select: {
        show(el, entry, value) {
            if (!el.options.length) {
                const choices = entry.options?.map(({file, label}) => [file, label]) ?? entry.values.map(v => [v, v]);
                for (const [optionValue, label] of choices) {
                    const option = document.createElement('option');
                    option.value = String(optionValue);
                    option.textContent = String(label);
                    el.append(option);
                }
            }
            el.value = String(value);
        },
        listen(el, entry, sync, signal) {
            el.addEventListener('change', () => sync.set(entry.key, el.value), {signal});
        },
    },
    radio: {
        show(el, entry, value) {
            for (const radio of el.querySelectorAll('input[type="radio"]')) radio.checked = radio.value === String(value);
        },
        listen(el, entry, sync, signal) {
            el.addEventListener('change', event => {
                if (event.target.matches('input[type="radio"]') && event.target.checked) sync.set(entry.key, event.target.value);
            }, {signal});
        },
    },
    matrix: {
        show(el, entry, value) {
            if (!el.querySelector('[data-enchant]')) el.innerHTML = generateResourceGrid(entry);
            for (const cell of el.querySelectorAll('[data-enchant]')) {
                cell.checked = value[cell.dataset.enchant][Number(cell.dataset.tier)];
            }
            for (const button of el.querySelectorAll('[data-tier-toggle]')) {
                const tier = Number(button.dataset.tierToggle);
                const state = tierState(value, tier);
                button.textContent = `${GLYPHS[state]}T${tier + 1}`;
                button.classList.toggle('opacity-50', state === 'none');
            }
        },
        listen(el, entry, sync, signal) {
            el.addEventListener('change', event => {
                const cell = event.target.closest('[data-enchant]');
                if (!cell) return;
                const next = structuredClone(sync.getJSON(entry.key));
                next[cell.dataset.enchant][Number(cell.dataset.tier)] = cell.checked;
                sync.setJSON(entry.key, next);
            }, {signal});
            el.addEventListener('click', event => {
                const button = event.target.closest('[data-tier-toggle]');
                if (!button) return;
                const tier = Number(button.dataset.tierToggle);
                const matrix = structuredClone(sync.getJSON(entry.key));
                const turnOn = tierState(matrix, tier) !== 'all';
                for (const enchant of renderedEnchants(tier)) matrix[enchant][tier] = turnOn;
                sync.setJSON(entry.key, matrix);
            }, {signal});
        },
    },
};

function kindOf(el, entry) {
    if (entry?.shape === 'matrix') return 'matrix';
    if (el.tagName === 'SELECT') return 'select';
    if (el.tagName === 'INPUT') return el.type;
    if (el.querySelector('input[type="radio"]')) return 'radio';
    return null;
}

function render(root, sync, key) {
    const entry = registryEntry(key);
    if (!entry) return;
    const value = sync.get(key);
    for (const el of root.querySelectorAll(`[data-setting="${key}"]`)) {
        const kind = KINDS[kindOf(el, entry)];
        if (!kind || (kind.textEntry && el === document.activeElement)) continue;
        kind.show(el, entry, value);
    }
    for (const readout of root.querySelectorAll(`[data-value-for="${key}"]`)) {
        readout.textContent = (READOUTS[key] ?? String)(value);
    }
}

function onButton(root, sync, event) {
    const button = event.target.closest('[data-nudge], [data-reset]');
    if (!button || !root.contains(button)) return;
    const entry = registryEntry(button.dataset.nudge ?? button.dataset.reset);
    if (!entry) return;
    const value = button.dataset.reset !== undefined
        ? entry.default
        : snap(entry, sync.get(entry.key) + Number(button.dataset.dir) * entry.step);
    writeNumber(sync, entry, value);
}

const bindings = new WeakMap();

export function bindSettingControls(root, signal, sync = settingsSync) {
    bindings.get(root)?.abort();
    const binding = new AbortController();
    bindings.set(root, binding);
    const bound = AbortSignal.any([signal, binding.signal]);

    const keys = new Set();
    for (const el of root.querySelectorAll('[data-setting]')) {
        const entry = registryEntry(el.dataset.setting);
        const kind = KINDS[kindOf(el, entry)];
        if (!entry || !kind) continue;
        kind.listen(el, entry, sync, bound);
        keys.add(entry.key);
    }
    for (const readout of root.querySelectorAll('[data-value-for]')) keys.add(readout.dataset.valueFor);
    keys.forEach(key => render(root, sync, key));

    root.addEventListener('click', event => onButton(root, sync, event), {signal: bound});
    const onChange = key => render(root, sync, key);
    sync.on('*', onChange);
    bound.addEventListener('abort', () => sync.off('*', onChange), {once: true});
}

const PRESETS = {all: true, clear: false};

const ENEMY_FILTERS = SETTINGS.filter(entry => entry.page === 'Enemies'
    && ['Classic', 'Mists bosses', 'Other'].includes(entry.section)
    && entry.type === 'bool' && entry.scope === 'setting' && entry.key !== 'settingEnemiesMinHealthFilter');

export function applyEnemyPreset(name, sync = settingsSync) {
    if (!Object.hasOwn(PRESETS, name)) return;
    for (const entry of ENEMY_FILTERS) sync.setBool(entry.key, PRESETS[name]);
}

const registeredPages = new Set();

export function registerBoundPage(name, {init, destroy} = {}) {
    if (!registeredPages.has(name)) {
        registeredPages.add(name);
        let activation = null;
        registerPage(name, {
            async init() {
                activation?.abort();
                activation = new AbortController();
                const {signal} = activation;
                const root = document.getElementById('page-content');
                bindSettingControls(root, signal);
                await init?.({root, signal});
            },
            async destroy() {
                activation?.abort();
                activation = null;
                await destroy?.();
            },
        });
    }
    window.onGlobalsReady(() => reinitCurrentPage());
}

function exportableEntries() {
    return SETTINGS.filter(entry => (entry.scope === 'setting' || entry.scope === 'ui') && entry.key !== 'settingIgnoreList');
}

export function resetAllSettings(sync = settingsSync) {
    for (const entry of exportableEntries()) sync.remove(entry.key);
}

export async function buildDebugExport(sync, fetchImpl) {
    const settings = {};
    for (const entry of exportableEntries()) settings[entry.key] = sync.get(entry.key);

    let backend;
    try {
        const response = await fetchImpl('/api/settings/logging');
        if (!response.ok) throw new Error(`status ${response.status}`);
        backend = await response.json();
    } catch (error) {
        backend = {error: error?.message ?? String(error)};
    }

    return {
        settings,
        settingSchemaVersion: sync.getSchemaVersion(),
        backend,
        browser: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language,
        },
    };
}

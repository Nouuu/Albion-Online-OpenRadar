import settingsSync from './SettingsSync.js';
import {registryEntry} from './SettingsRegistry.js';

const FIT_CAP = 1200;

function unbounded(value) {
    return Number.isFinite(value) ? value : Infinity;
}

export function computeRadarSize({size, fit, availableWidth, availableHeight}) {
    const {min, max} = registryEntry('settingRadarSize');
    const cap = fit ? FIT_CAP : Math.min(max, Math.max(min, size));
    return Math.max(1, Math.floor(Math.min(cap, unbounded(availableWidth), unbounded(availableHeight))));
}

const LAYOUT_KEYS = new Set(['settingRadarSize', 'settingRadarFitToScreen']);
const SIZE_CONTROLS = '[data-setting="settingRadarSize"], [data-nudge="settingRadarSize"], [data-reset="settingRadarSize"]';

let state = null;

function padding(el, side) {
    return el ? parseFloat(getComputedStyle(el)[side]) || 0 : 0;
}

function chainTop(el) {
    let top = 0;
    for (let node = el; node; node = node.offsetParent) top += node.offsetTop;
    return top;
}

function measure(container, page) {
    const body = container.parentElement;
    const availableWidth = body.clientWidth - padding(body, 'paddingLeft') - padding(body, 'paddingRight');
    const availableHeight = page.clientHeight - padding(page, 'paddingBottom') - padding(body, 'paddingBottom')
        - (chainTop(container) - chainTop(page));
    return {availableWidth, availableHeight};
}

function applyLayout() {
    if (!state) return;
    const {container, page} = state;
    const fit = settingsSync.getBool('settingRadarFitToScreen');
    const size = computeRadarSize({size: settingsSync.getNumber('settingRadarSize'), fit, ...measure(container, page)});

    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    for (const control of page.querySelectorAll(SIZE_CONTROLS)) control.disabled = fit;

    let changed = false;
    for (const canvas of container.querySelectorAll('canvas')) {
        if (canvas.width === size && canvas.height === size) continue;
        canvas.width = size;
        canvas.height = size;
        changed = true;
    }
    if (changed) window.dispatchEvent(new CustomEvent('canvasSizeChanged', {detail: {size}}));
}

export function initRadarSettingsPanel() {
    const container = document.getElementById('canvasContainer');
    const page = document.getElementById('page-content');
    if (!container || !page || state?.container === container) return;
    destroyRadarSettingsPanel();

    const controller = new AbortController();
    const {signal} = controller;
    const observer = new ResizeObserver(() => {
        if (state?.container === container && container.isConnected) applyLayout();
    });
    state = {container, page, controller, observer};

    const onSetting = key => {
        if (LAYOUT_KEYS.has(key)) applyLayout();
    };
    settingsSync.on('*', onSetting);
    signal.addEventListener('abort', () => settingsSync.off('*', onSetting), {once: true});
    document.body.addEventListener('htmx:afterSettle', event => {
        if (event.detail?.target?.id === 'page-content') applyLayout();
    }, {signal});
    observer.observe(page);
    applyLayout();
}

export function destroyRadarSettingsPanel() {
    if (!state) return;
    state.observer.disconnect();
    state.controller.abort();
    state = null;
}

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

export function radarLayout({size, fit, beside, pageWidth, chrome, gap, listMin, availableHeight}) {
    const stacked = computeRadarSize({size, fit, availableWidth: pageWidth - chrome, availableHeight});
    if (!beside) return {size: stacked, beside: false};
    const widthLeft = pageWidth - chrome - gap - listMin;
    const next = computeRadarSize({size, fit, availableWidth: widthLeft, availableHeight});
    const kept = computeRadarSize({size, fit: false, availableWidth: pageWidth - chrome, availableHeight});
    return next >= kept ? {size: next, beside: true} : {size: stacked, beside: false};
}

const LIST_MIN_REM = 22;
const LAYOUT_KEYS = new Set(['settingRadarSize', 'settingRadarFitToScreen', 'settingRadarPlayersBeside']);
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

function measure(container, page, wrapper) {
    const body = container.parentElement;
    const availableHeight = page.clientHeight - padding(page, 'paddingBottom') - padding(body, 'paddingBottom')
        - (chainTop(container) - chainTop(page));
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return {
        pageWidth: wrapper.clientWidth,
        chrome: padding(body, 'paddingLeft') + padding(body, 'paddingRight'),
        gap: parseFloat(getComputedStyle(wrapper).columnGap) || 0,
        listMin: LIST_MIN_REM * rem,
        availableHeight,
    };
}

function applyLayout() {
    if (!state) return;
    const {container, page, wrapper} = state;
    const fit = settingsSync.getBool('settingRadarFitToScreen');
    const frame = measure(container, page, wrapper);
    const {size, beside} = radarLayout({
        size: settingsSync.getNumber('settingRadarSize'), fit,
        beside: settingsSync.getBool('settingRadarPlayersBeside'), ...frame,
    });

    wrapper.toggleAttribute('data-players-beside', beside);
    container.closest('.card').style.width = beside ? `${size + frame.chrome}px` : '';

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
    const wrapper = document.getElementById('radarLayout');
    if (!container || !page || !wrapper || state?.container === container) return;
    destroyRadarSettingsPanel();

    const controller = new AbortController();
    const {signal} = controller;
    const observer = new ResizeObserver(() => {
        if (state?.container === container && container.isConnected) applyLayout();
    });
    state = {container, page, wrapper, controller, observer};

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

// synthetic: pure sizing helpers, then the radar template mounted with stubbed layout and a fake ResizeObserver.
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync from './SettingsSync.js';
import {computeRadarSize, destroyRadarSettingsPanel, initRadarSettingsPanel, radarLayout} from './RadarSettingsPanel.js';
import {bindSettingControls} from './SettingControls.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));

const RADAR_KEYS = ['settingRadarSize', 'settingRadarFitToScreen', 'settingRadarPlayersBeside'];

describe('computeRadarSize', () => {
    test.each([
        [500, false, 1000, 1000, 500],
        [800, false, 1000, 540, 540],
        [1100, false, 1500, 1300, 1100],
        [1300, false, 1500, 1300, 1200],
        [300, false, 280, 1000, 280],
        [200, false, 1000, 1000, 300],
        [500, true, 1500, 1300, 1200],
        [500, false, NaN, 600, 500],
        [500, false, 0, 600, 1],
        [600, false, 512.7, 900, 512],
    ])('@verified 2026-09-24: size %s fit %s in %sx%s gives %s', (size, fit, availableWidth, availableHeight, expected) => {
        expect(computeRadarSize({size, fit, availableWidth, availableHeight})).toBe(expected);
    });
});

describe('radarLayout', () => {
    const frame = {chrome: 32, gap: 16, listMin: 352};
    test.each([
        ['off keeps the stack', false, 500, false, 1600, 900, 500, false],
        ['room for the list keeps the size', true, 500, false, 1600, 900, 500, true],
        ['a list squeezed below its minimum falls back', true, 800, false, 1100, 900, 800, false],
        ['a height-capped radar keeps its size beside the list', true, 800, false, 1000, 500, 500, true],
        ['Fit sizes the radar from the space left', true, 500, true, 1600, 900, 900, true],
        ['Fit stays capped at 1200', true, 500, true, 1700, 2000, 1200, true],
        ['Fit falls back when less than the minimum size is left', true, 500, true, 600, 900, 568, false],
        ['Fit falls back when the width left is below Max size', true, 500, true, 709, 700, 677, false],
        ['Fit beside keeps at least Max size', true, 500, true, 1125, 800, 725, true],
        ['a phone falls back', true, 500, false, 358, 700, 326, false],
    ])('@verified 2026-09-26: %s', (_, beside, size, fit, pageWidth, availableHeight, expectedSize, expectedBeside) => {
        expect(radarLayout({size, fit, beside, pageWidth, availableHeight, ...frame}))
            .toEqual({size: expectedSize, beside: expectedBeside});
    });
});

let observers = [];
let sizeEvents = [];
let root = null;

class FakeResizeObserver {
    constructor(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
    }
}

function onSizeEvent(event) {
    sizeEvents.push(event.detail.size);
}

function container() {
    return root.querySelector('#canvasContainer');
}

function stubLayout({width = 1000, height = 1000, top = 40} = {}) {
    Object.defineProperty(root.querySelector('#radarLayout'), 'clientWidth', {value: width, configurable: true});
    Object.defineProperty(root, 'clientHeight', {value: height, configurable: true});
    Object.defineProperty(container(), 'offsetTop', {value: top, configurable: true});
}

function canvases() {
    return [...container().querySelectorAll('canvas')];
}

function bitmaps() {
    return canvases().map(canvas => [canvas.width, canvas.height]);
}

function settle(target) {
    target.dispatchEvent(new CustomEvent('htmx:afterSettle', {bubbles: true, detail: {target}}));
}

beforeEach(() => {
    localStorage.clear();
    RADAR_KEYS.forEach(key => settingsSync.remove(key));
    observers = [];
    sizeEvents = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    window.addEventListener('canvasSizeChanged', onSizeEvent);
    root = mountPage('radar');
    stubLayout();
});

afterEach(() => {
    destroyRadarSettingsPanel();
    window.removeEventListener('canvasSizeChanged', onSizeEvent);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    RADAR_KEYS.forEach(key => settingsSync.remove(key));
    document.body.innerHTML = '';
});

describe('radar settings panel layout', () => {
    test('@verified 2026-09-24: first init with room keeps the 500 bitmaps and fires no size event', () => {
        initRadarSettingsPanel();

        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
        expect([container().style.width, container().style.height]).toEqual(['500px', '500px']);
        expect(sizeEvents).toEqual([]);
    });

    test('@verified 2026-09-24: first init in a 358 px card sizes the four bitmaps and fires one size event', () => {
        stubLayout({width: 358});

        initRadarSettingsPanel();

        expect(bitmaps()).toEqual(Array(4).fill([358, 358]));
        expect([container().style.width, container().style.height]).toEqual(['358px', '358px']);
        expect(sizeEvents).toEqual([358]);
    });

    test('@verified 2026-09-24: available height is the page height minus the container offset', () => {
        stubLayout({height: 580, top: 40});
        initRadarSettingsPanel();
        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));

        stubLayout({height: 440, top: 40});
        observers[0].callback([]);

        expect(bitmaps()).toEqual(Array(4).fill([400, 400]));
        expect(sizeEvents).toEqual([400]);
    });

    test('@verified 2026-09-24: Fit to screen fills the space up to 1200 and is undone when turned off', () => {
        stubLayout({width: 1500, height: 1340});
        initRadarSettingsPanel();

        settingsSync.setBool('settingRadarFitToScreen', true);
        expect(bitmaps()).toEqual(Array(4).fill([1200, 1200]));

        settingsSync.setBool('settingRadarFitToScreen', false);
        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
        expect(sizeEvents).toEqual([1200, 500]);
    });

    test('@verified 2026-09-24: a Size change re-applies the layout', () => {
        initRadarSettingsPanel();

        settingsSync.setNumber('settingRadarSize', 650);

        expect(bitmaps()).toEqual(Array(4).fill([650, 650]));
        expect(sizeEvents).toEqual([650]);
    });

    test('@verified 2026-09-24: init, resize and Fit never write settingRadarSize', () => {
        const broadcast = vi.spyOn(settingsSync, 'broadcast');
        stubLayout({width: 358});

        initRadarSettingsPanel();
        stubLayout({width: 300});
        observers[0].callback([]);
        settingsSync.setBool('settingRadarFitToScreen', true);

        expect(broadcast.mock.calls.map(([key]) => key)).toEqual(['settingRadarFitToScreen']);
        expect(localStorage.getItem('settingRadarSize')).toBeNull();
    });

    test('@verified 2026-09-24: the ResizeObserver watches #page-content', () => {
        initRadarSettingsPanel();

        expect(observers).toHaveLength(1);
        expect(observers[0].observe).toHaveBeenCalledWith(root);
    });

    test('@verified 2026-09-24: htmx:afterSettle on #page-content restores size', () => {
        stubLayout({width: 358});
        initRadarSettingsPanel();
        canvases().forEach(canvas => {
            canvas.width = 500;
            canvas.height = 500;
        });
        container().style.cssText = '';

        settle(root);

        expect(bitmaps()).toEqual(Array(4).fill([358, 358]));
        expect([container().style.width, container().style.height]).toEqual(['358px', '358px']);
    });

    test('@verified 2026-09-24: htmx:afterSettle on another target leaves the layout alone', () => {
        stubLayout({width: 358});
        initRadarSettingsPanel();
        canvases().forEach(canvas => {
            canvas.width = 500;
        });
        const other = document.createElement('div');
        document.body.append(other);

        settle(other);

        expect(canvases().map(canvas => canvas.width)).toEqual(Array(4).fill(500));
    });

    test('@verified 2026-09-24: a second init on the same container adds no observer or listener', () => {
        const addListener = vi.spyOn(document.body, 'addEventListener');
        initRadarSettingsPanel();
        const wildcards = settingsSync.listeners.get('*')?.length ?? 0;
        const bodyListeners = addListener.mock.calls.length;

        initRadarSettingsPanel();

        expect(observers).toHaveLength(1);
        expect(observers[0].observe).toHaveBeenCalledTimes(1);
        expect(settingsSync.listeners.get('*')?.length ?? 0).toBe(wildcards);
        expect(addListener.mock.calls.length).toBe(bodyListeners);
    });

    test('@verified 2026-09-24: init on a new container releases the old one first', () => {
        initRadarSettingsPanel();
        root = mountPage('radar');
        stubLayout({width: 358});

        initRadarSettingsPanel();

        expect(observers).toHaveLength(2);
        expect(observers[0].disconnect).toHaveBeenCalled();
        expect(bitmaps()).toEqual(Array(4).fill([358, 358]));
    });

    test('@verified 2026-09-24: destroy disconnects the observer and releases the listeners', () => {
        const wildcards = settingsSync.listeners.get('*')?.length ?? 0;
        initRadarSettingsPanel();

        destroyRadarSettingsPanel();

        expect(observers[0].disconnect).toHaveBeenCalled();
        expect(settingsSync.listeners.get('*')?.length ?? 0).toBe(wildcards);
        settingsSync.setNumber('settingRadarSize', 650);
        settle(root);
        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
    });

    test('@verified 2026-09-24: the ResizeObserver callback after destroy does nothing', () => {
        initRadarSettingsPanel();
        const {callback} = observers[0];
        destroyRadarSettingsPanel();
        stubLayout({width: 358});

        callback([]);

        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
        expect(sizeEvents).toEqual([]);
    });

    function layoutState() {
        const wrapper = root.querySelector('#radarLayout');
        return {beside: wrapper.hasAttribute('data-players-beside'), card: container().closest('.card').style.width};
    }

    test('@verified 2026-09-26: Players beside radar on a wide page moves the list beside a radar-sized card', () => {
        stubLayout({width: 1600, height: 1000});
        initRadarSettingsPanel();
        expect(layoutState()).toEqual({beside: false, card: ''});

        settingsSync.setBool('settingRadarPlayersBeside', true);
        expect(layoutState()).toEqual({beside: true, card: '500px'});
        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));

        settingsSync.setBool('settingRadarPlayersBeside', false);
        expect(layoutState()).toEqual({beside: false, card: ''});
    });

    test('@verified 2026-09-26: Players beside radar falls back to the stack when the list would get less than 22rem', () => {
        stubLayout({width: 800, height: 1000});
        settingsSync.setBool('settingRadarPlayersBeside', true);
        initRadarSettingsPanel();

        expect(layoutState()).toEqual({beside: false, card: ''});
        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
    });

    test('@verified 2026-09-26: Fit with the list beside sizes the radar from the width left', () => {
        stubLayout({width: 1200, height: 1340});
        settingsSync.setBool('settingRadarPlayersBeside', true);
        settingsSync.setBool('settingRadarFitToScreen', true);
        initRadarSettingsPanel();

        expect(layoutState()).toEqual({beside: true, card: '848px'});
        expect(bitmaps()).toEqual(Array(4).fill([848, 848]));
    });

    test('@verified 2026-09-26: a resize that squeezes the list returns to the stack', () => {
        stubLayout({width: 1600, height: 1000});
        settingsSync.setBool('settingRadarPlayersBeside', true);
        initRadarSettingsPanel();
        expect(layoutState().beside).toBe(true);

        stubLayout({width: 700, height: 1000});
        observers[0].callback([]);

        expect(layoutState()).toEqual({beside: false, card: ''});
    });

    test('@verified 2026-09-24: the ResizeObserver callback does nothing once the container left the document', () => {
        initRadarSettingsPanel();
        root.remove();
        stubLayout({width: 358});

        observers[0].callback([]);

        expect(bitmaps()).toEqual(Array(4).fill([500, 500]));
        expect(sizeEvents).toEqual([]);
    });
});

describe('radar settings panel controls', () => {
    let binding = null;

    function bindAndInit() {
        binding = new AbortController();
        bindSettingControls(root, binding.signal);
        initRadarSettingsPanel();
    }

    function change(el) {
        el.dispatchEvent(new Event('change', {bubbles: true}));
    }

    afterEach(() => {
        binding?.abort();
        binding = null;
    });

    test('@verified 2026-09-24: Fit on disables the Size slider', () => {
        bindAndInit();
        const size = root.querySelector('[data-setting="settingRadarSize"]');
        const fit = root.querySelector('[data-setting="settingRadarFitToScreen"]');
        expect(size.disabled).toBe(false);

        fit.checked = true;
        change(fit);
        expect(size.disabled).toBe(true);

        fit.checked = false;
        change(fit);
        expect(size.disabled).toBe(false);
    });

    test('@verified 2026-09-26: Fit on disables the Size nudge and reset buttons, the other sliders keep theirs', () => {
        bindAndInit();
        const sizeButtons = [...root.querySelectorAll('[data-nudge="settingRadarSize"], [data-reset="settingRadarSize"]')];
        const zoomButtons = [...root.querySelectorAll('[data-nudge="settingRadarZoom"], [data-reset="settingRadarZoom"]')];
        expect(sizeButtons).toHaveLength(3);

        settingsSync.setBool('settingRadarFitToScreen', true);
        expect(sizeButtons.map(button => button.disabled)).toEqual([true, true, true]);
        expect(zoomButtons.map(button => button.disabled)).toEqual([false, false, false]);

        settingsSync.setBool('settingRadarFitToScreen', false);
        expect(sizeButtons.map(button => button.disabled)).toEqual([false, false, false]);
    });

    test('@verified 2026-09-24: nothing in the panel or the canvas carries a style transform', () => {
        bindAndInit();
        settingsSync.setBool('settingRadarFitToScreen', true);

        const turned = [root, ...root.querySelectorAll('*')].filter(el => el.style?.transform);
        expect(turned).toEqual([]);
    });
});

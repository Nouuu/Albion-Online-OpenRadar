// synthetic: pure sizing and rotation helpers, then the radar template mounted with stubbed layout and a fake ResizeObserver.
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync from './SettingsSync.js';
import {
    computeRadarSize,
    destroyRadarSettingsPanel,
    initRadarSettingsPanel,
    rotationDegrees,
    rotationTransform,
} from './RadarSettingsPanel.js';
import {bindSettingControls} from './SettingControls.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

vi.mock('../core/PageController.js', () => ({registerPage: vi.fn(), reinitCurrentPage: vi.fn()}));

const RADAR_KEYS = ['settingRadarSize', 'settingRadarFitToScreen', 'settingRadarRotation'];

describe('computeRadarSize', () => {
    test.each([
        [500, false, 1000, 1000, 500],
        [800, false, 1000, 540, 540],
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

describe('rotation helpers', () => {
    test.each([
        [0, 0, ''],
        [90, 90, 'rotate(90deg)'],
        [180, 180, 'rotate(180deg)'],
        [270, 270, 'rotate(270deg)'],
        [45, 0, ''],
        ['90', 90, 'rotate(90deg)'],
        [NaN, 0, ''],
        [undefined, 0, ''],
    ])('@verified 2026-09-24: %s normalizes to %s and transform "%s"', (value, degrees, transform) => {
        expect(rotationDegrees(value)).toBe(degrees);
        expect(rotationTransform(value)).toBe(transform);
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
    Object.defineProperty(container().parentElement, 'clientWidth', {value: width, configurable: true});
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

    test('@verified 2026-09-24: htmx:afterSettle on #page-content restores size and rotation', () => {
        stubLayout({width: 358});
        settingsSync.set('settingRadarRotation', '90');
        initRadarSettingsPanel();
        canvases().forEach(canvas => {
            canvas.width = 500;
            canvas.height = 500;
        });
        container().style.cssText = '';

        settle(root);

        expect(bitmaps()).toEqual(Array(4).fill([358, 358]));
        expect([container().style.width, container().style.height]).toEqual(['358px', '358px']);
        expect(container().style.transform).toBe('rotate(90deg)');
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

    test('@verified 2026-09-24: Fit on disables the Size slider and its three buttons on the elements', () => {
        bindAndInit();
        const sizeControls = [...root.querySelectorAll(
            '[data-setting="settingRadarSize"], [data-nudge="settingRadarSize"], [data-reset="settingRadarSize"]')];
        const fit = root.querySelector('[data-setting="settingRadarFitToScreen"]');
        expect(sizeControls).toHaveLength(4);
        expect(sizeControls.map(el => el.disabled)).toEqual([false, false, false, false]);

        fit.checked = true;
        change(fit);
        expect(sizeControls.map(el => el.disabled)).toEqual([true, true, true, true]);

        fit.checked = false;
        change(fit);
        expect(sizeControls.map(el => el.disabled)).toEqual([false, false, false, false]);
    });

    test('@verified 2026-09-24: rotation 90 through the radios turns only #canvasContainer', () => {
        bindAndInit();
        const radio = root.querySelector('[data-setting="settingRadarRotation"] input[value="90"]');

        radio.checked = true;
        change(radio);

        const turned = [root, ...root.querySelectorAll('*')].filter(el => el.style?.transform);
        expect(turned.map(el => el.id)).toEqual(['canvasContainer']);
        expect(container().style.transform).toBe('rotate(90deg)');
    });

    test('@verified 2026-09-24: a stored rotation of 45 draws upright with the 0 radio checked', () => {
        settingsSync.set('settingRadarRotation', '45');

        bindAndInit();

        expect(container().style.transform).toBe('');
        const checked = [...root.querySelectorAll('[data-setting="settingRadarRotation"] input:checked')];
        expect(checked.map(el => el.value)).toEqual(['0']);
    });
});

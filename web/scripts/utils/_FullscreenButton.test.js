// synthetic: the Fullscreen API is not implemented by happy-dom, stubbed per test with Object.defineProperty.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

const HEADER_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../internal/templates/layouts/header.gohtml');

function mountButton(page = 'radar') {
    document.body.innerHTML = `
        <main id="page-content" data-page="${page}"></main>
        <button id="fullscreenToggleBtn" style="display:none;">
            <i data-lucide="maximize"></i>
            <span>Fullscreen</span>
        </button>
    `;
    return document.getElementById('fullscreenToggleBtn');
}

function stub(target, prop, value) {
    Object.defineProperty(target, prop, {value, configurable: true});
}

let FullscreenButton;

beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '';
    stub(document, 'fullscreenElement', null);
    stub(document, 'fullscreenEnabled', true);
    stub(document.documentElement, 'requestFullscreen', vi.fn(() => Promise.resolve()));
    stub(document, 'exitFullscreen', vi.fn(() => Promise.resolve()));
    vi.stubGlobal('lucide', {createIcons: vi.fn()});
    vi.stubGlobal('logger', {warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn()});
    FullscreenButton = await import('./FullscreenButton.js');
});

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('visibility', () => {
    test('hidden when the browser reports no fullscreen support', () => {
        stub(document, 'fullscreenEnabled', false);
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        expect(button.style.display).toBe('none');
    });

    test('hidden when fullscreenEnabled is absent', () => {
        stub(document, 'fullscreenEnabled', undefined);
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        expect(button.style.display).toBe('none');
    });

    test('hidden outside the radar page', () => {
        const button = mountButton('settings');
        FullscreenButton.initFullscreenButton(button);
        expect(button.style.display).toBe('none');
    });

    test('shown on the radar page when the browser supports fullscreen', () => {
        const button = mountButton('radar');
        FullscreenButton.initFullscreenButton(button);
        expect(button.style.display).toBe('flex');
    });

    test('re-evaluated on htmx:afterSettle targeting page-content', () => {
        const button = mountButton('radar');
        FullscreenButton.initFullscreenButton(button);
        document.getElementById('page-content').dataset.page = 'settings';
        document.body.dispatchEvent(new CustomEvent('htmx:afterSettle', {detail: {target: {id: 'page-content'}}}));
        expect(button.style.display).toBe('none');
    });

    test('ignores htmx:afterSettle for another target', () => {
        const button = mountButton('radar');
        FullscreenButton.initFullscreenButton(button);
        document.getElementById('page-content').dataset.page = 'settings';
        document.body.dispatchEvent(new CustomEvent('htmx:afterSettle', {detail: {target: {id: 'sidebar'}}}));
        expect(button.style.display).toBe('flex');
    });
});

describe('click toggles fullscreen', () => {
    test('requests fullscreen synchronously when not active', () => {
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        button.click();
        expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
        expect(document.exitFullscreen).not.toHaveBeenCalled();
    });

    test('exits fullscreen when active', () => {
        stub(document, 'fullscreenElement', document.documentElement);
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        button.click();
        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
        expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
    });

    test('a rejected request is logged through window.logger', async () => {
        stub(document.documentElement, 'requestFullscreen', vi.fn(() => Promise.reject(new Error('denied'))));
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(window.logger.warn).toHaveBeenCalledTimes(1);
    });
});

describe('fullscreenchange rendering', () => {
    test('entering fullscreen renders the exit label and the minimize icon', () => {
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        stub(document, 'fullscreenElement', document.documentElement);
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(button.querySelector('span').textContent).toBe('Exit Fullscreen');
        expect(button.querySelector('[data-lucide]').dataset.lucide).toBe('minimize');
        expect(window.lucide.createIcons).toHaveBeenCalledWith({root: button});
    });

    test('leaving fullscreen renders the enter label and the maximize icon', () => {
        const button = mountButton();
        FullscreenButton.initFullscreenButton(button);
        stub(document, 'fullscreenElement', document.documentElement);
        document.dispatchEvent(new Event('fullscreenchange'));
        stub(document, 'fullscreenElement', null);
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(button.querySelector('span').textContent).toBe('Fullscreen');
        expect(button.querySelector('[data-lucide]').dataset.lucide).toBe('maximize');
    });
});

describe('exitFullscreenIfActive', () => {
    test('exits when fullscreen is active', () => {
        stub(document, 'fullscreenElement', document.documentElement);
        FullscreenButton.exitFullscreenIfActive();
        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    });

    test('does nothing when not active', () => {
        FullscreenButton.exitFullscreenIfActive();
        expect(document.exitFullscreen).not.toHaveBeenCalled();
    });

    test('logs a rejected exit instead of leaving it unhandled', async () => {
        stub(document, 'fullscreenElement', document.documentElement);
        stub(document, 'exitFullscreen', vi.fn(() => Promise.reject(new Error('denied'))));

        FullscreenButton.exitFullscreenIfActive();

        await vi.waitFor(() => expect(window.logger.warn).toHaveBeenCalledWith(
            expect.anything(), 'FullscreenExitFailed', {error: 'denied'}));
    });
});

describe('header.gohtml string contract', () => {
    const header = readFileSync(HEADER_PATH, 'utf8');

    test('holds the fullscreen button', () => {
        expect(header).toContain('id="fullscreenToggleBtn"');
    });

    test('holds the init call', () => {
        expect(header).toContain('initFullscreenButton');
    });
});

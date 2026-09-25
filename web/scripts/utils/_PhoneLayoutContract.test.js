// synthetic: source text and template markup, not a capture.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {mountPage} from '../__fixtures__/pageMarkup.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const inputCss = readFileSync(join(ROOT, 'web/styles/input.css'), 'utf8');
const baseLayout = readFileSync(join(ROOT, 'internal/templates/layouts/base.gohtml'), 'utf8');

function loadLayout(name) {
    const root = document.createElement('div');
    root.innerHTML = readFileSync(join(ROOT, 'internal/templates/layouts', name), 'utf8');
    return root;
}

describe('phone layout contract', () => {
    test('input.css declares the phone-landscape custom variant', () => {
        expect(inputCss).toContain('@custom-variant phone-landscape (@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse));');
    });

    test('base.gohtml uses h-dvh, not h-screen', () => {
        expect(baseLayout).toContain('h-dvh');
        expect(baseLayout).not.toContain('h-screen');
    });

    test('the radar settings panel markup holds no hidden sm: class', () => {
        mountPage('radar');
        const panel = document.getElementById('radarSettingsPanel');
        expect(panel).not.toBeNull();
        expect(panel.outerHTML).not.toContain('hidden sm:');
    });

    test('radar canvases carry no sm:m-2.5, never outgrow the page, and only the map canvas is rounded', () => {
        mountPage('radar');
        const container = document.getElementById('canvasContainer');
        expect(container.className).toContain('ring-2');
        expect(container.className).toContain('max-w-full');
        expect(container.className).not.toContain('overflow-hidden');
        for (const canvas of container.querySelectorAll('canvas')) {
            expect(canvas.className).not.toContain('sm:m-2.5');
            expect(canvas.className, canvas.id).toContain('max-w-full');
            expect(canvas.classList.contains('rounded-lg'), canvas.id).toBe(canvas.id === 'mapCanvas');
        }
    });

    test('#page-content scrolls vertically and carries no overflow-x-hidden guard', () => {
        const main = baseLayout.match(/<main id="page-content"[\s\S]*?class="([^"]*)"/)[1];
        expect(main).not.toContain('overflow-x-hidden');
        expect(main).toContain('overflow-y-auto');
    });

    test('rows that set the page minimum width wrap on narrow screens', () => {
        const flexWrap = el => el?.classList.contains('flex-wrap');
        mountPage('radar');
        expect(flexWrap(document.querySelector('#playersSection h3'))).toBe(true);
        for (const key of ['settingRadarClusterRadius', 'settingRadarClusterMinSize']) {
            expect(flexWrap(document.querySelector(`[data-setting="${key}"]`).closest('label')), key).toBe(true);
        }
        mountPage('enemies');
        const titles = [...document.querySelectorAll('.collapse-title')].filter(t => t.querySelector('.badge'));
        expect(titles.length).toBeGreaterThan(0);
        expect(titles.every(flexWrap)).toBe(true);
        expect(flexWrap(document.querySelector('[data-setting="settingEnemiesMinHealth"]').closest('label'))).toBe(true);
        mountPage('settings');
        const exportRow = document.getElementById('downloadLogsBtn').parentElement;
        expect(flexWrap(exportRow)).toBe(true);
        expect(exportRow.querySelector('span').className).toContain('max-w-max');
        const categoryGrid = document.querySelector('[data-setting="settingLogCategorySystem"]').closest('.grid');
        expect(categoryGrid.classList.contains('grid-cols-1')).toBe(true);
    });

    test('the mobile drawer footer stays in flow above a scrolling nav', () => {
        const root = loadLayout('sidebar.gohtml');
        const aside = root.querySelector('#mobile-sidebar');
        const nav = root.querySelector('#mobile-nav');
        const footer = aside.lastElementChild;
        expect(aside.className).toContain('flex');
        expect(aside.className).toContain('flex-col');
        expect(nav.className).toContain('overflow-y-auto');
        expect(footer.className).not.toContain('absolute');
    });
});

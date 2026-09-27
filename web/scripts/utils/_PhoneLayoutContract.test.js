// synthetic: source text and template markup, not a capture.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {mountPage} from '../__fixtures__/pageMarkup.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const inputCss = readFileSync(join(ROOT, 'web/styles/input.css'), 'utf8');
const baseLayout = readFileSync(join(ROOT, 'internal/templates/layouts/base.gohtml'), 'utf8');
const PAGES_DIR = join(ROOT, 'internal/templates/pages');

function pageNames() {
    return readdirSync(PAGES_DIR).filter(file => file.endsWith('.gohtml')).map(file => file.replace('.gohtml', ''));
}

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
        const badgedTitles = pageNames().flatMap(name => {
            mountPage(name);
            return [...document.querySelectorAll('.collapse-title')].filter(t => t.querySelector('.badge'));
        });
        expect(badgedTitles.length).toBeGreaterThan(0);
        expect(badgedTitles.every(flexWrap)).toBe(true);
        mountPage('enemies');
        expect(flexWrap(document.querySelector('[data-setting="settingEnemiesMinHealth"]').closest('label'))).toBe(true);
        mountPage('settings');
        const exportRow = document.getElementById('downloadLogsBtn').parentElement;
        expect(flexWrap(exportRow)).toBe(true);
        expect(exportRow.querySelector('span').className).toContain('max-w-max');
        const categoryGrid = document.querySelector('[data-setting="settingLogCategorySystem"]').closest('.grid');
        expect(categoryGrid.classList.contains('grid-cols-1')).toBe(true);
    });

    test('the Detected Players header and lists are compact only under phone-landscape', () => {
        mountPage('radar');
        const cardBody = document.querySelector('#playersSection > .card-body');
        expect(cardBody.className).toContain('phone-landscape:p-2');

        const headerRow = document.querySelector('#playersSection h3').parentElement;
        expect(headerRow.className).toContain('phone-landscape:flex-row');
        expect(headerRow.className).toContain('phone-landscape:items-center');
        expect(headerRow.className).toContain('phone-landscape:gap-2');
        expect(headerRow.className).toContain('@md:flex-row');

        const title = document.querySelector('#playersSection h3');
        expect(title.className).toContain('text-xl');
        expect(title.className).toContain('phone-landscape:text-base');

        for (const id of ['statHostileContainer', 'statFactionContainer', 'statPassiveContainer']) {
            const container = document.getElementById(id);
            expect(container.className, id).toContain('phone-landscape:py-0.5');
            expect(container.className, id).toContain('phone-landscape:px-2');
            const title2 = container.querySelector('.stat-title');
            expect(title2.className, id).toContain('text-[10px]');
            expect(title2.className, id).not.toMatch(/phone-landscape:text-\[[0-9]px\]/);
            const value = container.querySelector('.stat-value');
            expect(value.className, id).toContain('phone-landscape:text-xs');
        }

        for (const id of ['playersHostile', 'playersFaction', 'playersPassive']) {
            const heading = document.getElementById(id).firstElementChild;
            expect(heading.className, id).toContain('phone-landscape:pb-1');
            expect(heading.className, id).toContain('phone-landscape:mb-1');
        }

        for (const id of ['hostileList', 'factionList', 'passiveList']) {
            const list = document.getElementById(id);
            expect(list.className, id).toContain('phone-landscape:gap-1');
        }
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

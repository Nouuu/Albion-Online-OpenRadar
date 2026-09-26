// synthetic: hand-built rects, no capture involved.
// Layout is stubbed because happy-dom computes no geometry.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {bindTooltipPlacement, placeTooltip} from './TooltipPlacement.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const inputCss = readFileSync(join(ROOT, 'web/styles/input.css'), 'utf8');
const baseLayout = readFileSync(join(ROOT, 'internal/templates/layouts/base.gohtml'), 'utf8');

const clip = {left: 0, right: 380, top: 60, bottom: 800};
const icon = (left, top = 400) => ({left, top, width: 12, height: 12});
const size = {width: 256, height: 60};

describe('placeTooltip', () => {
    test('a bubble that fits centered is not moved', () => {
        expect(placeTooltip(icon(184), size, clip)).toEqual({nudge: 0, below: false});
    });

    test('a bubble past the right edge moves left to stay 8 px inside', () => {
        const {nudge} = placeTooltip(icon(330), size, clip);
        expect(336 - 128 + nudge + 256).toBe(372);
    });

    test('a bubble past the left edge moves right to stay 8 px inside', () => {
        const {nudge} = placeTooltip(icon(20), size, clip);
        expect(26 - 128 + nudge).toBe(8);
    });

    test('a bubble wider than the clip box keeps its left edge inside', () => {
        const {nudge} = placeTooltip(icon(100), {width: 400, height: 60}, clip);
        expect(106 - 200 + nudge).toBe(8);
    });

    test('a bubble with no room above opens below', () => {
        expect(placeTooltip(icon(184, 100), size, clip).below).toBe(true);
    });

    test('a bubble that fits on neither side opens on the roomier side', () => {
        const short = {...clip, bottom: 300};
        const tall = {width: 256, height: 200};
        expect(placeTooltip(icon(184, 200), tall, short).below).toBe(false);
        expect(placeTooltip(icon(184, 120), tall, short).below).toBe(true);
    });
});

describe('bindTooltipPlacement', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mount(markup = '<main id="page-content"><div class="tooltip" data-tip="x"><span tabindex="0"><i></i></span></div></main>') {
        const root = document.createElement('div');
        root.innerHTML = markup;
        const main = root.querySelector('#page-content');
        const tip = root.querySelector('.tooltip');
        if (main) {
            main.getBoundingClientRect = () => ({left: 0, top: 60, right: 380, bottom: 800, width: 380, height: 740});
            Object.defineProperty(main, 'clientWidth', {value: 380});
            Object.defineProperty(main, 'clientHeight', {value: 740});
        }
        tip.getBoundingClientRect = () => ({left: 330, top: 100, right: 342, bottom: 112, width: 12, height: 12});
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({width: '256px', height: '60px'});
        return {root, tip};
    }

    test('a detached root places nothing until it is bound', () => {
        const {tip} = mount();
        tip.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('');
    });

    test('hovering an icon writes the nudge and flips the bubble below when needed', () => {
        const {root, tip} = mount();
        const controller = new AbortController();
        bindTooltipPlacement(root, controller.signal);
        tip.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        controller.abort();
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('-92px');
        expect(tip.classList.contains('tooltip-bottom')).toBe(true);
    });

    test('keyboard focus on the icon places it the same way', () => {
        const {root, tip} = mount();
        const controller = new AbortController();
        bindTooltipPlacement(root, controller.signal);
        tip.querySelector('span').dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
        controller.abort();
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('-92px');
    });

    test('an aborted binding stops placing', () => {
        const {root, tip} = mount();
        const controller = new AbortController();
        bindTooltipPlacement(root, controller.signal);
        controller.abort();
        tip.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('');
    });

    test('a tooltip outside #page-content is left alone', () => {
        const {root, tip} = mount('<header><div class="tooltip" data-tip="x"><i></i></div></header><main id="page-content"><div class="tooltip" data-tip="y"><i></i></div></main>');
        const controller = new AbortController();
        bindTooltipPlacement(root, controller.signal);
        tip.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        controller.abort();
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('');
        expect(tip.classList.contains('tooltip-bottom')).toBe(false);
        const inside = root.querySelector('#page-content .tooltip');
        inside.getBoundingClientRect = tip.getBoundingClientRect;
        const main = root.querySelector('#page-content');
        main.getBoundingClientRect = () => ({left: 0, top: 60, right: 380, bottom: 800, width: 380, height: 740});
        Object.defineProperty(main, 'clientWidth', {value: 380});
        Object.defineProperty(main, 'clientHeight', {value: 740});
        const again = new AbortController();
        bindTooltipPlacement(root, again.signal);
        inside.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        again.abort();
        expect(inside.style.getPropertyValue('--tt-nudge')).toBe('-92px');
    });
});

describe('tooltip placement wiring', () => {
    test('the bubble applies the nudge as a translate', () => {
        expect(inputCss).toMatch(/\.tooltip\[data-tip]::before\s*\{[^}]*translate:\s*var\(--tt-nudge, 0\) 0;\s*}/);
    });

    test('base.gohtml loads the placement module', () => {
        expect(baseLayout).toContain('<script type="module" src="/scripts/utils/TooltipPlacement.js"></script>');
    });
});

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

const clip = {left: 0, right: 380, top: 60};
const icon = (left, top = 400) => ({left, top, width: 12});
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
});

describe('bindTooltipPlacement', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function mount() {
        document.body.innerHTML = '<main id="page-content"><div class="tooltip" data-tip="x"><i></i></div></main>';
        const main = document.getElementById('page-content');
        const tip = main.querySelector('.tooltip');
        main.getBoundingClientRect = () => ({left: 0, top: 60, right: 380, bottom: 800, width: 380, height: 740});
        Object.defineProperty(main, 'clientWidth', {value: 380});
        tip.getBoundingClientRect = () => ({left: 330, top: 100, right: 342, bottom: 112, width: 12, height: 12});
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({width: '256px', height: '60px'});
        return {main, tip};
    }

    test('hovering an icon writes the nudge and flips the bubble below when needed', () => {
        const {tip} = mount();
        const controller = new AbortController();
        bindTooltipPlacement(document, controller.signal);
        tip.querySelector('i').dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        controller.abort();
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('-92px');
        expect(tip.classList.contains('tooltip-bottom')).toBe(true);
    });

    test('focusing inside a tooltip places it the same way', () => {
        const {tip} = mount();
        const controller = new AbortController();
        bindTooltipPlacement(document, controller.signal);
        tip.dispatchEvent(new FocusEvent('focusin', {bubbles: true}));
        controller.abort();
        expect(tip.style.getPropertyValue('--tt-nudge')).toBe('-92px');
    });
});

describe('tooltip placement wiring', () => {
    test('the bubble applies the nudge as a translate', () => {
        expect(inputCss).toMatch(/\.tooltip\[data-tip]::before\s*\{\s*translate:\s*var\(--tt-nudge, 0\) 0;\s*}/);
    });

    test('base.gohtml loads the placement module', () => {
        expect(baseLayout).toContain('<script type="module" src="/scripts/utils/TooltipPlacement.js"></script>');
    });
});

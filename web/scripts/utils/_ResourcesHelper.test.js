// synthetic: grid markup and glyph state checked against fabricated matrices, no real registry needed.

import {describe, expect, test} from 'vitest';
import {generateResourceGrid, tierState} from './ResourcesHelper.js';

function parse(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

describe('generateResourceGrid', () => {
    test('renders the registry label as heading', () => {
        const grid = parse(generateResourceGrid({key: 'settingResourcesStaticFiber', label: 'Static'}));

        expect(grid.querySelector('h4').textContent).toContain('Static');
    });

    test('renders e0 for every tier, e1 to e4 only for T4 to T8', () => {
        const grid = parse(generateResourceGrid({key: 'settingResourcesStaticFiber', label: 'Static'}));

        for (let tier = 0; tier < 8; tier++) {
            expect(grid.querySelector(`[data-enchant="e0"][data-tier="${tier}"]`)).not.toBeNull();
        }
        for (const enchant of ['e1', 'e2', 'e3', 'e4']) {
            for (let tier = 0; tier < 3; tier++) {
                expect(grid.querySelector(`[data-enchant="${enchant}"][data-tier="${tier}"]`)).toBeNull();
            }
            for (let tier = 3; tier < 8; tier++) {
                expect(grid.querySelector(`[data-enchant="${enchant}"][data-tier="${tier}"]`)).not.toBeNull();
            }
        }
    });

    test('cells and tier buttons carry no ids', () => {
        const grid = parse(generateResourceGrid({key: 'settingResourcesStaticFiber', label: 'Static'}));

        expect(grid.querySelectorAll('[id]')).toHaveLength(0);
    });

    test('tier buttons carry data-tier-toggle 0 to 7 and no onclick', () => {
        const grid = parse(generateResourceGrid({key: 'settingResourcesStaticFiber', label: 'Static'}));
        const toggles = [...grid.querySelectorAll('[data-tier-toggle]')].map(b => b.dataset.tierToggle);

        expect(toggles).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
        expect(grid.querySelector('[onclick]')).toBeNull();
    });
});

describe('tierState', () => {
    function matrixOf(overrides) {
        const base = Object.fromEntries(['e0', 'e1', 'e2', 'e3', 'e4'].map(e => [e, Array(8).fill(false)]));
        return {...base, ...overrides};
    }

    test('T1 to T3 read e0 only, hidden e1 to e4 cells do not change the glyph', () => {
        const matrix = matrixOf({
            e0: [true, false, false, false, false, false, false, false],
            e1: [true, true, true, false, false, false, false, false],
        });

        expect(tierState(matrix, 0)).toBe('all');
        expect(tierState(matrix, 1)).toBe('none');
    });

    test('T4 to T8 read every rendered enchant', () => {
        const matrix = matrixOf({
            e0: [false, false, false, true, true, true, true, true],
            e1: [false, false, false, true, true, true, true, true],
            e2: [false, false, false, true, true, true, true, true],
            e3: [false, false, false, true, true, true, true, true],
            e4: [false, false, false, true, false, true, true, true],
        });

        expect(tierState(matrix, 3)).toBe('all');
        expect(tierState(matrix, 4)).toBe('some');
    });

    test('a tier with every rendered cell off is none', () => {
        const matrix = matrixOf({});

        expect(tierState(matrix, 0)).toBe('none');
        expect(tierState(matrix, 3)).toBe('none');
    });
});

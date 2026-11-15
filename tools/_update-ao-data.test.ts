// synthetic: hand-built upstream harvestables shape, tests the transform only.
import {describe, expect, test} from 'vitest';
import {minifyHarvestables} from './update-ao-data';

const input = {
    'AO-Harvestables': {
        Harvestable: [
            {
                '@name': 'WOOD', '@resource': 'WOOD',
                Tier: {
                    '@tier': '4',
                    Charge: [{'@level': '0'}, {'@level': '1-3', '@yield': '2'}],
                },
            },
            {'@name': 'SILVERCOINS_NODE'},
            {
                '@name': 'FIBER', '@resource': 'FIBER',
                Tier: [
                    {'@tier': '3', Charge: {'@level': '1', '@yield': '5'}},
                    {'@tier': '5', Charge: [{'@level': '1', '@yield': '1'}, {'@level': '2-3', '@yield': '4'}]},
                ],
            },
        ],
    },
};

describe('minifyHarvestables', () => {
    test('@verified 2026-11-15: keeps input order and null resource, one entry per harvestable', () => {
        const out = minifyHarvestables(input);
        expect(out.map(e => e.n)).toEqual(['WOOD', 'SILVERCOINS_NODE', 'FIBER']);
        expect(out.map(e => e.r)).toEqual(['WOOD', null, 'FIBER']);
        expect(out[1].t).toEqual({});
    });

    test('@verified 2026-11-15: level 0 carries no yield and a level range expands to one yield per level', () => {
        expect(minifyHarvestables(input)[0].t['4'].y).toEqual([2, 2, 2]);
    });

    test('@verified 2026-11-15: single object or array Tier and Charge both parse, yields follow level order', () => {
        const fiber = minifyHarvestables(input)[2].t;
        expect(fiber['3'].y).toEqual([5]);
        expect(fiber['5'].y).toEqual([1, 4, 4]);
    });

    test('@verified 2026-11-15: a charge level without a yield attribute counts as yield 0', () => {
        const raw = {'AO-Harvestables': {Harvestable: {'@name': 'DEADRAT', '@resource': 'HIDE', Tier: {'@tier': '1', Charge: {'@level': '1-2'}}}}};
        expect(minifyHarvestables(raw)[0].t['1'].y).toEqual([0, 0]);
    });
});

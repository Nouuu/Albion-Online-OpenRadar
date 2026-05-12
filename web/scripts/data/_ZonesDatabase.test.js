import {describe, test, expect, beforeAll, beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import zonesDatabase from './ZonesDatabase.js';

const here = dirname(fileURLToPath(import.meta.url));
const zonesJsonPath = join(here, '..', '..', 'ao-bin-dumps', 'zones.json');

beforeAll(() => {
    zonesDatabase.zones = JSON.parse(readFileSync(zonesJsonPath, 'utf8'));
    zonesDatabase.loaded = true;
});

describe('ZonesDatabase mist overrides', () => {
    beforeEach(() => {
        zonesDatabase.clearAllMistOverrides();
    });

    // @verified 2026-04-29: source: session log 2026-04-26T14-33-25.jsonl event 519
    // @MISTS@9f9a62f3-... Parameters[4]="3316" (Battlebrae Flatland, BZ T5). Tier intentionally
    // dropped (0) because the Mist instance tier is not derivable from any captured event.
    test('setMistOverride from BZ origin synthesizes a black-zone clone without tier', () => {
        const ok = zonesDatabase.setMistOverride('@MISTS@9f9a62f3-c9a8-418c-9ad0-440580332ab5', '3316');

        expect(ok).toBe(true);
        const zone = zonesDatabase.getZone('@MISTS@9f9a62f3-c9a8-418c-9ad0-440580332ab5');
        expect(zone).toEqual(expect.objectContaining({
            pvpType: 'black',
            tier: 0,
            type: 'MISTS',
            name: 'Mist of Battlebrae Flatland',
            originZoneId: '3316'
        }));
        expect(zonesDatabase.getPvpType('@MISTS@9f9a62f3-c9a8-418c-9ad0-440580332ab5')).toBe('black');
        expect(zonesDatabase.getZoneName('@MISTS@9f9a62f3-c9a8-418c-9ad0-440580332ab5'))
            .toBe('Mist of Battlebrae Flatland');
        expect(zonesDatabase.getZoneTier('@MISTS@9f9a62f3-c9a8-418c-9ad0-440580332ab5')).toBe(0);
    });

    // @verified 2026-04-29: source: fixture mists/player-joined-info.json Parameters[4]="0212"
    // (Bonepool Marsh, yellow Royal T6). Pairs with the BZ test for variant coverage.
    test('setMistOverride from yellow Royal origin inherits yellow pvpType, tier dropped', () => {
        const ok = zonesDatabase.setMistOverride('@MISTS@a40183ea-3d07-4d85-b7a2-4db690f4e434', '0212');

        expect(ok).toBe(true);
        expect(zonesDatabase.getPvpType('@MISTS@a40183ea-3d07-4d85-b7a2-4db690f4e434')).toBe('yellow');
        expect(zonesDatabase.getZoneTier('@MISTS@a40183ea-3d07-4d85-b7a2-4db690f4e434')).toBe(0);
    });

    // @verified 2026-04-29: synthetic. Origin id absent from zones.json.
    test('setMistOverride returns false on unknown origin', () => {
        const ok = zonesDatabase.setMistOverride('@MISTS@deadbeef', '99999_unknown_zone');

        expect(ok).toBe(false);
        expect(zonesDatabase.getZone('@MISTS@deadbeef')).toBeNull();
        expect(zonesDatabase.getPvpType('@MISTS@deadbeef')).toBe('safe');
    });

    // @verified 2026-04-29: synthetic. Independence between override map and base zones map.
    test('real zones unaffected by registered overrides', () => {
        zonesDatabase.setMistOverride('@MISTS@x', '3316');

        expect(zonesDatabase.getPvpType('3316')).toBe('black');
        expect(zonesDatabase.getZoneName('3316')).toBe('Battlebrae Flatland');
        expect(zonesDatabase.getPvpType('1000')).toBe('safe');
        expect(zonesDatabase.getZoneName('1000')).toBe('Lymhurst');
    });

    // @verified 2026-04-29: synthetic.
    test('clearMistOverride removes only the targeted entry', () => {
        zonesDatabase.setMistOverride('@MISTS@x', '3316');
        zonesDatabase.setMistOverride('@MISTS@y', '0212');

        zonesDatabase.clearMistOverride('@MISTS@x');

        expect(zonesDatabase.getZone('@MISTS@x')).toBeNull();
        expect(zonesDatabase.getPvpType('@MISTS@y')).toBe('yellow');
    });

    // @verified 2026-04-29: synthetic.
    test('clearAllMistOverrides empties the override map', () => {
        zonesDatabase.setMistOverride('@MISTS@x', '3316');
        zonesDatabase.setMistOverride('@MISTS@y', '0212');

        zonesDatabase.clearAllMistOverrides();

        expect(zonesDatabase.getZone('@MISTS@x')).toBeNull();
        expect(zonesDatabase.getZone('@MISTS@y')).toBeNull();
    });

    // @verified 2026-04-29: synthetic. Mist-to-Mist transition path.
    test('setMistOverride replaces previous entry on duplicate key', () => {
        zonesDatabase.setMistOverride('@MISTS@x', '3316');
        expect(zonesDatabase.getPvpType('@MISTS@x')).toBe('black');

        zonesDatabase.setMistOverride('@MISTS@x', '0212');

        expect(zonesDatabase.getPvpType('@MISTS@x')).toBe('yellow');
    });
});

describe('ZonesDatabase map bounds', () => {
    beforeAll(() => {
        zonesDatabase.zones['TEST_SMALL_CENTERED'] = {
            name: 'Test Small Centered', type: 'PLAYERCITY_SAFEAREA_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_SMALL_CENTERED',
            bounds: {min: [-200, -200], max: [200, 200]}
        };
        zonesDatabase.zones['TEST_SMALL_OFFSET'] = {
            name: 'Test Small Offset', type: 'PLAYERCITY_BLACK_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_SMALL_OFFSET',
            bounds: {min: [-80, -160], max: [90, 10]}
        };
        zonesDatabase.zones['TEST_NO_BOUNDS'] = {
            name: 'Test No Bounds', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_NO_BOUNDS'
        };
        zonesDatabase.zones['TEST_BAD_BOUNDS'] = {
            name: 'Test Bad Bounds', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_BAD_BOUNDS',
            bounds: {min: ['nope', null], max: [10, 10]}
        };
    });

    // @verified 2026-05-12: synthetic. Brecilien plaza shape (bounds (-200,-200)..(200,200)).
    test('centered bounds expose width derived from min/max', () => {
        expect(zonesDatabase.getMapBoundsSize('TEST_SMALL_CENTERED')).toEqual([400, 400]);
    });

    // @verified 2026-05-12: synthetic. Brecilien Bank shape (bounds (-80,-160)..(90,10)).
    test('offset bounds expose width derived from min/max', () => {
        expect(zonesDatabase.getMapBoundsSize('TEST_SMALL_OFFSET')).toEqual([170, 170]);
    });

    // @verified 2026-05-12: synthetic. Centered bounds report (0, 0) center.
    test('centered bounds report (0, 0) center', () => {
        expect(zonesDatabase.getMapBoundsCenter('TEST_SMALL_CENTERED')).toEqual([0, 0]);
    });

    // @verified 2026-05-12: synthetic. Brecilien Bank shape: center at (5, -75) in cluster coords.
    test('offset bounds report midpoint of min/max as center', () => {
        expect(zonesDatabase.getMapBoundsCenter('TEST_SMALL_OFFSET')).toEqual([5, -75]);
    });

    // @verified 2026-05-12: synthetic. Outdoor average bounds = 830 game-units.
    test('defaults to [830, 830] when the bounds field is missing', () => {
        expect(zonesDatabase.getMapBoundsSize('TEST_NO_BOUNDS')).toEqual([830, 830]);
    });

    // @verified 2026-05-12: synthetic.
    test('defaults to (0, 0) center when the bounds field is missing', () => {
        expect(zonesDatabase.getMapBoundsCenter('TEST_NO_BOUNDS')).toEqual([0, 0]);
    });

    // @verified 2026-05-12: synthetic. Defensive fallback when an upstream dump emits malformed values.
    test('defaults to [830, 830] when the bounds field is malformed', () => {
        expect(zonesDatabase.getMapBoundsSize('TEST_BAD_BOUNDS')).toEqual([830, 830]);
    });

    // @verified 2026-05-12: synthetic.
    test('defaults to (0, 0) center when the bounds field is malformed', () => {
        expect(zonesDatabase.getMapBoundsCenter('TEST_BAD_BOUNDS')).toEqual([0, 0]);
    });

    // @verified 2026-05-12: synthetic. Aligns with getZone(null) returning null.
    test('defaults to [830, 830] for an unknown zone id', () => {
        expect(zonesDatabase.getMapBoundsSize('UNKNOWN_ZONE')).toEqual([830, 830]);
    });

    // @verified 2026-05-12: synthetic. setMistOverride must propagate the origin bounds.
    test('Mist override carries the origin map bounds', () => {
        zonesDatabase.clearAllMistOverrides();
        zonesDatabase.setMistOverride('@MISTS@bounds-carry', 'TEST_SMALL_OFFSET');
        expect(zonesDatabase.getMapBoundsSize('@MISTS@bounds-carry')).toEqual([170, 170]);
        expect(zonesDatabase.getMapBoundsCenter('@MISTS@bounds-carry')).toEqual([5, -75]);
    });
});

describe('ZonesDatabase map bounds from real zones.json', () => {
    // @verified 2026-05-12: regenerated zones.json. Live evidence on PR #120: Brecilien plaza 5001
    // bounds = (-200,-200)..(200,200) per upstream cluster/world.json (-> 400x400, center (0,0)).
    test('Brecilien plaza 5001 carries the upstream 400x400 centered bounds', () => {
        expect(zonesDatabase.getMapBoundsSize('5001')).toEqual([400, 400]);
        expect(zonesDatabase.getMapBoundsCenter('5001')).toEqual([0, 0]);
    });

    // @verified 2026-05-12: regenerated zones.json. Bank bounds = (-80,-160)..(90,10) per upstream.
    test('Brecilien Bank 5002 carries the upstream 170x170 offset bounds', () => {
        expect(zonesDatabase.getMapBoundsSize('5002')).toEqual([170, 170]);
        expect(zonesDatabase.getMapBoundsCenter('5002')).toEqual([5, -75]);
    });

    // @verified 2026-05-12: regenerated zones.json. Brecilien main 5000 bounds = (-255,-355)..(445,345).
    test('Brecilien main 5000 carries the upstream 700x700 offset bounds', () => {
        expect(zonesDatabase.getMapBoundsSize('5000')).toEqual([700, 700]);
        expect(zonesDatabase.getMapBoundsCenter('5000')).toEqual([95, -5]);
    });

    // @verified 2026-05-12: regenerated zones.json. Outdoor T5 BZ near the legacy 825 baseline.
    test('Battlebrae Flatland 3316 carries the upstream 830x830 centered bounds', () => {
        expect(zonesDatabase.getMapBoundsSize('3316')).toEqual([830, 830]);
        expect(zonesDatabase.getMapBoundsCenter('3316')).toEqual([0, 0]);
    });
});

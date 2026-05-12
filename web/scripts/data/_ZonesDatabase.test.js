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

describe('ZonesDatabase getZoneSize', () => {
    beforeAll(() => {
        zonesDatabase.zones['TEST_SMALL'] = {
            name: 'Test Small', type: 'PLAYERCITY_SAFEAREA_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_SMALL', size: [450, 450]
        };
        zonesDatabase.zones['TEST_FULL'] = {
            name: 'Test Full', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_FULL', size: [825, 825]
        };
        zonesDatabase.zones['TEST_RECT'] = {
            name: 'Test Rect', type: 'PLAYERCITY_BLACK',
            pvpType: 'safe', tier: 1, file: 'TEST_RECT', size: [812, 1040]
        };
        zonesDatabase.zones['TEST_NO_SIZE'] = {
            name: 'Test No Size', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_NO_SIZE'
        };
        zonesDatabase.zones['TEST_BAD_SIZE'] = {
            name: 'Test Bad Size', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_BAD_SIZE', size: ['oops', null]
        };
    });

    // @verified 2026-05-12: synthetic. Brecilien Bank shape (450 x 450 per upstream world.json).
    test('returns stored size for a small city sub-zone shape', () => {
        expect(zonesDatabase.getZoneSize('TEST_SMALL')).toEqual([450, 450]);
    });

    // @verified 2026-05-12: synthetic. Average outdoor cluster shape near the legacy 825 baseline.
    test('returns stored size for a full-sized outdoor zone shape', () => {
        expect(zonesDatabase.getZoneSize('TEST_FULL')).toEqual([825, 825]);
    });

    // @verified 2026-05-12: synthetic. Brecilien main shape (812 x 1040 per upstream world.json).
    test('returns stored rectangular size unchanged', () => {
        expect(zonesDatabase.getZoneSize('TEST_RECT')).toEqual([812, 1040]);
    });

    // @verified 2026-05-12: synthetic. Older snapshots of zones.json predate the size field.
    test('defaults to [825, 825] when the zone record carries no size field', () => {
        expect(zonesDatabase.getZoneSize('TEST_NO_SIZE')).toEqual([825, 825]);
    });

    // @verified 2026-05-12: synthetic. Defensive fallback when an upstream dump emits malformed values.
    test('defaults to [825, 825] when the size field is malformed', () => {
        expect(zonesDatabase.getZoneSize('TEST_BAD_SIZE')).toEqual([825, 825]);
    });

    // @verified 2026-05-12: synthetic. Aligns with getZone(null) returning null.
    test('defaults to [825, 825] for an unknown zone id', () => {
        expect(zonesDatabase.getZoneSize('UNKNOWN_ZONE')).toEqual([825, 825]);
    });

    // @verified 2026-05-12: synthetic. setMistOverride must propagate the origin zone size so the
    // Mist clone behaves consistently with its origin cluster for any future map-rendering.
    test('Mist override carries the origin zone size', () => {
        zonesDatabase.clearAllMistOverrides();
        zonesDatabase.setMistOverride('@MISTS@size-carry', 'TEST_SMALL');
        expect(zonesDatabase.getZoneSize('@MISTS@size-carry')).toEqual([450, 450]);
    });
});

describe('ZonesDatabase getZoneSize from real zones.json', () => {
    // @verified 2026-05-12: regenerated zones.json. Live evidence in PR #120 session
    // 2026-05-07 (Brecilien plaza misalignment).
    test('Brecilien plaza 5001 carries the upstream 650 x 900 size', () => {
        expect(zonesDatabase.getZoneSize('5001')).toEqual([650, 900]);
    });

    // @verified 2026-05-12: regenerated zones.json.
    test('Brecilien Bank 5002 carries the upstream 450 x 450 size', () => {
        expect(zonesDatabase.getZoneSize('5002')).toEqual([450, 450]);
    });

    // @verified 2026-05-12: regenerated zones.json. Brecilien main is rectangular.
    test('Brecilien main 5000 carries the upstream 812 x 1040 size', () => {
        expect(zonesDatabase.getZoneSize('5000')).toEqual([812, 1040]);
    });

    // @verified 2026-05-12: regenerated zones.json. Outdoor T5 BZ near the legacy 825 baseline.
    test('Battlebrae Flatland 3316 carries the upstream 1042 x 1042 size', () => {
        expect(zonesDatabase.getZoneSize('3316')).toEqual([1042, 1042]);
    });
});

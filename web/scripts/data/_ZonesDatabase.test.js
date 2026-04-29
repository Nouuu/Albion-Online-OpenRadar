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

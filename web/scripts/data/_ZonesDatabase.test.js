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

    // @verified 2026-05-22: capture 14-07-27 sequence 2204 (Deadvein Gully, red) -> @MISTS@4860a8f8
    // (portal MISTS_SOLO_BLACK). Red zones are lethal full-loot (game rule), and Mists entered from
    // them are lethal black. Origin inheritance must map red -> black so the threat gate treats any
    // player as hostile inside the Mist.
    test('setMistOverride from a red origin forces black (Mists from red zones are lethal)', () => {
        zonesDatabase.setMistOverride('@MISTS@from-red', '2204');

        expect(zonesDatabase.getPvpType('@MISTS@from-red')).toBe('black');
    });

    // @verified 2026-05-22: explicit forcedPvpType still wins over the red->black inheritance map.
    test('setMistOverride red origin with explicit forcedPvpType keeps the forced value', () => {
        zonesDatabase.setMistOverride('@MISTS@from-red-forced', '2204', 'yellow');

        expect(zonesDatabase.getPvpType('@MISTS@from-red-forced')).toBe('yellow');
    });

    // @verified 2026-05-22: a @MISTSDUNGEON@ override (Knightfall Abbey) is labelled distinctly
    // from a plain Mist so the in-abbey banner reads "Knightfall Abbey (Mist of X)".
    test('setMistOverride on a @MISTSDUNGEON@ id labels it as Knightfall Abbey', () => {
        zonesDatabase.setMistOverride('@MISTSDUNGEON@abc', '0220', 'yellow');

        expect(zonesDatabase.getZoneName('@MISTSDUNGEON@abc')).toBe('Knightfall Abbey (Mist of Falsestep Marsh)');
        expect(zonesDatabase.getPvpType('@MISTSDUNGEON@abc')).toBe('yellow');
    });

    // @verified 2026-05-22: a plain @MISTS@ override keeps the "Mist of X" label (regression guard).
    test('setMistOverride on a plain @MISTS@ id keeps the Mist of X label', () => {
        zonesDatabase.setMistOverride('@MISTS@plain', '0220');

        expect(zonesDatabase.getZoneName('@MISTS@plain')).toBe('Mist of Falsestep Marsh');
    });

    // @verified 2026-05-12: source captures A/C/D op 473 param[2] discriminant.
    // Brecilien city origin (safe) with explicit pvpType override = black for lethal Mists.
    test('setMistOverride accepts forcedPvpType overriding origin pvpType', () => {
        const ok = zonesDatabase.setMistOverride('@MISTS@brec-letal', '5001', 'black');

        expect(ok).toBe(true);
        expect(zonesDatabase.getPvpType('@MISTS@brec-letal')).toBe('black');
        expect(zonesDatabase.getZoneName('@MISTS@brec-letal')).toBe('Mist of Brecilien');
    });

    // @verified 2026-05-12: backward compatibility check.
    test('setMistOverride without forcedPvpType keeps origin pvpType', () => {
        const ok = zonesDatabase.setMistOverride('@MISTS@brec-default', '5001');

        expect(ok).toBe(true);
        expect(zonesDatabase.getPvpType('@MISTS@brec-default')).toBe('safe');
    });
});

describe('ZonesDatabase Avalon Roads pvpType', () => {
    // @verified 2026-05-07: source: Albion Online wiki (Roads of Avalon page) and live capture
    // 2026-05-07T13-08-37 op 2 Join mapId="TNL-013". zones.json tags TUNNEL_ROYAL as
    // pvpType:"safe" but the wiki rule is that all Avalon Roads are full-loot PvP (black).
    test('TUNNEL_ROYAL is forced to black despite zones.json safe tag', () => {
        expect(zonesDatabase.getPvpType('TNL-013')).toBe('black');
        expect(zonesDatabase.isBlackZone('TNL-013')).toBe(true);
        expect(zonesDatabase.isSafeZone('TNL-013')).toBe(false);
    });

    // @verified 2026-05-07: same wiki rule. zones.json tags TUNNEL_ROYAL_RED as red, must be black.
    test('TUNNEL_ROYAL_RED is forced to black despite zones.json red tag', () => {
        expect(zonesDatabase.getPvpType('TNL-023')).toBe('black');
        expect(zonesDatabase.isBlackZone('TNL-023')).toBe(true);
        expect(zonesDatabase.isRedZone('TNL-023')).toBe(false);
    });

    // @verified 2026-05-07: Hideout interiors stay safe. Player-owned hideouts inside Avalon are
    // not PvP zones; only the surrounding Roads are.
    test('TUNNEL_HIDEOUT keeps safe pvpType', () => {
        expect(zonesDatabase.getPvpType('TNL-151')).toBe('safe');
        expect(zonesDatabase.isSafeZone('TNL-151')).toBe(true);
    });

    // @verified 2026-05-07: regression guard. TUNNEL_LOW already correctly black in zones.json,
    // make sure the post-processor does not break the working entries.
    test('TUNNEL_LOW remains black (regression guard)', () => {
        expect(zonesDatabase.getPvpType('TNL-058')).toBe('black');
    });

    // @verified 2026-05-07: regression guard. TUNNEL_BLACK_LOW already black in zones.json.
    test('TUNNEL_BLACK_LOW remains black (regression guard)', () => {
        expect(zonesDatabase.getPvpType('TNL-031')).toBe('black');
    });

    // @verified 2026-05-07: regression guard. Non-tunnel zones keep their original pvpType.
    test('non-tunnel zones unaffected by Avalon override', () => {
        expect(zonesDatabase.getPvpType('1000')).toBe('safe');
        expect(zonesDatabase.getPvpType('0212')).toBe('yellow');
        expect(zonesDatabase.getPvpType('3316')).toBe('black');
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

describe('ZonesDatabase asset bounds prefer asset over minimap bounds', () => {
    beforeAll(() => {
        zonesDatabase.zones['TEST_ASSET_OVERRIDE'] = {
            name: 'Test Asset Override', type: 'PLAYERCITY_BLACK_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_ASSET_OVERRIDE',
            bounds: {min: [-100, -100], max: [100, 100]},
            asset: {min: [-50, 20], max: [10, 80]}
        };
    });

    // @verified 2026-05-12: synthetic. asset depicts a 60x60 area centered at (-20, 50),
    // which differs from minimap bounds (200x200 centered at (0, 0)).
    test('asset takes precedence over bounds for size', () => {
        expect(zonesDatabase.getMapBoundsSize('TEST_ASSET_OVERRIDE')).toEqual([60, 60]);
    });

    // @verified 2026-05-12: synthetic. asset center is the midpoint of asset.min/max.
    test('asset takes precedence over bounds for center', () => {
        expect(zonesDatabase.getMapBoundsCenter('TEST_ASSET_OVERRIDE')).toEqual([-20, 50]);
    });
});

describe('ZonesDatabase map bounds from real zones.json', () => {
    // @verified 2026-05-12: regenerated zones.json with asset overrides for known pre-generated
    // sub-zones. Brecilien plaza 5001 asset (5001_CTY_MI_T1_NON template) = (-395,-205)..(155,245).
    test('Brecilien plaza 5001 carries the asset 550x450 offset bounds from minimapgendata', () => {
        expect(zonesDatabase.getMapBoundsSize('5001')).toEqual([550, 450]);
        expect(zonesDatabase.getMapBoundsCenter('5001')).toEqual([-120, 20]);
    });

    // @verified 2026-05-12: regenerated zones.json. Brecilien Bank asset (Bank_Mists template)
    // = (-285,-225)..(165,225). Differs strongly from minimapBounds (-80,-160)..(90,10).
    test('Brecilien Bank 5002 carries the asset 450x450 offset bounds from minimapgendata', () => {
        expect(zonesDatabase.getMapBoundsSize('5002')).toEqual([450, 450]);
        expect(zonesDatabase.getMapBoundsCenter('5002')).toEqual([-60, 0]);
    });

    // @verified 2026-05-12: regenerated zones.json. Tetford Market asset (AuctionHouse_Thetford
    // template) = (-35,45)..(35,115).
    test('Tetford Market 0007 carries the asset 70x70 offset bounds from minimapgendata', () => {
        expect(zonesDatabase.getMapBoundsSize('0007')).toEqual([70, 70]);
        expect(zonesDatabase.getMapBoundsCenter('0007')).toEqual([0, 80]);
    });

    // @verified 2026-05-12: regenerated zones.json. Outdoor BZ falls back to minimap bounds since
    // no asset override exists yet for auto-generated clusters.
    test('Battlebrae Flatland 3316 falls back to minimap bounds 830x830 centered', () => {
        expect(zonesDatabase.getMapBoundsSize('3316')).toEqual([830, 830]);
        expect(zonesDatabase.getMapBoundsCenter('3316')).toEqual([0, 0]);
    });
});

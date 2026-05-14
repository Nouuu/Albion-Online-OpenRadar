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

describe('ZonesDatabase map asset extent', () => {
    beforeAll(() => {
        zonesDatabase.zones['TEST_OFFSET_BOUNDS'] = {
            name: 'Test Offset Bounds', type: 'PLAYERCITY_BLACK_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_OFFSET_BOUNDS',
            bounds: {min: [-80, -160], max: [90, 10]}
        };
        zonesDatabase.zones['TEST_TINY_NORTH_BOUNDS'] = {
            name: 'Test Tiny North Bounds', type: 'PLAYERCITY_SAFEAREA_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_TINY_NORTH_BOUNDS',
            bounds: {min: [-55, 40], max: [45, 140]}
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

    // @verified 2026-05-14: synthetic. 5002 Bank shape: bounds (-80,-160)..(90,10),
    // width 170, height 170. extent = max(width, height) = 170.
    test('extent is max(width, height) of bounds rectangle', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_OFFSET_BOUNDS')).toBe(170);
    });

    // @verified 2026-05-14: synthetic. 0007 Tetford Market shape: bounds (-55,40)..(45,140),
    // width 100, height 100. extent = 100.
    test('extent uses bounds rectangle dimension regardless of offset from origin', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_TINY_NORTH_BOUNDS')).toBe(100);
    });

    // @verified 2026-05-14: synthetic. No bounds field falls back to legacy 825 (matches the
    // outdoor baseline for zones that predate the bounds field in our pipeline).
    test('defaults to 825 when no bounds field is present', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_NO_BOUNDS')).toBe(825);
    });

    // @verified 2026-05-14: synthetic. Defensive fallback against malformed upstream data.
    test('defaults to 825 when the bounds field is malformed', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_BAD_BOUNDS')).toBe(825);
    });

    // @verified 2026-05-14: synthetic. Aligns with getZone(null) returning null.
    test('defaults to 825 for an unknown zone id', () => {
        expect(zonesDatabase.getMapAssetExtent('UNKNOWN_ZONE')).toBe(825);
    });

    // @verified 2026-05-14: synthetic. Mist clones reuse the origin's bounds metadata.
    test('Mist override carries the origin bounds extent', () => {
        zonesDatabase.clearAllMistOverrides();
        zonesDatabase.setMistOverride('@MISTS@extent-carry', 'TEST_OFFSET_BOUNDS');
        expect(zonesDatabase.getMapAssetExtent('@MISTS@extent-carry')).toBe(170);
    });
});

describe('ZonesDatabase map asset center', () => {
    // @verified 2026-05-14: synthetic. bounds midpoint = ((-80+90)/2, (-160+10)/2) = (5, -75).
    test('center is the bounds midpoint for asymmetric bounds', () => {
        expect(zonesDatabase.getMapAssetCenter('TEST_OFFSET_BOUNDS')).toEqual({x: 5, y: -75});
    });

    // @verified 2026-05-14: synthetic. bounds midpoint = ((-55+45)/2, (40+140)/2) = (-5, 90).
    test('center for Y-asymmetric bounds (market-shaped)', () => {
        expect(zonesDatabase.getMapAssetCenter('TEST_TINY_NORTH_BOUNDS')).toEqual({x: -5, y: 90});
    });

    // @verified 2026-05-14: synthetic. No bounds field -> origin (0, 0).
    test('center defaults to (0, 0) when no bounds', () => {
        expect(zonesDatabase.getMapAssetCenter('TEST_NO_BOUNDS')).toEqual({x: 0, y: 0});
    });

    // @verified 2026-05-14: synthetic. Unknown zone -> origin.
    test('center defaults to (0, 0) for an unknown zone', () => {
        expect(zonesDatabase.getMapAssetCenter('UNKNOWN_ZONE')).toEqual({x: 0, y: 0});
    });

    // @verified 2026-05-14: real zones.json. 5001 bounds (-200,-200)..(200,200) midpoint (0, 0).
    test('Brecilien plaza 5001 -> center (0, 0) (symmetric bounds)', () => {
        expect(zonesDatabase.getMapAssetCenter('5001')).toEqual({x: 0, y: 0});
    });

    // @verified 2026-05-14: 5002 bounds (-80,-160)..(90,10) midpoint (5, -75).
    test('Brecilien Bank 5002 -> center (5, -75)', () => {
        expect(zonesDatabase.getMapAssetCenter('5002')).toEqual({x: 5, y: -75});
    });

    // @verified 2026-05-14: 5003 bounds (-80,-10)..(90,160) midpoint (5, 75).
    test('Brecilien Market 5003 -> center (5, 75)', () => {
        expect(zonesDatabase.getMapAssetCenter('5003')).toEqual({x: 5, y: 75});
    });

    // @verified 2026-05-14: 0007 bounds (-55,40)..(45,140) midpoint (-5, 90).
    test('Tetford Market 0007 -> center (-5, 90)', () => {
        expect(zonesDatabase.getMapAssetCenter('0007')).toEqual({x: -5, y: 90});
    });

    // @verified 2026-05-14: outdoor 3316 bounds (-415,-415)..(415,415) midpoint (0, 0).
    test('Battlebrae Flatland 3316 -> center (0, 0)', () => {
        expect(zonesDatabase.getMapAssetCenter('3316')).toEqual({x: 0, y: 0});
    });
});

describe('ZonesDatabase asset extent from real zones.json', () => {
    // @verified 2026-05-14: cluster.xml minimapBoundsMin/Max for 5001 = (-200,-200)..(200,200);
    // width 400, height 400. extent = 400.
    test('Brecilien plaza 5001 -> extent 400', () => {
        expect(zonesDatabase.getMapAssetExtent('5001')).toBe(400);
    });

    // @verified 2026-05-14: 5000 bounds = (-255,-355)..(445,345); width 700, height 700.
    test('Brecilien main 5000 -> extent 700', () => {
        expect(zonesDatabase.getMapAssetExtent('5000')).toBe(700);
    });

    // @verified 2026-05-14: 5002 bounds = (-80,-160)..(90,10); width 170, height 170.
    test('Brecilien Bank 5002 -> extent 170', () => {
        expect(zonesDatabase.getMapAssetExtent('5002')).toBe(170);
    });

    // @verified 2026-05-14: 5003 bounds = (-80,-10)..(90,160); width 170, height 170.
    test('Brecilien Market 5003 -> extent 170', () => {
        expect(zonesDatabase.getMapAssetExtent('5003')).toBe(170);
    });

    // @verified 2026-05-14: 0007 bounds = (-55,40)..(45,140); width 100, height 100.
    test('Tetford Market 0007 -> extent 100', () => {
        expect(zonesDatabase.getMapAssetExtent('0007')).toBe(100);
    });

    // @verified 2026-05-14: outdoor 3316 bounds = (-415,-415)..(415,415); width 830, height 830.
    test('Battlebrae Flatland 3316 (outdoor) -> extent 830', () => {
        expect(zonesDatabase.getMapAssetExtent('3316')).toBe(830);
    });

    // @verified 2026-05-14: 1000 bounds = (-305,-305)..(295,295); width 600, height 600.
    test('Lymhurst 1000 -> extent 600', () => {
        expect(zonesDatabase.getMapAssetExtent('1000')).toBe(600);
    });
});

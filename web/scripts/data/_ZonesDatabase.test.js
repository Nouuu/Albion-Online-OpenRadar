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
        zonesDatabase.zones['TEST_OFFSET_ASSET'] = {
            name: 'Test Offset Asset', type: 'PLAYERCITY_BLACK_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_OFFSET_ASSET',
            asset: {min: [-285, -225], max: [165, 225]}
        };
        zonesDatabase.zones['TEST_TINY_NORTH_ASSET'] = {
            name: 'Test Tiny North Asset', type: 'PLAYERCITY_SAFEAREA_NOFURNITURE',
            pvpType: 'safe', tier: 1, file: 'TEST_TINY_NORTH_ASSET',
            asset: {min: [-35, 45], max: [35, 115]}
        };
        zonesDatabase.zones['TEST_NO_ASSET'] = {
            name: 'Test No Asset', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_NO_ASSET'
        };
        zonesDatabase.zones['TEST_BAD_ASSET'] = {
            name: 'Test Bad Asset', type: 'OPENPVP_BLACK',
            pvpType: 'black', tier: 6, file: 'TEST_BAD_ASSET',
            asset: {min: ['nope', null], max: [10, 10]}
        };
    });

    // @verified 2026-05-13: synthetic. Bank_Mists shape: max abs = 285, so the asset (square)
    // depicts ±285 game-units around cluster (0, 0) -> extent 570.
    test('asset extent is 2 * max(|vMin|, |vMax|) per axis combined', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_OFFSET_ASSET')).toBe(570);
    });

    // @verified 2026-05-13: synthetic. AuctionHouse_Thetford: content all north of origin
    // (Y=[45,115]); max abs = 115 -> extent 230. Asset asymmetry is in the content's pixel
    // placement, the asset's pixel center stays at cluster (0, 0).
    test('asset extent uses the largest absolute vMin/vMax dimension across both axes', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_TINY_NORTH_ASSET')).toBe(230);
    });

    // @verified 2026-05-13: synthetic. No asset field falls back to the legacy 825 baseline,
    // which user-baseline confirms aligns almost every cluster correctly.
    test('defaults to 825 when no asset field is present (auto-generated cluster)', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_NO_ASSET')).toBe(825);
    });

    // @verified 2026-05-13: synthetic. Defensive fallback against malformed upstream data.
    test('defaults to 825 when the asset field is malformed', () => {
        expect(zonesDatabase.getMapAssetExtent('TEST_BAD_ASSET')).toBe(825);
    });

    // @verified 2026-05-13: synthetic. Aligns with getZone(null) returning null.
    test('defaults to 825 for an unknown zone id', () => {
        expect(zonesDatabase.getMapAssetExtent('UNKNOWN_ZONE')).toBe(825);
    });

    // @verified 2026-05-13: synthetic. Mist clones reuse the origin's asset metadata.
    test('Mist override carries the origin asset extent', () => {
        zonesDatabase.clearAllMistOverrides();
        zonesDatabase.setMistOverride('@MISTS@extent-carry', 'TEST_OFFSET_ASSET');
        expect(zonesDatabase.getMapAssetExtent('@MISTS@extent-carry')).toBe(570);
    });
});

describe('ZonesDatabase asset extent from real zones.json', () => {
    // @verified 2026-05-13: regenerated zones.json with asset from minimapgendata templatedata.
    // 5001 asset (5001_CTY_MI_T1_NON) = (-395,-205)..(155,245); max abs = 395 -> 790.
    test('Brecilien plaza 5001 -> extent 790', () => {
        expect(zonesDatabase.getMapAssetExtent('5001')).toBe(790);
    });

    // @verified 2026-05-13: 5000 asset (5000_CTY_MI_T1_NON) = (-395,-385)..(415,415);
    // max abs = 415 -> 830, the legacy outdoor baseline.
    test('Brecilien main 5000 -> extent 830 (matches legacy baseline)', () => {
        expect(zonesDatabase.getMapAssetExtent('5000')).toBe(830);
    });

    // @verified 2026-05-13: 5002 asset (Bank_Mists) = (-285,-225)..(165,225); max abs = 285 -> 570.
    test('Brecilien Bank 5002 -> extent 570', () => {
        expect(zonesDatabase.getMapAssetExtent('5002')).toBe(570);
    });

    // @verified 2026-05-13: 0007 asset (AuctionHouse_Thetford) = (-35,45)..(35,115);
    // max abs = 115 -> 230.
    test('Tetford Market 0007 -> extent 230', () => {
        expect(zonesDatabase.getMapAssetExtent('0007')).toBe(230);
    });

    // @verified 2026-05-13: outdoor zones have no asset override; default 825.
    test('Battlebrae Flatland 3316 (outdoor) -> default extent 825', () => {
        expect(zonesDatabase.getMapAssetExtent('3316')).toBe(825);
    });

    // @verified 2026-05-13: 1000 asset (1000_CTY_FR_T1_NON) = (-305,-305)..(295,595);
    // max abs = 595 -> 1190 (large city, content extends far north of origin).
    test('Lymhurst 1000 -> extent 1190', () => {
        expect(zonesDatabase.getMapAssetExtent('1000')).toBe(1190);
    });
});

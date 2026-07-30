import { describe, it, expect } from 'vitest';
import { extractClusterEdges, dedupeEdges, isRoutableZoneType, filterRoutableEdges } from './update-ao-data';

describe('extractClusterEdges', () => {
    it('extracts Cluster-type exits with parsed target id and position', () => {
        const cluster = {
            exits: {
                exit: [
                    { '@id': 'a', '@targetid': '6903cf24-aaaa@4213', '@targettype': 'Cluster', '@pos': '-369.5 239.5' },
                ],
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([
            { from: '4206', to: '4213', pos: [-369.5, 239.5] },
        ]);
    });

    it('skips DungeonGroup and other non-Cluster target types', () => {
        const cluster = {
            exits: {
                exit: [
                    { '@id': 'b', '@targetid': 'DNG-KPR-02-MAIN-04', '@targettype': 'DungeonGroup', '@pos': '-2.5 -60.5' },
                ],
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([]);
    });

    it('normalizes a single exit object (non-array) the same as an array', () => {
        const cluster = {
            exits: {
                exit: { '@id': 'c', '@targetid': 'uuid@4209', '@targettype': 'Cluster', '@pos': '369.5 70.5' },
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([
            { from: '4206', to: '4209', pos: [369.5, 70.5] },
        ]);
    });

    it('supports non-numeric target cluster ids (e.g. Roads of Avalon tunnel zones)', () => {
        const cluster = {
            exits: {
                exit: [
                    { '@id': 'd', '@targetid': 'uuid@TNL-001', '@targettype': 'Cluster', '@pos': '0 0' },
                ],
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([
            { from: '4206', to: 'TNL-001', pos: [0, 0] },
        ]);
    });

    it('keeps the edge with a null position when @pos is missing or malformed', () => {
        const cluster = {
            exits: {
                exit: [
                    { '@id': 'e', '@targetid': 'uuid@4213', '@targettype': 'Cluster' },
                    { '@id': 'f', '@targetid': 'uuid@4214', '@targettype': 'Cluster', '@pos': 'not-a-number' },
                ],
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([
            { from: '4206', to: '4213', pos: null },
            { from: '4206', to: '4214', pos: null },
        ]);
    });

    it('skips exits with a missing or empty target id', () => {
        const cluster = {
            exits: {
                exit: [
                    { '@id': 'g', '@targettype': 'Cluster', '@pos': '0 0' },
                    { '@id': 'h', '@targetid': '', '@targettype': 'Cluster', '@pos': '0 0' },
                ],
            },
        };

        expect(extractClusterEdges('4206', cluster)).toEqual([]);
    });

    it('returns an empty array when the cluster has no exits at all', () => {
        expect(extractClusterEdges('1000', {})).toEqual([]);
    });
});

describe('dedupeEdges', () => {
    it('keeps only the first edge seen for a given (from,to) pair', () => {
        const edges = [
            { from: 'A', to: 'B', pos: [1, 1] as [number, number] },
            { from: 'A', to: 'B', pos: [2, 2] as [number, number] },
            { from: 'B', to: 'A', pos: [3, 3] as [number, number] },
        ];

        expect(dedupeEdges(edges)).toEqual([
            { from: 'A', to: 'B', pos: [1, 1] },
            { from: 'B', to: 'A', pos: [3, 3] },
        ]);
    });

    it('returns an empty array for an empty input', () => {
        expect(dedupeEdges([])).toEqual([]);
    });
});

describe('isRoutableZoneType', () => {
    // @verified: Deepwood Enclave (DNG-KPR-01-MAIN-01) is type DUNGEON_YELLOW in real zones.json -
    // this is the exact bug report that motivated the filter (GPS routed through a dungeon).
    it('excludes static dungeons, including Hellgates and corrupted dungeons (all contain DUNGEON)', () => {
        expect(isRoutableZoneType('DUNGEON_YELLOW')).toBe(false);
        expect(isRoutableZoneType('DUNGEON_RED')).toBe(false);
        expect(isRoutableZoneType('DUNGEON_SAFEAREA')).toBe(false);
        expect(isRoutableZoneType('DUNGEON_HELL_5V5_LETHAL')).toBe(false);
        expect(isRoutableZoneType('CORRUPTED_DUNGEON_INTERMEDIATE')).toBe(false);
    });

    it('excludes hideouts (ownership-gated, not public routes)', () => {
        expect(isRoutableZoneType('HIDEOUT')).toBe(false);
        expect(isRoutableZoneType('TUNNEL_HIDEOUT')).toBe(false);
        expect(isRoutableZoneType('TUNNEL_HIDEOUT_DEEP')).toBe(false);
    });

    it('excludes guild/player islands and arenas/expeditions (matchmade or teleport-only)', () => {
        expect(isRoutableZoneType('GUILDISLAND')).toBe(false);
        expect(isRoutableZoneType('PLAYERISLAND')).toBe(false);
        expect(isRoutableZoneType('SHOWROOMISLAND')).toBe(false);
        expect(isRoutableZoneType('ARENA_1V1')).toBe(false);
        expect(isRoutableZoneType('T5_EXPEDITION_STANDARD')).toBe(false);
    });

    // @verified: PLAYERCITY_HELLDEN ("Antiquarian's Den") contains "HELL" but is a real walkable
    // city district, not a Hellgate - regression guard against an over-eager "HELL" substring check.
    it('keeps PLAYERCITY_HELLDEN routable despite containing HELL', () => {
        expect(isRoutableZoneType('PLAYERCITY_HELLDEN')).toBe(true);
    });

    it('keeps regular open-world zones, cities, passages and Avalon road tunnels routable', () => {
        expect(isRoutableZoneType('OPENPVP_BLACK_3')).toBe(true);
        expect(isRoutableZoneType('PLAYERCITY_SAFEAREA_01')).toBe(true);
        expect(isRoutableZoneType('PASSAGE_RED')).toBe(true);
        expect(isRoutableZoneType('TUNNEL_ROYAL')).toBe(true);
        expect(isRoutableZoneType('TUNNEL_ROYAL_RED')).toBe(true);
        expect(isRoutableZoneType('TUNNEL_BLACK_HIGH')).toBe(true);
    });

    it('treats a missing/empty type as non-routable (safe default)', () => {
        expect(isRoutableZoneType('')).toBe(false);
        expect(isRoutableZoneType(undefined as unknown as string)).toBe(false);
    });
});

describe('filterRoutableEdges', () => {
    const zones = {
        '1000': {name: 'Lymhurst', type: 'PLAYERCITY_SAFEAREA_02', pvpType: 'safe' as const, tier: 1, file: 'x'},
        '1215': {name: 'Some Zone', type: 'OPENPVP_YELLOW', pvpType: 'yellow' as const, tier: 4, file: 'y'},
        'DNG-KPR-01-MAIN-01': {name: 'Deepwood Enclave', type: 'DUNGEON_YELLOW', pvpType: 'yellow' as const, tier: 5, file: 'z'},
    };

    it('drops an edge whose target is a static dungeon', () => {
        const edges = [
            {from: '1000', to: '1215', pos: null},
            {from: '1000', to: 'DNG-KPR-01-MAIN-01', pos: null},
        ];

        expect(filterRoutableEdges(edges, zones)).toEqual([
            {from: '1000', to: '1215', pos: null},
        ]);
    });

    it('drops an edge whose endpoint zone is entirely unknown', () => {
        const edges = [{from: '1000', to: 'UNKNOWN-ZONE', pos: null}];
        expect(filterRoutableEdges(edges, zones)).toEqual([]);
    });
});

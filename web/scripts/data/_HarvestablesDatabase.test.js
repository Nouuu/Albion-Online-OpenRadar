// real game data through the fixtures loader.
import {beforeAll, describe, expect, test} from 'vitest';
import {loadRealHarvestablesDatabase} from '../__fixtures__/realDatabases.js';

describe('HarvestablesDatabase entryAt', () => {
    let db;
    beforeAll(() => {
        db = loadRealHarvestablesDatabase();
    });

    test('@verified 2026-11-15: the first entry of each family sits at its harvestables.xml position', () => {
        expect(db.entryAt(0).resource).toBe('WOOD');
        expect(db.entryAt(7).resource).toBe('ROCK');
        expect(db.entryAt(14).resource).toBe('FIBER');
        expect(db.entryAt(20).resource).toBe('HIDE');
        expect(db.entryAt(27).resource).toBe('ORE');
    });

    test('@verified 2026-11-15: position 28 is the dynamic ore entry and the file holds 89 entries', () => {
        expect(db.entryAt(28).name).toBe('ORE_DYNAMIC');
        expect(db.entryAt(88)).not.toBeNull();
        expect(db.entryAt(89)).toBeNull();
    });

    test('@verified 2026-11-15: an entry exposes its name, resource and tier yields', () => {
        const wood = db.entryAt(0);
        expect(wood.name).toBe('WOOD');
        expect(wood.tiers['1'].y.length).toBeGreaterThan(0);
    });

    test('@verified 2026-11-15: a negative, fractional or non-numeric position has no entry', () => {
        expect(db.entryAt(-1)).toBeNull();
        expect(db.entryAt(1.5)).toBeNull();
        expect(db.entryAt(undefined)).toBeNull();
    });
});

describe('HarvestablesDatabase getResource', () => {
    let db;
    beforeAll(() => {
        db = loadRealHarvestablesDatabase();
    });

    test.each([
        [0, 'WOOD'], [6, 'WOOD'], [7, 'ROCK'], [13, 'ROCK'], [14, 'FIBER'], [19, 'FIBER'],
        [20, 'HIDE'], [26, 'HIDE'], [27, 'ORE'], [28, 'ORE'], [32, 'ORE'],
    ])('@verified 2026-11-15: position %i is %s', (position, resource) => {
        expect(db.getResource(position)).toBe(resource);
    });

    test('@verified 2026-11-15: a silver entry, a position past the file, a negative and a fractional one have no resource', () => {
        expect(db.getResource(59)).toBeNull();
        expect(db.getResource(200)).toBeNull();
        expect(db.getResource(-1)).toBeNull();
        expect(db.getResource(1.5)).toBeNull();
    });
});

describe('HarvestablesDatabase countAt', () => {
    let db;
    beforeAll(() => {
        db = loadRealHarvestablesDatabase();
    });

    test.each([
        [0, 1, 2, 2],
        [2, 1, 1, 10],
        [2, 2, 3, 5],
        [6, 4, 30, 30],
        [14, 4, 3, 6],
        [14, 5, 5, 5],
        [14, 4, 0, 0],
    ])('@verified 2026-11-15: entry %i tier %i at charge level %i holds %i', (position, tier, chargeLevel, expected) => {
        expect(db.countAt(position, tier, chargeLevel)).toBe(expected);
    });

    test('@verified 2026-11-15: a charge level past the last listed level counts 0', () => {
        expect(db.countAt(14, 4, 9)).toBe(0);
    });

    test('@verified 2026-11-15: fractional silver yields are truncated per level', () => {
        expect(db.countAt(59, 2, 3)).toBe(1);
    });

    test('@verified 2026-11-15: a missing entry, tier or non numeric input counts 0, never NaN', () => {
        expect(db.countAt(500, 4, 2)).toBe(0);
        expect(db.countAt(14, 9, 2)).toBe(0);
        expect(db.countAt(14, 4, undefined)).toBe(0);
        expect(db.countAt(undefined, 4, 2)).toBe(0);
    });
});

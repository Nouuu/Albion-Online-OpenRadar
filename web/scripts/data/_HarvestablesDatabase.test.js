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

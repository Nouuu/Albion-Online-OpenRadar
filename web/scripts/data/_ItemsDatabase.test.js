import {describe, test, expect} from 'vitest';
import {loadRealItemsDatabase} from '../__fixtures__/realDatabases.js';
import {ItemsDatabase} from './ItemsDatabase.js';

// pcap-derived: ids 5453, 5478, 5503, 2989 are the head, armor, shoes and mount
// slots of one player in web/scripts/__fixtures__/ws/players/equipment.json.
// Expected names come from upstream formatted/items.txt.

const REAL_IDS = [
    [1, 'UNIQUE_HIDEOUT', 0, 0],
    [2, 'T3_2H_TOOL_TRACKING', 3, 0],
    [2989, 'T6_MOUNT_GIANTSTAG_MOOSE', 6, 0],
    [5453, 'T8_HEAD_GATHERER_FIBER', 8, 0],
    [5454, 'T8_HEAD_GATHERER_FIBER@1', 8, 1],
    [5455, 'T8_HEAD_GATHERER_FIBER@2', 8, 2],
    [5456, 'T8_HEAD_GATHERER_FIBER@3', 8, 3],
    [5457, 'T8_HEAD_GATHERER_FIBER@4', 8, 4],
    [5478, 'T8_ARMOR_GATHERER_FIBER', 8, 0],
    [5503, 'T8_SHOES_GATHERER_FIBER', 8, 0],
    [11000, 'UNIQUE_OFF_VANITY_CHARITY_MARCH2020', 0, 0],
    [12071, 'T8_JOURNAL_FISHING_FULL', 8, 0],
];

describe('ItemsDatabase real catalog', () => {
    // @verified 2026-07-24: array index is the real Albion item id, cross-checked against upstream items.txt.
    test.each(REAL_IDS)('id %i resolves to %s', (id, name, tier, enchant) => {
        const db = loadRealItemsDatabase();

        const item = db.getItemById(id);

        expect(item).toBeDefined();
        expect(item.name).toBe(name);
        expect(item.tier).toBe(tier);
        expect(item.enchant).toBe(enchant);
    });

    // @verified 2026-07-24: id 0 is not an Albion item id, upstream starts at 1.
    test('id 0 is absent', () => {
        const db = loadRealItemsDatabase();

        expect(db.getItemById(0)).toBeUndefined();
    });

    // @verified 2026-07-24: catalog covers the full upstream id space, guards a silent parse failure.
    test('catalog holds the full upstream id space', () => {
        const db = loadRealItemsDatabase();

        expect(db.items.size).toBeGreaterThan(12000);
    });

    // @verified 2026-07-24: no entry carries an empty name, guards a regex drift in the builder.
    test('every entry has a name', () => {
        const db = loadRealItemsDatabase();

        for (const [id, item] of db.items) {
            expect(item.name, `id ${id} has an empty name`).toBeTruthy();
        }
    });
});

describe('ItemsDatabase._parseItems', () => {
    // synthetic: upstream ids are contiguous today, so holes are not observable in the real catalog.
    // @verified 2026-07-24: a hole is skipped and does not shift the ids that follow it.
    test('skips holes without shifting later ids', () => {
        const db = new ItemsDatabase();

        db._parseItems([null, {n: 'T4_BAG', p: 100}, null, {n: 'T5_BAG', p: 200}]);

        expect(db.items.size).toBe(2);
        expect(db.getItemById(1).name).toBe('T4_BAG');
        expect(db.getItemById(3).name).toBe('T5_BAG');
        expect(db.getItemById(2)).toBeUndefined();
    });

    // @verified 2026-07-24: an entry without a name is skipped rather than stored empty.
    test('skips an entry with no name', () => {
        const db = new ItemsDatabase();

        db._parseItems([null, {p: 100}, {n: 'T5_BAG', p: 200}]);

        expect(db.items.size).toBe(1);
        expect(db.getItemById(2).name).toBe('T5_BAG');
    });

    // @verified 2026-07-24: missing itempower defaults to 0 rather than undefined.
    test('missing itempower becomes 0', () => {
        const db = new ItemsDatabase();

        db._parseItems([null, {n: 'T4_BAG'}]);

        expect(db.getItemById(1).itempower).toBe(0);
    });
});

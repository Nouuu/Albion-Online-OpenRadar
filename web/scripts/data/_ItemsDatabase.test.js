import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {describe, test, expect} from 'vitest';
import {loadRealItemsDatabase} from '../__fixtures__/realDatabases.js';
import {ItemsDatabase} from './ItemsDatabase.js';

// upstream: expected ids and names come from the committed catalog, cross-checked
// against upstream formatted/items.txt. No WS fixture is involved.
// synthetic: the hole and malformed-entry cases, not observable upstream today.

const here = dirname(fileURLToPath(import.meta.url));
const rawItemsCatalog = JSON.parse(readFileSync(join(here, '..', '..', 'ao-bin-dumps', 'items.min.json'), 'utf8'));

const REAL_IDS = [
    [1, 'UNIQUE_HIDEOUT', 0, 0],
    [2, 'T3_2H_TOOL_TRACKING', 3, 0],
    [3045, 'T6_MOUNT_GIANTSTAG_MOOSE', 6, 0],
    [5584, 'T8_HEAD_GATHERER_FIBER', 8, 0],
    [5585, 'T8_HEAD_GATHERER_FIBER@1', 8, 1],
    [5586, 'T8_HEAD_GATHERER_FIBER@2', 8, 2],
    [5587, 'T8_HEAD_GATHERER_FIBER@3', 8, 3],
    [5588, 'T8_HEAD_GATHERER_FIBER@4', 8, 4],
    [5609, 'T8_ARMOR_GATHERER_FIBER', 8, 0],
    [5634, 'T8_SHOES_GATHERER_FIBER', 8, 0],
    [11149, 'UNIQUE_OFF_VANITY_CHARITY_MARCH2020', 0, 0],
    [12237, 'T8_JOURNAL_FISHING_FULL', 8, 0],
];

// pcap-derived: item ids read off the wire in the 2026-09-03 capture (CharacterEquipmentChanged and
// NewCharacter), the same ids upstream items.txt assigns to these names after Dragonfire.
const WIRE_IDS = [
    [8408, 'T4_MAIN_AXE@1', 4, 1],
    [4134, 'T4_HEAD_LEATHER_SET2@1', 4, 1],
    [8661, 'T4_2H_DUALSWORD@1', 4, 1],
];

describe('ItemsDatabase real catalog', () => {
    // @verified 2026-09-03: array index is the real Albion item id, cross-checked against upstream items.txt
    // fetched 2026-09-03 after the Dragonfire reassignment.
    test.each([...REAL_IDS, ...WIRE_IDS])('id %i resolves to %s', (id, name, tier, enchant) => {
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

    // @verified 2026-09-03: catalog covers the full upstream id space (items.txt holds 12237 ids), guards a
    // silent parse failure.
    test('catalog holds the full upstream id space', () => {
        const db = loadRealItemsDatabase();

        expect(db.items.size).toBe(12237);
    });

    // @verified 2026-07-24: no non-null raw entry carries a falsy n, guards a builder regex drift.
    test('every non-null raw entry has a name', () => {
        for (let id = 0; id < rawItemsCatalog.length; id++) {
            const item = rawItemsCatalog[id];
            if (item === null) continue;
            expect(item.n, `id ${id} has a falsy name`).toBeTruthy();
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

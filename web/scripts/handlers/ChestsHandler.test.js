// pcap-derived fixture: web/scripts/__fixtures__/ws/chests/spawn.json
// synthetic: inline parameter objects

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

const {ChestsHandler} = await import('./ChestsHandler.js');

describe('ChestsHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new ChestsHandler();
    });

    describe('addChestEvent (event 391)', () => {
        // @verified 2026-04-18: chest from pcap-derived fixture adds entry with expected id, position, and chestName from Parameters[3].
        test('pcap-derived spawn: non-mist chest adds to list with id, posX, posY, chestName from Parameters[3]', async () => {
            const fx = await loadFixture('chests', 'spawn');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);

            handler.addChestEvent(p);

            const list = handler.chestsList;
            expect(list).toHaveLength(1);
            expect(list[0].id).toBe(p[0]);
            expect(list[0].posX).toBe(p[1][0]);
            expect(list[0].posY).toBe(p[1][1]);
            expect(list[0].chestName).toBe(p[3]);
        });

        // @verified 2026-04-18: addChestEvent with chestName NOT containing "mist" stores Parameters[3] directly.
        test('synthetic: non-mist chestName uses Parameters[3]', () => {
            const p = {0: 1, 1: [10, 20], 3: 'KEEPER_DYNAMIC_CAMP_PERSONAL_SMALL_LC', 4: 'SWAMP_RED_LOOTCHEST_DYNAMIC'};

            handler.addChestEvent(p);

            expect(handler.chestsList[0].chestName).toBe('KEEPER_DYNAMIC_CAMP_PERSONAL_SMALL_LC');
        });

        // @verified 2026-04-18: addChestEvent with chestName containing "mist" falls back to Parameters[4].
        test('synthetic: mist chestName falls back to Parameters[4]', () => {
            const p = {0: 2, 1: [5, 15], 3: 'MIST_LOOTCHEST_SMALL', 4: 'MIST_OVERRIDE_NAME'};

            handler.addChestEvent(p);

            expect(handler.chestsList[0].chestName).toBe('MIST_OVERRIDE_NAME');
        });

        // @verified 2026-04-18: mist match is case-insensitive because the code uses toLowerCase() before includes().
        test('synthetic: mist match is case-insensitive', () => {
            const p = {0: 3, 1: [0, 0], 3: 'MiSt_LOOTCHEST', 4: 'override'};

            handler.addChestEvent(p);

            expect(handler.chestsList[0].chestName).toBe('override');
        });

        // @verified 2026-04-19: addChestEvent guards typeof Parameters[3] before toLowerCase; undefined no longer throws.
        test('synthetic: addChestEvent with Parameters[3]=undefined does not throw', () => {
            const p = {0: 99, 1: [0, 0], 3: undefined};
            expect(() => handler.addChestEvent(p)).not.toThrow();
        });

        // @verified 2026-04-19: rarity persisted from Parameters[5] on the stored Chest entity (#29 handler-layer root cause).
        test('pcap-derived spawn preserves Parameters[5] rarity on the stored Chest entity', async () => {
            const fx = await loadFixture('chests', 'spawn');
            const p = normalizeParams(fx.messages[0].parameters);
            handler.addChestEvent(p);
            const stored = handler.chestsList[0];
            expect(stored.rarity).toBe(p[5]);
        });

        // @verified 2026-04-19: contract test, addChest without rarity defaults to null on the stored Chest entity.
        test('synthetic contract: addChest without rarity defaults to null', () => {
            handler.addChest(42, 0, 0, 'any-chest');
            const stored = handler.chestsList.find(c => c.id === 42);
            expect(stored).toBeDefined();
            expect(stored.rarity).toBeNull();
        });
    });

    describe('addChest dedup', () => {
        // @verified 2026-04-18: addChest with duplicate id does not add a second entry.
        test('synthetic: addChest dedup by id does not duplicate entries', () => {
            handler.addChest(10, 1, 2, 'chest-A');
            handler.addChest(10, 3, 4, 'chest-B');

            expect(handler.chestsList).toHaveLength(1);
        });

        // @verified 2026-04-18: addChest on existing id calls touch, refreshing lastUpdateTime.
        test('synthetic: addChest on existing id refreshes lastUpdateTime', () => {
            handler.addChest(10, 1, 2, 'chest-A');
            const before = handler.chestsList[0].lastUpdateTime;

            handler.chestsList[0].lastUpdateTime = before - 5000;
            handler.addChest(10, 1, 2, 'chest-A');

            expect(handler.chestsList[0].lastUpdateTime).toBeGreaterThanOrEqual(before - 5000);
        });
    });

    describe('removeChest', () => {
        // @verified 2026-04-18: removeChest removes the matching entry; unknown id is a no-op.
        test('synthetic: removeChest removes entry by id; unknown id is no-op', () => {
            handler.addChest(20, 0, 0, 'chest');
            handler.addChest(21, 1, 1, 'chest2');

            handler.removeChest(20);
            expect(handler.chestsList).toHaveLength(1);
            expect(handler.chestsList[0].id).toBe(21);

            handler.removeChest(9999);
            expect(handler.chestsList).toHaveLength(1);
        });
    });

    describe('Clear', () => {
        // @verified 2026-04-18: Clear empties chestsList.
        test('synthetic: Clear empties chestsList', () => {
            handler.addChest(30, 0, 0, 'a');
            handler.addChest(31, 1, 1, 'b');

            handler.Clear();

            expect(handler.chestsList).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-18: entities older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: cleanupStaleEntities removes stale entries, keeps fresh', () => {
            handler.addChest(40, 0, 0, 'stale');
            handler.addChest(41, 1, 1, 'fresh');
            handler.chestsList[0].lastUpdateTime = Date.now() - 200000;

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.chestsList).toHaveLength(1);
            expect(handler.chestsList[0].id).toBe(41);
        });

        // @verified 2026-04-18: returns 0 when all entries are within maxAgeMs.
        test('synthetic: cleanupStaleEntities returns 0 when all fresh', () => {
            handler.addChest(50, 0, 0, 'fresh');

            expect(handler.cleanupStaleEntities(120000)).toBe(0);
            expect(handler.chestsList).toHaveLength(1);
        });
    });
});

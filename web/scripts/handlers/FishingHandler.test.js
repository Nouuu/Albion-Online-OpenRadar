// pcap-derived fixture: web/scripts/__fixtures__/ws/fishing/spawn.json
// synthetic: inline parameter objects

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {FishingHandler} = await import('./FishingHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('FishingHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new FishingHandler();
    });

    describe('newFishEvent (event 359)', () => {
        // @verified 2026-04-18: fixture message with type="FishingNodeFish" (id=136) adds one Fish entry with correct fields.
        test('pcap-derived spawn: FishingNodeFish type adds Fish with type, size, and position', async () => {
            const fx = await loadFixture('fishing', 'spawn');
            const msg = fx.messages.find(m => m.parameters['4'] === 'FishingNodeFish');
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newFishEvent(p);

            expect(handler.fishes).toHaveLength(1);
            expect(handler.fishes[0].id).toBe(p[0]);
            expect(handler.fishes[0].type).toBe('FishingNodeFish');
            expect(handler.fishes[0].posX).toBe(p[1][0]);
            expect(handler.fishes[0].posY).toBe(p[1][1]);
            expect(handler.fishes[0].sizeSpawned).toBe(p[2]);
            expect(handler.fishes[0].sizeLeftToSpawn).toBe(p[3]);
            expect(handler.fishes[0].totalSize).toBe(p[2] + p[3]);
        });

        // @verified 2026-04-24: empty-string type entries are phantom/zone-level broadcasts, not real pools.
        // Live session log session_2026-04-24T19-35-04 showed every type="" entry has total=15 and is placed
        // on land; real pools carry FishingNodeFish (total=1), FishingNodeSwarm (total=5), or FishingNodeChest
        // (total=1). Reverting the FISH-1 narrowing: empty type is now filtered out again.
        test('pcap-derived spawn: entries with type="" are filtered out', async () => {
            const fx = await loadFixture('fishing', 'spawn');
            const emptyTypeMsgs = fx.messages.filter(m => m.parameters['4'] === '');
            expect(emptyTypeMsgs.length).toBeGreaterThan(0);

            for (const msg of emptyTypeMsgs) {
                handler.newFishEvent(normalizeParams(msg.parameters));
            }

            expect(handler.fishes).toHaveLength(0);
        });

        // @verified 2026-04-18: second event for the same id updates position and size in place without adding a new entry.
        test('pcap-derived spawn: two consecutive events for same id update existing fish in place', async () => {
            const fx = await loadFixture('fishing', 'spawn');
            const msgs = fx.messages.filter(m => m.parameters['4'] === 'FishingNodeFish');
            expect(msgs.length).toBeGreaterThanOrEqual(2);
            const firstP = normalizeParams(msgs[0].parameters);
            const id = firstP[0];

            handler.newFishEvent(firstP);
            expect(handler.fishes).toHaveLength(1);

            const updateP = {...firstP, 0: id, 1: [99.9, 88.8], 2: 7, 3: 2};
            handler.newFishEvent(updateP);

            expect(handler.fishes).toHaveLength(1);
            expect(handler.fishes[0].posX).toBe(99.9);
            expect(handler.fishes[0].posY).toBe(88.8);
            expect(handler.fishes[0].sizeSpawned).toBe(7);
            expect(handler.fishes[0].sizeLeftToSpawn).toBe(2);
            expect(handler.fishes[0].totalSize).toBe(9);
        });

        // @verified 2026-04-24: settingFishing=false no longer gates spawn; filter is applied at render so toggles take effect instantly.
        test('synthetic: settingFishing=false still adds pool to list (render-time filter only)', () => {
            settingsSync.getBool.mockReturnValue(false);

            handler.newFishEvent({0: 1, 1: [0, 0], 2: 5, 3: 0, 4: 'FishingNodeFish'});

            expect(handler.fishes).toHaveLength(1);
        });

        // @verified 2026-04-18: missing Parameters[4] (null) is falsy; newFishEvent returns early.
        test('synthetic: missing type (Parameters[4]=null) skips spawn', () => {
            handler.newFishEvent({0: 1, 1: [0, 0], 2: 5, 3: 0, 4: null});

            expect(handler.fishes).toHaveLength(0);
        });

        // @verified 2026-04-18: missing Parameters[1] (null) is falsy; newFishEvent returns early.
        test('synthetic: missing coor (Parameters[1]=null) skips spawn', () => {
            handler.newFishEvent({0: 1, 1: null, 2: 5, 3: 0, 4: 'FishingNodeFish'});

            expect(handler.fishes).toHaveLength(0);
        });
    });

    describe('fishingEnd (event 356)', () => {
        // @verified 2026-04-18: fishingEnd removes a known id.
        test('synthetic: fishingEnd removes known id from fishes', () => {
            handler.fishes.push({id: 42, posX: 0, posY: 0, type: 'FishingNodeFish', sizeSpawned: 1, sizeLeftToSpawn: 0, totalSize: 1, hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});

            handler.fishingEnd({0: 42});

            expect(handler.fishes).toHaveLength(0);
        });

        // @verified 2026-04-18: fishingEnd with unknown id is a no-op; list length unchanged.
        test('synthetic: fishingEnd on unknown id is no-op', () => {
            handler.fishes.push({id: 42, posX: 0, posY: 0, type: 'FishingNodeFish', sizeSpawned: 1, sizeLeftToSpawn: 0, totalSize: 1, hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});

            handler.fishingEnd({0: 9999});

            expect(handler.fishes).toHaveLength(1);
        });

        // @verified 2026-04-24: fishingEnd now removes fish regardless of settingFishing, mirroring the render-time filter migration.
        test('synthetic: fishingEnd removes fish even when settingFishing=false', () => {
            handler.fishes.push({id: 55, posX: 0, posY: 0, type: 'FishingNodeFish', sizeSpawned: 1, sizeLeftToSpawn: 0, totalSize: 1, hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});
            settingsSync.getBool.mockReturnValue(false);

            handler.fishingEnd({0: 55});

            expect(handler.fishes).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-18: entities older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: cleanupStaleEntities removes stale fish, keeps fresh', () => {
            const now = Date.now();
            handler.fishes.push({id: 1, lastUpdateTime: now - 200000, posX: 0, posY: 0, touch() {}});
            handler.fishes.push({id: 2, lastUpdateTime: now - 10, posX: 0, posY: 0, touch() {}});

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.fishes).toHaveLength(1);
            expect(handler.fishes[0].id).toBe(2);
        });
    });
});

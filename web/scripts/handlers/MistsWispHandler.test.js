// pcap-derived fixture: web/scripts/__fixtures__/ws/mists-wisp/spawn.json (capture-52, 2026-04-19)
// synthetic: other tests use inline parameter objects for lifecycle coverage

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

const {MistsWispHandler} = await import('./MistsWispHandler.js');

describe('MistsWispHandler', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new MistsWispHandler();
    });

    describe('newWispEvent (event 523)', () => {
        // @verified 2026-04-19: real pcap spawn (capture-52) adds one wisp with id and position from Parameters[0] and [1].
        test('pcap-derived spawn: first event from fixture adds one wisp', async () => {
            const fx = await loadFixture('mists-wisp', 'spawn');
            const p = normalizeParams(fx.messages[0].parameters);

            handler.newWispEvent(p);

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(p[0]);
            expect(handler.wispList[0].posX).toBe(p[1][0]);
            expect(handler.wispList[0].posY).toBe(p[1][1]);
        });

        // @verified 2026-04-19: all distinct event ids from the 27 fixture messages produce distinct wisps.
        test('pcap-derived spawn: all distinct events add their own wisp', async () => {
            const fx = await loadFixture('mists-wisp', 'spawn');
            const seenIds = new Set();
            for (const msg of fx.messages) {
                const p = normalizeParams(msg.parameters);
                handler.newWispEvent(p);
                seenIds.add(p[0]);
            }

            expect(handler.wispList.length).toBe(seenIds.size);
        });

        // @verified 2026-04-19: second event with same id calls touch on existing entry and advances lastUpdateTime.
        test('synthetic: duplicate id only touches existing entry', () => {
            handler.newWispEvent({0: 42, 1: [10, 20]});
            const cage = handler.wispList[0];
            cage.lastUpdateTime = cage.lastUpdateTime - 5000;
            const preTouchTime = cage.lastUpdateTime;

            handler.newWispEvent({0: 42, 1: [15, 25]});

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].lastUpdateTime).toBeGreaterThan(preTouchTime);
            expect(handler.wispList[0].posX).toBe(10);
        });

        // @verified 2026-04-19: missing position parameter causes early return.
        test('synthetic: missing position is dropped', () => {
            handler.newWispEvent({0: 99});

            expect(handler.wispList).toHaveLength(0);
        });

        // @verified 2026-04-19: missing id parameter causes early return.
        test('synthetic: missing id is dropped', () => {
            handler.newWispEvent({1: [0, 0]});

            expect(handler.wispList).toHaveLength(0);
        });
    });

    describe('removeWisp', () => {
        // @verified 2026-04-19: remove by id drops the matching entry and keeps others.
        test('synthetic: remove by id drops entry', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});

            handler.removeWisp(1);

            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(2);
        });
    });

    describe('Clear', () => {
        // @verified 2026-04-19: Clear empties the wispList.
        test('synthetic: Clear empties wispList', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});

            handler.Clear();

            expect(handler.wispList).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-19: entries older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: entries older than maxAgeMs are removed', () => {
            handler.newWispEvent({0: 1, 1: [0, 0]});
            handler.newWispEvent({0: 2, 1: [1, 1]});
            handler.wispList[0].lastUpdateTime = Date.now() - 200000;

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.wispList).toHaveLength(1);
            expect(handler.wispList[0].id).toBe(2);
        });
    });
});

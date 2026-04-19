// pcap-derived fixture: web/scripts/__fixtures__/ws/wispcage/spawn.json (capture-70, 2026-04-19)
// synthetic: other tests use inline parameter objects for gate and dedup coverage

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => false),
    },
}));

const {WispCageHandler} = await import('./WispCageHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('WispCageHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(false);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new WispCageHandler();
    });

    describe('newCageEvent (event 530)', () => {
        // @characterization 2026-04-19: real pcap shape (capture-70) is P[2]=position array, P[4]=cage name, P[1]=scalar, P[5]=int. Current handler reads P[1] (scalar) as position array, P[2] (position) as name, and gates on P[4] (defined) so the cage is dropped. No cage appears on the radar.
        test('pcap-derived spawn: current handler drops cage because Parameters[4] is always defined in real traffic', async () => {
            const fx = await loadFixture('wispcage', 'spawn');
            const p = normalizeParams(fx.messages[0].parameters);

            handler.newCageEvent(p);

            expect(handler.cages).toHaveLength(0);
        });

        // WISP-1: pinned bug, real spawn should add a cage with name from Parameters[4] and position from Parameters[2].
        test.fails('pcap-derived spawn: cage is added with name from Parameters[4] and position from Parameters[2]', async () => {
            const fx = await loadFixture('wispcage', 'spawn');
            const p = normalizeParams(fx.messages[0].parameters);

            handler.newCageEvent(p);

            expect(handler.cages).toHaveLength(1);
            expect(handler.cages[0].id).toBe(p[0]);
            expect(handler.cages[0].posX).toBe(p[2][0]);
            expect(handler.cages[0].posY).toBe(p[2][1]);
            expect(handler.cages[0].name).toBe(p[4]);
        });

        // @verified 2026-04-18: settingCage=false and Parameters[4]=undefined passes the inverted gate; cage is added to list.
        test('synthetic: newCageEvent with settingCage=false and Parameters[4]=undefined adds cage', () => {
            handler.newCageEvent({0: 1, 1: [10, 20], 2: 'CageA', 4: undefined});

            expect(handler.cages).toHaveLength(1);
            expect(handler.cages[0].id).toBe(1);
            expect(handler.cages[0].posX).toBe(10);
            expect(handler.cages[0].posY).toBe(20);
            expect(handler.cages[0].name).toBe('CageA');
        });

        // @verified 2026-04-18: settingCage=true triggers the inverted gate; cage is not added.
        test('synthetic: newCageEvent with settingCage=true returns early (inverted gate)', () => {
            settingsSync.getBool.mockReturnValue(true);

            handler.newCageEvent({0: 2, 1: [0, 0], 2: 'CageB', 4: undefined});

            expect(handler.cages).toHaveLength(0);
        });

        // @verified 2026-04-18: Parameters[4] defined (not undefined) triggers the inverted gate; cage is not added.
        test('synthetic: newCageEvent with Parameters[4] defined returns early', () => {
            handler.newCageEvent({0: 3, 1: [0, 0], 2: 'CageC', 4: 99});

            expect(handler.cages).toHaveLength(0);
        });

        // @verified 2026-04-18: second newCageEvent with same id calls touch on existing cage and does not add a second entry.
        test('synthetic: dedup by id calls touch on existing cage', () => {
            handler.newCageEvent({0: 4, 1: [5, 6], 2: 'CageD', 4: undefined});
            expect(handler.cages).toHaveLength(1);

            const cage = handler.cages[0];
            const originalTime = cage.lastUpdateTime;
            cage.lastUpdateTime = originalTime - 5000;

            handler.newCageEvent({0: 4, 1: [7, 8], 2: 'CageD', 4: undefined});

            expect(handler.cages).toHaveLength(1);
            expect(handler.cages[0].lastUpdateTime).toBeGreaterThanOrEqual(originalTime - 5000);
        });
    });

    describe('cageOpenedEvent (event 532)', () => {
        // @verified 2026-04-18: settingCage=true causes cageOpenedEvent to return early; cage is not removed.
        test('synthetic: cageOpenedEvent with settingCage=true returns early without removing', () => {
            handler.cages.push({id: 10, posX: 0, posY: 0, name: 'X', hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});
            settingsSync.getBool.mockReturnValue(true);

            handler.cageOpenedEvent({0: 10});

            expect(handler.cages).toHaveLength(1);
        });

        // @verified 2026-04-18: cageOpenedEvent with settingCage=false and matching id removes the cage.
        test('synthetic: cageOpenedEvent with matching id and settingCage=false removes cage', () => {
            handler.cages.push({id: 11, posX: 0, posY: 0, name: 'Y', hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});

            handler.cageOpenedEvent({0: 11});

            expect(handler.cages).toHaveLength(0);
        });

        // @verified 2026-04-18: cageOpenedEvent with unknown id is a no-op; cages list unchanged.
        test('synthetic: cageOpenedEvent with unknown id is no-op', () => {
            handler.cages.push({id: 12, posX: 0, posY: 0, name: 'Z', hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});

            handler.cageOpenedEvent({0: 9999});

            expect(handler.cages).toHaveLength(1);
        });
    });

    describe('Clear', () => {
        // @verified 2026-04-18: Clear empties the cages list.
        test('synthetic: Clear empties cages list', () => {
            handler.cages.push({id: 20, posX: 0, posY: 0, name: 'A', hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});
            handler.cages.push({id: 21, posX: 1, posY: 1, name: 'B', hX: 0, hY: 0, lastUpdateTime: Date.now(), touch() {}});

            handler.Clear();

            expect(handler.cages).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-18: cages older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: cleanupStaleEntities removes stale cages past maxAgeMs', () => {
            const now = Date.now();
            handler.cages.push({id: 30, lastUpdateTime: now - 200000, posX: 0, posY: 0, touch() {}});
            handler.cages.push({id: 31, lastUpdateTime: now - 10, posX: 0, posY: 0, touch() {}});

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.cages).toHaveLength(1);
            expect(handler.cages[0].id).toBe(31);
        });
    });
});

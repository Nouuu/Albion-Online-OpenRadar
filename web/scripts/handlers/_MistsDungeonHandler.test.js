// pcap-derived fixture: web/scripts/__fixtures__/ws/mists/dungeon-portal-spawn.json (capture 2026-05-16T13-41-00)
// synthetic: dedup, cleanup, and Clear coverage

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {getBool: vi.fn(() => true)},
}));

const {MistsDungeonHandler} = await import('./MistsDungeonHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('MistsDungeonHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new MistsDungeonHandler();
    });

    // @verified 2026-05-16: pcap-derived; event 323 with param[15]="MISTS_DUNGEON_SOLO_BLACK"
    // is the Knightfall Abbey portal. Position from param[1], id from param[0], name from param[15].
    test('addPortal stores entry from pcap fixture parameters', async () => {
        const fx = await loadFixture('mists', 'dungeon-portal-spawn');
        const p = normalizeParams(fx.messages[0].parameters);

        handler.addPortal(p[0], p[1][0], p[1][1], p[15]);

        expect(handler.portalList).toHaveLength(1);
        const portal = handler.portalList[0];
        expect(portal.id).toBe(p[0]);
        expect(portal.posX).toBe(p[1][0]);
        expect(portal.posY).toBe(p[1][1]);
        expect(portal.name).toBe('MISTS_DUNGEON_SOLO_BLACK');
        expect(portal.drawName).toBe('mists_abbey');
    });

    // @verified 2026-05-16: synthetic. Same id touches existing entry, no duplicate.
    test('addPortal with existing id touches lastUpdateTime, no duplicate', () => {
        handler.addPortal(1, 10, 20, 'MISTS_DUNGEON_SOLO_BLACK');
        const ts1 = handler.portalList[0].lastUpdateTime;

        handler.addPortal(1, 99, 99, 'MISTS_DUNGEON_SOLO_BLACK');

        expect(handler.portalList).toHaveLength(1);
        expect(handler.portalList[0].lastUpdateTime).toBeGreaterThanOrEqual(ts1);
        expect(handler.portalList[0].posX).toBe(10);
    });

    // @verified 2026-05-16: synthetic. Stale entries past TTL are dropped.
    test('cleanupStaleEntities drops entries older than maxAgeMs', () => {
        const now = Date.now();
        handler.portalList.push({id: 1, posX: 10, posY: 20, name: 'MISTS_DUNGEON_SOLO_BLACK', drawName: 'mists_abbey', hX: 0, hY: 0, lastUpdateTime: now - 140000, touch() {}});
        handler.portalList.push({id: 2, posX: 30, posY: 40, name: 'MISTS_DUNGEON_SOLO_BLACK', drawName: 'mists_abbey', hX: 0, hY: 0, lastUpdateTime: now, touch() {}});

        handler.cleanupStaleEntities(130000);

        expect(handler.portalList.map(p => p.id)).toEqual([2]);
    });

    // @verified 2026-05-16: synthetic. Clear empties the list.
    test('Clear empties portalList', () => {
        handler.addPortal(1, 10, 20, 'MISTS_DUNGEON_SOLO_BLACK');
        handler.addPortal(2, 30, 40, 'MISTS_DUNGEON_SOLO_BLACK');

        handler.Clear();

        expect(handler.portalList).toHaveLength(0);
    });

    // @verified 2026-05-22: pcap-confirmed (capture 13-36-55) the abbey portal id receives a
    // Leave event (event 1) on despawn. removePortal drops only the matching id.
    test('removePortal removes only the matching id', () => {
        handler.addPortal(1, 10, 20, 'MISTS_DUNGEON_SOLO_BLACK');
        handler.addPortal(2, 30, 40, 'MISTS_DUNGEON_SOLO_BLACK');

        handler.removePortal(1);

        expect(handler.portalList.map(p => p.id)).toEqual([2]);
    });

    // @verified 2026-05-22: synthetic. removePortal on an unknown id is a no-op.
    test('removePortal with unknown id leaves the list unchanged', () => {
        handler.addPortal(1, 10, 20, 'MISTS_DUNGEON_SOLO_BLACK');

        handler.removePortal(999);

        expect(handler.portalList).toHaveLength(1);
    });
});

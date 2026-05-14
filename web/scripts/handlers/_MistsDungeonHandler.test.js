// pcap-derived fixture: web/scripts/__fixtures__/ws/mists/dungeon-exit-spawn.json (capture 2026-05-14T19-38-46)
// synthetic: dedup, cleanup, and Clear coverage

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
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

    // @verified 2026-05-14: pcap-derived; portal entity stored with id, position, raw param[3].
    test('addPortal stores entry from pcap fixture parameters', async () => {
        const fx = await loadFixture('mists', 'dungeon-exit-spawn');
        const p = normalizeParams(fx.messages[0].parameters);

        handler.addPortal(p[0], p[2][0], p[2][1], p[3]);

        expect(handler.portalList).toHaveLength(1);
        const portal = handler.portalList[0];
        expect(portal.id).toBe(p[0]);
        expect(portal.posX).toBe(p[2][0]);
        expect(portal.posY).toBe(p[2][1]);
        expect(portal.rawParam3).toBe(p[3]);
        expect(portal.drawName).toBe('mists_abbey');
    });

    // @verified 2026-05-14: synthetic. Same id touches existing entry, no duplicate.
    test('addPortal with existing id touches lastUpdateTime, no duplicate', () => {
        handler.addPortal(1, 10, 20, 90);
        const ts1 = handler.portalList[0].lastUpdateTime;

        handler.addPortal(1, 99, 99, 91);

        expect(handler.portalList).toHaveLength(1);
        expect(handler.portalList[0].lastUpdateTime).toBeGreaterThanOrEqual(ts1);
        expect(handler.portalList[0].posX).toBe(10);
    });

    // @verified 2026-05-14: synthetic. Stale entries past TTL are dropped.
    test('cleanupStaleEntities drops entries older than maxAgeMs', () => {
        const now = Date.now();
        handler.portalList.push({id: 1, posX: 10, posY: 20, rawParam3: 90, drawName: 'mists_abbey', hX: 0, hY: 0, lastUpdateTime: now - 140000, touch() {}});
        handler.portalList.push({id: 2, posX: 30, posY: 40, rawParam3: 90, drawName: 'mists_abbey', hX: 0, hY: 0, lastUpdateTime: now, touch() {}});

        handler.cleanupStaleEntities(130000);

        expect(handler.portalList.map(p => p.id)).toEqual([2]);
    });

    // @verified 2026-05-14: synthetic. Clear empties the list.
    test('Clear empties portalList', () => {
        handler.addPortal(1, 10, 20, 90);
        handler.addPortal(2, 30, 40, 90);

        handler.Clear();

        expect(handler.portalList).toHaveLength(0);
    });
});

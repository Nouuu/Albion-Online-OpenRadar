// pcap-derived fixture: web/scripts/__fixtures__/ws/dungeons/spawn.json
// synthetic: inline parameter objects

import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
    },
}));

const {DungeonsHandler} = await import('./DungeonsHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

describe('DungeonsHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new DungeonsHandler();
    });

    describe('dungeonEvent (event 325)', () => {
        // @verified 2026-09-03: pcap-derived, 2026-09-03 Highland capture. Dragonfire inserted a parameter at
        // [4] on event 325, so the enchant moved from Parameters[8] to [9] and the Mists tag from [15] to
        // [16]. The keeper dungeon carries its name at [3] and enchant 1 at [9].
        test('pcap-derived spawn: T7_KEEPER adds entry with id, position, name and enchant=Parameters[9]', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages.find(m => m.parameters['3'] === 'T7_KEEPER');
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].id).toBe(p[0]);
            expect(handler.dungeonList[0].posX).toBe(p[1][0]);
            expect(handler.dungeonList[0].posY).toBe(p[1][1]);
            expect(handler.dungeonList[0].name).toBe('T7_KEEPER');
            expect(handler.dungeonList[0].enchant).toBe(1);
        });

        // @verified 2026-09-03: pcap-derived, same capture. The portal a wisp opens arrives with
        // param[6]="SHARED_MIST_WISP_PORTAL_MOB", MISTS_DUO_BLACK at [3] and [16], enchant 2 at [9]. It is a
        // Mists group entrance: DungeonType.Group, gated by settingMistDuo and settingMistE2.
        test('pcap-derived spawn: MISTS_DUO_BLACK wisp portal maps to a Mists Group entrance with enchant 2', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 'SHARED_MIST_WISP_PORTAL_MOB');
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            expect(handler.dungeonList).toHaveLength(1);
            const d = handler.dungeonList[0];
            expect(d.name).toBe('MISTS_DUO_BLACK');
            expect(d.type).toBe(1); // DungeonType.Group
            expect(d.enchant).toBe(2);
            expect(settingsSync.getBool).toHaveBeenCalledWith('settingMistE2');
        });

        // @verified 2026-09-03: pcap-derived, same capture. Re-firing the wisp portal event deduplicates on id.
        test('pcap-derived spawn: duplicate wisp portal id deduplicates on second event', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 'SHARED_MIST_WISP_PORTAL_MOB');
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);
            handler.dungeonEvent(p);

            expect(handler.dungeonList).toHaveLength(1);
        });
    });

    describe('addDungeon classification', () => {
        // @verified 2026-04-18: name containing "corrupted" is checked before "solo", so "CORRUPTED_SOLO" maps to Corrupted not Solo.
        test('synthetic: "CORRUPTED_SOLO" string matches Corrupted before Solo check', () => {
            handler.addDungeon(1, 0, 0, 'CORRUPTED_SOLO', 0);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].type).toBe(2); // DungeonType.Corrupted
        });

        // @verified 2026-04-18: name containing "hellgate" maps to Hellgate type (DungeonType.Hellgate=3). drawName = "hellgate".
        test('synthetic: "HELLGATE_2V2_NON_LETHAL" matches Hellgate type with drawName "hellgate"', () => {
            handler.addDungeon(2, 0, 0, 'HELLGATE_2V2_NON_LETHAL', 0);

            expect(handler.dungeonList).toHaveLength(1);
            const d = handler.dungeonList[0];
            expect(d.type).toBe(3); // DungeonType.Hellgate
            expect(d.drawName).toBe('hellgate');
        });

        // @verified 2026-04-18: unknown name falls through to Group type (DungeonType.Group=1).
        test('synthetic: unknown name falls through to Group type', () => {
            handler.addDungeon(3, 0, 0, 'T5_UNKNOWN_MOB', 0);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].type).toBe(1); // DungeonType.Group
        });
    });

    describe('addDungeon settings gates', () => {
        // @verified 2026-04-18: settingDungeonCorrupted=false drops corrupted dungeon.
        test('synthetic: settingDungeonCorrupted=false for corrupted dungeon drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonCorrupted');

            handler.addDungeon(10, 0, 0, 'CORRUPTED_SOLO_NONLETHAL', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-18: settingDungeonSolo=false drops solo dungeon.
        test('synthetic: settingDungeonSolo=false for solo drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonSolo');

            handler.addDungeon(11, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: settingDungeonE<enchant>=false for solo drops insertion even when settingDungeonSolo=true.
        test('synthetic: settingDungeonE0=false for solo at enchant 0 drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonE0');

            handler.addDungeon(12, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-18: settingDungeonHellgate=false drops hellgate dungeon.
        test('synthetic: settingDungeonHellgate=false for hellgate drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonHellgate');

            handler.addDungeon(13, 0, 0, 'HELLGATE_2V2_NON_LETHAL', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-18: settingDungeonDuo=false drops group dungeon.
        test('synthetic: settingDungeonDuo=false for group drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonDuo');

            handler.addDungeon(14, 0, 0, 'T5_MORGANA', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: settingDungeonE<enchant>=false for group drops insertion even when settingDungeonDuo=true.
        test('synthetic: settingDungeonE2=false for group at enchant 2 drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonE2');

            handler.addDungeon(15, 0, 0, 'T5_MORGANA', 2);

            expect(handler.dungeonList).toHaveLength(0);
        });
    });

    describe('dedup', () => {
        // @verified 2026-04-18: addDungeon with existing id calls touch and does not add a second entry.
        test('synthetic: addDungeon dedup by id does not add second entry', () => {
            handler.addDungeon(20, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);
            handler.addDungeon(20, 1, 1, 'T5_PORTAL_ROYAL_SOLO', 0);

            expect(handler.dungeonList).toHaveLength(1);
        });
    });

    describe('removeDungeon', () => {
        // @verified 2026-04-18: removeDungeon removes the matching entry; unknown id is a no-op.
        test('synthetic: removeDungeon removes entry by id', () => {
            handler.addDungeon(30, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);
            handler.addDungeon(31, 1, 1, 'T5_MORGANA', 0);

            handler.removeDungeon(30);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].id).toBe(31);
        });
    });

    describe('MISTS portals (SHARED_MIST_WISP_PORTAL_MOB)', () => {
        // @verified 2026-09-03: dungeonEvent picks Parameters[9] (rarity) over Parameters[7] (variant) for MISTS portals.
        test('MIST-6: dungeonEvent on MISTS_SOLO_YELLOW uses Parameters[9] as enchant, not Parameters[7]', () => {
            handler.dungeonEvent({0: 1, 1: [0, 0], 3: 'MISTS_SOLO_YELLOW', 7: 2, 9: 0, 252: 325});

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].enchant).toBe(0);
            expect(handler.dungeonList[0].drawName).toBe('dungeon_0');
        });

        // @verified 2026-09-03: same MISTS_SOLO_YELLOW name with Parameters[9]=1 renders dungeon_1 (Peu commun).
        test('MIST-6: Parameters[9]=1 with same MISTS_SOLO_YELLOW name renders dungeon_1', () => {
            handler.dungeonEvent({0: 1, 1: [0, 0], 3: 'MISTS_SOLO_YELLOW', 7: 2, 9: 1, 252: 325});

            expect(handler.dungeonList[0].enchant).toBe(1);
            expect(handler.dungeonList[0].drawName).toBe('dungeon_1');
        });

        // @verified 2026-09-03: non-MISTS dungeon also reads Parameters[9] (universal enchant source).
        test('MIST-6: non-MISTS dungeon also uses Parameters[9] as enchant (ignoring Parameters[7] variant id)', () => {
            handler.dungeonEvent({0: 2, 1: [0, 0], 3: 'T5_PORTAL_ROYAL_SOLO', 7: 229, 9: 0, 252: 325});

            expect(handler.dungeonList[0].enchant).toBe(0);
            expect(handler.dungeonList[0].drawName).toBe('dungeon_0');
        });

        // @verified 2026-04-23: settingMistSolo=false drops MISTS solo portal.
        test('MIST-6: settingMistSolo=false drops MISTS_SOLO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: settingMistE<rarity>=false drops MISTS portal matching that rarity.
        test('MIST-6: settingMistE1=false drops Peu commun MISTS portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistE1');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 1);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: MISTS portal is NOT filtered by settingDungeonSolo (decoupled from standard dungeons).
        test('MIST-6: settingDungeonSolo=false does NOT drop MISTS_SOLO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonSolo');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 0);

            expect(handler.dungeonList).toHaveLength(1);
        });

        // @verified 2026-09-03: T6_MORGANA enchant 2 is read from Parameters[9], never from the [7] variant id.
        test('MIST-6: T6_MORGANA with Parameters[9]=2 renders group_2 (never the Parameters[7] variant id)', () => {
            handler.dungeonEvent({0: 5199, 1: [87, 7], 3: 'T6_MORGANA', 7: 327, 9: 2, 252: 325});

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].enchant).toBe(2);
            expect(handler.dungeonList[0].drawName).toBe('group_2');
        });

        // @verified 2026-04-23: MISTS_DUO_<TYPE> maps to Group type (DungeonType.Group=1) and uses settingMistDuo.
        test('MIST-6: MISTS_DUO_YELLOW routes to Group type gated by settingMistDuo', () => {
            handler.addDungeon(1, 0, 0, 'MISTS_DUO_YELLOW', 2);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].type).toBe(1);
            expect(handler.dungeonList[0].enchant).toBe(2);
            expect(handler.dungeonList[0].drawName).toBe('group_2');
        });

        // @verified 2026-04-23: settingMistDuo=false drops MISTS duo portal.
        test('MIST-6: settingMistDuo=false drops MISTS_DUO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistDuo');

            handler.addDungeon(1, 0, 0, 'MISTS_DUO_YELLOW', 0);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-09-03: pcap-derived (dungeons/spawn.json, capture 2026-09-03). The
        // server stopped populating Parameters[3] for MISTS portals between 2026-05-14 and
        // @verified 2026-09-03: pcap-derived, 2026-09-03 capture. The abbey entrance arrives with
        // {3:"", 6:"SHARED_MIST_DUNGEON_ENTRANCE_SMALL", 16:"MISTS_DUNGEON_SOLO_YELLOW", 9:0}. dungeonEvent
        // must fall back to Parameters[16] so a Mist entrance with an empty [3] keeps rendering.
        test('MIST-6: dungeonEvent falls back to Parameters[16] when Parameters[3] is empty (pcap-derived)', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 'SHARED_MIST_DUNGEON_ENTRANCE_SMALL');
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].name).toBe('MISTS_DUNGEON_SOLO_YELLOW');
            expect(handler.dungeonList[0].drawName).toBe('dungeon_0');
        });

        // @verified 2026-09-03: regression guard. A standard dungeon with a populated
        // Parameters[3] must keep using it (not the Parameters[16] fallback).
        test('MIST-6: dungeonEvent keeps Parameters[3] when present even if Parameters[16] differs', () => {
            handler.dungeonEvent({0: 2, 1: [0, 0], 3: 'CORRUPTED_SOLO_NONLETHAL', 9: 0, 16: 'IRRELEVANT', 252: 325});

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].drawName).toBe('corrupt');
        });
    });

    describe('Clear', () => {
        // @verified 2026-04-18: Clear empties dungeonList.
        test('synthetic: Clear empties dungeonList', () => {
            handler.addDungeon(40, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);
            handler.addDungeon(41, 1, 1, 'T5_MORGANA', 0);

            handler.Clear();

            expect(handler.dungeonList).toHaveLength(0);
        });
    });

    describe('cleanupStaleEntities', () => {
        // @verified 2026-04-18: entries older than maxAgeMs are removed; fresh ones stay.
        test('synthetic: cleanupStaleEntities removes stale entries, keeps fresh', () => {
            handler.addDungeon(50, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);
            handler.addDungeon(51, 1, 1, 'T5_MORGANA', 0);
            handler.dungeonList[0].lastUpdateTime = Date.now() - 200000;

            const removed = handler.cleanupStaleEntities(120000);

            expect(removed).toBe(1);
            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].id).toBe(51);
        });

        // @verified 2026-04-18: returns 0 when all entries are within maxAgeMs.
        test('synthetic: cleanupStaleEntities returns 0 when all fresh', () => {
            handler.addDungeon(60, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 0);

            expect(handler.cleanupStaleEntities(120000)).toBe(0);
            expect(handler.dungeonList).toHaveLength(1);
        });
    });
});

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

    describe('dungeonEvent (event 323)', () => {
        // @verified 2026-04-18: first fixture message "T5_PORTAL_ROYAL_SOLO" adds one Solo dungeon with id, posX, posY, name, enchant.
        test('pcap-derived spawn: first fixture dungeon adds entry with id, position, name, enchant', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].id).toBe(p[0]);
            expect(handler.dungeonList[0].posX).toBe(p[1][0]);
            expect(handler.dungeonList[0].posY).toBe(p[1][1]);
            expect(handler.dungeonList[0].name).toBe(p[3]);
            expect(handler.dungeonList[0].enchant).toBe(p[6]);
        });

        // @verified 2026-04-18: fixture name "T5_PORTAL_ROYAL_SOLO" contains "solo" -> Solo type (DungeonType.Solo=0). drawName = "dungeon_<enchant>".
        test('pcap-derived spawn: T5_PORTAL_ROYAL_SOLO maps to Solo type with drawName dungeon_<enchant>', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages[0];
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            const d = handler.dungeonList[0];
            expect(d.type).toBe(0); // DungeonType.Solo
            expect(d.drawName).toBe('dungeon_' + p[6]);
        });

        // @verified 2026-04-18: fixture name "CORRUPTED_SOLO_NONLETHAL" contains "corrupted" -> Corrupted type (DungeonType.Corrupted=2). drawName = "corrupt" (no enchant suffix).
        test('pcap-derived spawn: CORRUPTED_SOLO_NONLETHAL maps to Corrupted type with drawName "corrupt"', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const corruptedMsg = fx.messages.find(m => m.parameters['3'] === 'CORRUPTED_SOLO_NONLETHAL');
            expect(corruptedMsg).toBeDefined();
            const p = normalizeParams(corruptedMsg.parameters);

            handler.dungeonEvent(p);

            const d = handler.dungeonList[0];
            expect(d.type).toBe(2); // DungeonType.Corrupted
            expect(d.drawName).toBe('corrupt');
        });

        // @verified 2026-04-18: fixture name "T5_MORGANA" contains none of solo/corrupted/hellgate -> falls through to Group type (DungeonType.Group=1). drawName = "group_<enchant>".
        test('pcap-derived spawn: T5_MORGANA falls through to Group type with drawName group_<enchant>', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const msg = fx.messages.find(m => m.parameters['3'] === 'T5_MORGANA');
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.dungeonEvent(p);

            const d = handler.dungeonList[0];
            expect(d.type).toBe(1); // DungeonType.Group
            expect(d.drawName).toBe('group_' + p[6]);
        });

        // @verified 2026-04-18: last two fixture messages share id 5789; second call deduplicates and list stays at length 1.
        test('pcap-derived spawn: duplicate id 5789 deduplicates on second event', async () => {
            const fx = await loadFixture('dungeons', 'spawn');
            const dupes = fx.messages.filter(m => m.parameters['0'] === 5789);
            expect(dupes).toHaveLength(2);

            for (const msg of dupes) {
                handler.dungeonEvent(normalizeParams(msg.parameters));
            }

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

        // @verified 2026-04-18: settingDungeonE<enchant>=false for solo drops insertion even when settingDungeonSolo=true.
        test('synthetic: settingDungeonE229=false for solo at enchant 229 drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonE229');

            handler.addDungeon(12, 0, 0, 'T5_PORTAL_ROYAL_SOLO', 229);

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

        // @verified 2026-04-18: settingDungeonE<enchant>=false for group drops insertion even when settingDungeonDuo=true.
        test('synthetic: settingDungeonE327=false for group at enchant 327 drops insertion', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonE327');

            handler.addDungeon(15, 0, 0, 'T5_MORGANA', 327);

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
        // pcap-live evidence: MISTS_SOLO_YELLOW event 323 always carries
        // params[6]=2 (a variant/seed constant), not the zone rarity.
        // Rarity is encoded in the name suffix (YELLOW=Common, GREEN=Uncommon,
        // BLUE=Rare, PURPLE=Epic, GOLD=Legendary).

        // @verified 2026-04-23: MISTS_SOLO_YELLOW extracts enchant 0 from the name suffix, overriding params[6]=2.
        test('MIST-6: MISTS_SOLO_YELLOW uses rarity from name suffix, not params[6]', () => {
            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 2);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].enchant).toBe(0);
            expect(handler.dungeonList[0].drawName).toBe('dungeon_0');
        });

        // @verified 2026-04-23: each MISTS colour maps to its expected rarity index.
        test('MIST-6: colour suffix to rarity mapping (YELLOW=0, GREEN=1, BLUE=2, PURPLE=3, GOLD=4)', () => {
            const cases = [
                ['MISTS_SOLO_YELLOW', 0],
                ['MISTS_SOLO_GREEN', 1],
                ['MISTS_SOLO_BLUE', 2],
                ['MISTS_SOLO_PURPLE', 3],
                ['MISTS_SOLO_GOLD', 4],
            ];
            for (const [name, expectedRarity] of cases) {
                handler = new DungeonsHandler();
                handler.addDungeon(1, 0, 0, name, 999);
                expect(handler.dungeonList[0].enchant).toBe(expectedRarity);
                expect(handler.dungeonList[0].drawName).toBe('dungeon_' + expectedRarity);
            }
        });

        // @verified 2026-04-23: settingMistSolo=false drops MISTS solo portal.
        test('MIST-6: settingMistSolo=false drops MISTS_SOLO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistSolo');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 2);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: settingMistE<rarity>=false drops MISTS portal matching that rarity.
        test('MIST-6: settingMistE0=false drops YELLOW (Common) MISTS portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistE0');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 2);

            expect(handler.dungeonList).toHaveLength(0);
        });

        // @verified 2026-04-23: MISTS portal is NOT filtered by settingDungeonSolo (decoupled from standard dungeons).
        test('MIST-6: settingDungeonSolo=false does NOT drop MISTS_SOLO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingDungeonSolo');

            handler.addDungeon(1, 0, 0, 'MISTS_SOLO_YELLOW', 2);

            expect(handler.dungeonList).toHaveLength(1);
        });

        // @verified 2026-04-23: MISTS_DUO_<COLOR> maps to Group type (DungeonType.Group=1) and uses settingMistDuo.
        test('MIST-6: MISTS_DUO_GREEN routes to Group type gated by settingMistDuo', () => {
            handler.addDungeon(1, 0, 0, 'MISTS_DUO_GREEN', 2);

            expect(handler.dungeonList).toHaveLength(1);
            expect(handler.dungeonList[0].type).toBe(1);
            expect(handler.dungeonList[0].enchant).toBe(1);
            expect(handler.dungeonList[0].drawName).toBe('group_1');
        });

        // @verified 2026-04-23: settingMistDuo=false drops MISTS duo portal.
        test('MIST-6: settingMistDuo=false drops MISTS_DUO portal', () => {
            settingsSync.getBool.mockImplementation(key => key !== 'settingMistDuo');

            handler.addDungeon(1, 0, 0, 'MISTS_DUO_GREEN', 2);

            expect(handler.dungeonList).toHaveLength(0);
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

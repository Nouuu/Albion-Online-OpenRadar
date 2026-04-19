import {describe, test, expect, beforeEach, vi} from 'vitest';
import * as EventRouter from './EventRouter.js';
import {EventCodes} from '../utils/EventCodes.js';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

describe('EventRouter', () => {
    let handlers;
    let map;
    let radarRenderer;
    let clearHandlers;

    beforeEach(() => {
        EventRouter.reset();

        window.logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        handlers = {
            playersHandler: {
                updateLocalPlayerPosition: vi.fn(),
                removePlayer: vi.fn(),
                handleNewPlayerEvent: vi.fn(),
                handleMountedPlayerEvent: vi.fn(),
                UpdatePlayerHealth: vi.fn(),
                UpdatePlayerLooseHealth: vi.fn(),
                updateItems: vi.fn(),
                updatePlayerFaction: vi.fn()
            },
            mobsHandler: {
                updateMistPosition: vi.fn(),
                updateMobPosition: vi.fn(),
                removeMist: vi.fn(),
                removeMob: vi.fn(),
                updateEnchantEvent: vi.fn(),
                NewMobEvent: vi.fn(),
                debugLogMobById: vi.fn(),
                updateMobHealth: vi.fn(),
                updateMobHealthRegen: vi.fn(),
                updateMobHealthBulk: vi.fn()
            },
            harvestablesHandler: {
                newSimpleHarvestableObject: vi.fn(),
                newHarvestableObject: vi.fn(),
                HarvestUpdateEvent: vi.fn(),
                harvestFinished: vi.fn()
            },
            chestsHandler: {removeChest: vi.fn(), addChestEvent: vi.fn()},
            dungeonsHandler: {removeDungeon: vi.fn(), dungeonEvent: vi.fn()},
            fishingHandler: {removeFish: vi.fn(), newFishEvent: vi.fn(), fishingEnd: vi.fn()},
            wispCageHandler: {removeCage: vi.fn(), newCageEvent: vi.fn(), cageOpenedEvent: vi.fn()},
            mistsWispHandler: {newWispEvent: vi.fn(), removeWisp: vi.fn()}
        };

        map = {id: -1, hX: 0, hY: 0, isBZ: false};
        radarRenderer = {
            setLocalPlayerPosition: vi.fn(),
            setMap: vi.fn()
        };
        clearHandlers = vi.fn();

        EventRouter.init({handlers, map, radarRenderer});
    });

    // Helper: collect all vi.fn() calls across every handler method
    function allHandlerCalls() {
        const calls = [];
        for (const h of Object.values(handlers)) {
            for (const fn of Object.values(h)) {
                if (fn.mock) calls.push(...fn.mock.calls);
            }
        }
        return calls;
    }

    // -------------------------------------------------------------------------
    // onRequest opMove
    // -------------------------------------------------------------------------
    describe('onRequest opMove', () => {
        // @verified 2026-04-18: opcode 22 is the current Move request in Protocol18
        test('opcode 22 with float array updates local player position', () => {
            EventRouter.onRequest({253: 22, 1: [10.5, 20.5]});

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(10.5, 20.5);
            expect(radarRenderer.setLocalPlayerPosition).toHaveBeenCalledWith(10.5, 20.5);
            expect(EventRouter.getLocalPlayerPosition()).toEqual({x: 10.5, y: 20.5});
        });

        // @verified 2026-04-18: opcode 21 still accepted for backward compat with pre-Protocol18 captures
        test('opcode 21 still works for backward compat', () => {
            EventRouter.onRequest({253: 21, 1: [1.5, 2.5]});

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(1.5, 2.5);
        });

        // @verified 2026-04-18: opcode 22 with pcap-derived float array from move-request fixture
        test('opcode 22 with pcap-derived position array', async () => {
            // pcap-derived: router/move-request.json
            const fix = await loadFixture('router', 'move-request');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onRequest(p);

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(
                p[1][0], p[1][1]
            );
        });

        // @verified 2026-04-18: second move-request entry from same pcap sequence
        test('opcode 22 with second pcap-derived position array', async () => {
            // pcap-derived: router/move-request.json
            const fix = await loadFixture('router', 'move-request');
            const msg = fix.messages[1];
            const p = normalizeParams(msg.parameters);

            EventRouter.onRequest(p);

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(
                p[1][0], p[1][1]
            );
        });

        // @verified 2026-04-18: unrelated opcodes must not update position
        test('unrelated opcode is ignored', () => {
            EventRouter.onRequest({253: 999, 1: [1, 2]});

            expect(handlers.playersHandler.updateLocalPlayerPosition).not.toHaveBeenCalled();
            expect(radarRenderer.setLocalPlayerPosition).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: legacy Buffer payload from older client builds
        test('legacy Buffer payload is decoded via DataView', () => {
            const buffer = {
                type: 'Buffer',
                data: [0x00, 0x00, 0xc8, 0x41, 0x00, 0x00, 0x48, 0x42]
            };

            EventRouter.onRequest({253: 22, 1: buffer});

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(25.0, 50.0);
        });
    });

    // -------------------------------------------------------------------------
    // onResponse JoinMap (opcode 2)
    // -------------------------------------------------------------------------
    describe('onResponse JoinMap', () => {
        // @verified 2026-04-18: float array position path updates renderer and clears handlers
        test('opcode 2 with float array updates local player position and clears handlers', () => {
            EventRouter.onResponse({253: 2, 9: [100.5, 200.5], 103: 0}, clearHandlers);

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(100.5, 200.5);
            expect(clearHandlers).toHaveBeenCalledTimes(1);
        });

        // @verified 2026-04-18: params[8] non-empty string sets map.id and notifies renderer
        test('opcode 2 extracts map id from params[8] and notifies renderer', () => {
            EventRouter.onResponse({253: 2, 8: '0203', 9: [0, 0]}, clearHandlers);

            expect(map.id).toBe('0203');
            expect(radarRenderer.setMap).toHaveBeenCalledWith(map);
        });

        // @verified 2026-04-18: missing params[8] leaves map.id unchanged
        test('opcode 2 leaves map id untouched when params[8] missing', () => {
            map.id = '0100';
            EventRouter.onResponse({253: 2, 9: [0, 0]}, clearHandlers);

            expect(map.id).toBe('0100');
        });

        // @verified 2026-04-18: pcap-derived JoinFinished sets map.id from params[8]
        test('opcode 2 pcap-derived fixture sets map.id from params[8]', async () => {
            // pcap-derived: router/join-finished.json message[0], params[8]="0201"
            const fix = await loadFixture('router', 'join-finished');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onResponse(p, clearHandlers);

            expect(map.id).toBe('0201');
            expect(clearHandlers).toHaveBeenCalledTimes(1);
        });

        // Pinned: ROUTER-1 (issue #57). EventRouter.onResponse opcode 2 does not extract isBZ from
        // params[103] hashtable. Post-Protocol18: {"5": 1409813048, "7": 56653070} is non-zero.
        // Fix design: 2026-04-18-protocol18-regressions-design.md.
        test.fails('ROUTER-1: onResponse JoinMap extracts isBZ from params[103] hashtable', async () => {
            // pcap-derived: router/join-finished.json message[0]
            // params[103] = {"5": 1409813048, "7": 56653070}
            const fix = await loadFixture('router', 'join-finished');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onResponse(p, clearHandlers);

            // When fixed, map.isBZ must reflect the non-zero hashtable (true or derived value).
            expect(map.isBZ).not.toBe(false);
        });

        // @verified 2026-04-18: second pcap JoinFinished message updates position from array
        test('opcode 2 second pcap message: position array updates local player position', async () => {
            // pcap-derived: router/join-finished.json message[1], params[9]=[-10.09..., 28.14...]
            const fix = await loadFixture('router', 'join-finished');
            const msg = fix.messages[1];
            const p = normalizeParams(msg.parameters);

            EventRouter.onResponse(p, clearHandlers);

            expect(handlers.playersHandler.updateLocalPlayerPosition).toHaveBeenCalledWith(
                p[9][0], p[9][1]
            );
        });
    });

    // -------------------------------------------------------------------------
    // onResponse ChangeCluster (opcode 41)
    // -------------------------------------------------------------------------
    describe('onResponse ChangeCluster', () => {
        // @verified 2026-04-18: new non-empty map id triggers update and clear
        test('opcode 41 updates map id from params[0] and notifies renderer', () => {
            map.id = '0201';
            EventRouter.onResponse({253: 41, 0: '0203'}, clearHandlers);

            expect(map.id).toBe('0203');
            expect(radarRenderer.setMap).toHaveBeenCalledWith(map);
            expect(clearHandlers).toHaveBeenCalledTimes(1);
        });

        // @verified 2026-04-18: same map id is a no-op
        test('opcode 41 ignored when map id unchanged', () => {
            map.id = '0203';
            EventRouter.onResponse({253: 41, 0: '0203'}, clearHandlers);

            expect(radarRenderer.setMap).not.toHaveBeenCalled();
            expect(clearHandlers).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: null params[0] is not a valid zone string
        test('opcode 41 ignored when params[0] not a valid zone string', () => {
            map.id = '0201';
            EventRouter.onResponse({253: 41, 0: null}, clearHandlers);

            expect(map.id).toBe('0201');
            expect(clearHandlers).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: pcap-derived change-cluster message[1] sets new map id
        test('opcode 41 pcap-derived: transitions from initial state to new map id', async () => {
            // pcap-derived: router/change-cluster.json message[1], params[0]="0006"
            const fix = await loadFixture('router', 'change-cluster');
            const msg = fix.messages[1];
            const p = normalizeParams(msg.parameters);
            map.id = 'previous-map';

            EventRouter.onResponse(p, clearHandlers);

            expect(map.id).toBe('0006');
            expect(clearHandlers).toHaveBeenCalledTimes(1);
        });

        // @verified 2026-04-18: pcap-derived third cluster change message sets map "0007"
        test('opcode 41 pcap-derived: transitions to third cluster', async () => {
            // pcap-derived: router/change-cluster.json message[2], params[0]="0007"
            const fix = await loadFixture('router', 'change-cluster');
            const msg = fix.messages[2];
            const p = normalizeParams(msg.parameters);
            map.id = '0006';

            EventRouter.onResponse(p, clearHandlers);

            expect(map.id).toBe('0007');
            expect(clearHandlers).toHaveBeenCalledTimes(1);
        });
    });

    // -------------------------------------------------------------------------
    // onResponse legacy map change (opcode 35)
    // -------------------------------------------------------------------------
    describe('onResponse legacy map change (opcode 35)', () => {
        // @characterization 2026-04-18: current code does debounce + same-id guard for opcode 35
        test('opcode 35 updates map id when debounce window has elapsed', () => {
            // synthetic: no pcap fixture; legacy path not observed in corpus
            map.id = 'old-map';
            EventRouter.onResponse({253: 35, 0: 'new-map'}, clearHandlers);

            expect(map.id).toBe('new-map');
        });

        // @characterization 2026-04-18: same map id is silently skipped
        test('opcode 35 skips update when map id is already the same', () => {
            map.id = 'same-map';
            EventRouter.onResponse({253: 35, 0: 'same-map'}, clearHandlers);

            expect(radarRenderer.setMap).not.toHaveBeenCalled();
        });

        // @characterization 2026-04-18: unknown opcode produces no side effect
        test('unknown opcode 999 is a no-op', () => {
            EventRouter.onResponse({253: 999, 0: 'anything'}, clearHandlers);

            expect(clearHandlers).not.toHaveBeenCalled();
            expect(radarRenderer.setMap).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // onEvent Move (3)
    // -------------------------------------------------------------------------
    describe('onEvent Move', () => {
        // @verified 2026-04-18: Move dispatches to both mob position updaters
        test('Move event dispatches to mobsHandler with positions', () => {
            EventRouter.onEvent({0: 12345, 4: 100, 5: 200, 252: 3});

            expect(handlers.mobsHandler.updateMobPosition).toHaveBeenCalledWith(12345, 100, 200);
            expect(handlers.mobsHandler.updateMistPosition).toHaveBeenCalledWith(12345, 100, 200);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent Leave (1)
    // -------------------------------------------------------------------------
    describe('onEvent Leave', () => {
        // @verified 2026-04-20: Leave fans out remove calls to all eight handlers
        test('Leave event removes entity from all handlers', () => {
            EventRouter.onEvent({0: 42, 252: EventCodes.Leave});

            expect(handlers.playersHandler.removePlayer).toHaveBeenCalledWith(42);
            expect(handlers.mobsHandler.removeMist).toHaveBeenCalledWith(42);
            expect(handlers.mobsHandler.removeMob).toHaveBeenCalledWith(42);
            expect(handlers.dungeonsHandler.removeDungeon).toHaveBeenCalledWith(42);
            expect(handlers.chestsHandler.removeChest).toHaveBeenCalledWith(42);
            expect(handlers.fishingHandler.removeFish).toHaveBeenCalledWith(42);
            expect(handlers.wispCageHandler.removeCage).toHaveBeenCalledWith(42);
            expect(handlers.mistsWispHandler.removeWisp).toHaveBeenCalledWith(42);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewCharacter (29)
    // -------------------------------------------------------------------------
    describe('onEvent NewCharacter', () => {
        // @verified 2026-04-18: pcap-derived spawn routes to handleNewPlayerEvent with id + full params
        test('NewCharacter pcap-derived: dispatches handleNewPlayerEvent', async () => {
            // pcap-derived: players/spawn.json message[0], params[0]=9956, params[252]=29
            const fix = await loadFixture('players', 'spawn');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.handleNewPlayerEvent).toHaveBeenCalledWith(9956, p);
        });

        // @verified 2026-04-18: second spawn variant (different player id)
        test('NewCharacter pcap-derived: second player variant dispatches correctly', async () => {
            // pcap-derived: players/spawn.json message[1], params[0]=9512
            const fix = await loadFixture('players', 'spawn');
            const msg = fix.messages[1];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.handleNewPlayerEvent).toHaveBeenCalledWith(9512, p);
        });

        // @verified 2026-04-18: third player variant with guild tag
        test('NewCharacter pcap-derived: high-gear player with guild dispatches correctly', async () => {
            // pcap-derived: players/spawn.json message[7], params[0]=1441, params[51]="JOIN"
            const fix = await loadFixture('players', 'spawn');
            const msg = fix.messages[7];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.handleNewPlayerEvent).toHaveBeenCalledWith(1441, p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent CharacterEquipmentChanged (90)
    // -------------------------------------------------------------------------
    describe('onEvent CharacterEquipmentChanged', () => {
        // @verified 2026-04-18: pcap-derived equipment change dispatches updateItems
        test('CharacterEquipmentChanged pcap-derived: dispatches updateItems with id and params', async () => {
            // pcap-derived: players/equipment.json message[0], params[0]=6740, params[252]=90
            const fix = await loadFixture('players', 'equipment');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.updateItems).toHaveBeenCalledWith(6740, p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent ChangeFlaggingFinished (363)
    // -------------------------------------------------------------------------
    describe('onEvent ChangeFlaggingFinished', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes ChangeFlaggingFinished (P[252]=363) to playersHandler.updatePlayerFaction', async () => {
            // pcap-derived: players/faction-change.json message[0], P[252]=363
            const fix = await loadFixture('players', 'faction-change');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.updatePlayerFaction).toHaveBeenCalledWith(p[0], p[1]);
        });

        // @verified 2026-04-18: second pcap variant, dispatch verified after EventCodes refresh.
        test('onEvent routes ChangeFlaggingFinished second variant (P[252]=363) to updatePlayerFaction', async () => {
            // pcap-derived: players/faction-change.json message[1], P[252]=363
            const fix = await loadFixture('players', 'faction-change');
            const p = normalizeParams(fix.messages[1].parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.updatePlayerFaction).toHaveBeenCalledWith(p[0], p[1]);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent Mounted (211)
    // -------------------------------------------------------------------------
    describe('onEvent Mounted', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes Mounted (P[252]=211) to playersHandler.handleMountedPlayerEvent', async () => {
            // pcap-derived: players/mounted.json message[0], P[252]=211
            const fix = await loadFixture('players', 'mounted');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.handleMountedPlayerEvent).toHaveBeenCalledWith(p[0], p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewSimpleHarvestableObjectList (39)
    // -------------------------------------------------------------------------
    describe('onEvent NewSimpleHarvestableObjectList', () => {
        // @verified 2026-04-18: harvestables batch-spawn dispatches newSimpleHarvestableObject(params)
        test('NewSimpleHarvestableObjectList pcap-derived: dispatches newSimpleHarvestableObject', async () => {
            // pcap-derived: harvestables/batch-spawn.json message[0]
            const fix = await loadFixture('harvestables', 'batch-spawn');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.harvestablesHandler.newSimpleHarvestableObject).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewHarvestableObject (40)
    // -------------------------------------------------------------------------
    describe('onEvent NewHarvestableObject', () => {
        // @verified 2026-04-18: single harvestable spawn dispatches newHarvestableObject(id, params)
        test('NewHarvestableObject pcap-derived: dispatches newHarvestableObject with id', async () => {
            // pcap-derived: harvestables/single-spawn.json message[0], params[0]=2246
            const fix = await loadFixture('harvestables', 'single-spawn');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.harvestablesHandler.newHarvestableObject).toHaveBeenCalledWith(2246, p);
        });

        // @verified 2026-04-18: enchanted stone variant (params[6]=529)
        test('NewHarvestableObject pcap-derived: enchanted stone variant dispatches correctly', async () => {
            // pcap-derived: harvestables/single-spawn.json message[2], params[0]=8403, params[6]=529
            const fix = await loadFixture('harvestables', 'single-spawn');
            const msg = fix.messages[2];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.harvestablesHandler.newHarvestableObject).toHaveBeenCalledWith(8403, p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent HarvestableChangeState (46)
    // -------------------------------------------------------------------------
    describe('onEvent HarvestableChangeState', () => {
        // @verified 2026-04-18: state update dispatches HarvestUpdateEvent(params)
        test('HarvestableChangeState pcap-derived: dispatches HarvestUpdateEvent', async () => {
            // pcap-derived: harvestables/state-update.json message[0], params[0]=3315
            const fix = await loadFixture('harvestables', 'state-update');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.harvestablesHandler.HarvestUpdateEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent HarvestFinished (61)
    // -------------------------------------------------------------------------
    describe('onEvent HarvestFinished', () => {
        // @verified 2026-04-18: harvest finished dispatches harvestFinished(params)
        test('HarvestFinished pcap-derived: dispatches harvestFinished', async () => {
            // pcap-derived: harvestables/finished.json message[0], params[252]=61
            const fix = await loadFixture('harvestables', 'finished');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.harvestablesHandler.harvestFinished).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent MobChangeState (47)
    // -------------------------------------------------------------------------
    describe('onEvent MobChangeState', () => {
        // @verified 2026-04-18: mob state change dispatches updateEnchantEvent(params)
        test('MobChangeState pcap-derived: dispatches updateEnchantEvent', async () => {
            // pcap-derived: mobs/change-state.json message[0], params[0]=4598, params[252]=47
            const fix = await loadFixture('mobs', 'change-state');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.mobsHandler.updateEnchantEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewMob (123)
    // -------------------------------------------------------------------------
    describe('onEvent NewMob', () => {
        // @verified 2026-04-18: pcap-derived mob spawn dispatches NewMobEvent(params)
        test('NewMob pcap-derived: dispatches NewMobEvent', async () => {
            // pcap-derived: mobs/spawn.json message[0], params[0]=5672, params[252]=123
            const fix = await loadFixture('mobs', 'spawn');
            const msg = fix.messages[0];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.mobsHandler.NewMobEvent).toHaveBeenCalledWith(p);
        });

        // @verified 2026-04-18: second mob variant (heavier mob with HP)
        test('NewMob pcap-derived: named mob variant dispatches correctly', async () => {
            // pcap-derived: mobs/spawn.json message[1], params[0]=4786, params[1]=2082
            const fix = await loadFixture('mobs', 'spawn');
            const msg = fix.messages[1];
            const p = normalizeParams(msg.parameters);

            EventRouter.onEvent(p);

            expect(handlers.mobsHandler.NewMobEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent RegenerationHealthChanged (91)
    // -------------------------------------------------------------------------
    describe('onEvent RegenerationHealthChanged', () => {
        // @verified 2026-04-18: health regen dispatches to both players and mobs handlers
        test('RegenerationHealthChanged: dispatches UpdatePlayerHealth and updateMobHealthRegen', () => {
            // synthetic: no specific regen fixture in corpus
            const p = {0: 1001, 252: EventCodes.RegenerationHealthChanged};

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.UpdatePlayerHealth).toHaveBeenCalledWith(p);
            expect(handlers.mobsHandler.updateMobHealthRegen).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent HealthUpdate (6)
    // -------------------------------------------------------------------------
    describe('onEvent HealthUpdate', () => {
        // @verified 2026-04-18: health update dispatches to both players and mobs handlers
        test('HealthUpdate: dispatches UpdatePlayerLooseHealth and updateMobHealth', () => {
            // synthetic: no specific health-update fixture in corpus
            const p = {0: 1001, 252: EventCodes.HealthUpdate};

            EventRouter.onEvent(p);

            expect(handlers.playersHandler.UpdatePlayerLooseHealth).toHaveBeenCalledWith(p);
            expect(handlers.mobsHandler.updateMobHealth).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent HealthUpdates (7)
    // -------------------------------------------------------------------------
    describe('onEvent HealthUpdates', () => {
        // @verified 2026-04-18: bulk health update dispatches to mobs handler only
        test('HealthUpdates: dispatches updateMobHealthBulk', () => {
            // synthetic: no specific bulk-health fixture in corpus
            const p = {0: 1001, 252: EventCodes.HealthUpdates};

            EventRouter.onEvent(p);

            expect(handlers.mobsHandler.updateMobHealthBulk).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewRandomDungeonExit (323)
    // -------------------------------------------------------------------------
    describe('onEvent NewRandomDungeonExit', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes NewRandomDungeonExit (P[252]=323) to dungeonsHandler.dungeonEvent', async () => {
            // pcap-derived: dungeons/spawn.json message[0], P[252]=323
            const fix = await loadFixture('dungeons', 'spawn');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.dungeonsHandler.dungeonEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewMistsWispSpawn (523)
    // -------------------------------------------------------------------------
    describe('onEvent NewMistsWispSpawn', () => {
        test('MIST-3: onEvent routes NewMistsWispSpawn (P[252]=523) to mistsWispHandler.newWispEvent', () => {
            // synthetic: no pcap fixture for event 523 mists wisp spawn
            const p = {0: 67, 1: [172.5, 15.5], 2: 90, 252: 523};

            EventRouter.onEvent(p);

            expect(handlers.mistsWispHandler.newWispEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewLootChest (391)
    // -------------------------------------------------------------------------
    describe('onEvent NewLootChest', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes NewLootChest (P[252]=391) to chestsHandler.addChestEvent', async () => {
            // pcap-derived: chests/spawn.json message[0], P[252]=391
            const fix = await loadFixture('chests', 'spawn');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.chestsHandler.addChestEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewFishingZoneObject (359)
    // -------------------------------------------------------------------------
    describe('onEvent NewFishingZoneObject', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes NewFishingZoneObject (P[252]=359) to fishingHandler.newFishEvent', async () => {
            // pcap-derived: fishing/spawn.json message[0], P[252]=359
            const fix = await loadFixture('fishing', 'spawn');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.fishingHandler.newFishEvent).toHaveBeenCalledWith(p);
        });

        // @verified 2026-04-18: FishingNodeFish variant, dispatch verified after EventCodes refresh.
        test('onEvent routes NewFishingZoneObject FishingNodeFish variant (P[252]=359) to newFishEvent', async () => {
            // pcap-derived: fishing/spawn.json message[2], P[252]=359
            const fix = await loadFixture('fishing', 'spawn');
            const p = normalizeParams(fix.messages[2].parameters);

            EventRouter.onEvent(p);

            expect(handlers.fishingHandler.newFishEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent FishingFinished (356)
    // -------------------------------------------------------------------------
    describe('onEvent FishingFinished', () => {
        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis.
        test('onEvent routes FishingFinished (P[252]=356) to fishingHandler.fishingEnd', () => {
            // synthetic: no fishingEnd fixture in corpus; upstream value is 356
            const p = {0: 999, 252: 356};

            EventRouter.onEvent(p);

            expect(handlers.fishingHandler.fishingEnd).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // onEvent NewCagedObject (530) + CagedObjectStateUpdated (531)
    // -------------------------------------------------------------------------
    describe('onEvent WispCage', () => {
        // @verified 2026-04-19: pcap-derived from capture-70 confirms P[252]=530 in real traffic. Dispatch routes to newCageEvent.
        test('onEvent routes NewCagedObject (P[252]=530) to wispCageHandler.newCageEvent', async () => {
            // pcap-derived: wispcage/spawn.json message[0], P[252]=530
            const fix = await loadFixture('wispcage', 'spawn');
            const p = normalizeParams(fix.messages[0].parameters);

            EventRouter.onEvent(p);

            expect(handlers.wispCageHandler.newCageEvent).toHaveBeenCalledWith(p);
        });

        // @verified 2026-04-18: dispatch verified after EventCodes refresh against upstream StatisticsAnalysis master fetch. Capture-70 has no CagedObjectStateUpdated events so this stays synthetic.
        test('onEvent routes CagedObjectStateUpdated (P[252]=531) to wispCageHandler.cageOpenedEvent', () => {
            // synthetic: no wispcage-opened fixture in corpus; upstream value is 531
            const p = {0: 777, 252: 531};

            EventRouter.onEvent(p);

            expect(handlers.wispCageHandler.cageOpenedEvent).toHaveBeenCalledWith(p);
        });
    });

    // -------------------------------------------------------------------------
    // No-op event codes (no handler method should be called)
    // -------------------------------------------------------------------------
    describe('onEvent no-op codes', () => {
        const noop_cases = [
            ['HarvestStart', EventCodes.HarvestStart],
            ['HarvestCancel', EventCodes.HarvestCancel],
            ['InventoryPutItem', EventCodes.InventoryPutItem],
            ['InventoryDeleteItem', EventCodes.InventoryDeleteItem],
            ['InventoryState', EventCodes.InventoryState],
            ['NewSimpleItem', EventCodes.NewSimpleItem],
            ['NewEquipmentItem', EventCodes.NewEquipmentItem],
            ['NewJournalItem', EventCodes.NewJournalItem],
            ['UpdateFame', EventCodes.UpdateFame],
            ['UpdateMoney', EventCodes.UpdateMoney],
        ];

        // @verified 2026-04-18: all these codes are explicit no-ops in the switch table
        test.each(noop_cases)('%s (%i) does not invoke any handler method', (name, code) => {
            // synthetic: minimal params to exercise the switch case
            EventRouter.onEvent({0: 1, 252: code});

            expect(allHandlerCalls()).toHaveLength(0);
        });

        // @verified 2026-04-18: code 590 (BotCommand) is logging-only, no handler dispatch
        test('code 590 is logging-only and invokes no handler method', () => {
            // synthetic: code 590 exists as literal in EventRouter switch
            EventRouter.onEvent({0: 1, 252: 590});

            expect(allHandlerCalls()).toHaveLength(0);
        });

        // @verified 2026-04-18: completely unknown code produces no side effect and no throw
        test('unknown event code 9999 does not invoke any handler method and does not throw', () => {
            // synthetic
            expect(() => {
                EventRouter.onEvent({0: 1, 252: 9999});
            }).not.toThrow();

            expect(allHandlerCalls()).toHaveLength(0);
        });
    });
});

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getNumber: vi.fn((_k, d) => d),
        getJSON: vi.fn(() => null),
    },
}));

vi.mock('../data/ZonesDatabase.js', () => ({
    default: {
        getPvpType: vi.fn(() => 'safe'),
    },
}));

const {PlayersHandler} = await import('./PlayersHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;
const zonesDatabase = (await import('../data/ZonesDatabase.js')).default;

describe('PlayersHandler', () => {
    let handler;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockReturnValue(true);
        settingsSync.getNumber.mockImplementation((_k, d) => d);
        zonesDatabase.getPvpType.mockReturnValue('safe');

        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = 'safe-zone-01';

        handler = new PlayersHandler();
    });

    afterEach(() => {
        document.body.querySelectorAll('.bg-error\\/60').forEach(el => el.remove());
    });

    // ---------------------------------------------------------------------------
    // handleNewPlayerEvent (event 29)
    // ---------------------------------------------------------------------------
    describe('handleNewPlayerEvent (event 29)', () => {
        // @verified 2026-04-18: passive player (faction=0) from pcap adds a Player entity to the list.
        test('pcap-derived spawn: passive player faction=0 adds entity', async () => {
            const fx = await loadFixture('players', 'spawn');
            const msg = fx.messages.find(m => m.parameters['53'] === 0);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.handleNewPlayerEvent(p[0], p);

            expect(handler.getSize()).toBe(1);
            const player = handler.playersList[0];
            expect(player.id).toBe(p[0]);
            expect(player.nickname).toBe(p[1]);
            expect(player.faction).toBe(0);
        });

        // @verified 2026-04-18: faction player (faction=5) lands with stored faction value.
        test('pcap-derived spawn: faction=5 player stores faction field', async () => {
            const fx = await loadFixture('players', 'spawn');
            const msg = fx.messages.find(m => m.parameters['53'] === 5);
            expect(msg).toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.handleNewPlayerEvent(p[0], p);

            expect(handler.playersList[0].faction).toBe(5);
        });

        // @suspect 2026-04-18 PLAY-1 (issue #65): hostile player in unknown zone does not trigger alert because zonesDatabase falls back to 'safe' for missing zones, and isPlayerThreat returns false for 'safe'.
        test('synthetic hostile in unknown zone: alert should fire but does not', () => {
            zonesDatabase.getPvpType.mockReturnValue('safe');
            window.currentMapId = 'UNMAPPED_AVALON_HIDEOUT';
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(handler.getSize()).toBe(1);
            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: duplicate id does not add second entity to list.
        test('synthetic: duplicate spawn for same id keeps list size at 1', () => {
            const params = {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []};
            handler.handleNewPlayerEvent(42, params);
            handler.handleNewPlayerEvent(42, params);

            expect(handler.getSize()).toBe(1);
        });

        // @verified 2026-04-18: duplicate spawn still returns 2 (the normal return value of the method).
        test('synthetic: duplicate spawn returns 2', () => {
            const params = {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []};
            handler.handleNewPlayerEvent(42, params);
            const result = handler.handleNewPlayerEvent(42, params);

            expect(result).toBe(2);
        });

        // @verified 2026-04-18: settingShowPlayers=false causes early return with no entity added.
        test('synthetic: settingShowPlayers=false skips detection and returns 2', () => {
            settingsSync.getBool.mockImplementation(k => k !== 'settingShowPlayers');

            const result = handler.handleNewPlayerEvent(1, {1: 'Bob', 8: '', 53: 0, 51: null, 40: [], 43: []});

            expect(handler.getSize()).toBe(0);
            expect(result).toBe(2);
        });

        // @verified 2026-04-18: when list is at max capacity, new spawn is silently dropped.
        test('synthetic: list at maxPlayers capacity prevents insertion', () => {
            settingsSync.getNumber.mockImplementation((k, d) => k === 'settingMaxPlayersDisplay' ? 2 : d);
            handler.handleNewPlayerEvent(1, {1: 'A', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'B', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(3, {1: 'C', 8: '', 53: 0, 51: null, 40: [], 43: []});

            expect(handler.getSize()).toBe(2);
        });

        // @verified 2026-04-18: passive player in safe zone does not trigger audio.
        test('synthetic: passive faction=0 in safe zone does not play sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('safe');
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: hostile in safe zone does not trigger audio (isPlayerThreat returns false for 'safe').
        test('synthetic: hostile faction=255 in safe zone does not play sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('safe');
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: hostile faction=255 in red zone triggers audio alert.
        test('synthetic: hostile faction=255 in red zone plays sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(playSpy).toHaveBeenCalled();
        });

        // @verified 2026-04-18: in black zone isPlayerThreat returns true for any faction including passive=0.
        test('synthetic: passive faction=0 in black zone plays sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('black');
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});

            expect(playSpy).toHaveBeenCalled();
        });

        // @verified 2026-04-18: alert gate requires mapId to be truthy; null mapId blocks both flash and sound.
        test('synthetic: missing mapId suppresses alert even in red zone', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            window.currentMapId = null;
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: when both settingFlash and settingSound are false, no DOM flash element is created and no audio fires.
        test('synthetic: settingFlash=false and settingSound=false suppress all alerts in red zone', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            settingsSync.getBool.mockImplementation(k => {
                if (k === 'settingFlash' || k === 'settingSound') return false;
                return true;
            });
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(playSpy).not.toHaveBeenCalled();
            expect(document.body.querySelectorAll('.bg-error\\/60').length).toBe(0);
        });

        // @characterization 2026-04-18: settingFlash=true and threat present appends a flash div to document.body.
        test('synthetic: settingFlash=true with threat appends flash div to body', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            settingsSync.getBool.mockImplementation(k => k !== 'settingSound');

            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(document.body.querySelectorAll('.bg-error\\/60').length).toBeGreaterThanOrEqual(1);
        });
    });

    // ---------------------------------------------------------------------------
    // updatePlayerFaction (event 363)
    // ---------------------------------------------------------------------------
    describe('updatePlayerFaction (event 363)', () => {
        // @verified 2026-04-18: pcap faction-change event has newFaction=5 for all 3 observed messages.
        test('pcap-derived faction-change: faction stored on known player', async () => {
            const fx = await loadFixture('players', 'faction-change');
            const msg = fx.messages[0];
            const id = msg.parameters['0'];
            const newFaction = msg.parameters['1'];

            handler.handleNewPlayerEvent(id, {1: 'TestPlayer', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.updatePlayerFaction(id, newFaction);

            const player = handler.playersList.find(p => p.id === id);
            expect(player.faction).toBe(newFaction);
        });

        // @verified 2026-04-18: unknown id is a no-op; no exception, no entity created.
        test('synthetic: unknown id is no-op', () => {
            expect(() => handler.updatePlayerFaction(9999, 255)).not.toThrow();
            expect(handler.getSize()).toBe(0);
        });

        // @verified 2026-04-18: passive to hostile transition in red zone fires audio alert.
        test('synthetic: passive-to-hostile transition in red zone plays sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []});
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.updatePlayerFaction(1, 255);

            expect(playSpy).toHaveBeenCalled();
        });

        // @verified 2026-04-18: already-hostile player does not re-fire alert on repeated hostile update.
        test('synthetic: hostile-to-hostile does not play sound again', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 255, 51: null, 40: [], 43: []});
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.updatePlayerFaction(1, 255);

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: hostile-to-passive transition does not play sound.
        test('synthetic: hostile-to-passive does not play sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 255, 51: null, 40: [], 43: []});
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.updatePlayerFaction(1, 0);

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @verified 2026-04-18: passive-to-hostile in safe zone does not play sound (isPlayerThreat false for safe).
        test('synthetic: passive-to-hostile in safe zone does not play sound', () => {
            zonesDatabase.getPvpType.mockReturnValue('safe');
            handler.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []});
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.updatePlayerFaction(1, 255);

            expect(playSpy).not.toHaveBeenCalled();
        });

        // @suspect 2026-04-18 PLAY-2 (issue #36): alreadyIgnoredPlayers list is never consulted in triggerHostileAlert. A player pushed into that list still triggers a sound alert on faction change.
        test('synthetic PLAY-2: ignored player still triggers alert on faction change in red zone', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.alreadyIgnoredPlayers = [{id: 1}];
            const playSpy = vi.spyOn(handler.audio, 'play').mockResolvedValue();

            handler.updatePlayerFaction(1, 255);

            expect(playSpy).toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------------------
    // handleMountedPlayerEvent (event 211)
    // ---------------------------------------------------------------------------
    describe('handleMountedPlayerEvent (event 211)', () => {
        // @verified 2026-04-18: pcap message with param11=true (boolean) sets mounted=true.
        test('pcap-derived mounted: param11=true sets player mounted', async () => {
            const fx = await loadFixture('players', 'mounted');
            const msg = fx.messages.find(m => m.parameters['11'] === true);
            expect(msg).toBeDefined();
            const id = msg.parameters['0'];

            handler.handleNewPlayerEvent(id, {1: 'Rider', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleMountedPlayerEvent(id, normalizeParams(msg.parameters));

            expect(handler.playersList.find(p => p.id === id).mounted).toBe(true);
        });

        // @verified 2026-04-18: pcap message with param10=-1 (number) is coerced equal to '-1' string and sets mounted=true.
        test('pcap-derived mounted: param10=-1 (numeric) sets player mounted via ten==-1 branch', async () => {
            const fx = await loadFixture('players', 'mounted');
            const msg = fx.messages.find(m => m.parameters['10'] === -1 && m.parameters['11'] !== true);
            if (!msg) {
                // All pcap messages with param10=-1 also have param11=true; use synthetic.
                const id = 77;
                handler.handleNewPlayerEvent(id, {1: 'MountUser', 8: '', 53: 0, 51: null, 40: [], 43: []});
                handler.handleMountedPlayerEvent(id, {10: -1, 11: false});
                expect(handler.playersList.find(p => p.id === id).mounted).toBe(true);
            } else {
                const id = msg.parameters['0'];
                handler.handleNewPlayerEvent(id, {1: 'Rider', 8: '', 53: 0, 51: null, 40: [], 43: []});
                handler.handleMountedPlayerEvent(id, normalizeParams(msg.parameters));
                expect(handler.playersList.find(p => p.id === id).mounted).toBe(true);
            }
        });

        // @verified 2026-04-18: param11=false and param10 absent sets mounted=false.
        test('synthetic: param11=false and no param10 sets mounted=false', () => {
            const id = 88;
            handler.handleNewPlayerEvent(id, {1: 'Walker', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.playersList[0].mounted = true;

            handler.handleMountedPlayerEvent(id, {10: undefined, 11: false});

            expect(handler.playersList[0].mounted).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // Health updates (events 91 and 6)
    // ---------------------------------------------------------------------------
    describe('UpdatePlayerHealth (event 91)', () => {
        // @verified 2026-04-18: both currentHealth and initialHealth stored for known player.
        test('synthetic: sets currentHealth and initialHealth for known player', () => {
            handler.handleNewPlayerEvent(1, {1: 'Bob', 8: '', 53: 0, 51: null, 40: [], 43: []});

            handler.UpdatePlayerHealth({0: 1, 2: 850, 3: 1000});

            const p = handler.playersList[0];
            expect(p.currentHealth).toBe(850);
            expect(p.initialHealth).toBe(1000);
        });

        // @verified 2026-04-18: unknown id is a no-op.
        test('synthetic: unknown id is no-op', () => {
            expect(() => handler.UpdatePlayerHealth({0: 9999, 2: 500, 3: 1000})).not.toThrow();
        });
    });

    describe('UpdatePlayerLooseHealth (event 6)', () => {
        // @verified 2026-04-18: sets currentHealth from param[3], does not touch initialHealth.
        test('synthetic: sets currentHealth from param[3] for known player', () => {
            handler.handleNewPlayerEvent(1, {1: 'Bob', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.playersList[0].initialHealth = 1000;

            handler.UpdatePlayerLooseHealth({0: 1, 3: 600});

            const p = handler.playersList[0];
            expect(p.currentHealth).toBe(600);
            expect(p.initialHealth).toBe(1000);
        });

        // @verified 2026-04-18: unknown id is a no-op.
        test('synthetic: unknown id is no-op', () => {
            expect(() => handler.UpdatePlayerLooseHealth({0: 9999, 3: 200})).not.toThrow();
        });
    });

    // ---------------------------------------------------------------------------
    // updateItems (event 90)
    // ---------------------------------------------------------------------------
    describe('updateItems (event 90)', () => {
        // @verified 2026-04-18: pcap equipment message stores items on the matching player.
        test('pcap-derived equipment: items stored and touch called', async () => {
            const fx = await loadFixture('players', 'equipment');
            const msg = fx.messages[0];
            const id = msg.parameters['0'];
            const items = msg.parameters['2'];

            handler.handleNewPlayerEvent(id, {1: 'Geared', 8: '', 53: 0, 51: null, 40: [], 43: []});
            const before = handler.playersList[0].lastUpdateTime;

            handler.updateItems(id, normalizeParams(msg.parameters));

            const p = handler.playersList[0];
            expect(p.items).toEqual(items);
            expect(p.lastUpdateTime).toBeGreaterThanOrEqual(before);
        });

        // @verified 2026-04-18: unknown id results in no entity created and no throw.
        test('synthetic: unknown id is no-op', () => {
            expect(() => handler.updateItems(9999, {2: [1, 2, 3]})).not.toThrow();
            expect(handler.getSize()).toBe(0);
        });

        // @characterization 2026-04-18: current code: if Parameters[2] is undefined, items remain null on player.
        test('synthetic: missing Parameters[2] leaves items as null', () => {
            handler.handleNewPlayerEvent(1, {1: 'Bob', 8: '', 53: 0, 51: null, 40: [], 43: []});

            handler.updateItems(1, {0: 1});

            expect(handler.playersList[0].items).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // Local player position (opRequest 22)
    // ---------------------------------------------------------------------------
    describe('updateLocalPlayerPosition', () => {
        // @verified 2026-04-18: posX and posY stored on localPlayer.
        test('synthetic: stores posX and posY on localPlayer', () => {
            handler.updateLocalPlayerPosition(123.4, 567.8);

            expect(handler.localPlayer.posX).toBe(123.4);
            expect(handler.localPlayer.posY).toBe(567.8);
        });
    });

    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------
    describe('lifecycle', () => {
        // @verified 2026-04-18: removePlayer removes matching entity from list.
        test('synthetic: removePlayer removes the target entity', () => {
            handler.handleNewPlayerEvent(1, {1: 'A', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'B', 8: '', 53: 0, 51: null, 40: [], 43: []});

            handler.removePlayer(1);

            expect(handler.getSize()).toBe(1);
            expect(handler.playersList[0].id).toBe(2);
        });

        // @verified 2026-04-18: Clear empties playersList and resets alreadyIgnoredPlayers.
        test('synthetic: Clear empties playersList and resets alreadyIgnoredPlayers', () => {
            handler.handleNewPlayerEvent(1, {1: 'A', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.alreadyIgnoredPlayers = [{id: 1}];

            handler.Clear();

            expect(handler.getSize()).toBe(0);
            expect(handler.alreadyIgnoredPlayers).toEqual([]);
        });

        // @verified 2026-04-18: cleanupStaleEntities removes players older than maxAgeMs and returns count.
        test('synthetic: cleanupStaleEntities removes stale players', () => {
            handler.handleNewPlayerEvent(1, {1: 'Old', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Fresh', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.playersList[0].lastUpdateTime = Date.now() - 400000;
            handler.playersList[1].lastUpdateTime = Date.now();

            const removed = handler.cleanupStaleEntities(300000);

            expect(removed).toBe(1);
            expect(handler.getSize()).toBe(1);
            expect(handler.playersList[0].id).toBe(2);
        });

        // @verified 2026-04-18: enforceMaxSize removes oldest entries above the limit.
        test('synthetic: enforceMaxSize trims oldest entries and returns removed count', () => {
            handler.handleNewPlayerEvent(1, {1: 'Old', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Middle', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(3, {1: 'New', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.playersList[0].lastUpdateTime = Date.now() - 3000;
            handler.playersList[1].lastUpdateTime = Date.now() - 2000;
            handler.playersList[2].lastUpdateTime = Date.now() - 1000;

            const removed = handler.enforceMaxSize(2);

            expect(removed).toBe(1);
            expect(handler.getSize()).toBe(2);
        });

        // @verified 2026-04-18: getSize returns the current player count.
        test('synthetic: getSize reflects current list size', () => {
            expect(handler.getSize()).toBe(0);
            handler.handleNewPlayerEvent(1, {1: 'A', 8: '', 53: 0, 51: null, 40: [], 43: []});
            expect(handler.getSize()).toBe(1);
        });
    });

    // ---------------------------------------------------------------------------
    // getFilteredPlayers
    // ---------------------------------------------------------------------------
    describe('getFilteredPlayers', () => {
        // @verified 2026-04-18: in black zone with settingDangerousPlayers=false, list is empty regardless of player faction.
        test('synthetic: black zone with settingDangerousPlayers=false returns empty list', () => {
            zonesDatabase.getPvpType.mockReturnValue('black');
            settingsSync.getBool.mockImplementation(k => k !== 'settingDangerousPlayers');
            handler.handleNewPlayerEvent(1, {1: 'A', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'B', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(handler.getFilteredPlayers()).toHaveLength(0);
        });

        // @verified 2026-04-18: in red zone with settingPassivePlayers=false, passive players are removed but hostile kept.
        test('synthetic: red zone with settingPassivePlayers=false removes passive, keeps hostile', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            settingsSync.getBool.mockImplementation(k => {
                if (k === 'settingPassivePlayers') return false;
                return true;
            });
            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            const result = handler.getFilteredPlayers();

            expect(result).toHaveLength(1);
            expect(result[0].faction).toBe(255);
        });
    });

    // ---------------------------------------------------------------------------
    // getPlayersByType
    // ---------------------------------------------------------------------------
    describe('getPlayersByType', () => {
        // @verified 2026-04-18: in black zone, all players land in hostile bucket, faction and passive buckets are empty.
        test('synthetic: black zone places all players in hostile bucket', () => {
            zonesDatabase.getPvpType.mockReturnValue('black');
            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Faction', 8: '', 53: 5, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(3, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            const buckets = handler.getPlayersByType();

            expect(buckets.hostile).toHaveLength(3);
            expect(buckets.faction).toHaveLength(0);
            expect(buckets.passive).toHaveLength(0);
        });

        // @verified 2026-04-18: outside black zone, players are sorted into correct buckets by isPassive/isFactionPlayer/isHostile.
        test('synthetic: red zone buckets players by faction type', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Faction', 8: '', 53: 5, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(3, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            const buckets = handler.getPlayersByType();

            expect(buckets.passive.map(p => p.id)).toContain(1);
            expect(buckets.faction.map(p => p.id)).toContain(2);
            expect(buckets.hostile.map(p => p.id)).toContain(3);
        });
    });

    describe('triggerScreenFlash', () => {
        // @verified 2026-04-24: triggerScreenFlash stamps lastFlashAt so RadarRenderer can mirror the alert on the radar overlay.
        test('synthetic: triggerScreenFlash sets lastFlashAt to a recent timestamp', () => {
            const before = performance.now();
            handler.triggerScreenFlash();
            expect(handler.lastFlashAt).toBeGreaterThanOrEqual(before);
        });

        // @verified 2026-04-24: triggerScreenFlash appends a DOM overlay visible to the full-viewport flash.
        test('synthetic: triggerScreenFlash appends bg-error/60 div to body', () => {
            handler.triggerScreenFlash();
            expect(document.body.querySelectorAll('.bg-error\\/60').length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getThreatPlayers (zone-aware threat list)', () => {
        // @verified 2026-04-24: safe zone yields zero threats regardless of faction.
        test('synthetic: safe zone returns no threats', () => {
            zonesDatabase.getPvpType.mockReturnValue('safe');
            handler.handleNewPlayerEvent(1, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(handler.getThreatPlayers()).toHaveLength(0);
        });

        // @verified 2026-04-24: red zone returns only faction=255 players.
        test('synthetic: red zone returns faction=255 only', () => {
            zonesDatabase.getPvpType.mockReturnValue('red');
            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            const threats = handler.getThreatPlayers();
            expect(threats).toHaveLength(1);
            expect(threats[0].id).toBe(2);
        });

        // @verified 2026-04-24: black zone returns every player regardless of faction (fix for Pulsating Border bug).
        test('synthetic: black zone returns passive AND hostile as threats', () => {
            zonesDatabase.getPvpType.mockReturnValue('black');
            handler.handleNewPlayerEvent(1, {1: 'Passive', 8: '', 53: 0, 51: null, 40: [], 43: []});
            handler.handleNewPlayerEvent(2, {1: 'Hostile', 8: '', 53: 255, 51: null, 40: [], 43: []});

            expect(handler.getThreatPlayers()).toHaveLength(2);
        });
    });
});

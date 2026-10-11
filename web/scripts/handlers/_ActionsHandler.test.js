// pcap-derived: actions/*.json range cuts of the anonymized 2026-09-03 and 2026-05-12 captures, fed to the handler by event code.
// synthetic: actions/synthetic-*.json written by hand, windows under fake timers, the local id, invalid positions and the
// zone and faction variants absent from the corpus.

import {describe, test, expect, beforeAll, beforeEach, afterEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';
import {EventCodes} from '../utils/EventCodes.js';
import {OperationCodes} from '../utils/OperationCodes.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        get: vi.fn((_k, d) => d),
        getBool: vi.fn(() => true),
        getNumber: vi.fn((_k, d) => d),
        getFloat: vi.fn((_k, d) => d),
        getJSON: vi.fn(() => null),
    },
}));

const {ActionsHandler, ACTION_LIFETIME_MS, MOUNT_WINDOW_MS} = await import('./ActionsHandler.js');
const {PlayersHandler} = await import('./PlayersHandler.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;
const EventRouter = await import('../core/EventRouter.js');
const {ActionsDrawing} = await import('../drawings/ActionsDrawing.js');
const PlayerListRenderer = await import('../core/PlayerListRenderer.js');

const SAFE = '0000';
const YELLOW = '0201';
const RED = '2203';
const BLACK = '0317';
const LOCAL = 900001;
const MOUNT_CAST_GAP = 8;

let players;
let actions;

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

beforeEach(() => {
    vi.clearAllMocks();
    settingsSync.getBool.mockImplementation(key => key !== 'settingFlash' && key !== 'settingSound');
    settingsSync.getJSON.mockReturnValue(null);
    window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
    window.currentMapId = SAFE;
    sessionStorage.clear();
    players = new PlayersHandler();
    actions = new ActionsHandler(players);
});

afterEach(() => {
    vi.useRealTimers();
});

function spawn(id, nickname, faction = 0) {
    players.handleNewPlayerEvent(id, {1: nickname, 8: '', 53: faction, 51: null, 40: [], 43: []});
}

async function replay(scenario) {
    const fx = await loadFixture('actions', scenario);
    const events = fx.messages.filter(m => m.kind === 'event').map(m => normalizeParams(m.parameters));
    for (const p of events.filter(e => e[252] === EventCodes.NewCharacter)) {
        players.handleNewPlayerEvent(p[0], p);
    }
    return events;
}

function markerOf(id) {
    return actions.getMarkers(Date.now()).find(m => m.playerId === id);
}

describe('self-cast presence', () => {
    // @verified 2026-09-23: a self-cast carries the caster's own position at [2] (anonymized 2026-05 and 2026-09
    // captures), cut in actions/self-cast.json.
    test('pcap-derived self-cast: each self-cast of a known player places a presence marker at Parameters[2]', async () => {
        const events = await replay('self-cast');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && p[0] === p[1] && players.getPlayer(p[1]));
        expect(casts.length).toBeGreaterThan(0);

        for (const p of casts) {
            actions.onCastSpell(p);
            expect(markerOf(p[1])).toMatchObject({
                playerId: p[1], x: p[2][0], y: p[2][1], family: 'presence', selfCast: true, casterId: null,
            });
        }
    });

    // @verified 2026-09-23: self-casts of ids missing from the players list (mobs, the local player) place nothing, so
    // actions/self-cast.json yields one marker per listed caster and nothing else.
    test('pcap-derived self-cast: one marker per known caster and none for other ids', async () => {
        const events = await replay('self-cast');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && p[0] === p[1]);

        casts.forEach(p => actions.onCastSpell(p));

        const known = casts.map(p => p[1]).filter((id, i, all) => players.getPlayer(id) && all.indexOf(id) === i);
        expect(actions.getMarkers(Date.now()).map(m => m.playerId).sort()).toEqual(known.sort());
    });

    // @verified 2026-09-23: every marker stamps the player's lastActionAt through noteAction, which orders the list.
    test('synthetic: a marker notes the action on the player', () => {
        spawn(11, 'Alice');
        const noteAction = vi.spyOn(players, 'noteAction');

        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});

        expect(noteAction).toHaveBeenCalledWith(11);
    });

    // @verified 2026-09-23: a newer action of the same player replaces its marker.
    test('synthetic: a cast 4 s after the first replaces the marker, which shows age 0', () => {
        vi.useFakeTimers();
        spawn(11, 'Alice');
        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});

        vi.advanceTimersByTime(4000);
        actions.onCastSpell({0: 11, 1: 11, 2: [30, 40]});

        const markers = actions.getMarkers(Date.now());
        expect(markers).toHaveLength(1);
        expect(markers[0]).toMatchObject({playerId: 11, x: 30, y: 40, at: Date.now(), lastUpdateTime: Date.now()});
    });

    // @verified 2026-09-23: a cast whose target is missing from the players list places nothing.
    test('synthetic: a self-cast of an unknown id places nothing', () => {
        actions.onCastSpell({0: 12, 1: 12, 2: [10, 20]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a position is an array of at least two finite numbers, anything else drops the event.
    test.each([
        ['missing', undefined],
        ['one number', [10]],
        ['NaN', [Number.NaN, 20]],
        ['string', '10,20'],
    ])('synthetic: a self-cast with a %s position places nothing', (_label, position) => {
        spawn(11, 'Alice');

        actions.onCastSpell({0: 11, 1: 11, 2: position});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the local player's own actions never give a marker, even when its id is in the players list.
    test('synthetic: a self-cast of the local id places nothing even when that id is a listed player', () => {
        spawn(LOCAL, 'Me');
        actions.setLocalId(LOCAL);

        actions.onCastSpell({0: LOCAL, 1: LOCAL, 2: [10, 20]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a later Join response replaces the local id.
    test('synthetic: setLocalId replaces the previous local id', () => {
        actions.setLocalId(LOCAL);
        actions.setLocalId(LOCAL + 1);

        expect(actions.localId).toBe(LOCAL + 1);
    });

    // @verified 2026-10-10: a page change rebuilds the handler with no new Join response; the 2026-10-10 live capture lost
    // the attacker flag of a whole fight that way.
    test('synthetic: a handler rebuilt after a page change keeps the local id of the last Join response', () => {
        actions.setLocalId(LOCAL);

        const rebuilt = new ActionsHandler(players);

        expect(rebuilt.localId).toBe(LOCAL);
    });

    // @verified 2026-10-10: Move, NewCharacter and NewMob never carry the local id (12 zones of the 2026-10-10 capture),
    // so one that names it proves the saved id belongs to another entity, after a Join the page never saw.
    test('synthetic: an entity naming the saved local id drops it, for this handler and the next one', () => {
        actions.setLocalId(LOCAL);

        actions.onOtherEntity(LOCAL);

        expect(actions.localId).toBeNull();
        expect(new ActionsHandler(players).localId).toBeNull();
    });

    // @verified 2026-10-10: the server forwards a Join response whatever its return code, so one without [0] must not
    // turn every untargeted cast of a dangerous player into an attack on the local player.
    test('synthetic: a Join response without an integer id leaves no local id, and an untargeted cast flags nobody', () => {
        window.currentMapId = BLACK;
        spawn(21, 'Enemy');

        actions.setLocalId(undefined);
        actions.onCastStart({0: 21, 2: [1, 2]});
        actions.onCastSpell({0: 21, 2: [1, 2]});

        expect(actions.localId).toBeNull();
        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-10-10: any other id leaves the local id alone.
    test('synthetic: an entity with another id keeps the local id', () => {
        actions.setLocalId(LOCAL);

        actions.onOtherEntity(LOCAL + 1);

        expect(actions.localId).toBe(LOCAL);
    });
});

describe('teleport, respawn and forced movement', () => {
    // @verified 2026-09-23: Teleport carries the player at [0] and its destination at [2], cut in actions/teleport.json.
    test('pcap-derived teleport: a presence marker at the destination', async () => {
        const events = await replay('teleport');
        const moves = events.filter(p => p[252] === EventCodes.Teleport && players.getPlayer(p[0]));
        expect(moves.length).toBeGreaterThan(0);

        for (const p of moves) {
            actions.onTeleport(p);
            expect(markerOf(p[0])).toMatchObject({x: p[2][0], y: p[2][1], family: 'presence', selfCast: false});
        }
    });

    // @verified 2026-09-23: Respawn carries the player at [0] and the respawn point at [2], where its next self-cast
    // lands in actions/respawn.json.
    test('pcap-derived respawn: a presence marker at the respawn point', async () => {
        const events = await replay('respawn');
        const respawns = events.filter(p => p[252] === EventCodes.Respawn && players.getPlayer(p[0]));
        expect(respawns.length).toBeGreaterThan(0);

        for (const p of respawns) {
            actions.onRespawn(p);
            expect(markerOf(p[0])).toMatchObject({x: p[2][0], y: p[2][1], family: 'presence', selfCast: false});
        }
    });

    // @verified 2026-09-23: ForcedMovement carries the player at [0] and its path at [5], whose first pair is the
    // position before the push, cut in actions/forced-movement.json.
    test('pcap-derived forced-movement: a mobility marker at the first pair of Parameters[5]', async () => {
        const events = await replay('forced-movement');
        const pushes = events.filter(p => p[252] === EventCodes.ForcedMovement && players.getPlayer(p[0]));
        expect(pushes.length).toBeGreaterThan(0);

        for (const p of pushes) {
            actions.onForcedMovement(p);
            expect(markerOf(p[0])).toMatchObject({x: p[5][0], y: p[5][1], family: 'mobility', selfCast: false});
        }
    });

    // @verified 2026-09-23: an event of an id missing from the players list places nothing.
    test.each([
        ['ForcedMovement', 'onForcedMovement', {0: 31, 5: [1, 2, 3, 4]}],
        ['Teleport', 'onTeleport', {0: 31, 2: [1, 2]}],
        ['Respawn', 'onRespawn', {0: 31, 2: [1, 2]}],
    ])('synthetic: %s of an unknown id places nothing', (_name, method, params) => {
        actions[method](params);

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the local player's own actions never give a marker.
    test('synthetic: a teleport of the local id places nothing even when that id is a known player', () => {
        spawn(31, 'Carol');
        actions.setLocalId(31);

        actions.onTeleport({0: 31, 2: [1, 2]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a push whose path holds fewer than two finite numbers is dropped.
    test('synthetic: a forced movement with a one-number path places nothing', () => {
        spawn(31, 'Carol');

        actions.onForcedMovement({0: 31, 5: [1]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });
});

describe('marker lifetime', () => {
    // @verified 2026-09-23: a marker lives 10 s and is then no longer stored.
    test('synthetic: a marker is kept at 9999 ms and dropped from the list at 10000 ms', () => {
        vi.useFakeTimers();
        spawn(11, 'Alice');
        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});

        vi.advanceTimersByTime(ACTION_LIFETIME_MS - 1);
        expect(actions.getMarkers(Date.now())).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect(actions.markerList).toEqual([]);
    });

    // @verified 2026-09-23: Leave removes the player's marker at once and keeps the others.
    test('synthetic: removePlayer drops only that player marker', () => {
        spawn(11, 'Alice');
        spawn(12, 'Bob');
        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});
        actions.onCastSpell({0: 12, 1: 12, 2: [30, 40]});

        actions.removePlayer(11);

        expect(actions.getMarkers(Date.now()).map(m => m.playerId)).toEqual([12]);
    });

    // @verified 2026-09-23: clear drops markers and healed pairs and keeps the local id for the next Join response.
    test('synthetic: clear drops markers and healed pairs and keeps the local id', () => {
        spawn(11, 'Alice');
        actions.setLocalId(LOCAL);
        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});
        actions.healedPairs.push([11, LOCAL]);

        actions.clear();

        expect(actions.markerList).toEqual([]);
        expect(actions.healedPairs).toEqual([]);
        expect(actions.localId).toBe(LOCAL);
    });
});

describe('mount', () => {
    // @verified 2026-09-23: a Mounted follows the rider's self-cast within a few messages in the anonymized captures, as
    // in actions/mount-up.json.
    test('pcap-derived mount-up: a Mounted after the rider self-cast turns the marker into a mount marker', async () => {
        const events = await replay('mount-up');
        const pairs = [];
        events.forEach((p, i) => {
            if (p[252] !== EventCodes.Mounted || !players.getPlayer(p[0])) return;
            const cast = events.slice(Math.max(0, i - MOUNT_CAST_GAP), i)
                .filter(c => c[252] === EventCodes.CastSpell && c[0] === p[0] && c[1] === p[0])
                .at(-1);
            if (cast) pairs.push([cast, p]);
        });
        expect(pairs.length).toBeGreaterThan(0);

        for (const [cast, mounted] of pairs) {
            actions.onCastSpell(cast);
            actions.onMounted(mounted[0]);
            expect(markerOf(mounted[0])).toMatchObject({x: cast[2][0], y: cast[2][1], family: 'mount'});
        }
    });

    // @verified 2026-09-23: the window is strictly under 2 s, the time of the action is kept and the upgrade refreshes
    // lastUpdateTime.
    test.each([
        [MOUNT_WINDOW_MS - 1, 'mount', true],
        [MOUNT_WINDOW_MS, 'presence', false],
    ])('synthetic: a Mounted %i ms after the self-cast leaves a %s marker', (delay, family, touched) => {
        vi.useFakeTimers();
        spawn(11, 'Alice');
        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});
        const at = Date.now();

        vi.advanceTimersByTime(delay);
        actions.onMounted(11);

        expect(markerOf(11)).toMatchObject({family, at, x: 10, y: 20, lastUpdateTime: touched ? Date.now() : at});
    });

    // @verified 2026-09-23: only a self-cast presence marker can become a mount marker.
    test.each([
        ['Teleport', 'onTeleport', {0: 11, 2: [10, 20]}, 'presence'],
        ['ForcedMovement', 'onForcedMovement', {0: 11, 5: [10, 20]}, 'mobility'],
    ])('synthetic: a Mounted after a %s keeps the marker family', (_name, method, params, family) => {
        spawn(11, 'Alice');
        actions[method](params);

        actions.onMounted(11);

        expect(markerOf(11).family).toBe(family);
    });

    // @verified 2026-09-23: a Mounted with no recent self-cast places nothing but still notes the action.
    test('synthetic: a Mounted with no marker places nothing and notes the action', () => {
        spawn(11, 'Alice');
        const noteAction = vi.spyOn(players, 'noteAction');

        actions.onMounted(11);

        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect(noteAction).toHaveBeenCalledWith(11);
    });

    // @verified 2026-09-23: a Mounted of an id missing from the players list changes nothing and does not throw.
    test('synthetic: a Mounted of an unknown id changes nothing', () => {
        expect(() => actions.onMounted(99)).not.toThrow();
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });
});

describe('self entries of CastSpells and CastStart', () => {
    // @verified 2026-09-23: pair i of CastSpells [2] belongs to target i of [1], as in actions/cast-spells.json; a self
    // entry is a self-cast.
    test('synthetic: the caster entry of a CastSpells places a presence marker at its own pair', () => {
        spawn(11, 'Alice');

        actions.onCastSpells({0: 11, 1: [77, 11], 2: [1, 2, 3, 4]});

        expect(actions.getMarkers(Date.now())).toHaveLength(1);
        expect(markerOf(11)).toMatchObject({x: 3, y: 4, family: 'presence', selfCast: true});
    });

    // @verified 2026-09-23: target and pair lists of different lengths are read up to the shorter one.
    test('synthetic: a CastSpells entry with no pair places nothing', () => {
        spawn(11, 'Alice');

        actions.onCastSpells({0: 11, 1: [77, 11], 2: [1, 2]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a byte-array target list reaches the browser as {type: 'Buffer', data} and is dropped.
    test('synthetic: a CastSpells with a non-array target list places nothing', () => {
        spawn(11, 'Alice');

        actions.onCastSpells({0: 11, 1: {type: 'Buffer', data: [11, 0, 0, 0]}, 2: [1, 2]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: CastStart carries its target at [7] and the target position at [2] when present, as in
    // actions/cast-start-target.json.
    test('synthetic: a CastStart on the caster places a presence marker at Parameters[2]', () => {
        spawn(11, 'Alice');

        actions.onCastStart({0: 11, 7: 11, 2: [5, 6]});

        expect(markerOf(11)).toMatchObject({x: 5, y: 6, family: 'presence', selfCast: true});
    });

    // @verified 2026-09-23: a CastStart without [7] carries a ground point, not a player position, as in
    // actions/ground-cast.json.
    test('synthetic: a CastStart without a target places nothing', () => {
        spawn(11, 'Alice');

        actions.onCastStart({0: 11, 2: [5, 6]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });
});

async function routeFixture(scenario, zone) {
    const fx = await loadFixture('actions', scenario);
    const messages = fx.messages.map(m => ({kind: m.kind, p: normalizeParams(m.parameters)}));
    const inert = new Proxy({}, {get: () => () => undefined});
    EventRouter.reset();
    EventRouter.init({
        handlers: {
            playersHandler: players, actionsHandler: actions, mobsHandler: inert, harvestablesHandler: inert,
            chestsHandler: inert, dungeonsHandler: inert, fishingHandler: inert, wispCageHandler: inert,
        },
        map: {id: -1, hX: 0, hY: 0, isBZ: false},
        radarRenderer: null,
    });
    messages.filter(m => m.kind === 'response').forEach(m => EventRouter.onResponse(m.p, () => {
        players.Clear();
        actions.clear();
    }));
    if (zone) window.currentMapId = zone;
    messages.filter(m => m.kind === 'event').forEach(m => EventRouter.onEvent(m.p));
    return messages;
}

describe('map change', () => {
    // @verified 2026-09-23: a ChangeCluster response (router/change-cluster.json, map 0000) runs the handler clear, which
    // drops the players, the markers and the heal memory; the responses run before the queued events, as live.
    test('pcap-derived self-cast then change-cluster: no player, marker or heal pair survives', async () => {
        await routeFixture('self-cast');
        actions.healedPairs.push([players.playersList[0].id, actions.localId]);
        expect(actions.getMarkers(Date.now()).length).toBeGreaterThan(0);

        const fx = await loadFixture('router', 'change-cluster');
        EventRouter.onResponse(normalizeParams(fx.messages[0].parameters), () => {
            players.Clear();
            actions.clear();
        });

        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect(players.playersList).toEqual([]);
        expect(actions.healedPairs).toEqual([]);
    });
});

describe('casts between players', () => {
    // @verified 2026-09-23: in black zone 0317 every player not ignored is dangerous, so the target of a cast between two
    // players in actions/cast-between-players.json gets a combat marker at [2] with the caster id.
    test('pcap-derived cast-between-players: in a black zone the target gets a combat marker with the caster id', async () => {
        window.currentMapId = BLACK;
        const events = await replay('cast-between-players');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && p[0] !== p[1]
            && players.getPlayer(p[0]) && players.getPlayer(p[1]));
        expect(casts.length).toBeGreaterThan(0);

        for (const p of casts) {
            actions.onCastSpell(p);
            expect(markerOf(p[1])).toMatchObject({
                x: p[2][0], y: p[2][1], family: 'combat', casterId: p[0], selfCast: false,
            });
        }
    });

    // @verified 2026-09-23: the same casts in safe zone 0000 give presence, nobody is dangerous there.
    test('pcap-derived cast-between-players: in a safe zone the target gets a presence marker with the caster id', async () => {
        const events = await replay('cast-between-players');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && p[0] !== p[1]
            && players.getPlayer(p[0]) && players.getPlayer(p[1]));
        expect(casts.length).toBeGreaterThan(0);

        for (const p of casts) {
            actions.onCastSpell(p);
            expect(markerOf(p[1])).toMatchObject({x: p[2][0], y: p[2][1], family: 'presence', casterId: p[0]});
        }
    });

    // @verified 2026-09-23: pair i of CastSpells [2] belongs to target i of [1], as in actions/cast-spells.json in black
    // zone 0317; every known target gets its own marker.
    test('pcap-derived cast-spells: each known target gets a marker at its own pair', async () => {
        window.currentMapId = BLACK;
        const events = await replay('cast-spells');
        const bursts = events.filter(p => p[252] === EventCodes.CastSpells && Array.isArray(p[1]) && players.getPlayer(p[0]));
        expect(bursts.some(p => p[1].some(t => t !== p[0] && players.getPlayer(t)))).toBe(true);

        for (const p of bursts) {
            actions.onCastSpells(p);
            p[1].forEach((target, i) => {
                if (!players.getPlayer(target)) return;
                expect(markerOf(target)).toMatchObject({
                    x: p[2][2 * i], y: p[2][2 * i + 1], family: target === p[0] ? 'presence' : 'combat',
                });
            });
        }
    });

    // @verified 2026-09-23: CastStart carries its target at [7] and the target position at [2], as in
    // actions/cast-start-target.json in safe zone 0000.
    test('pcap-derived cast-start-target: a CastStart with a known target marks the target at Parameters[2]', async () => {
        const events = await replay('cast-start-target');
        const starts = events.filter(p => p[252] === EventCodes.CastStart
            && players.getPlayer(p[0]) && players.getPlayer(p[7]));
        expect(starts.some(p => p[0] !== p[7])).toBe(true);

        for (const p of starts) {
            actions.onCastStart(p);
            expect(markerOf(p[7])).toMatchObject({x: p[2][0], y: p[2][1], family: 'presence', selfCast: p[0] === p[7]});
        }
    });

    // @verified 2026-09-23: combat when the caster or the target passes the spawn alert gate (red and yellow: faction
    // 255; black: everyone; safe: nobody).
    test.each([
        ['red', RED, 255, 0, 'combat'],
        ['red', RED, 0, 255, 'combat'],
        ['red', RED, 0, 0, 'presence'],
        ['red', RED, 3, 0, 'presence'],
        ['yellow', YELLOW, 255, 0, 'combat'],
        ['yellow', YELLOW, 0, 3, 'presence'],
        ['black', BLACK, 0, 0, 'combat'],
        ['safe', SAFE, 255, 255, 'presence'],
    ])('synthetic: %s zone %s, caster faction %i on target faction %i gives %s', (_label, zone, casterFaction, targetFaction, family) => {
        window.currentMapId = zone;
        spawn(41, 'Caster', casterFaction);
        spawn(42, 'Target', targetFaction);

        actions.onCastSpell({0: 41, 1: 42, 2: [5, 6]});

        expect(markerOf(42)).toMatchObject({family, casterId: 41, x: 5, y: 6});
    });

    // @verified 2026-09-23: a player in the ignore list is never dangerous, like the spawn alert.
    test('synthetic: a hostile caster in the ignore list gives presence in a red zone', () => {
        window.currentMapId = RED;
        settingsSync.getJSON.mockImplementation(key => key === 'ignoreList' ? ['Caster'] : null);
        spawn(41, 'Caster', 255);
        spawn(42, 'Target', 0);

        actions.onCastSpell({0: 41, 1: 42, 2: [5, 6]});

        expect(markerOf(42).family).toBe('presence');
    });

    // @verified 2026-09-23: a remembered heal pair never yields combat, in either direction and whatever order the pair
    // was stored in.
    test.each([
        [[41, 42], 41, 42],
        [[41, 42], 42, 41],
        [[42, 41], 41, 42],
    ])('synthetic: black zone, healed pair %j, cast %i on %i gives presence', (pair, caster, target) => {
        window.currentMapId = BLACK;
        spawn(41, 'Healer');
        spawn(42, 'Friend');
        actions.healedPairs.push(pair);

        actions.onCastSpell({0: caster, 1: target, 2: [5, 6]});

        expect(markerOf(target)).toMatchObject({family: 'presence', casterId: caster});
    });

    // @verified 2026-09-23: a heal pair of other players leaves combat in place.
    test('synthetic: black zone, a heal pair of other ids does not soften the cast', () => {
        window.currentMapId = BLACK;
        spawn(41, 'Caster');
        spawn(42, 'Target');
        actions.healedPairs.push([41, 43]);

        actions.onCastSpell({0: 41, 1: 42, 2: [5, 6]});

        expect(markerOf(42).family).toBe('combat');
    });
});

describe('casts that place nothing', () => {
    // @verified 2026-09-23: a caster missing from the players list (a mob) places nothing on the player it targets; no
    // capture holds a mob cast on a listed player, so the case is written by hand in actions/synthetic-mob-cast-on-player.json.
    test('synthetic-mob-cast-on-player: a cast from an unknown caster on a known player places nothing', async () => {
        window.currentMapId = BLACK;
        const events = await replay('synthetic-mob-cast-on-player');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && !players.getPlayer(p[0]) && players.getPlayer(p[1]));
        expect(casts.length).toBeGreaterThan(0);

        casts.forEach(p => actions.onCastSpell(p));

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a cast on an id missing from the players list (a mob) places nothing, as in
    // actions/cast-on-mob.json.
    test('pcap-derived cast-on-mob: a cast from a known player on an unknown target places nothing', async () => {
        window.currentMapId = BLACK;
        const events = await replay('cast-on-mob');
        const casts = events.filter(p => p[252] === EventCodes.CastSpell && players.getPlayer(p[0])
            && p[1] !== undefined && !players.getPlayer(p[1]));
        expect(casts.length).toBeGreaterThan(0);

        casts.forEach(p => actions.onCastSpell(p));

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: a CastSpell without [1] or a CastStart without [7] carries a ground point, as in
    // actions/ground-cast.json, and places nothing.
    test('pcap-derived ground-cast: ground-targeted casts place nothing', async () => {
        window.currentMapId = BLACK;
        const events = await replay('ground-cast');
        const spells = events.filter(p => p[252] === EventCodes.CastSpell && p[1] === undefined);
        const starts = events.filter(p => p[252] === EventCodes.CastStart && p[7] === undefined);
        expect(spells.length + starts.length).toBeGreaterThan(0);

        spells.forEach(p => actions.onCastSpell(p));
        starts.forEach(p => actions.onCastStart(p));

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });
});

describe('full flow to the radar', () => {
    // @verified 2026-09-23: actions/cast-between-players.json through EventRouter, ActionsHandler and ActionsDrawing in
    // black zone 0317; responses first, as the live queue runs them ahead of queued events.
    test('full-flow: cast-between-players events draw one red diamond per acting known player and none on the local id', async () => {
        const messages = await routeFixture('cast-between-players', BLACK);
        const events = messages.filter(m => m.kind === 'event').map(m => m.p);

        const drawing = new ActionsDrawing();
        drawing.drawDiamond = vi.fn();
        const ctx = {
            globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
            save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
            fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(), measureText: vi.fn(() => ({width: 12})),
        };
        const markers = actions.getMarkers(Date.now());
        drawing.invalidate(ctx, markers, players.getPlayersByType());

        const spawned = events.filter(p => p[252] === EventCodes.NewCharacter).map(p => p[0]);
        const hit = events
            .filter(p => p[252] === EventCodes.CastSpell && p[0] !== p[1] && players.getPlayer(p[0]) && players.getPlayer(p[1]))
            .map(p => p[1]);
        expect(hit.length).toBeGreaterThan(0);
        hit.forEach(id => expect(markers.some(m => m.playerId === id)).toBe(true));
        expect(markers.every(m => spawned.includes(m.playerId) && m.playerId !== actions.localId)).toBe(true);
        expect(drawing.drawDiamond).toHaveBeenCalledTimes(markers.length);
        drawing.drawDiamond.mock.calls.forEach(call => expect(call[4]).toBe('#ef4444'));
    });
});

describe('every action fixture through the router', () => {
    const byId = (a, b) => a[0] - b[0];

    // @verified 2026-09-23: each cut, replayed through EventRouter in the zone of its Join response with the responses
    // first, leaves exactly the markers its events give: self-casts, mounts, pushes, teleports, respawns and casts between
    // listed players; nothing for the local player, a mob, the ground or a player that left.
    test.each([
        ['self-cast', [[1255088, 'presence', 0.468737, 86.151886]]],
        ['mount-up', [[1255088, 'mount', 0.468737, 86.151886]]],
        ['dismount', [[1254486, 'presence', 7.7275124, 113.128426]]],
        ['forced-movement', [[1255446, 'mobility', 6.5469065, 66.714745], [1255908, 'presence', 7.05, 113.42]]],
        ['leave', []],
        ['local-self-cast', []],
        ['cast-on-mob', [[41362, 'mobility', 333.4844, -158.64052]]],
        ['mob-cast-on-local', []],
        ['mob-attack-on-local', []],
        ['teleport', [[1448788, 'presence', 7.8076406, 97.3155]]],
        ['cast-spells', [[1441391, 'presence', 8.053006, 89.28338], [1448788, 'presence', 6.9241805, 89.12979]]],
        ['cast-between-players', [
            [1298481, 'presence', 2.105602, 86.30618], [1453850, 'mobility', 3.2973344, 87.39119], [1471557, 'presence', 8, 115],
        ]],
        ['respawn', [[1655584, 'presence', 0.8839832, 93.23946]]],
        ['cast-start-target', [[1640953, 'presence', 4.649451, 83.897514]]],
        ['attack-between-players', [[1655584, 'presence', 7.21, 116.79], [1656011, 'presence', 3.197569, 88.90218]]],
        ['health-update', [[1655584, 'presence', 7.21, 116.79], [1656011, 'presence', 7.89, 113.03]]],
        ['heal', [
            [1655584, 'presence', 7.21, 116.79], [1656011, 'mobility', 7.681092, 91.58957], [1656044, 'presence', 10.793419, 94.88708],
        ]],
        ['health-updates', [[1655584, 'presence', 7.21, 116.79], [1656011, 'presence', 7.89, 113.03]]],
        ['ground-cast', [[1656011, 'presence', 7.89, 113.03]]],
    ])('pcap-derived %s: exactly the expected markers', async (scenario, expected) => {
        await routeFixture(scenario);

        const markers = actions.getMarkers(Date.now()).map(m => [m.playerId, m.family, m.x, m.y]);
        expect(markers.sort(byId)).toEqual(expected);
    });
});

// synthetic: every hit on the local player, which none of the anonymized captures holds, the actions/synthetic-*.json files
// and the zone, faction and ignore variants; the stand-in tests put a real message's target or caster in the local slot.
// pcap-derived: actions/{mob-attack-on-local,attack-between-players}.json, local id and zone from their Join response.

describe('attacks on the local player', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.currentMapId = BLACK;
        actions.setLocalId(LOCAL);
    });

    function flagged(id) {
        return Date.now() < players.getPlayer(id).attackingUntil;
    }

    async function joinAndReplay(scenario) {
        const fx = await loadFixture('actions', scenario);
        const join = fx.messages.find(m => m.kind === 'response' && m.parameters['253'] === OperationCodes.Join);
        window.currentMapId = join.parameters['8'];
        actions.setLocalId(join.parameters['0']);
        return replay(scenario);
    }

    function standIn(id) {
        players.removePlayer(id);
        actions.setLocalId(id);
    }

    // @verified 2026-09-23: a dangerous caster on the local id is flagged for 10 s and the hit places no marker.
    test('synthetic: a CastSpell on the local id flags the caster for 10 s and places no marker', () => {
        spawn(21, 'Bob');

        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});

        expect(players.getPlayer(21)).toMatchObject({attackingUntil: Date.now() + 10000, lastActionAt: Date.now()});
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the local entry of a CastSpells flags the caster and the other entry keeps its marker.
    test('synthetic: a CastSpells on the local id and another player flags the caster and marks only the other', () => {
        spawn(21, 'Bob');
        spawn(22, 'Carol');

        actions.onCastSpells({0: 21, 1: [LOCAL, 22], 2: [1, 2, 3, 4]});

        expect(flagged(21)).toBe(true);
        expect(actions.getMarkers(Date.now())).toEqual([
            expect.objectContaining({playerId: 22, x: 3, y: 4, family: 'combat', casterId: 21}),
        ]);
    });

    // @verified 2026-09-23: the position is not read for the local target.
    test('synthetic: a CastStart on the local id with no position flags the caster', () => {
        spawn(21, 'Bob');

        actions.onCastStart({0: 21, 7: LOCAL});

        expect(flagged(21)).toBe(true);
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: Attack carries the attacker at [0] and the target at [2]; an auto attack on the local id flags.
    test('synthetic: an Attack on the local id flags the attacker and notes the action', () => {
        spawn(21, 'Bob');

        actions.onAttack({0: 21, 2: LOCAL});

        expect(players.getPlayer(21)).toMatchObject({attackingUntil: Date.now() + 10000, lastActionAt: Date.now()});
    });

    // @verified 2026-09-23: an Attack carries no position, so one between other players changes nothing.
    test('synthetic: an Attack between two other players flags nobody and places no marker', () => {
        spawn(21, 'Bob');
        spawn(22, 'Carol');

        actions.onAttack({0: 21, 2: 22});

        expect(players.playersList.map(p => p.attackingUntil)).toEqual([0, 0]);
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: an attacker missing from the players list raises nothing.
    test('synthetic: a cast or an Attack on the local id from an unknown id raises nothing', () => {
        expect(() => {
            actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
            actions.onAttack({0: 21, 2: LOCAL});
        }).not.toThrow();

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the spawn alert gate decides: black every player, red and yellow faction 255 only, safe nobody.
    test.each([
        ['black', BLACK, 0, true],
        ['red', RED, 0, false],
        ['red', RED, 3, false],
        ['red', RED, 255, true],
        ['yellow', YELLOW, 3, false],
        ['yellow', YELLOW, 255, true],
        ['safe', SAFE, 255, false],
    ])('synthetic: %s zone %s, a faction %i caster on the local id is flagged: %s', (_label, zone, faction, expected) => {
        window.currentMapId = zone;
        spawn(21, 'Bob', faction);

        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});

        expect(flagged(21)).toBe(expected);
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the ignore list clears the flag on nickname, guild or alliance, like the spawn alert.
    test.each([
        ['nickname', 'Friend'],
        ['guild', 'FriendGuild'],
        ['alliance', 'FriendAlliance'],
    ])('synthetic: black zone, a player ignored by %s is never flagged', (_label, entry) => {
        settingsSync.getJSON.mockImplementation(key => key === 'ignoreList' ? [entry] : null);
        players.handleNewPlayerEvent(21, {1: 'Friend', 8: 'FriendGuild', 53: 0, 51: 'FriendAlliance', 40: [], 43: []});

        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
        actions.onAttack({0: 21, 2: LOCAL});

        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-09-23: a remembered heal pair with the local id never yields the flag.
    test('synthetic: black zone, a player that healed the local player is not flagged by its cast or Attack', () => {
        spawn(21, 'Healer');
        actions.healedPairs.push([21, LOCAL]);

        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
        actions.onAttack({0: 21, 2: LOCAL});

        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-09-23: the flag lasts 10 s from the last hit.
    test('synthetic: a second hit 6 s after the first holds the flag until 10 s after the second', () => {
        spawn(21, 'Bob');
        actions.onAttack({0: 21, 2: LOCAL});
        vi.advanceTimersByTime(6000);
        actions.onAttack({0: 21, 2: LOCAL});

        vi.advanceTimersByTime(9999);
        expect(flagged(21)).toBe(true);

        vi.advanceTimersByTime(1);
        expect(flagged(21)).toBe(false);
    });

    // @verified 2026-09-23: before any Join response nothing is flagged, even for a message whose target is null.
    test('synthetic: with no local id a cast or an Attack on a null target flags nobody', () => {
        sessionStorage.clear();
        actions = new ActionsHandler(players);
        spawn(21, 'Bob');

        actions.onCastSpell({0: 21, 1: null, 2: [10, 20]});
        actions.onAttack({0: 21, 2: null});

        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-09-23: actions/synthetic-cast-on-local.json, black zone 3346 of its Join response: a faction 0 player
    // casts on the Join local id (CastSpell [1], CastStart [7]) and is flagged; no capture holds a player casting on the
    // local player.
    test('synthetic-cast-on-local: the caster of a cast on the local id is flagged and gets no marker', async () => {
        const events = await joinAndReplay('synthetic-cast-on-local');
        const onLocal = events.filter(p => (p[252] === EventCodes.CastSpell && p[1] === actions.localId)
            || (p[252] === EventCodes.CastStart && p[7] === actions.localId));
        const casters = onLocal.map(p => p[0]).filter(id => players.getPlayer(id));
        expect(defaultZonesDatabase.getPvpType(window.currentMapId)).toBe('black');
        expect(casters.length).toBeGreaterThan(0);

        onLocal.forEach(p => (p[252] === EventCodes.CastSpell ? actions.onCastSpell(p) : actions.onCastStart(p)));

        casters.forEach(id => expect(flagged(id)).toBe(true));
        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: in actions/mob-attack-on-local.json Attack [2] is the Join local id and [0] a mob; nothing is
    // raised and nothing is placed.
    test('pcap-derived mob-attack-on-local: a mob Attack on the local id flags nobody and places no marker', async () => {
        const events = await joinAndReplay('mob-attack-on-local');
        const attack = events.find(p => p[252] === EventCodes.Attack && p[2] === actions.localId);
        expect(attack).toBeDefined();
        expect(players.getPlayer(attack[0])).toBeUndefined();

        expect(() => actions.onAttack(attack)).not.toThrow();

        expect(actions.getMarkers(Date.now())).toEqual([]);
    });

    // @verified 2026-09-23: the same message with a dangerous player holding the mob id at [0] flags that player.
    test('synthetic (stand-in on the mob-attack-on-local message): a dangerous player at [0] is flagged', async () => {
        const events = await joinAndReplay('mob-attack-on-local');
        const attack = events.find(p => p[252] === EventCodes.Attack && p[2] === actions.localId);
        window.currentMapId = BLACK;
        spawn(attack[0], 'StandIn');

        actions.onAttack(attack);

        expect(flagged(attack[0])).toBe(true);
    });

    // @verified 2026-09-23: in actions/attack-between-players.json two listed players duel in safe zone 5001 away from the
    // local player; the Attack flags nobody.
    test('pcap-derived attack-between-players: a real Attack between two other players flags nobody', async () => {
        const events = await joinAndReplay('attack-between-players');
        const attack = events.find(p => p[252] === EventCodes.Attack && players.getPlayer(p[0]) && players.getPlayer(p[2]));
        expect(attack).toBeDefined();
        expect(attack[2]).not.toBe(actions.localId);

        actions.onAttack(attack);

        expect(players.playersList.every(p => p.attackingUntil === 0)).toBe(true);
    });

    // @verified 2026-09-23: with its target standing in for the local player, the same Attack flags [0] in a black zone
    // and nobody in the safe zone of the capture.
    test('synthetic (stand-in on the attack-between-players message): [0] is flagged in a black zone, not in the safe zone', async () => {
        const events = await joinAndReplay('attack-between-players');
        const attack = events.find(p => p[252] === EventCodes.Attack && players.getPlayer(p[0]) && players.getPlayer(p[2]));
        expect(defaultZonesDatabase.getPvpType(window.currentMapId)).toBe('safe');
        standIn(attack[2]);

        actions.onAttack(attack);
        expect(players.getPlayer(attack[0]).attackingUntil).toBe(0);

        window.currentMapId = BLACK;
        actions.onAttack(attack);
        expect(flagged(attack[0])).toBe(true);
    });

    // @verified 2026-09-23: HealthUpdate carries the target at [0], the signed change at [2] and the causer at [6];
    // damage by a player on the local id flags it.
    test('synthetic: a HealthUpdate hit from a player on the local id flags the player', () => {
        spawn(21, 'Bob');

        actions.onHealthUpdate({0: LOCAL, 2: -120, 3: 880, 6: 21});

        expect(flagged(21)).toBe(true);
    });

    // @verified 2026-09-23: an absent key means 0 (no change, or causer 0); a mob causer, a hit on another player and a
    // heal raise nothing.
    test.each([
        ['no change key', {0: LOCAL, 3: 880, 6: 21}],
        ['no causer key', {0: LOCAL, 2: -120, 3: 880}],
        ['a mob causer', {0: LOCAL, 2: -120, 3: 880, 6: 4242}],
        ['a hit on another player', {0: 22, 2: -120, 3: 880, 6: 21}],
        ['a heal', {0: LOCAL, 2: 120, 3: 880, 6: 21}],
    ])('synthetic: a HealthUpdate with %s flags nobody', (_label, params) => {
        spawn(21, 'Bob');
        spawn(22, 'Carol');

        actions.onHealthUpdate(params);

        expect(players.playersList.map(p => p.attackingUntil)).toEqual([0, 0]);
    });

    // @verified 2026-09-23: HealthUpdates holds one target at [0] and parallel arrays at [2] and [6]; a byte array
    // reaches the browser as {type: 'Buffer', data}, and a typed or plain array works the same.
    test.each([
        ['a plain array', [0, 21]],
        ['a Buffer object', {type: 'Buffer', data: [0, 21]}],
        ['a Uint8Array', Uint8Array.from([0, 21])],
    ])('synthetic: a HealthUpdates with causers as %s flags the player behind the negative entry', (_label, causers) => {
        spawn(21, 'Bob');

        actions.onHealthUpdates({0: LOCAL, 2: [-30, -120], 6: causers});

        expect(flagged(21)).toBe(true);
    });

    // @verified 2026-09-23: a HealthUpdates without its arrays is dropped.
    test('synthetic: a HealthUpdates without arrays flags nobody and does not throw', () => {
        spawn(21, 'Bob');

        expect(() => actions.onHealthUpdates({0: LOCAL})).not.toThrow();

        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-09-23: a positive change with a causer other than the target stores the pair once, smaller id first.
    test('synthetic: heals both ways between two players store one pair, smaller id first', () => {
        spawn(21, 'Bob');
        spawn(22, 'Carol');

        actions.onHealthUpdate({0: 22, 2: 80, 6: 21});
        actions.onHealthUpdate({0: 21, 2: 40, 6: 22});

        expect(actions.healedPairs).toEqual([[21, 22]]);
    });

    // @verified 2026-09-23: the local id counts as a known id and HealthUpdates heals count like HealthUpdate ones.
    test('synthetic: a HealthUpdates heal of the local player stores the pair', () => {
        spawn(21, 'Bob');

        actions.onHealthUpdates({0: LOCAL, 2: [60], 6: [21]});

        expect(actions.healedPairs).toEqual([[21, LOCAL]]);
    });

    // @verified 2026-09-23: a self heal, an unknown healer, an unknown target and damage store no pair.
    test.each([
        ['a self heal', {0: 21, 2: 80, 6: 21}],
        ['an unknown healer', {0: 21, 2: 80, 6: 4242}],
        ['an unknown target', {0: 4242, 2: 80, 6: 21}],
        ['damage', {0: 21, 2: -80, 6: 22}],
    ])('synthetic: %s stores no pair', (_label, params) => {
        spawn(21, 'Bob');
        spawn(22, 'Carol');

        actions.onHealthUpdate(params);

        expect(actions.healedPairs).toEqual([]);
    });

    // @verified 2026-09-23: a black zone party healer that healed the local player raises nothing afterwards, whatever
    // reaches the local id from it.
    test('synthetic: black zone, a party healer that healed the local player is never flagged afterwards', () => {
        spawn(21, 'Healer');
        actions.onHealthUpdate({0: LOCAL, 2: 150, 6: 21});

        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
        actions.onAttack({0: 21, 2: LOCAL});
        actions.onHealthUpdate({0: LOCAL, 2: -20, 6: 21});
        actions.onHealthUpdates({0: LOCAL, 2: [-20], 6: [21]});

        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-10-10: actions/attack-on-local.json, live mist fight of 2026-10-10: a faction 255 player casts on the
    // Join local id (CastStart [7], CastSpell [1]), leaves and spawns again, then auto attacks and damages it. The live
    // session typed the mist black through the mist choice, which the cut does not hold, so the test sets the zone.
    test('pcap-derived attack-on-local: a live attacker is flagged and its hits on the local id place no marker', async () => {
        const messages = await routeFixture('attack-on-local', BLACK);
        const events = messages.filter(m => m.kind === 'event').map(m => m.p);
        const local = actions.localId;
        const attacker = events.find(p => p[252] === EventCodes.CastStart && p[7] === local)[0];

        expect(events.filter(p => p[252] === EventCodes.Attack && p[0] === attacker && p[2] === local)).toHaveLength(1);
        expect(events.filter(p => p[252] === EventCodes.HealthUpdate && p[0] === local && p[6] === attacker && p[2] < 0)).toHaveLength(1);
        expect(flagged(attacker)).toBe(true);
        expect(actions.getMarkers(Date.now()).filter(m => m.playerId === local || m.family === 'combat')).toEqual([]);
    });

    function healSequence(events) {
        const heal = events.find(p => p[252] === EventCodes.HealthUpdate && p[2] > 0);
        const start = events.findIndex(p => p[252] === EventCodes.CastStart && p[0] === heal[6] && p[7] === heal[0]);
        return {healer: heal[6], target: heal[0], sequence: events.slice(start, events.indexOf(heal) + 1)};
    }

    function routeEvents(sequence) {
        const inert = new Proxy({}, {get: () => () => undefined});
        EventRouter.reset();
        EventRouter.init({
            handlers: {
                playersHandler: players, actionsHandler: actions, mobsHandler: inert, harvestablesHandler: inert,
                chestsHandler: inert, dungeonsHandler: inert, fishingHandler: inert, wispCageHandler: inert,
            },
            map: {id: -1, hX: 0, hY: 0, isBZ: false},
            radarRenderer: null,
        });
        sequence.forEach(p => EventRouter.onEvent(p));
    }

    // @verified 2026-10-10: a zone change made while the radar page was closed leaves a stale saved id; in a mist, ids are
    // small enough that it can name a mob of the new zone. Its Move drops the id, so a hit on that mob flags nobody.
    test('synthetic: after a page change, a Move naming the restored id drops it and a hit on that entity flags nobody', () => {
        spawn(21, 'Enemy');
        actions = new ActionsHandler(players);
        expect(actions.localId).toBe(LOCAL);

        routeEvents([
            {252: EventCodes.Move, 0: LOCAL, 4: 1, 5: 2},
            {252: EventCodes.CastSpell, 0: 21, 1: LOCAL, 2: [1, 2]},
            {252: EventCodes.Attack, 0: 21, 2: LOCAL},
        ]);

        expect(actions.localId).toBeNull();
        expect(players.getPlayer(21).attackingUntil).toBe(0);
    });

    // @verified 2026-10-10: actions/heal.json in its real order: CastStart 14 and CastSpell 19 of the healer on the target,
    // then the positive HealthUpdate 6. With the target standing in for the local player in a black zone, the cast flags
    // the healer before the heal is known; the heal lifts the flag.
    test('synthetic (stand-in on the heal message order): the heal that follows a cast on the local id lifts the flag', async () => {
        const {healer, target, sequence} = healSequence(await joinAndReplay('heal'));
        standIn(target);
        window.currentMapId = BLACK;

        routeEvents(sequence.filter(p => p[252] !== EventCodes.HealthUpdate));
        expect(flagged(healer)).toBe(true);

        routeEvents(sequence.filter(p => p[252] === EventCodes.HealthUpdate));
        expect(flagged(healer)).toBe(false);
    });

    // @verified 2026-10-10: actions/heal.json in its real order between two other players in a black zone: the cast puts a
    // combat marker on the target before the heal is known; the heal turns it into presence.
    test('pcap-derived heal: in a black zone the heal that follows a cast turns the target marker into presence', async () => {
        const {healer, target, sequence} = healSequence(await joinAndReplay('heal'));
        window.currentMapId = BLACK;

        routeEvents(sequence.filter(p => p[252] !== EventCodes.HealthUpdate));
        expect(markerOf(target)).toMatchObject({family: 'combat', casterId: healer});

        routeEvents(sequence.filter(p => p[252] === EventCodes.HealthUpdate));
        expect(markerOf(target)).toMatchObject({family: 'presence', casterId: healer});
    });

    // @verified 2026-09-23: the memory covers the pair that healed and no one else.
    test('synthetic: a heal by one player does not shield another attacker', () => {
        spawn(21, 'Healer');
        spawn(22, 'Enemy');
        actions.onHealthUpdate({0: LOCAL, 2: 150, 6: 21});

        actions.onAttack({0: 22, 2: LOCAL});

        expect(flagged(22)).toBe(true);
    });

    // @verified 2026-09-23: a cast between two players that healed each other in a black zone is a presence marker.
    test('synthetic: black zone, a cast on a player the caster healed gives a presence marker', () => {
        spawn(21, 'Healer');
        spawn(22, 'Friend');
        actions.onHealthUpdate({0: 22, 2: 150, 6: 21});

        actions.onCastSpell({0: 21, 1: 22, 2: [5, 6]});

        expect(markerOf(22)).toMatchObject({family: 'presence', casterId: 21});
    });

    // @verified 2026-09-23: clear drops the heal memory with the markers and keeps the local id.
    test('synthetic: after clear a former healer is flagged again', () => {
        spawn(21, 'Healer');
        actions.onHealthUpdate({0: LOCAL, 2: 150, 6: 21});

        actions.clear();
        actions.onAttack({0: 21, 2: LOCAL});

        expect(actions.healedPairs).toEqual([]);
        expect(actions.localId).toBe(LOCAL);
        expect(flagged(21)).toBe(true);
    });

    // @verified 2026-09-23: actions/synthetic-hit-on-local.json, black zone 3346: a player's damage on the Join local id,
    // alone in a HealthUpdate or as a HealthUpdates entry, flags that player; no capture holds a player hitting the local
    // player.
    test.each([
        ['HealthUpdate', EventCodes.HealthUpdate, 'onHealthUpdate'],
        ['HealthUpdates', EventCodes.HealthUpdates, 'onHealthUpdates'],
    ])('synthetic-hit-on-local: a %s hit on the local id flags the player behind it', async (_name, code, method) => {
        const events = await joinAndReplay('synthetic-hit-on-local');
        const attacker = events.find(p => p[252] === EventCodes.NewCharacter)[0];
        const hits = events.filter(p => p[252] === code && p[0] === actions.localId);
        expect(hits.length).toBeGreaterThan(0);

        hits.forEach(p => actions[method](p));

        expect(flagged(attacker)).toBe(true);
    });

    // @verified 2026-09-23: in actions/health-updates.json a HealthUpdates on another player holds a hit from a listed
    // player (-124) and a self heal (+646); even in a black zone neither flags nor stores a pair.
    test('pcap-derived health-updates: a hit on another player and a self heal raise and store nothing', async () => {
        const events = await joinAndReplay('health-updates');
        const bulk = events.filter(p => p[252] === EventCodes.HealthUpdates);
        expect(bulk.some(p => p[0] !== actions.localId && p[2].some(c => c < 0) && p[2].some(c => c > 0))).toBe(true);
        window.currentMapId = BLACK;

        bulk.forEach(p => actions.onHealthUpdates(p));

        expect(players.playersList.every(p => p.attackingUntil === 0)).toBe(true);
        expect(actions.healedPairs).toEqual([]);
    });

    // @verified 2026-09-23: in actions/heal.json a listed player heals another (+276) and hits a third (-187); the heal
    // stores its pair and the hit stores none.
    test('pcap-derived heal: the heal stores its pair and the hit stores none', async () => {
        const events = await joinAndReplay('heal');
        const updates = events.filter(p => p[252] === EventCodes.HealthUpdate
            && players.getPlayer(p[0]) && players.getPlayer(p[6]) && p[0] !== p[6]);
        const heals = updates.filter(p => p[2] > 0);
        expect(heals).toHaveLength(1);
        expect(updates.some(p => p[2] < 0)).toBe(true);

        updates.forEach(p => actions.onHealthUpdate(p));

        const [heal] = heals;
        expect(actions.healedPairs).toEqual([[Math.min(heal[0], heal[6]), Math.max(heal[0], heal[6])]]);
    });

    // @verified 2026-09-23: in actions/health-update.json a listed player hits another (-143) away from the local
    // player; even in a black zone nobody is flagged.
    test('pcap-derived health-update: a real hit between two other players flags nobody', async () => {
        const events = await joinAndReplay('health-update');
        const hit = events.find(p => p[252] === EventCodes.HealthUpdate && p[2] < 0
            && players.getPlayer(p[0]) && players.getPlayer(p[6]));
        expect(hit).toBeDefined();
        expect(hit[0]).not.toBe(actions.localId);
        window.currentMapId = BLACK;

        actions.onHealthUpdate(hit);

        expect(players.playersList.every(p => p.attackingUntil === 0)).toBe(true);
    });

    // @verified 2026-09-23: with its target standing in for the local player in a black zone, the same hit flags [6].
    test('synthetic (stand-in on the health-update message): the causer is flagged in a black zone', async () => {
        const events = await joinAndReplay('health-update');
        const hit = events.find(p => p[252] === EventCodes.HealthUpdate && p[2] < 0
            && players.getPlayer(p[0]) && players.getPlayer(p[6]));
        standIn(hit[0]);
        window.currentMapId = BLACK;

        actions.onHealthUpdate(hit);

        expect(flagged(hit[6])).toBe(true);
    });

    // @verified 2026-09-23: the real Attack of actions/attack-between-players.json, its target standing in for the local
    // player in a black zone, goes through EventRouter and puts the attacker above a player who acted earlier, with the
    // badge and the ring.
    test('full-flow synthetic stand-in: an Attack routed to ActionsHandler tops the players list with the badge and the ring', async () => {
        const events = await joinAndReplay('attack-between-players');
        const attack = events.find(p => p[252] === EventCodes.Attack && players.getPlayer(p[0]) && players.getPlayer(p[2]));
        expect(attack).toBeDefined();
        standIn(attack[2]);
        spawn(99, 'Other');
        players.noteAction(99);
        vi.advanceTimersByTime(1000);
        window.currentMapId = BLACK;
        document.body.innerHTML = '<div id="playersList"><div id="playersHostile"><div id="hostileList"></div></div></div>';
        PlayerListRenderer.reset();

        EventRouter.reset();
        EventRouter.init({handlers: {playersHandler: players, actionsHandler: actions}, map: {id: -1, hX: 0, hY: 0, isBZ: false}, radarRenderer: null});

        EventRouter.onEvent(attack);
        PlayerListRenderer.update(players);
        vi.advanceTimersToNextFrame();

        const top = document.querySelector('#hostileList [data-player-id]');
        expect(Number(top.dataset.playerId)).toBe(attack[0]);
        expect(top.textContent).toContain('Attacking you');
        expect(top.classList.contains('ring-error')).toBe(true);
    });
});

describe('debug traces', () => {
    const traces = event => window.logger.debug.mock.calls.filter(([cat, name]) => cat === CATEGORIES.PLAYERS && name === event).map(c => c[2]);

    // @verified 2026-09-26: a live test is read from the debug log, so every marker the handler places is traced.
    test('synthetic: a placed marker is traced with its player, family and position', () => {
        spawn(11, 'Alice');

        actions.onCastSpell({0: 11, 1: 11, 2: [10, 20]});

        expect(traces('action_marker')).toEqual([{playerId: 11, family: 'presence', x: 10, y: 20, casterId: null}]);
    });

    // @verified 2026-09-26: a cast that places nothing is traced with the reason, so a missing marker can be explained.
    test.each([
        ['target_not_listed', () => actions.onCastSpell({0: 12, 1: 12, 2: [10, 20]})],
        ['invalid_position', () => actions.onCastSpell({0: 11, 1: 11, 2: [10]})],
        ['no_target', () => actions.onCastSpell({0: 11, 2: [10, 20]})],
        ['caster_not_listed', () => actions.onCastSpell({0: 5306, 1: 11, 2: [10, 20]})],
    ])('synthetic: a cast skipped as %s is traced', (reason, act) => {
        spawn(11, 'Alice');

        act();

        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect(traces('action_skipped').map(t => t.reason)).toEqual([reason]);
    });

    // @verified 2026-09-26: an attack trigger is traced whether it flags or not, with the reason when it does not.
    test('synthetic: attack triggers are traced as flagged or ignored with the reason', () => {
        spawn(21, 'Enemy');
        actions.setLocalId(LOCAL);
        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
        window.currentMapId = BLACK;
        actions.onCastSpell({0: 21, 1: LOCAL, 2: [10, 20]});
        actions.onAttack({0: 5306, 2: LOCAL});

        expect(traces('attack_ignored')).toEqual([
            {casterId: 21, reason: 'not_dangerous'},
            {casterId: 5306, reason: 'caster_not_listed'},
        ]);
        expect(traces('attack_flag')).toEqual([{casterId: 21}]);
    });

    // @verified 2026-10-10: actions/local-self-cast.json, local id from its Join response: the local player's casts stop
    // before any rule (the 2026-10-10 live log held 17 attack_ignored for the local player's own casts).
    test('pcap-derived local-self-cast: casts of the local player leave no marker and no trace', async () => {
        await routeFixture('local-self-cast');

        expect(actions.localId).not.toBeNull();
        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect([...traces('attack_ignored'), ...traces('action_skipped')].filter(t => t.casterId === actions.localId)).toEqual([]);
    });

    // @verified 2026-10-10: a cast of the local player on a listed player places nothing and traces nothing.
    test('synthetic: a cast of the local player on a listed player places nothing and traces nothing', () => {
        spawn(11, 'Alice');
        actions.setLocalId(LOCAL);

        actions.onCastSpell({0: LOCAL, 1: 11, 2: [10, 20]});

        expect(actions.getMarkers(Date.now())).toEqual([]);
        expect(traces('action_skipped')).toEqual([]);
    });

    // @verified 2026-09-26: a recorded heal pair is traced.
    test('synthetic: a heal pair is traced when recorded', () => {
        spawn(11, 'Alice');
        spawn(12, 'Bob');

        actions.onHealthUpdate({0: 12, 2: 50, 6: 11});

        expect(traces('heal_pair')).toEqual([{causerId: 11, targetId: 12}]);
    });
});

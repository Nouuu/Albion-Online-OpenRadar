// synthetic: markers built by hand to pin the draw calls, the fade, the label and the switches; players go through
// the real PlayersHandler and the real zones.json so the class buckets are the ones the radar computes.
// pcap-derived: full-flow NewCharacter and self-cast CastSpell from actions/self-cast.json, EventRouter to invalidate.

import {describe, test, expect, beforeAll, beforeEach, afterEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';
import {loadRealZonesDatabase, defaultZonesDatabase} from '../__fixtures__/realDatabases.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        get: vi.fn((_k, d) => d),
        getBool: vi.fn(() => true),
        getNumber: vi.fn((_k, d) => d ?? 0),
        getFloat: vi.fn(() => null),
        getJSON: vi.fn(() => null),
    },
}));

const {ActionsDrawing} = await import('./ActionsDrawing.js');
const {ActionsHandler} = await import('../handlers/ActionsHandler.js');
const {PlayersHandler} = await import('../handlers/PlayersHandler.js');
const EventRouter = await import('../core/EventRouter.js');
const {EventCodes} = await import('../utils/EventCodes.js');
const settingsSync = (await import('../utils/SettingsSync.js')).default;

const NOW = 1_000_000;
const SAFE_ZONE = '1000';
const BLACK_ZONE = '1305';

beforeAll(() => {
    defaultZonesDatabase.zones = loadRealZonesDatabase().zones;
    defaultZonesDatabase.loaded = true;
});

function marker(playerId, {family = 'presence', ageMs = 0, hX = 10, hY = 20} = {}) {
    return {playerId, x: 0, y: 0, family, selfCast: family === 'presence', at: NOW - ageMs, casterId: null, lastUpdateTime: NOW - ageMs, hX, hY};
}

function spawn(players, id, nickname, faction) {
    players.handleNewPlayerEvent(id, {1: nickname, 8: '', 53: faction});
}

describe('ActionsDrawing', () => {
    let drawing;
    let players;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        settingsSync.getBool.mockImplementation(() => true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, status: 204}));
        window.currentMapId = SAFE_ZONE;
        players = new PlayersHandler();
        drawing = new ActionsDrawing();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        drawing.drawDiamond = vi.fn();
        drawing.drawTextItems = vi.fn();
        ctx = {font: '', globalAlpha: 1, measureText: vi.fn(() => ({width: 40}))};
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    // @verified 2026-09-23: the diamond takes the colour of the class bucket the radar puts the player in.
    test.each([
        ['hostile', 255, '#ef4444'],
        ['faction', 3, '#3b82f6'],
        ['passive', 0, '#22c55e'],
    ])('synthetic: a %s player in a safe zone draws a diamond in its class colour', (_cls, faction, color) => {
        spawn(players, 7, 'Anon', faction);

        drawing.invalidate(ctx, [marker(7)], players.getPlayersByType());

        expect(drawing.drawDiamond).toHaveBeenCalledTimes(1);
        expect(drawing.drawDiamond).toHaveBeenCalledWith(ctx, 10, 20, 7, color);
    });

    // @verified 2026-09-23: the zone rule makes every player hostile in a black zone, faction 0 included.
    test('synthetic: a passive player in a black zone draws a hostile diamond', () => {
        window.currentMapId = BLACK_ZONE;
        spawn(players, 7, 'Anon', 0);

        drawing.invalidate(ctx, [marker(7)], players.getPlayersByType());

        expect(drawing.drawDiamond).toHaveBeenCalledWith(ctx, 10, 20, 7, '#ef4444');
    });

    // @verified 2026-09-23: one emoji per family at the top right of the diamond.
    test.each([
        ['presence', '\u{2728}'],
        ['mount', '\u{1F40E}'],
        ['combat', '\u{2694}\u{FE0F}'],
        ['mobility', '\u{1F4A8}'],
    ])('synthetic: a %s marker carries its emoji at the top right', (family, emoji) => {
        spawn(players, 7, 'Anon', 0);

        drawing.invalidate(ctx, [marker(7, {family})], players.getPlayersByType());

        expect(drawing.drawTextItems).toHaveBeenCalledWith(13.5, 16.5, emoji, ctx, '9px', 'white');
    });

    // @verified 2026-09-23: the nickname and the age with one decimal, centred under the diamond.
    test('synthetic: the label reads nickname and age, centred under the diamond', () => {
        spawn(players, 7, 'Anon', 0);

        drawing.invalidate(ctx, [marker(7, {ageMs: 3400})], players.getPlayersByType());

        expect(ctx.measureText).toHaveBeenCalledWith('Anon \u{00B7} 3.4s');
        expect(drawing.drawTextItems).toHaveBeenCalledWith(-10, 34, 'Anon \u{00B7} 3.4s', ctx, '9px', 'white');
    });

    // @verified 2026-09-23: alpha is 1 - age / 10000 while the marker draws, and back to 1 afterwards.
    test('synthetic: a marker fades with its age and the alpha is restored', () => {
        const alphas = [];
        drawing.drawDiamond = vi.fn(c => alphas.push(c.globalAlpha));
        spawn(players, 7, 'Anon', 0);
        spawn(players, 8, 'Anon', 0);

        drawing.invalidate(ctx, [marker(7, {ageMs: 0}), marker(8, {ageMs: 2500})], players.getPlayersByType());

        expect(alphas).toEqual([1, 0.75]);
        expect(ctx.globalAlpha).toBe(1);
    });

    // @verified 2026-09-23: a marker the drawing reads a moment past its lifetime draws transparent, never below zero.
    test('synthetic: a marker past its lifetime draws with alpha 0', () => {
        const alphas = [];
        drawing.drawDiamond = vi.fn(c => alphas.push(c.globalAlpha));
        spawn(players, 7, 'Anon', 0);

        drawing.invalidate(ctx, [marker(7, {ageMs: 10500})], players.getPlayersByType());

        expect(alphas).toEqual([0]);
    });

    // @verified 2026-09-23: a marker whose player is not listed draws nothing.
    test('synthetic: a marker of an unknown player is skipped', () => {
        drawing.invalidate(ctx, [marker(99)], players.getPlayersByType());

        expect(drawing.drawDiamond).not.toHaveBeenCalled();
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    // @verified 2026-09-23: the actions switch off draws nothing.
    test('synthetic: settingShowPlayerActions off draws nothing', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowPlayerActions');
        spawn(players, 7, 'Anon', 255);

        drawing.invalidate(ctx, [marker(7)], players.getPlayersByType());

        expect(drawing.drawDiamond).not.toHaveBeenCalled();
        expect(drawing.drawTextItems).not.toHaveBeenCalled();
    });

    // @verified 2026-09-23: the players master switch off draws nothing.
    test('synthetic: settingShowPlayers off draws nothing', () => {
        spawn(players, 7, 'Anon', 255);
        settingsSync.getBool.mockImplementation(key => key !== 'settingShowPlayers');

        drawing.invalidate(ctx, [marker(7)], players.getPlayersByType());

        expect(drawing.drawDiamond).not.toHaveBeenCalled();
    });

    // @verified 2026-09-23: the passive filter off hides passive markers and keeps the others.
    test('synthetic: settingPassivePlayers off hides the passive marker only', () => {
        settingsSync.getBool.mockImplementation(key => key !== 'settingPassivePlayers');
        spawn(players, 7, 'Passive', 0);
        spawn(players, 8, 'Hostile', 255);

        drawing.invalidate(ctx, [marker(7), marker(8, {hX: 30, hY: 40})], players.getPlayersByType());

        expect(drawing.drawDiamond).toHaveBeenCalledTimes(1);
        expect(drawing.drawDiamond).toHaveBeenCalledWith(ctx, 30, 40, 7, '#ef4444');
    });

    // @verified 2026-09-23: the diamond is a closed four point path, filled in the colour, with a dark outline.
    test('synthetic: drawDiamond fills and strokes a four point path', () => {
        const path = {beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn()};

        ActionsDrawing.prototype.drawDiamond.call(drawing, path, 10, 20, 7, '#ef4444');

        expect(path.moveTo).toHaveBeenCalledWith(10, 13);
        expect(path.lineTo.mock.calls).toEqual([[17, 20], [10, 27], [3, 20]]);
        expect(path.closePath).toHaveBeenCalled();
        expect(path.fillStyle).toBe('#ef4444');
        expect(path.fill).toHaveBeenCalled();
        expect(path.strokeStyle).toBe('rgba(0, 0, 0, 0.8)');
        expect(path.stroke).toHaveBeenCalled();
    });

    // @verified 2026-09-23: markers hold world positions; interpolate turns them into radar offsets from the local
    // player, the same formula as interpolateEntity, and eases later moves of the local player.
    test('synthetic: interpolate places a marker relative to the local player', () => {
        const m = {playerId: 7, x: 100, y: 50};

        drawing.interpolate([m], 90, 40, 0.3);
        expect([m.hX, m.hY]).toEqual([-10, 10]);

        drawing.interpolate([m], 80, 40, 0.5);
        expect([m.hX, m.hY]).toEqual([-15, 10]);
    });
});

describe('ActionsDrawing full-flow', () => {
    let players;
    let actions;
    let drawing;
    let ctx;

    beforeEach(() => {
        vi.clearAllMocks();
        settingsSync.getBool.mockImplementation(() => true);
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.currentMapId = undefined;
        EventRouter.reset();
        players = new PlayersHandler();
        actions = new ActionsHandler(players);
        const stub = () => new Proxy({}, {get: (target, key) => (target[key] ??= vi.fn())});
        EventRouter.init({
            handlers: {
                playersHandler: players,
                actionsHandler: actions,
                mobsHandler: stub(),
                harvestablesHandler: stub(),
                chestsHandler: stub(),
                dungeonsHandler: stub(),
                fishingHandler: stub(),
                wispCageHandler: stub(),
                mistsDungeonHandler: stub(),
            },
            map: {id: -1},
            radarRenderer: null,
        });
        drawing = new ActionsDrawing();
        drawing.transformPoint = vi.fn((x, y) => ({x, y}));
        drawing.getMarkerSize = vi.fn(s => s);
        drawing.getScaledFontSize = vi.fn(s => s);
        drawing.drawDiamond = vi.fn();
        drawing.drawTextItems = vi.fn();
        ctx = {font: '', globalAlpha: 1, measureText: vi.fn(() => ({width: 40}))};
    });

    // @verified 2026-09-23: every listed player that self-casts in actions/self-cast.json draws one diamond at the
    // position of its last self-cast; the local player and players without NewCharacter draw nothing.
    test('full-flow: self-casts of known players draw one diamond each at the cast position', async () => {
        const fx = await loadFixture('actions', 'self-cast');
        const messages = fx.messages.map(m => normalizeParams(m.parameters));
        const isSelfCast = p => p[252] === EventCodes.CastSpell && p[0] === p[1];
        const replayed = messages.filter(p => p[252] === EventCodes.NewCharacter || isSelfCast(p));

        replayed.forEach(p => EventRouter.onEvent(p));

        const known = replayed.filter(isSelfCast).filter(p => players.playersList.some(pl => pl.id === p[0]));
        const lastPerPlayer = known.filter((p, i) => !known.slice(i + 1).some(q => q[0] === p[0]));
        expect(lastPerPlayer.length).toBeGreaterThan(0);

        drawing.interpolate(actions.markerList, 0, 0, 1);
        drawing.invalidate(ctx, actions.getMarkers(Date.now()), players.getPlayersByType());

        expect(drawing.drawDiamond).toHaveBeenCalledTimes(lastPerPlayer.length);
        for (const p of lastPerPlayer) {
            expect(drawing.drawDiamond).toHaveBeenCalledWith(ctx, 0 - p[2][0], p[2][1], 7, expect.any(String));
        }
    });
});

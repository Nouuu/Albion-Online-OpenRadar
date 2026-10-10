// synthetic: initRadar runs with the database loader and the WebSocket client stubbed; the radar wiring tests have no
// canvas, so no renderer.
// synthetic: the router init is spied to read the handlers it receives.
// synthetic: the renderer is stubbed and a canvas context faked, to read the dependencies initRadar hands it.

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

vi.mock('../core/DatabaseLoader.js', () => ({load: vi.fn(async () => {})}));
vi.mock('../core/WebSocketManager.js', () => ({setMessageCallback: vi.fn(), connect: vi.fn(), disconnect: vi.fn()}));
vi.mock('../core/EventRouter.js', async (importOriginal) => ({...await importOriginal(), init: vi.fn()}));
vi.mock('./RadarRenderer.js', () => ({
    createRadarRenderer: vi.fn(() => ({initialize: vi.fn(), setMap: vi.fn(), start: vi.fn(), stop: vi.fn()})),
}));
vi.mock('../core/PlayerListRenderer.js', async (importOriginal) => ({...await importOriginal(), update: vi.fn()}));

const Utils = await import('./Utils.js');
const EventRouter = await import('../core/EventRouter.js');
const {ActionsHandler} = await import('../handlers/ActionsHandler.js');
const {createRadarRenderer} = await import('./RadarRenderer.js');
const {ActionsDrawing} = await import('../drawings/ActionsDrawing.js');
const PlayerListRenderer = await import('../core/PlayerListRenderer.js');
const settingsSync = (await import('./SettingsSync.js')).default;

describe('Utils radar wiring', () => {
    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        document.body.innerHTML = '<button id="button"></button>';
    });

    afterEach(() => {
        Utils.destroyRadar();
    });

    // @verified 2026-09-23: the handler is built on the players handler and handed to the router.
    test('initRadar builds an ActionsHandler on the players handler and hands it to the router', async () => {
        await Utils.initRadar();

        const actions = window.handlers.actions;
        expect(actions).toBeInstanceOf(ActionsHandler);
        expect(actions.playersHandler).toBe(window.handlers.players);
        expect(EventRouter.init).toHaveBeenCalledWith(expect.objectContaining({
            handlers: expect.objectContaining({actionsHandler: actions}),
        }));
    });

    // @verified 2026-09-23: the clear button drops every marker with the other handlers.
    test('the clear button drops the action markers', async () => {
        await Utils.initRadar();
        const actions = window.handlers.actions;
        actions.markerList.push({playerId: 1, at: Date.now()});

        document.getElementById('button').click();

        expect(actions.markerList).toEqual([]);
    });

    describe('players list refresh', () => {
        const KEYS = ['settingShowPlayers', 'settingPassivePlayers'];

        beforeEach(() => {
            vi.useFakeTimers();
            KEYS.forEach(key => settingsSync.setBool(key, true));
        });

        afterEach(() => {
            KEYS.forEach(key => settingsSync.remove(key));
            vi.useRealTimers();
        });

        // @verified 2026-09-23: the 1.5 s refresh re-renders the list for a new action and when an attack flag ends, and
        // not in between.
        test('the list re-renders on a new action and when the attack flag ends', async () => {
            await Utils.initRadar();
            const players = window.handlers.players;
            players.handleNewPlayerEvent(1, {1: 'Alice', 8: '', 53: 0, 51: null, 40: [], 43: []});
            vi.advanceTimersByTime(1500);
            PlayerListRenderer.update.mockClear();

            vi.advanceTimersByTime(1500);
            expect(PlayerListRenderer.update).not.toHaveBeenCalled();

            players.noteAction(1);
            vi.advanceTimersByTime(1500);
            expect(PlayerListRenderer.update).toHaveBeenCalledTimes(1);

            players.flagAttacker(1);
            vi.advanceTimersByTime(1500);
            expect(PlayerListRenderer.update).toHaveBeenCalledTimes(2);

            vi.advanceTimersByTime(7500);
            expect(PlayerListRenderer.update).toHaveBeenCalledTimes(2);

            vi.advanceTimersByTime(1500);
            expect(PlayerListRenderer.update).toHaveBeenCalledTimes(3);
        });
    });
});

describe('Utils renderer wiring', () => {
    let getContext;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        document.body.innerHTML = '<canvas id="drawCanvas"></canvas>';
        getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({});
    });

    afterEach(() => {
        Utils.destroyRadar();
        getContext.mockRestore();
    });

    // @verified 2026-09-23: the renderer draws only what initRadar hands it, so the actions pair must reach it.
    test('initRadar hands the actions drawing and the actions handler to the renderer', async () => {
        await Utils.initRadar();

        const {handlers, drawings} = createRadarRenderer.mock.calls.at(-1)[0];
        expect(drawings.actionsDrawing).toBeInstanceOf(ActionsDrawing);
        expect(handlers.actionsHandler).toBe(window.handlers.actions);
    });
});

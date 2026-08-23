// synthetic: the backend playing a sound is not observable in a capture
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

vi.mock('./SettingsSync.js', () => ({
    default: {
        get: vi.fn((_k, d) => d),
        getFloat: vi.fn((_k, d) => d),
    },
}));

const {AlertSound} = await import('./AlertSound.js');
const settingsSync = (await import('./SettingsSync.js')).default;

const stubFetch = (response) => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

const accepted = () => stubFetch({ok: true, status: 204});
const refused = (status) => stubFetch({ok: false, status});
const sent = (fetchMock, call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe('AlertSound', () => {
    let toast;

    beforeEach(() => {
        toast = {warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn()};
        window.toast = toast;
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        settingsSync.get.mockImplementation((_k, d) => d);
        settingsSync.getFloat.mockImplementation((_k, d) => d);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // @verified 2026-08-23: playback lives in the Go process, which no window state can throttle.
    test('synthetic: an alert asks the backend to play', async () => {
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/alert/play');
        expect(fetchMock.mock.calls[0][1].method).toBe('POST');
        expect(sent(fetchMock)).toEqual({file: 'player.wav', volume: 1});
    });

    // @verified 2026-08-23: two threats are two alerts, the backend decides what to do with the overlap.
    test('synthetic: each trigger sends its own request', async () => {
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();
        await sound.play();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // @verified 2026-08-23: the level is read per alert, so a change applies without a reload.
    test('synthetic: the request carries the stored volume', async () => {
        settingsSync.getFloat.mockReturnValue(0.25);
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(sent(fetchMock).volume).toBe(0.25);
    });

    // @verified 2026-08-23: zero is silence, and it is a different control from the on/off toggle.
    test('synthetic: a volume of zero is sent as zero', async () => {
        settingsSync.getFloat.mockReturnValue(0);
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(sent(fetchMock).volume).toBe(0);
    });

    // @verified 2026-08-23: the selection is read per alert, so a change applies without a reload.
    test('synthetic: the request carries the file named by the setting', async () => {
        settingsSync.get.mockReturnValue('player.wav');
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(sent(fetchMock).file).toBe('player.wav');
    });

    // @verified 2026-08-23: a stale selection must fall back audibly, never to silence.
    test('synthetic: an unknown selection falls back to the default and warns', async () => {
        settingsSync.get.mockReturnValue('deleted.wav');
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(sent(fetchMock).file).toBe('player.wav');
        expect(window.logger.warn).toHaveBeenCalledWith(
            expect.anything(), 'AlertSoundMissing', expect.objectContaining({stored: 'deleted.wav'}));
    });

    // @verified 2026-08-23: a preview button that stays silent reads as broken, and the player pressed it.
    test('synthetic: preview plays at full when the volume is zero', async () => {
        settingsSync.getFloat.mockReturnValue(0);
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.preview();

        expect(sent(fetchMock).volume).toBe(1);
    });

    // @verified 2026-08-23: above zero, preview shows the player the level their alerts will use.
    test('synthetic: preview follows the volume when it is above zero', async () => {
        settingsSync.getFloat.mockReturnValue(0.4);
        const fetchMock = accepted();
        const sound = new AlertSound();

        await sound.preview();

        expect(sent(fetchMock).volume).toBe(0.4);
    });

    // @verified 2026-08-23: a machine with no audio device is the one failure the player cannot fix from here.
    test('synthetic: a backend without audio raises a persistent warning', async () => {
        refused(503);
        const sound = new AlertSound();

        await sound.play();

        expect(window.logger.warn).toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(toast.warning.mock.calls[0][1]).toBe(0);
    });

    // @verified 2026-08-23: the status is what separates a missing sound from a machine that cannot play.
    test('synthetic: a refused request records the status', async () => {
        refused(404);
        const sound = new AlertSound();

        await sound.play();

        expect(window.logger.warn).toHaveBeenCalledWith(
            expect.anything(), 'ThreatSoundFailed', expect.objectContaining({status: 404}));
    });

    // @verified 2026-08-23: a radar that stopped answering must not swallow the alert silently.
    test('synthetic: an unreachable backend is reported', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
        const sound = new AlertSound();

        await expect(sound.play()).resolves.toBeUndefined();

        expect(window.logger.warn).toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledTimes(1);
    });

    // @verified 2026-08-09: a stream of hostiles cannot bury the screen in toasts.
    test('synthetic: repeated failures warn the user once', async () => {
        refused(503);
        const sound = new AlertSound();

        await sound.play();
        await sound.play();
        await sound.play();

        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(window.logger.warn).toHaveBeenCalledTimes(3);
    });

    // @verified 2026-08-09: a working alert stays silent in the interface.
    test('synthetic: a successful play warns about nothing', async () => {
        accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(toast.warning).not.toHaveBeenCalled();
        expect(window.logger.warn).not.toHaveBeenCalled();
    });

    // @verified 2026-08-23: a played attempt must be distinguishable from one that never started.
    test('synthetic: a successful play records a debug line', async () => {
        accepted();
        const sound = new AlertSound();

        await sound.play();

        expect(window.logger.debug).toHaveBeenCalledWith(
            expect.anything(), 'ThreatSoundPlayed', expect.anything());
    });
});

// synthetic: browser audio policy is not observable in a capture
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

vi.mock('./SettingsSync.js', () => ({
    default: {
        get: vi.fn((_k, d) => d),
        getFloat: vi.fn((_k, d) => d),
    },
}));

const {AlertSound} = await import('./AlertSound.js');
const settingsSync = (await import('./SettingsSync.js')).default;

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

    // @verified 2026-05-22: a reused element stopped emitting after a long session, so each trigger builds its own.
    test('synthetic: each trigger builds a fresh element', async () => {
        const play = vi.fn().mockResolvedValue();
        const ctor = vi.fn(function () { this.play = play; });
        vi.stubGlobal('Audio', ctor);
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();
        await sound.play();

        expect(ctor).toHaveBeenCalledTimes(2);
        expect(ctor).toHaveBeenCalledWith('/sounds/player.wav');
        expect(play).toHaveBeenCalledTimes(2);
    });

    // @verified 2026-08-09: a blocked alert reaches the user instead of being swallowed into a debug log.
    test('synthetic: a rejected play raises a persistent warning', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockRejectedValue(new Error('NotAllowedError')); }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(window.logger.warn).toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(toast.warning.mock.calls[0][1]).toBe(0);
    });

    // @verified 2026-08-09: a stream of hostiles cannot bury the screen in toasts.
    test('synthetic: repeated rejections warn the user once', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockRejectedValue(new Error('NotAllowedError')); }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();
        await sound.play();
        await sound.play();

        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(window.logger.warn).toHaveBeenCalledTimes(3);
    });

    // @verified 2026-08-09: a working alert stays silent in the interface.
    test('synthetic: a successful play warns about nothing', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(toast.warning).not.toHaveBeenCalled();
        expect(window.logger.warn).not.toHaveBeenCalled();
    });

    // @verified 2026-08-23: the level is read per alert, so a change applies without a reload.
    test('synthetic: playback applies the stored volume', async () => {
        settingsSync.getFloat.mockReturnValue(0.25);
        let built;
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); built = this; }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(built.volume).toBe(0.25);
    });

    // @verified 2026-08-23: zero is silence, and it is a different control from the on/off toggle.
    test('synthetic: a volume of zero plays nothing audible', async () => {
        settingsSync.getFloat.mockReturnValue(0);
        let built;
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); built = this; }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(built.volume).toBe(0);
    });

    // @verified 2026-08-23: the selection is read per alert, so a change applies without a reload.
    test('synthetic: playback uses the file named by the setting', async () => {
        settingsSync.get.mockReturnValue('player.wav');
        const ctor = vi.fn(function () { this.play = vi.fn().mockResolvedValue(); });
        vi.stubGlobal('Audio', ctor);
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(ctor).toHaveBeenCalledWith('/sounds/player.wav');
    });

    // @verified 2026-08-23: a stale selection must fall back audibly, never to silence.
    test('synthetic: an unknown selection falls back to the default and warns', async () => {
        settingsSync.get.mockReturnValue('deleted.mp3');
        const ctor = vi.fn(function () { this.play = vi.fn().mockResolvedValue(); });
        vi.stubGlobal('Audio', ctor);
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(ctor).toHaveBeenCalledWith('/sounds/player.wav');
        expect(window.logger.warn).toHaveBeenCalledWith(
            expect.anything(), 'AlertSoundMissing', expect.objectContaining({stored: 'deleted.mp3'}));
    });

    // @verified 2026-08-23: a preview button that stays silent reads as broken, and the player pressed it.
    test('synthetic: preview plays at full when the volume is zero', async () => {
        settingsSync.getFloat.mockReturnValue(0);
        let built;
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); built = this; }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.preview();

        expect(built.play).toHaveBeenCalledTimes(1);
        expect(built.volume).toBe(1);
    });

    // @verified 2026-08-23: above zero, preview shows the player the level their alerts will use.
    test('synthetic: preview follows the volume when it is above zero', async () => {
        settingsSync.getFloat.mockReturnValue(0.4);
        let built;
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); built = this; }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.preview();

        expect(built.volume).toBe(0.4);
    });

    // @verified 2026-08-23: the error name is what separates an autoplay refusal from any other failure.
    test('synthetic: a refused play records the error name', async () => {
        const err = new Error('play() failed');
        err.name = 'NotAllowedError';
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockRejectedValue(err); }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(window.logger.warn).toHaveBeenCalledWith(
            expect.anything(), 'ThreatSoundBlocked', expect.objectContaining({name: 'NotAllowedError'}));
    });

    // @verified 2026-08-23: a played attempt must be distinguishable from one that never started.
    test('synthetic: a successful play records a debug line', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); }));
        const sound = new AlertSound('/sounds/player.wav');

        await sound.play();

        expect(window.logger.debug).toHaveBeenCalledWith(
            expect.anything(), 'ThreatSoundPlayed', expect.anything());
    });

    // @verified 2026-08-09: a constructor that throws is handled like a rejected play, the caller never sees it.
    test('synthetic: a throwing constructor does not escape', async () => {
        vi.stubGlobal('Audio', vi.fn(() => { throw new Error('no media support'); }));
        const sound = new AlertSound('/sounds/player.wav');

        await expect(sound.play()).resolves.toBeUndefined();
        expect(toast.warning).toHaveBeenCalledTimes(1);
    });
});

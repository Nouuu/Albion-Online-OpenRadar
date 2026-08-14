// synthetic: browser audio policy is not observable in a capture
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

import {AlertSound} from './AlertSound.js';

describe('AlertSound', () => {
    let toast;

    beforeEach(() => {
        toast = {warning: vi.fn(), error: vi.fn(), info: vi.fn(), success: vi.fn()};
        window.toast = toast;
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // @verified 2026-05-22: a reused element stopped emitting after a long session, so each trigger builds its own.
    test('synthetic: each trigger builds a fresh element', async () => {
        const play = vi.fn().mockResolvedValue();
        const ctor = vi.fn(function () { this.play = play; });
        vi.stubGlobal('Audio', ctor);
        const sound = new AlertSound('/sounds/player.mp3');

        await sound.play();
        await sound.play();

        expect(ctor).toHaveBeenCalledTimes(2);
        expect(ctor).toHaveBeenCalledWith('/sounds/player.mp3');
        expect(play).toHaveBeenCalledTimes(2);
    });

    // @verified 2026-08-09: a blocked alert reaches the user instead of being swallowed into a debug log.
    test('synthetic: a rejected play raises a persistent warning', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockRejectedValue(new Error('NotAllowedError')); }));
        const sound = new AlertSound('/sounds/player.mp3');

        await sound.play();

        expect(window.logger.warn).toHaveBeenCalled();
        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(toast.warning.mock.calls[0][1]).toBe(0);
    });

    // @verified 2026-08-09: a stream of hostiles cannot bury the screen in toasts.
    test('synthetic: repeated rejections warn the user once', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockRejectedValue(new Error('NotAllowedError')); }));
        const sound = new AlertSound('/sounds/player.mp3');

        await sound.play();
        await sound.play();
        await sound.play();

        expect(toast.warning).toHaveBeenCalledTimes(1);
        expect(window.logger.warn).toHaveBeenCalledTimes(3);
    });

    // @verified 2026-08-09: a working alert stays silent in the interface.
    test('synthetic: a successful play warns about nothing', async () => {
        vi.stubGlobal('Audio', vi.fn(function () { this.play = vi.fn().mockResolvedValue(); }));
        const sound = new AlertSound('/sounds/player.mp3');

        await sound.play();

        expect(toast.warning).not.toHaveBeenCalled();
        expect(window.logger.warn).not.toHaveBeenCalled();
    });

    // @verified 2026-08-09: a constructor that throws is handled like a rejected play, the caller never sees it.
    test('synthetic: a throwing constructor does not escape', async () => {
        vi.stubGlobal('Audio', vi.fn(() => { throw new Error('no media support'); }));
        const sound = new AlertSound('/sounds/player.mp3');

        await expect(sound.play()).resolves.toBeUndefined();
        expect(toast.warning).toHaveBeenCalledTimes(1);
    });
});

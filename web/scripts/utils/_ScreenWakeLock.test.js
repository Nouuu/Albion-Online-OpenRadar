// synthetic: navigator.wakeLock, isSecureContext and HTMLMediaElement.play are stubbed per test; happy-dom has none
// of the Screen Wake Lock API and never decodes media.
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import settingsSync from './SettingsSync.js';
import {startScreenWakeLock, stopScreenWakeLock} from './ScreenWakeLock.js';

const KEY = 'settingRadarKeepAwake';

let sentinels = [];
let play = null;

function stub(target, prop, value) {
    Object.defineProperty(target, prop, {value, configurable: true});
}

function withWakeLock() {
    stub(navigator, 'wakeLock', {
        request: vi.fn(async () => {
            const sentinel = {release: vi.fn(async () => {})};
            sentinels.push(sentinel);
            return sentinel;
        }),
    });
    stub(window, 'isSecureContext', true);
}

function videos() {
    return [...document.querySelectorAll('video')];
}

function setVisibility(state) {
    stub(document, 'visibilityState', state);
    document.dispatchEvent(new Event('visibilitychange'));
}

function flush() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
    sentinels = [];
    settingsSync.remove(KEY);
    stub(navigator, 'wakeLock', undefined);
    stub(window, 'isSecureContext', false);
    stub(document, 'visibilityState', 'visible');
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
    stopScreenWakeLock();
    settingsSync.remove(KEY);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe('screen wake lock', () => {
    test('@verified 2026-09-26: with the Wake Lock API in a secure context it requests a screen lock and adds no video', async () => {
        withWakeLock();

        startScreenWakeLock();
        await flush();

        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        expect(videos()).toEqual([]);
    });

    test.each([
        ['without the Wake Lock API', () => {}],
        ['over plain HTTP', () => stub(navigator, 'wakeLock', {request: vi.fn()})],
    ])('@verified 2026-09-26: %s it plays a muted, looping, inline, hidden video', async (_, setup) => {
        setup();

        startScreenWakeLock();
        await flush();

        const [video] = videos();
        expect(videos()).toHaveLength(1);
        expect([video.muted, video.loop, video.hasAttribute('playsinline')]).toEqual([true, true, true]);
        expect(video.src.startsWith('data:video/mp4;base64,')).toBe(true);
        expect(video.style.opacity).toBe('0');
        expect(play).toHaveBeenCalledTimes(1);
        expect(navigator.wakeLock?.request.mock.calls ?? []).toEqual([]);
    });

    test('@verified 2026-09-26: a refused wake lock falls back to the video', async () => {
        withWakeLock();
        navigator.wakeLock.request.mockRejectedValueOnce(new Error('NotAllowedError'));

        startScreenWakeLock();
        await flush();

        expect(videos()).toHaveLength(1);
        expect(play).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-26: the lock is requested again when the page becomes visible', async () => {
        withWakeLock();
        startScreenWakeLock();
        await flush();

        setVisibility('hidden');
        await flush();
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);

        setVisibility('visible');
        await flush();
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2);
    });

    test('@verified 2026-09-26: a play refused for lack of a gesture is retried once on the next pointerdown or keydown', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();
        expect(play).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new Event('keydown'));
        await flush();
        expect(play).toHaveBeenCalledTimes(2);

        document.dispatchEvent(new Event('pointerdown'));
        document.dispatchEvent(new Event('keydown'));
        await flush();
        expect(play).toHaveBeenCalledTimes(2);
    });

    test('@verified 2026-09-26: the setting off at start acquires nothing', async () => {
        withWakeLock();
        settingsSync.setBool(KEY, false);

        startScreenWakeLock();
        await flush();

        expect(navigator.wakeLock.request).not.toHaveBeenCalled();
        expect(videos()).toEqual([]);
    });

    test('@verified 2026-09-26: turning the setting off releases the lock, turning it on takes it again', async () => {
        withWakeLock();
        startScreenWakeLock();
        await flush();

        settingsSync.setBool(KEY, false);
        await flush();
        expect(sentinels[0].release).toHaveBeenCalledTimes(1);
        setVisibility('visible');
        await flush();
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);

        settingsSync.setBool(KEY, true);
        await flush();
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2);
    });

    test('@verified 2026-09-26: turning the setting off removes the video and its gesture retry', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();

        settingsSync.setBool(KEY, false);
        await flush();
        document.dispatchEvent(new Event('pointerdown'));
        await flush();

        expect(videos()).toEqual([]);
        expect(play).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-26: stop releases the lock and leaves no listener behind', async () => {
        withWakeLock();
        const before = [...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0);
        startScreenWakeLock();
        await flush();

        stopScreenWakeLock();
        await flush();
        setVisibility('visible');
        settingsSync.setBool(KEY, false);
        settingsSync.setBool(KEY, true);
        await flush();

        expect(sentinels[0].release).toHaveBeenCalledTimes(1);
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);
        expect([...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0)).toBe(before);
    });

    test('@verified 2026-09-26: stop removes the video and its pending gesture retry', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();

        stopScreenWakeLock();
        document.dispatchEvent(new Event('pointerdown'));
        document.dispatchEvent(new Event('keydown'));
        setVisibility('visible');
        await flush();

        expect(videos()).toEqual([]);
        expect(play).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-26: a lock granted after stop is released at once', async () => {
        withWakeLock();
        startScreenWakeLock();
        stopScreenWakeLock();
        await flush();

        expect(sentinels[0].release).toHaveBeenCalledTimes(1);
    });

    test('@verified 2026-09-26: a second start keeps a single lock and a single set of listeners', async () => {
        withWakeLock();
        startScreenWakeLock();
        await flush();
        const listeners = [...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0);

        startScreenWakeLock();
        await flush();

        expect([...settingsSync.listeners.values()].reduce((sum, list) => sum + list.length, 0)).toBe(listeners);
        expect(sentinels.filter(sentinel => !sentinel.release.mock.calls.length)).toHaveLength(1);
    });
});

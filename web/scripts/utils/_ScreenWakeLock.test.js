// synthetic: navigator.wakeLock, isSecureContext and HTMLMediaElement.play are stubbed per test; happy-dom has none
// of the Screen Wake Lock API and never decodes media.
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';
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

function setPointer(pointer) {
    stub(window, 'matchMedia', vi.fn(query => ({matches: query === `(pointer: ${pointer})`})));
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
    setPointer('coarse');
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
    ])('@verified 2026-09-26: %s it plays an unmuted, audible, looping, inline, hidden video', async (_, setup) => {
        setup();

        startScreenWakeLock();
        await flush();

        const [video] = videos();
        expect(videos()).toHaveLength(1);
        expect([video.muted, video.volume > 0, video.loop, video.hasAttribute('playsinline')]).toEqual([false, true, true, true]);
        expect(video.src.startsWith('data:video/mp4;base64,')).toBe(true);
        expect(video.style.opacity).toBe('0');
        expect(video.style.pointerEvents).toBe('none');
        expect(video.style.zIndex).toBe('-1');
        expect(video.getAttribute('aria-hidden')).toBe('true');
        expect(play).toHaveBeenCalledTimes(1);
        expect(navigator.wakeLock?.request.mock.calls ?? []).toEqual([]);
    });

    test('@verified 2026-09-26: the fallback media holds an H.264 video track and an AAC audio track, since Chromium keeps the wake lock of an audible video', async () => {
        startScreenWakeLock();
        await flush();

        const media = Buffer.from(videos()[0].src.split(',')[1], 'base64').toString('latin1');
        expect(['vide', 'avc1', 'soun', 'mp4a'].filter(tag => media.includes(tag))).toEqual(['vide', 'avc1', 'soun', 'mp4a']);
    });

    test('@verified 2026-09-26: the fallback media is the pinned silent clip', async () => {
        startScreenWakeLock();
        await flush();

        expect(createHash('sha256').update(videos()[0].src).digest('hex'))
            .toBe('8f516ae73c2935ce258570aeda10a7568e62431efe6394978b6a4cad2cc83b1e');
    });

    test('@verified 2026-09-26: with a fine pointer and no Wake Lock API it adds no video and no gesture listener', async () => {
        setPointer('fine');
        const add = vi.spyOn(document, 'addEventListener');
        play.mockRejectedValue(new Error('NotAllowedError'));

        startScreenWakeLock();
        await flush();
        document.dispatchEvent(new Event('pointerup'));
        await flush();

        expect(videos()).toEqual([]);
        expect(play).not.toHaveBeenCalled();
        expect(add.mock.calls.filter(([type]) => type === 'pointerup' || type === 'keydown')).toEqual([]);
    });

    test('@verified 2026-09-26: with a fine pointer and the Wake Lock API it takes the lock', async () => {
        setPointer('fine');
        withWakeLock();

        startScreenWakeLock();
        await flush();

        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        expect(videos()).toEqual([]);
    });

    test('@verified 2026-09-26: with a fine pointer a refused lock adds no video', async () => {
        setPointer('fine');
        withWakeLock();
        navigator.wakeLock.request.mockRejectedValueOnce(new Error('NotAllowedError'));

        startScreenWakeLock();
        await flush();

        expect(videos()).toEqual([]);
        expect(play).not.toHaveBeenCalled();
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

    test('@verified 2026-09-26: a play refused for lack of a gesture starts on the next pointerup or keydown', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();
        expect(play).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new Event('keydown'));
        await flush();
        expect(play).toHaveBeenCalledTimes(2);

        document.dispatchEvent(new Event('pointerup'));
        document.dispatchEvent(new Event('keydown'));
        await flush();
        expect(play).toHaveBeenCalledTimes(2);
    });

    test('@verified 2026-09-26: a pointerdown alone does not start the video, since a touch grants user activation only on pointerup', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();

        document.dispatchEvent(new Event('pointerdown'));
        await flush();
        expect(play).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new Event('pointerup'));
        await flush();
        expect(play).toHaveBeenCalledTimes(2);
    });

    test('@verified 2026-09-26: a gesture play refused again waits for the next gesture', async () => {
        play.mockRejectedValueOnce(new Error('NotAllowedError')).mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();

        document.dispatchEvent(new Event('keydown'));
        await flush();
        document.dispatchEvent(new Event('pointerup'));
        await flush();

        expect(play).toHaveBeenCalledTimes(3);
    });

    test('@verified 2026-09-26: two refused plays still retry once, on a single pair of gesture listeners', async () => {
        const add = vi.spyOn(document, 'addEventListener');
        play.mockRejectedValueOnce(new Error('NotAllowedError')).mockRejectedValueOnce(new Error('NotAllowedError'));
        startScreenWakeLock();
        await flush();
        setVisibility('visible');
        await flush();
        expect(play).toHaveBeenCalledTimes(2);

        document.dispatchEvent(new Event('pointerup'));
        await flush();
        document.dispatchEvent(new Event('keydown'));
        await flush();

        expect(play).toHaveBeenCalledTimes(3);
        expect(add.mock.calls.filter(([type]) => type === 'pointerup' || type === 'keydown')).toHaveLength(2);
    });

    test('@verified 2026-09-26: a new lock releases the previous one', async () => {
        withWakeLock();
        startScreenWakeLock();
        await flush();

        setVisibility('visible');
        await flush();

        expect(sentinels).toHaveLength(2);
        expect(sentinels[0].release).toHaveBeenCalledTimes(1);
        expect(sentinels[1].release).not.toHaveBeenCalled();
    });

    test('@verified 2026-09-26: a lock granted after the video fallback stops and removes the video', async () => {
        withWakeLock();
        navigator.wakeLock.request.mockRejectedValueOnce(new Error('NotAllowedError'));
        const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
        startScreenWakeLock();
        await flush();
        expect(videos()).toHaveLength(1);

        setVisibility('visible');
        await flush();

        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2);
        expect(videos()).toEqual([]);
        expect(pause).toHaveBeenCalled();
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
        document.dispatchEvent(new Event('pointerup'));
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
        document.dispatchEvent(new Event('pointerup'));
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

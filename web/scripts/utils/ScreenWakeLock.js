import settingsSync from './SettingsSync.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';

const KEY = 'settingRadarKeepAwake';
const VIDEO = 'data:video/mp4;base64,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';

let hold = null;

function warn(event) {
    return error => window.logger?.warn(CATEGORIES.SYSTEM, event, {error: error?.message});
}

function playVideo(current) {
    if (!current.video) {
        current.video = Object.assign(document.createElement('video'), {loop: true, src: VIDEO});
        current.video.setAttribute('playsinline', '');
        current.video.setAttribute('aria-hidden', 'true');
        current.video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
        document.body.append(current.video);
    }
    current.video.play().catch(() => {
        if (hold !== current || current.gesture) return;
        const gesture = new AbortController();
        current.gesture = gesture;
        const retry = () => {
            gesture.abort();
            current.gesture = null;
            playVideo(current);
        };
        document.addEventListener('pointerup', retry, {signal: gesture.signal});
        document.addEventListener('keydown', retry, {signal: gesture.signal});
    });
}

function dropVideo(current) {
    current.gesture?.abort();
    current.gesture = null;
    current.video?.pause();
    current.video?.remove();
    current.video = null;
}

async function acquire(current) {
    if (navigator.wakeLock && window.isSecureContext) {
        try {
            const sentinel = await navigator.wakeLock.request('screen');
            if (hold !== current) {
                sentinel.release().catch(warn('WakeLockReleaseFailed'));
                return;
            }
            current.sentinel?.release().catch(warn('WakeLockReleaseFailed'));
            current.sentinel = sentinel;
            dropVideo(current);
            return;
        } catch (error) {
            warn('WakeLockRequestFailed')(error);
        }
    }
    if (hold === current && !window.matchMedia('(pointer: fine)').matches) playVideo(current);
}

function enable() {
    if (hold) return;
    const current = {controller: new AbortController(), sentinel: null, video: null, gesture: null};
    hold = current;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') acquire(current);
    }, {signal: current.controller.signal});
    acquire(current);
}

function disable() {
    if (!hold) return;
    const current = hold;
    hold = null;
    current.controller.abort();
    current.sentinel?.release().catch(warn('WakeLockReleaseFailed'));
    dropVideo(current);
}

function sync() {
    if (settingsSync.getBool(KEY)) enable();
    else disable();
}

export function startScreenWakeLock() {
    stopScreenWakeLock();
    settingsSync.on(KEY, sync);
    sync();
}

export function stopScreenWakeLock() {
    settingsSync.off(KEY, sync);
    disable();
}

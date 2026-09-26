import settingsSync from './SettingsSync.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';

const KEY = 'settingRadarKeepAwake';
const VIDEO = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMHbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAABAAAAAgAAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAlZ0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAIAAAAAAAAABAAAAAAHObWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABeW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATlzdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAe/+EAFmdCwB7ZHsBEAAADAAQAAAMACDxYuSABAAZoy4BlLIAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAKKAAAAGQAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAAA8AAAAKAAAAFHN0Y28AAAAAAAAAAQAAAzcAAAA9dWR0YQAAADVtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAAhpbHN0AAAACGZyZWUAAAAhbWRhdAAAAAtliIQFvJigACFPgAAAAAZBmjgK+oA=';

let hold = null;

function warn(event) {
    return error => window.logger?.warn(CATEGORIES.SYSTEM, event, {error: error?.message});
}

function playVideo(current) {
    if (!current.video) {
        current.video = Object.assign(document.createElement('video'), {muted: true, loop: true, src: VIDEO});
        current.video.setAttribute('playsinline', '');
        current.video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
        document.body.append(current.video);
    }
    current.video.play().catch(() => {
        if (hold !== current) return;
        const retry = () => {
            document.removeEventListener('pointerdown', retry);
            document.removeEventListener('keydown', retry);
            current.video.play().catch(warn('KeepAwakeVideoFailed'));
        };
        document.addEventListener('pointerdown', retry, {signal: current.controller.signal});
        document.addEventListener('keydown', retry, {signal: current.controller.signal});
    });
}

async function acquire(current) {
    if (navigator.wakeLock && window.isSecureContext) {
        try {
            const sentinel = await navigator.wakeLock.request('screen');
            if (hold === current) current.sentinel = sentinel;
            else sentinel.release().catch(warn('WakeLockReleaseFailed'));
            return;
        } catch (error) {
            warn('WakeLockRequestFailed')(error);
        }
    }
    if (hold === current) playVideo(current);
}

function enable() {
    if (hold) return;
    const current = {controller: new AbortController(), sentinel: null, video: null};
    hold = current;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') acquire(current);
    }, {signal: current.controller.signal});
    acquire(current);
}

function disable() {
    if (!hold) return;
    const {controller, sentinel, video} = hold;
    hold = null;
    controller.abort();
    sentinel?.release().catch(warn('WakeLockReleaseFailed'));
    video?.pause();
    video?.remove();
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

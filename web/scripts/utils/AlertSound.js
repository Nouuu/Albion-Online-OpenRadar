import {CATEGORIES} from '../constants/LoggerConstants.js';

const BLOCKED_MESSAGE = 'Threat sound blocked by the browser. Click anywhere on the page to allow it.';
const MIN_GAP_MS = 500;

export class AlertSound {
    constructor(src) {
        this.src = src;
        this.reported = false;
        this.lastPlayedAt = -Infinity;
    }

    async play() {
        const at = Date.now();
        if (at - this.lastPlayedAt < MIN_GAP_MS) return;
        this.lastPlayedAt = at;
        try {
            await new Audio(this.src).play();
            window.logger?.debug(CATEGORIES.PLAYERS, 'ThreatSoundPlayed', {src: this.src});
        } catch (err) {
            this.report(err);
        }
    }

    report(err) {
        window.logger?.warn(CATEGORIES.PLAYERS, 'ThreatSoundBlocked', {name: err?.name, error: err?.message});
        if (this.reported) return;
        this.reported = true;
        window.toast?.warning(BLOCKED_MESSAGE, 0);
    }
}

export default new AlertSound('/sounds/player.mp3');

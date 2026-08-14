import {CATEGORIES} from '../constants/LoggerConstants.js';

const BLOCKED_MESSAGE = 'Threat sound blocked by the browser. Click anywhere on the page to allow it.';

export class AlertSound {
    constructor(src) {
        this.src = src;
        this.reported = false;
    }

    async play() {
        try {
            await new Audio(this.src).play();
        } catch (err) {
            this.report(err);
        }
    }

    report(err) {
        window.logger?.warn(CATEGORIES.PLAYERS, 'ThreatSoundBlocked', {error: err?.message});
        if (this.reported) return;
        this.reported = true;
        window.toast?.warning(BLOCKED_MESSAGE, 0);
    }
}

export default new AlertSound('/sounds/player.mp3');

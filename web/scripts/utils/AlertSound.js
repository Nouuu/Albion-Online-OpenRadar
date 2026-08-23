import {CATEGORIES} from '../constants/LoggerConstants.js';
import settingsSync from './SettingsSync.js';

const BLOCKED_MESSAGE = 'Threat sound blocked by the browser. Click anywhere on the page to allow it.';

export class AlertSound {
    constructor(src) {
        this.src = src;
        this.reported = false;
    }

    async play() {
        try {
            const audio = new Audio(this.src);
            audio.volume = settingsSync.getFloat('settingSoundVolume', 1);
            await audio.play();
            window.logger?.debug(CATEGORIES.PLAYERS, 'ThreatSoundPlayed', {src: this.src, volume: audio.volume});
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

import {CATEGORIES} from '../constants/LoggerConstants.js';
import settingsSync from './SettingsSync.js';
import {DEFAULT_SOUND, findSound, defaultSound} from './AlertSoundCatalog.js';

const BLOCKED_MESSAGE = 'Threat sound blocked by the browser. Click anywhere on the page to allow it.';

export class AlertSound {
    constructor(src) {
        this.src = src;
        this.reported = false;
    }

    async play() {
        await this.emit(settingsSync.getFloat('settingSoundVolume', 1));
    }

    async preview() {
        const volume = settingsSync.getFloat('settingSoundVolume', 1);
        await this.emit(volume > 0 ? volume : 1);
    }

    resolve() {
        const stored = settingsSync.get('settingSoundFile', DEFAULT_SOUND);
        const entry = findSound(stored);
        if (entry) return entry;
        window.logger?.warn(CATEGORIES.PLAYERS, 'AlertSoundMissing', {stored});
        return defaultSound();
    }

    async emit(volume) {
        const file = this.resolve().file;
        try {
            const audio = new Audio(`/sounds/${file}`);
            audio.volume = volume;
            await audio.play();
            window.logger?.debug(CATEGORIES.PLAYERS, 'ThreatSoundPlayed', {file, volume});
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

export default new AlertSound('/sounds/player.wav');

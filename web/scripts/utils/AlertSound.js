import {CATEGORIES} from '../constants/LoggerConstants.js';
import settingsSync from './SettingsSync.js';
import {DEFAULT_SOUND, findSound} from './AlertSoundCatalog.js';

const UNAVAILABLE_MESSAGE = 'Threat sound unavailable. The machine running the radar could not play it.';

export class AlertSound {
    constructor() {
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
        return findSound(DEFAULT_SOUND);
    }

    async emit(volume) {
        const file = this.resolve().file;
        try {
            const {ok, status} = await fetch('/api/alert/play', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({file, volume}),
            });
            if (!ok) return this.report(`alert play refused with HTTP ${status}`, status);
            window.logger?.debug(CATEGORIES.PLAYERS, 'ThreatSoundPlayed', {file, volume});
        } catch (err) {
            this.report(err?.message);
        }
    }

    report(error, status) {
        window.logger?.warn(CATEGORIES.PLAYERS, 'ThreatSoundFailed', {status, error});
        if (this.reported) return;
        this.reported = true;
        window.toast?.warning(UNAVAILABLE_MESSAGE, 0);
    }
}

export default new AlertSound();

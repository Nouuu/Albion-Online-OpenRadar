import settingsSync from './SettingsSync.js';
import {SETTINGS} from './SettingsRegistry.js';

function exportableEntries() {
    return SETTINGS.filter(entry => (entry.scope === 'setting' || entry.scope === 'ui') && entry.key !== 'settingIgnoreList');
}

export function resetAllSettings(sync = settingsSync) {
    for (const entry of exportableEntries()) sync.remove(entry.key);
}

export async function buildDebugExport(sync, fetchImpl) {
    const settings = {};
    for (const entry of exportableEntries()) settings[entry.key] = sync.get(entry.key);

    let backend;
    try {
        const response = await fetchImpl('/api/settings/logging');
        if (!response.ok) throw new Error(`status ${response.status}`);
        backend = await response.json();
    } catch (error) {
        backend = {error: error?.message ?? String(error)};
    }

    return {
        settings,
        settingSchemaVersion: sync.getSchemaVersion(),
        backend,
        browser: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            language: navigator.language,
        },
    };
}

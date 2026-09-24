import {MIGRATION_ROWS} from './SettingsRegistry.js';

const COPIED = new Set(['rename', 'fix', 'product']);

export function migrateSettings(storage) {
    for (const {legacyKey, key, migration} of MIGRATION_ROWS) {
        if (!COPIED.has(migration)) continue;
        const value = storage.getItem(legacyKey);
        if (value === null) continue;
        if (storage.getItem(key) === null) storage.setItem(key, value);
        storage.removeItem(legacyKey);
    }
    storage.setItem('settingSchemaVersion', '1');
}

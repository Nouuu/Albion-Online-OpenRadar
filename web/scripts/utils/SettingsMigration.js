import {ALL_FALSE_MATRIX_STRING, MIGRATION_ROWS, registryEntry} from './SettingsRegistry.js';

const COPIED = new Set(['rename', 'fix', 'product']);
const MARKER = 'settingSchemaVersion';

export function migrateSettings(storage) {
    const markerAtStart = storage.getItem(MARKER) !== null;
    const existing = MIGRATION_ROWS.some(({legacyKey}) => legacyKey !== null && storage.getItem(legacyKey) !== null);
    const renamed = MIGRATION_ROWS.filter(({migration}) => COPIED.has(migration));

    for (const {legacyKey, key} of renamed) {
        const value = storage.getItem(legacyKey);
        if (value !== null && storage.getItem(key) === null) storage.setItem(key, value);
    }

    if (existing && !markerAtStart) {
        for (const {key, migration} of MIGRATION_ROWS) {
            if (migration !== 'product' || storage.getItem(key) !== null) continue;
            storage.setItem(key, registryEntry(key).type === 'json' ? ALL_FALSE_MATRIX_STRING : 'false');
        }
    }

    for (const {legacyKey, migration} of MIGRATION_ROWS) {
        if ((COPIED.has(migration) || migration === 'remove') && storage.getItem(legacyKey) !== null) storage.removeItem(legacyKey);
    }
    storage.setItem(MARKER, '1');
}

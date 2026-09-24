// synthetic: hand-written legacy profiles from the settings registry table.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, test, expect, vi} from 'vitest';
import {migrateSettings} from './SettingsMigration.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__/settings');

function loadProfile(name) {
    return JSON.parse(readFileSync(join(FIXTURES, `legacy-${name}.json`), 'utf8'));
}

function memoryStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
        getItem: vi.fn(key => (map.has(key) ? map.get(key) : null)),
        setItem: vi.fn((key, value) => { map.set(key, String(value)); }),
        removeItem: vi.fn(key => { map.delete(key); }),
        key: index => [...map.keys()][index] ?? null,
        get length() { return map.size; },
        snapshot: () => Object.fromEntries(map),
    };
}

describe('migrateSettings', () => {
    test.each(['fresh', 'gatherer', 'pvp', 'polluted'])('legacy-%s profile migrates to the expected store', name => {
        const {input, expected} = loadProfile(name);
        const storage = memoryStorage(input);
        migrateSettings(storage);
        expect(storage.snapshot()).toEqual(expected);
    });

    test.each(['fresh', 'gatherer', 'pvp', 'polluted'])('legacy-%s profile is stable on a second run', name => {
        const storage = memoryStorage(loadProfile(name).input);
        migrateSettings(storage);
        const first = storage.snapshot();
        migrateSettings(storage);
        expect(storage.snapshot()).toEqual(first);
    });

    test('keep rows are never written or removed', () => {
        const keep = {settingRadarZoom: '2', settingLogToConsole: 'true', settingLogToServer: 'false'};
        const storage = memoryStorage(keep);
        migrateSettings(storage);
        const touched = [...storage.setItem.mock.calls, ...storage.removeItem.mock.calls].map(([key]) => key);
        expect(touched.filter(key => key in keep)).toEqual([]);
        expect(storage.snapshot()).toEqual({...keep, settingSchemaVersion: '1'});
    });

    test('the new value wins over the legacy one and the legacy key is deleted', () => {
        const storage = memoryStorage({settingDangerousPlayers: 'false', settingPlayersHostile: 'true'});
        migrateSettings(storage);
        expect(storage.snapshot()).toEqual({settingPlayersHostile: 'true', settingSchemaVersion: '1'});
    });

    test('a legacy write after migration is copied only when the new key is absent', () => {
        const storage = memoryStorage({settingSound: 'false'});
        migrateSettings(storage);
        storage.setItem('settingFlash', 'true');
        storage.setItem('settingSound', 'true');
        migrateSettings(storage);
        expect(storage.snapshot()).toEqual({
            settingAlertSound: 'false',
            settingAlertFlash: 'true',
            settingSchemaVersion: '1',
        });
    });

    test('the schema marker is written last', () => {
        const storage = memoryStorage({settingFlash: 'true'});
        migrateSettings(storage);
        expect(storage.setItem.mock.calls.at(-1)).toEqual(['settingSchemaVersion', '1']);
        expect(storage.setItem.mock.invocationCallOrder.at(-1))
            .toBeGreaterThan(Math.max(...storage.removeItem.mock.invocationCallOrder));
    });
});

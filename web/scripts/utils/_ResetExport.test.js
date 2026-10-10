// synthetic: resetAllSettings and buildDebugExport exercised against the registry and a real SettingsSync pair.

import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {SETTINGS} from './SettingsRegistry.js';
import {resetAllSettings, buildDebugExport} from './SettingControls.js';

const EXPORTABLE_KEYS = SETTINGS
    .filter(entry => (entry.scope === 'setting' || entry.scope === 'ui') && entry.key !== 'settingIgnoreList')
    .map(entry => entry.key)
    .sort();

let syncA = null;
let syncB = null;

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    syncA?.destroy();
    syncB?.destroy();
    syncA = null;
    syncB = null;
    localStorage.clear();
});

describe('resetAllSettings', () => {
    test('removes every setting and ui key, never touches settingIgnoreList or settingSchemaVersion', () => {
        const remove = vi.fn();
        resetAllSettings({remove});

        const removedKeys = remove.mock.calls.map(([key]) => key).sort();
        expect(removedKeys).toEqual(EXPORTABLE_KEYS);
        expect(removedKeys).not.toContain('settingIgnoreList');
        expect(removedKeys).not.toContain('settingSchemaVersion');
    });

    test('removes every setting and ui key from real storage, keeps the ignore list', async () => {
        const {SettingsSync} = await import('./SettingsSync.js');
        syncA = new SettingsSync();

        syncA.setBool('settingPlayersHostile', false);
        syncA.setBool('settingUiSidebarCollapsed', true);
        syncA.setJSON('settingIgnoreList', ['Griefer']);
        localStorage.setItem('settingSchemaVersion', '1');

        resetAllSettings(syncA);

        expect(localStorage.getItem('settingPlayersHostile')).toBeNull();
        expect(localStorage.getItem('settingUiSidebarCollapsed')).toBeNull();
        expect(localStorage.getItem('settingIgnoreList')).toBe('["Griefer"]');
        expect(localStorage.getItem('settingSchemaVersion')).toBe('1');
    });

    test('a second SettingsSync instance receives the removals', async () => {
        const {SettingsSync} = await import('./SettingsSync.js');
        localStorage.setItem('settingPlayersHostile', 'false');
        syncA = new SettingsSync();
        syncB = new SettingsSync();

        const listener = vi.fn();
        syncB.on('settingPlayersHostile', listener);

        resetAllSettings(syncA);

        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        expect(listener.mock.calls[0][0]).toBe('settingPlayersHostile');
        expect(syncB.getBool('settingPlayersHostile')).toBe(true);
    });
});

describe('buildDebugExport', () => {
    function registrySync(overrides = {}) {
        return {
            get: vi.fn(key => overrides[key] ?? SETTINGS.find(e => e.key === key)?.default),
            getSchemaVersion: vi.fn(() => '1'),
        };
    }

    test('lists every setting and ui key with its current value, excludes the ignore list', async () => {
        const sync = registrySync({settingLogLevel: 'DEBUG'});
        const fetchStub = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({serverLogsEnabled: true, pcapRecording: false}),
        }));

        const result = await buildDebugExport(sync, fetchStub);

        expect(Object.keys(result.settings).sort()).toEqual(EXPORTABLE_KEYS);
        expect(result.settings).not.toHaveProperty('settingIgnoreList');
        expect(result.settings.settingLogLevel).toBe('DEBUG');
        expect(result.backend).toEqual({serverLogsEnabled: true, pcapRecording: false});
        expect(fetchStub).toHaveBeenCalledWith('/api/settings/logging');
    });

    test('backend is {error} when the GET responds not ok', async () => {
        const sync = registrySync();
        const fetchStub = vi.fn(() => Promise.resolve({ok: false, status: 500}));

        const result = await buildDebugExport(sync, fetchStub);

        expect(result.backend).toEqual({error: expect.any(String)});
    });

    test('backend is {error} when fetch throws', async () => {
        const sync = registrySync();
        const fetchStub = vi.fn(() => Promise.reject(new Error('network down')));

        const result = await buildDebugExport(sync, fetchStub);

        expect(result.backend).toEqual({error: 'network down'});
    });

    test('includes settingSchemaVersion read from storage, not the registry', async () => {
        const sync = registrySync();
        sync.getSchemaVersion = vi.fn(() => '1');
        const fetchStub = vi.fn(() => Promise.resolve({ok: true, json: () => Promise.resolve({})}));

        const result = await buildDebugExport(sync, fetchStub);

        expect(result.settingSchemaVersion).toBe('1');
    });
});

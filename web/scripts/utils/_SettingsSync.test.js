// synthetic: fresh module imports over a seeded or failing localStorage.
import {afterEach, beforeEach, describe, test, expect, vi} from 'vitest';

let sync = null;

beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
});

afterEach(() => {
    sync?.destroy();
    sync = null;
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('SettingsSync singleton migration', () => {
    test('legacy keys are migrated before the singleton is built', async () => {
        localStorage.setItem('settingDangerousPlayers', 'true');
        ({default: sync} = await import('./SettingsSync.js'));
        expect(sync.getBool('settingPlayersHostile')).toBe(true);
        expect(localStorage.getItem('settingDangerousPlayers')).toBeNull();
    });

    test('a throwing storage leaves the module loadable', async () => {
        const fail = () => { throw new Error('storage denied'); };
        vi.stubGlobal('localStorage', {getItem: fail, setItem: fail, removeItem: fail, key: fail, length: 0});
        const module = await import('./SettingsSync.js');
        sync = module.default;
        expect(sync).toBeInstanceOf(module.SettingsSync);
    });

    test('a migration error is logged once the logger exists', async () => {
        vi.doMock('./SettingsMigration.js', () => ({migrateSettings: () => { throw new Error('quota'); }}));
        ({default: sync} = await import('./SettingsSync.js'));
        const error = vi.fn();
        vi.stubGlobal('logger', {error, warn: vi.fn(), info: vi.fn(), debug: vi.fn()});
        sync.getBool('settingAlertFlash');
        sync.getBool('settingAlertFlash');
        vi.doUnmock('./SettingsMigration.js');
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][1]).toBe('SettingsMigrationFailed');
        expect(error.mock.calls[0][2]).toEqual({error: 'quota'});
    });
});

describe('SettingsSync registry reads', () => {
    const DEFAULT_ROW = [false, false, false, true, true, true, true, true];

    async function freshSync(seed = {}) {
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
        ({default: sync} = await import('./SettingsSync.js'));
        return sync;
    }

    test('an unset key reads its registry default', async () => {
        const s = await freshSync();
        expect(s.getBool('settingPlayersHostile')).toBe(true);
        expect(s.getNumber('settingRadarClusterRadius')).toBe(30);
        expect(s.getFloat('settingRadarZoom')).toBe(1);
        expect(s.get('settingLogLevel')).toBe('WARN');
        expect(s.get('settingRadarRotation')).toBe(0);
        expect(s.getJSON('settingResourcesStaticFiber').e2).toEqual(DEFAULT_ROW);
    });

    test('a caller default is ignored', async () => {
        const s = await freshSync();
        expect(s.getBool('settingPlayersHostile', false)).toBe(true);
        expect(s.getNumber('settingRadarClusterRadius', 99)).toBe(30);
        expect(s.get('settingLogLevel', 'DEBUG')).toBe('WARN');
        expect(s.getJSON('settingIgnoreList', ['x'])).toEqual([]);
    });

    test('numbers clamp to the registry bounds', async () => {
        const s = await freshSync({settingRadarClusterRadius: '0', settingRadarZoom: '4000', settingRadarIconSize: '-5'});
        expect(s.getNumber('settingRadarClusterRadius')).toBe(10);
        expect(s.getFloat('settingRadarZoom')).toBe(3);
        expect(s.getFloat('settingRadarIconSize')).toBe(0.5);
    });

    test('a non-numeric number reads the default', async () => {
        const s = await freshSync({settingRadarClusterRadius: 'abc', settingRadarSize: ''});
        expect(s.getNumber('settingRadarClusterRadius')).toBe(30);
        expect(s.getNumber('settingRadarSize')).toBe(500);
    });

    test('a bool other than true or false reads the default', async () => {
        const s = await freshSync({settingPlayersShowEquipment: 'yes', settingAlertFlash: 'TRUE'});
        expect(s.getBool('settingPlayersShowEquipment')).toBe(true);
        expect(s.getBool('settingAlertFlash')).toBe(false);
    });

    test('an enum outside its values reads the default', async () => {
        const s = await freshSync({settingLogLevel: 'VERBOSE', settingAlertSoundFile: 'missing.wav', settingRadarRotation: '45'});
        expect(s.get('settingLogLevel')).toBe('WARN');
        expect(s.get('settingAlertSoundFile')).toBe('player.wav');
        expect(s.get('settingRadarRotation')).toBe(0);
    });

    test('a stored rotation string compares numerically', async () => {
        const s = await freshSync({settingRadarRotation: '90'});
        expect(s.get('settingRadarRotation')).toBe(90);
    });

    test('a numeric enum value set in this tab reads back as that value', async () => {
        const s = await freshSync();
        s.set('settingRadarRotation', 180);
        expect(s.get('settingRadarRotation')).toBe(180);
    });

    test('a JSON parse error reads the frozen default', async () => {
        const s = await freshSync({settingResourcesStaticFiber: '{broken', settingIgnoreList: 'nope'});
        const matrix = s.getJSON('settingResourcesStaticFiber');
        expect(matrix.e0).toEqual(DEFAULT_ROW);
        expect(Object.isFrozen(matrix)).toBe(true);
        expect(s.getJSON('settingIgnoreList')).toEqual([]);
    });

    test.each([
        ['an extra enchant key', {e0: [], e1: [], e2: [], e3: [], e4: [], e5: []}],
        ['a tier array of the wrong length', {e0: [true], e1: [], e2: [], e3: [], e4: []}],
        ['non-bool cells', Object.fromEntries(['e0', 'e1', 'e2', 'e3', 'e4'].map(e => [e, Array(8).fill(1)]))],
        ['a missing enchant key', Object.fromEntries(['e0', 'e1', 'e2', 'e3'].map(e => [e, Array(8).fill(true)]))],
        ['an array', [1, 2]],
    ])('a matrix with %s reads the default', async (_name, value) => {
        const s = await freshSync({settingResourcesLivingOre: JSON.stringify(value)});
        expect(s.getJSON('settingResourcesLivingOre').e4).toEqual(DEFAULT_ROW);
    });

    test('an ignore list that is not a string array reads the default', async () => {
        const s = await freshSync({settingIgnoreList: '{"a":1}'});
        expect(s.getJSON('settingIgnoreList')).toEqual([]);
    });

    test('a stored JSON value reads deep frozen and the same object twice', async () => {
        const off = Array(8).fill(false);
        const stored = {e0: Array(8).fill(true), e1: off, e2: off, e3: off, e4: off};
        const s = await freshSync({settingResourcesStaticWood: JSON.stringify(stored)});
        const first = s.getJSON('settingResourcesStaticWood');
        expect(first).toEqual(stored);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.e0)).toBe(true);
        expect(s.getJSON('settingResourcesStaticWood')).toBe(first);
    });

    test('setJSON and remove refresh the cached value', async () => {
        const s = await freshSync({settingIgnoreList: '["a"]'});
        expect(s.getJSON('settingIgnoreList')).toEqual(['a']);
        s.setJSON('settingIgnoreList', ['a', 'b']);
        expect(s.getJSON('settingIgnoreList')).toEqual(['a', 'b']);
        s.remove('settingIgnoreList');
        expect(s.getJSON('settingIgnoreList')).toEqual([]);
    });

    test('an unknown key logs once and reads undefined or false', async () => {
        const error = vi.fn();
        vi.stubGlobal('logger', {error, warn: vi.fn(), info: vi.fn(), debug: vi.fn()});
        const s = await freshSync({settingTypo: 'true'});
        expect(s.getBool('settingTypo')).toBe(false);
        expect(s.get('settingTypo')).toBeUndefined();
        expect(s.getNumber('settingTypo')).toBeUndefined();
        expect(error).toHaveBeenCalledTimes(1);
        expect(error.mock.calls[0][2]).toEqual({key: 'settingTypo'});
    });

    test('a pending removal key reads quietly', async () => {
        const error = vi.fn();
        vi.stubGlobal('logger', {error, warn: vi.fn(), info: vi.fn(), debug: vi.fn()});
        const s = await freshSync();
        expect(s.getBool('settingServerLogsEnabled')).toBe(false);
        expect(s.getBool('settingPcapRecording')).toBe(false);
        expect(error).not.toHaveBeenCalled();
    });
});

describe('SettingsSync storage fallback', () => {
    test('a removal from another tab reaches listeners as setting-removed, a null key is ignored', async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        const {SettingsSync} = await import('./SettingsSync.js');
        sync = new SettingsSync();
        localStorage.setItem('settingAlertFlash', 'true');
        expect(sync.getBool('settingAlertFlash')).toBe(true);
        const listener = vi.fn();
        const wildcard = vi.fn();
        sync.on('settingAlertFlash', listener);
        sync.on('*', wildcard);

        localStorage.removeItem('settingAlertFlash');
        window.dispatchEvent(new StorageEvent('storage', {key: 'settingAlertFlash', oldValue: 'true', newValue: null}));
        window.dispatchEvent(new StorageEvent('storage', {key: null}));

        expect(listener).toHaveBeenCalledWith('settingAlertFlash', null);
        expect(wildcard).toHaveBeenCalledTimes(1);
        expect(sync.getBool('settingAlertFlash')).toBe(false);
    });
});

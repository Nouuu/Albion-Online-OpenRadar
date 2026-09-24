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
});

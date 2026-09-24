// synthetic: registry shape checked against the spec Settings Registry table.
import {describe, test, expect} from 'vitest';
import {SETTINGS, registryEntry, registryDefault, LEGACY_REMOVED, MIGRATION_ROWS} from './SettingsRegistry.js';
import {ALERT_SOUNDS, DEFAULT_SOUND} from './AlertSoundCatalog.js';

const KEY_PATTERN = /^setting(Radar|Players|Alert|Ignore|Enemies|Resources|Chests|Mists|Dungeons|Log|Debug|Ui)[A-Z][A-Za-z0-9]*$/;

const TABLE = [
    ['settingRadarZoom', 'settingRadarZoom', 'keep'],
    ['settingCanvasSize', 'settingRadarSize', 'rename'],
    [null, 'settingRadarFitToScreen', 'new'],
    ['settingIconSize', 'settingRadarIconSize', 'rename'],
    [null, 'settingRadarRotation', 'new'],
    ['settingShowMap', 'settingRadarMapBackground', 'fix'],
    [null, 'settingRadarHudZoneInfo', 'new'],
    [null, 'settingRadarHudStats', 'new'],
    ['settingResourceCount', 'settingRadarResourceCount', 'rename'],
    ['settingResourceDistance', 'settingRadarResourceDistance', 'rename'],
    ['settingResourceColorBadges', 'settingRadarResourceTierBadges', 'rename'],
    ['settingResourceClusters', 'settingRadarResourceClusters', 'rename'],
    ['settingClusterRadius', 'settingRadarClusterRadius', 'fix'],
    ['settingClusterMinSize', 'settingRadarClusterMinSize', 'fix'],
    ['settingShowPlayers', 'settingPlayersDetect', 'product'],
    ['settingItems', 'settingPlayersShowEquipment', 'product'],
    ['settingShowSpells', 'settingPlayersShowSpells', 'rename'],
    ['settingShowPlayerHealthBar', 'settingPlayersShowHealthBars', 'product'],
    ['settingPassivePlayers', 'settingPlayersPassive', 'fix'],
    ['settingFactionPlayers', 'settingPlayersFaction', 'fix'],
    ['settingDangerousPlayers', 'settingPlayersHostile', 'fix'],
    ['settingMaxPlayersDisplay', 'settingPlayersMaxDisplayed', 'rename'],
    ['settingFlash', 'settingAlertFlash', 'rename'],
    ['settingFlashDangerousPlayer', 'settingAlertBorder', 'rename'],
    ['settingSound', 'settingAlertSound', 'rename'],
    ['settingSoundFile', 'settingAlertSoundFile', 'rename'],
    ['settingSoundVolume', 'settingAlertSoundVolume', 'rename'],
    ['settingSoundCooldown', 'settingAlertSoundCooldown', 'rename'],
    ['ignoreList', 'settingIgnoreList', 'rename'],
    ['settingAllEnemies', null, 'remove'],
    ['settingNormalEnemy', 'settingEnemiesNormal', 'rename'],
    ['settingEnchantedEnemy', 'settingEnemiesChampion', 'product'],
    ['settingMiniBossEnemy', 'settingEnemiesMiniBoss', 'product'],
    ['settingBossEnemy', 'settingEnemiesBoss', 'product'],
    ['settingShowMinimumHealthEnemies', 'settingEnemiesMinHealthFilter', 'rename'],
    ['settingTextMinimumHealthEnemies', 'settingEnemiesMinHealth', 'rename'],
    ['settingBossCrystalSpider', 'settingEnemiesMistsCrystalSpider', 'product'],
    ['settingBossFairyDragon', 'settingEnemiesMistsFairyDragon', 'product'],
    ['settingBossVeilWeaver', 'settingEnemiesMistsVeilWeaver', 'product'],
    ['settingBossGriffin', 'settingEnemiesMistsGriffin', 'product'],
    ['settingAvaloneDrones', 'settingEnemiesAvalonianDrones', 'rename'],
    ['settingShowEventEnemies', 'settingEnemiesEvent', 'rename'],
    ['settingEnemiesHealthBar', 'settingEnemiesShowHealthBars', 'rename'],
    ['settingShowUnmanagedEnemies', 'settingDebugEnemiesUnidentified', 'rename'],
    ['settingEnemiesID', 'settingDebugEnemiesTypeId', 'rename'],
    ['settingEnemiesTier', 'settingDebugEnemiesTier', 'rename'],
    ['settingEnemiesName', 'settingDebugEnemiesName', 'rename'],
    ['settingEnemiesCategoryBadge', 'settingDebugEnemiesCategoryBadge', 'rename'],
    ['settingStaticFiberEnchants', 'settingResourcesStaticFiber', 'product'],
    ['settingLivingFiberEnchants', 'settingResourcesLivingFiber', 'product'],
    ['settingStaticHideEnchants', 'settingResourcesStaticHide', 'product'],
    ['settingLivingHideEnchants', 'settingResourcesLivingHide', 'product'],
    ['settingStaticWoodEnchants', 'settingResourcesStaticWood', 'product'],
    ['settingLivingWoodEnchants', 'settingResourcesLivingWood', 'product'],
    ['settingStaticOreEnchants', 'settingResourcesStaticOre', 'product'],
    ['settingLivingOreEnchants', 'settingResourcesLivingOre', 'product'],
    ['settingStaticRockEnchants', 'settingResourcesStaticRock', 'product'],
    ['settingLivingRockEnchants', 'settingResourcesLivingRock', 'product'],
    ['settingFishing', 'settingResourcesFishing', 'product'],
    ['settingLivingResourcesHealthBar', 'settingResourcesShowHealthBars', 'rename'],
    ['settingLivingResourcesID', 'settingDebugResourcesTypeId', 'rename'],
    ['livingResourcesID', null, 'remove'],
    ['settingLivingResourcesName', 'settingDebugResourcesDbName', 'rename'],
    ['settingChestGreen', 'settingChestsGreen', 'product'],
    ['settingChestBlue', 'settingChestsBlue', 'product'],
    ['settingChestPurple', 'settingChestsPurple', 'product'],
    ['settingChestYellow', 'settingChestsYellow', 'product'],
    ['settingMistSolo', 'settingMistsSolo', 'product'],
    ['settingMistDuo', 'settingMistsDuo', 'product'],
    ['settingMistE0', 'settingMistsEnchant0', 'product'],
    ['settingMistE1', 'settingMistsEnchant1', 'product'],
    ['settingMistE2', 'settingMistsEnchant2', 'product'],
    ['settingMistE3', 'settingMistsEnchant3', 'product'],
    ['settingMistE4', 'settingMistsEnchant4', 'product'],
    ['settingCage', 'settingMistsWispCages', 'product'],
    ['settingWispSpawn', 'settingMistsWisps', 'product'],
    ['settingShowKnightfallAbbey', 'settingMistsKnightfallAbbey', 'fix'],
    ['settingWispSpawnDebugID', 'settingDebugMistsWispIds', 'rename'],
    ['settingDungeonSolo', 'settingDungeonsSolo', 'product'],
    ['settingDungeonDuo', 'settingDungeonsGroup', 'product'],
    ['settingDungeonE0', 'settingDungeonsEnchant0', 'product'],
    ['settingDungeonE1', 'settingDungeonsEnchant1', 'product'],
    ['settingDungeonE2', 'settingDungeonsEnchant2', 'product'],
    ['settingDungeonE3', 'settingDungeonsEnchant3', 'product'],
    ['settingDungeonE4', 'settingDungeonsEnchant4', 'product'],
    ['settingDungeonCorrupted', 'settingDungeonsCorrupted', 'product'],
    ['settingDungeonHellgate', 'settingDungeonsHellgate', 'product'],
    ['logLevel', 'settingLogLevel', 'rename'],
    ['categorySystem', 'settingLogCategorySystem', 'rename'],
    ['categoryNetwork', 'settingLogCategoryNetwork', 'rename'],
    ['categoryMap', 'settingLogCategoryMap', 'rename'],
    ['categoryPlayers', 'settingLogCategoryPlayers', 'rename'],
    ['categoryMobs', 'settingLogCategoryMobs', 'rename'],
    ['categoryHarvestables', 'settingLogCategoryResources', 'rename'],
    ['categoryDungeons', 'settingLogCategoryDungeons', 'rename'],
    ['categoryFishing', 'settingLogCategoryFishing', 'rename'],
    ['categoryRendering', null, 'remove'],
    ['settingLogToConsole', 'settingLogToConsole', 'keep'],
    ['settingLogToServer', 'settingLogToServer', 'keep'],
    ['settingServerLogsEnabled', null, 'backend'],
    ['settingPcapRecording', null, 'backend'],
    ['settingWsCoalescing', 'settingDebugWsCoalescing', 'rename'],
    ['settingWsThrottling', null, 'remove'],
    [null, 'settingUiRadarSettingsOpen', 'new'],
    ['collapse-classic', 'settingUiEnemiesClassicOpen', 'rename'],
    ['collapse-mists', 'settingUiEnemiesMistsOpen', 'rename'],
    ['collapse-other', 'settingUiEnemiesOtherOpen', 'rename'],
    ['collapse-debug', null, 'remove'],
    ['collapse-fiber', 'settingUiResourcesFiberOpen', 'rename'],
    ['collapse-hide', 'settingUiResourcesHideOpen', 'rename'],
    ['collapse-wood', 'settingUiResourcesWoodOpen', 'rename'],
    ['collapse-ore', 'settingUiResourcesOreOpen', 'rename'],
    ['collapse-rock', 'settingUiResourcesRockOpen', 'rename'],
    ['collapse-settings-logging', 'settingUiSettingsLoggingOpen', 'rename'],
    ['collapse-settings-debug', 'settingUiSettingsDebugOpen', 'rename'],
    ['collapse-settings-network', 'settingUiSettingsNetworkOpen', 'rename'],
    ['sidebarCollapsed', 'settingUiSidebarCollapsed', 'rename'],
];

describe('SettingsRegistry', () => {
    test('every key matches the domain pattern unless pending removal, and is unique', () => {
        for (const entry of SETTINGS) {
            if (!entry.pendingRemoval) expect(entry.key).toMatch(KEY_PATTERN);
        }
        const keys = SETTINGS.map(e => e.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test('the schema marker is not a registry entry', () => {
        expect(registryEntry('settingSchemaVersion')).toBeUndefined();
        expect(SETTINGS.some(e => e.key === 'settingSchemaVersion')).toBe(false);
    });

    test('MIGRATION_ROWS maps the 117 rows of the registry table with their class', () => {
        expect(MIGRATION_ROWS).toEqual(TABLE.map(([legacyKey, key, migration]) => ({legacyKey, key, migration})));
    });

    test('LEGACY_REMOVED lists the remove and backend legacy keys', () => {
        const expected = TABLE.filter(([, , m]) => m === 'remove' || m === 'backend').map(([legacyKey]) => legacyKey);
        expect([...LEGACY_REMOVED].sort()).toEqual(expected.sort());
    });

    test('removed rows have no registry entry', () => {
        for (const key of ['settingAllEnemies', 'livingResourcesID', 'categoryRendering', 'settingWsThrottling', 'collapse-debug']) {
            expect(registryEntry(key), key).toBeUndefined();
        }
    });

    test('registryEntry exposes the legacy name', () => {
        expect(registryEntry('settingPlayersHostile').legacyKey).toBe('settingDangerousPlayers');
        expect(registryEntry('settingUnknownKey')).toBeUndefined();
    });

    test('registryDefault throws on an unknown key', () => {
        expect(() => registryDefault('settingUnknownKey')).toThrow();
    });

    test('defaults follow the registry table', () => {
        const expected = {
            settingRadarZoom: 1, settingRadarSize: 500, settingRadarFitToScreen: false, settingRadarIconSize: 1,
            settingRadarRotation: 0, settingRadarMapBackground: true, settingRadarHudZoneInfo: true,
            settingRadarHudStats: true, settingRadarResourceCount: false, settingRadarResourceDistance: false,
            settingRadarResourceTierBadges: false, settingRadarResourceClusters: false,
            settingRadarClusterRadius: 30, settingRadarClusterMinSize: 2,
            settingPlayersDetect: true, settingPlayersShowEquipment: true, settingPlayersShowSpells: false,
            settingPlayersShowHealthBars: true, settingPlayersPassive: true, settingPlayersFaction: true,
            settingPlayersHostile: true, settingPlayersMaxDisplayed: 50,
            settingAlertFlash: false, settingAlertBorder: false, settingAlertSound: false,
            settingAlertSoundFile: 'player.wav', settingAlertSoundVolume: 1, settingAlertSoundCooldown: 500,
            settingIgnoreList: [],
            settingEnemiesNormal: false, settingEnemiesChampion: true, settingEnemiesMiniBoss: true,
            settingEnemiesBoss: true, settingEnemiesMinHealthFilter: false, settingEnemiesMinHealth: 2100,
            settingEnemiesMistsCrystalSpider: true, settingEnemiesMistsFairyDragon: true,
            settingEnemiesMistsVeilWeaver: true, settingEnemiesMistsGriffin: true,
            settingEnemiesAvalonianDrones: false, settingEnemiesEvent: false, settingEnemiesShowHealthBars: false,
            settingDebugEnemiesUnidentified: false, settingDebugEnemiesTypeId: false, settingDebugEnemiesTier: false,
            settingDebugEnemiesName: false, settingDebugEnemiesCategoryBadge: false,
            settingResourcesFishing: true, settingResourcesShowHealthBars: false,
            settingDebugResourcesTypeId: false, settingDebugResourcesDbName: false,
            settingChestsGreen: true, settingChestsBlue: true, settingChestsPurple: true, settingChestsYellow: true,
            settingMistsSolo: true, settingMistsDuo: true, settingMistsEnchant0: true, settingMistsEnchant1: true,
            settingMistsEnchant2: true, settingMistsEnchant3: true, settingMistsEnchant4: true,
            settingMistsWispCages: true, settingMistsWisps: true, settingMistsKnightfallAbbey: true,
            settingDebugMistsWispIds: false,
            settingDungeonsSolo: true, settingDungeonsGroup: true, settingDungeonsEnchant0: true,
            settingDungeonsEnchant1: true, settingDungeonsEnchant2: true, settingDungeonsEnchant3: true,
            settingDungeonsEnchant4: true, settingDungeonsCorrupted: true, settingDungeonsHellgate: true,
            settingLogLevel: 'WARN', settingLogCategorySystem: false, settingLogCategoryNetwork: false,
            settingLogCategoryMap: false, settingLogCategoryPlayers: false, settingLogCategoryMobs: false,
            settingLogCategoryResources: false, settingLogCategoryDungeons: false, settingLogCategoryFishing: false,
            settingLogToConsole: false, settingLogToServer: false, settingDebugWsCoalescing: true,
            settingUiRadarSettingsOpen: false, settingUiEnemiesClassicOpen: true, settingUiEnemiesMistsOpen: true,
            settingUiEnemiesOtherOpen: false, settingUiResourcesFiberOpen: true, settingUiResourcesHideOpen: false,
            settingUiResourcesWoodOpen: false, settingUiResourcesOreOpen: false, settingUiResourcesRockOpen: false,
            settingUiSettingsLoggingOpen: false, settingUiSettingsDebugOpen: false,
            settingUiSettingsNetworkOpen: false, settingUiSidebarCollapsed: false,
        };
        for (const [key, value] of Object.entries(expected)) {
            expect(registryDefault(key), key).toEqual(value);
        }
    });

    test('every resource matrix defaults to T4 to T8 on for enchant 0 to 4', () => {
        const row = [false, false, false, true, true, true, true, true];
        const matrices = SETTINGS.filter(e => e.key.startsWith('settingResourcesStatic') || e.key.startsWith('settingResourcesLiving'));
        expect(matrices).toHaveLength(10);
        for (const entry of matrices) {
            expect(entry.type).toBe('json');
            expect(entry.shape).toBe('matrix');
            expect(entry.default).toEqual({e0: row, e1: row, e2: row, e3: row, e4: row});
        }
        expect(registryEntry('settingIgnoreList').shape).toBe('stringList');
    });

    test('numeric entries carry the registry bounds', () => {
        const bounds = {
            settingRadarZoom: [0.1, 3, 0.1],
            settingRadarSize: [300, 800, 50],
            settingRadarIconSize: [0.5, 2, 0.1],
            settingRadarClusterRadius: [10, 100, 5],
            settingRadarClusterMinSize: [2, 10, 1],
            settingEnemiesMinHealth: [100, 1000000, 100],
            settingPlayersMaxDisplayed: [1, 100, 1],
            settingAlertSoundVolume: [0, 1, 0.05],
            settingAlertSoundCooldown: [0, 3000, 100],
        };
        const numeric = SETTINGS.filter(e => e.type === 'int' || e.type === 'float').map(e => e.key);
        expect(numeric.sort()).toEqual(Object.keys(bounds).sort());
        for (const [key, [min, max, step]] of Object.entries(bounds)) {
            const entry = registryEntry(key);
            expect({min: entry.min, max: entry.max, step: entry.step}, key).toEqual({min, max, step});
            expect(entry.default).toBeGreaterThanOrEqual(min);
            expect(entry.default).toBeLessThanOrEqual(max);
        }
    });

    test('readout units live on the registry row', () => {
        const units = {
            settingRadarZoom: '%',
            settingRadarSize: ' px',
            settingRadarIconSize: '%',
            settingAlertSoundVolume: '%',
            settingAlertSoundCooldown: ' ms',
        };
        for (const [key, unit] of Object.entries(units)) {
            expect(registryEntry(key).unit, key).toBe(unit);
        }
        expect(registryEntry('settingRadarClusterRadius').unit).toBeUndefined();
    });

    test('enum entries list their allowed values and hold their default', () => {
        expect(registryEntry('settingRadarRotation').values).toEqual([0, 90, 180, 270]);
        expect(registryEntry('settingLogLevel').values).toEqual(['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG']);
        for (const entry of SETTINGS.filter(e => e.type === 'enum')) {
            expect(entry.values, entry.key).toContain(entry.default);
        }
    });

    test('the alert sound entry takes its default and values from the catalog', () => {
        const entry = registryEntry('settingAlertSoundFile');
        expect(entry.default).toBe(DEFAULT_SOUND);
        expect(entry.values).toEqual(ALERT_SOUNDS.map(s => s.file));
        expect(entry.options).toEqual(ALERT_SOUNDS);
    });

    test('registry is deep frozen, matrix rows included', () => {
        expect(Object.isFrozen(SETTINGS)).toBe(true);
        expect(Object.isFrozen(registryEntry('settingResourcesStaticFiber'))).toBe(true);
        const matrix = registryDefault('settingResourcesStaticFiber');
        expect(Object.isFrozen(matrix)).toBe(true);
        expect(Object.isFrozen(matrix.e0)).toBe(true);
        expect(Object.isFrozen(MIGRATION_ROWS[0])).toBe(true);
    });
});

describe('SettingsRegistry control location', () => {
    test('every entry has a page', () => {
        expect(SETTINGS.filter(entry => !entry.page).map(entry => entry.key)).toEqual([]);
    });

    test.each([
        ['settingRadarZoom', 'Radar', 'Radar settings > View'],
        ['settingRadarHudStats', 'Radar', 'Radar settings > Display'],
        ['settingUiRadarSettingsOpen', 'Radar', 'Radar settings'],
        ['settingPlayersDetect', 'Players', 'Display'],
        ['settingAlertSoundFile', 'Players', 'Alerts'],
        ['settingIgnoreList', 'Ignore List', ''],
        ['settingEnemiesMistsGriffin', 'Enemies', 'Mists bosses'],
        ['settingEnemiesEvent', 'Enemies', 'Other'],
        ['settingUiEnemiesClassicOpen', 'Enemies', 'Classic'],
        ['settingResourcesLivingRock', 'Resources', 'Rock > Living'],
        ['settingResourcesFishing', 'Resources', 'Other'],
        ['settingMistsWisps', 'Chests', 'Mists'],
        ['settingDungeonsHellgate', 'Chests', 'Dungeons'],
        ['settingDebugEnemiesTier', 'Settings', 'Debug > Enemies'],
        ['settingPcapRecording', 'Settings', 'Debug > Network traffic'],
        ['settingLogLevel', 'Settings', 'Logging'],
        ['settingUiSettingsNetworkOpen', 'Settings', 'Network'],
        ['settingUiSidebarCollapsed', 'Layout', 'Sidebar'],
    ])('%s is on page %s, section %s', (key, page, section) => {
        expect(registryEntry(key)).toMatchObject({page, section});
    });

    test('enemy filter keys are the 10 bools of Enemies Classic, Mists bosses and Other', () => {
        const keys = SETTINGS
            .filter(entry => entry.page === 'Enemies' && ['Classic', 'Mists bosses', 'Other'].includes(entry.section))
            .filter(entry => entry.type === 'bool' && entry.scope === 'setting' && entry.key !== 'settingEnemiesMinHealthFilter')
            .map(entry => entry.key)
            .sort();

        expect(keys).toEqual([
            'settingEnemiesAvalonianDrones',
            'settingEnemiesBoss',
            'settingEnemiesChampion',
            'settingEnemiesEvent',
            'settingEnemiesMiniBoss',
            'settingEnemiesMistsCrystalSpider',
            'settingEnemiesMistsFairyDragon',
            'settingEnemiesMistsGriffin',
            'settingEnemiesMistsVeilWeaver',
            'settingEnemiesNormal',
        ]);
    });
});

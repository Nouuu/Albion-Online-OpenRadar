// synthetic: registry shape checked against the spec Settings Registry table.
import {describe, test, expect} from 'vitest';
import {SETTINGS, registryEntry, registryDefault, LEGACY_REMOVED, MIGRATION_ROWS} from './SettingsRegistry.js';

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

    test('registryEntry exposes the legacy name', () => {
        expect(registryEntry('settingPlayersHostile').legacyKey).toBe('settingDangerousPlayers');
        expect(registryEntry('settingUnknownKey')).toBeUndefined();
    });

    test('registryDefault throws on an unknown key', () => {
        expect(() => registryDefault('settingUnknownKey')).toThrow();
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

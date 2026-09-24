import {DEFAULT_SOUND} from './AlertSoundCatalog.js';

const ALL_FALSE_MATRIX = Object.fromEntries(['e0', 'e1', 'e2', 'e3', 'e4'].map(e => [e, Array(8).fill(false)]));

const MATRIX_ROWS = ['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].flatMap(resource => ['Static', 'Living'].map(kind =>
    [`settingResources${kind}${resource}`, 'json', ALL_FALSE_MATRIX, `setting${kind}${resource}Enchants`, 'product']));

const NETWORK_PATHS = {
    settingServerLogsEnabled: 'logging.serverLogsEnabled',
    settingPcapRecording: 'logging.pcapRecording',
};

const ROWS = [
    ['settingRadarZoom', 'float', 1, 'settingRadarZoom', 'keep'],
    ['settingRadarSize', 'int', 500, 'settingCanvasSize', 'rename'],
    ['settingRadarFitToScreen', 'bool', false, null, 'new'],
    ['settingRadarIconSize', 'float', 1, 'settingIconSize', 'rename'],
    ['settingRadarRotation', 'enum', '0', null, 'new'],
    ['settingRadarMapBackground', 'bool', true, 'settingShowMap', 'fix'],
    ['settingRadarHudZoneInfo', 'bool', true, null, 'new'],
    ['settingRadarHudStats', 'bool', true, null, 'new'],
    ['settingRadarResourceCount', 'bool', false, 'settingResourceCount', 'rename'],
    ['settingRadarResourceDistance', 'bool', false, 'settingResourceDistance', 'rename'],
    ['settingRadarResourceTierBadges', 'bool', false, 'settingResourceColorBadges', 'rename'],
    ['settingRadarResourceClusters', 'bool', false, 'settingResourceClusters', 'rename'],
    ['settingRadarClusterRadius', 'int', 0, 'settingClusterRadius', 'fix'],
    ['settingRadarClusterMinSize', 'int', 0, 'settingClusterMinSize', 'fix'],
    ['settingPlayersDetect', 'bool', false, 'settingShowPlayers', 'product'],
    ['settingPlayersShowEquipment', 'bool', false, 'settingItems', 'product'],
    ['settingPlayersShowSpells', 'bool', false, 'settingShowSpells', 'rename'],
    ['settingPlayersShowHealthBars', 'bool', false, 'settingShowPlayerHealthBar', 'product'],
    ['settingPlayersPassive', 'bool', false, 'settingPassivePlayers', 'fix'],
    ['settingPlayersFaction', 'bool', false, 'settingFactionPlayers', 'fix'],
    ['settingPlayersHostile', 'bool', false, 'settingDangerousPlayers', 'fix'],
    ['settingPlayersMaxDisplayed', 'int', 50, 'settingMaxPlayersDisplay', 'rename'],
    ['settingAlertFlash', 'bool', false, 'settingFlash', 'rename'],
    ['settingAlertBorder', 'bool', false, 'settingFlashDangerousPlayer', 'rename'],
    ['settingAlertSound', 'bool', false, 'settingSound', 'rename'],
    ['settingAlertSoundFile', 'enum', DEFAULT_SOUND, 'settingSoundFile', 'rename'],
    ['settingAlertSoundVolume', 'float', 1, 'settingSoundVolume', 'rename'],
    ['settingAlertSoundCooldown', 'int', 500, 'settingSoundCooldown', 'rename'],
    ['settingIgnoreList', 'json', [], 'ignoreList', 'rename'],
    ['settingAllEnemies', 'bool', false, 'settingAllEnemies', 'remove'],
    ['settingEnemiesNormal', 'bool', false, 'settingNormalEnemy', 'rename'],
    ['settingEnemiesChampion', 'bool', false, 'settingEnchantedEnemy', 'product'],
    ['settingEnemiesMiniBoss', 'bool', false, 'settingMiniBossEnemy', 'product'],
    ['settingEnemiesBoss', 'bool', false, 'settingBossEnemy', 'product'],
    ['settingEnemiesMinHealthFilter', 'bool', false, 'settingShowMinimumHealthEnemies', 'rename'],
    ['settingEnemiesMinHealth', 'int', 2100, 'settingTextMinimumHealthEnemies', 'rename'],
    ['settingEnemiesMistsCrystalSpider', 'bool', false, 'settingBossCrystalSpider', 'product'],
    ['settingEnemiesMistsFairyDragon', 'bool', false, 'settingBossFairyDragon', 'product'],
    ['settingEnemiesMistsVeilWeaver', 'bool', false, 'settingBossVeilWeaver', 'product'],
    ['settingEnemiesMistsGriffin', 'bool', false, 'settingBossGriffin', 'product'],
    ['settingEnemiesAvalonianDrones', 'bool', false, 'settingAvaloneDrones', 'rename'],
    ['settingEnemiesEvent', 'bool', false, 'settingShowEventEnemies', 'rename'],
    ['settingEnemiesShowHealthBars', 'bool', false, 'settingEnemiesHealthBar', 'rename'],
    ['settingDebugEnemiesUnidentified', 'bool', false, 'settingShowUnmanagedEnemies', 'rename'],
    ['settingDebugEnemiesTypeId', 'bool', false, 'settingEnemiesID', 'rename'],
    ['settingDebugEnemiesTier', 'bool', false, 'settingEnemiesTier', 'rename'],
    ['settingDebugEnemiesName', 'bool', false, 'settingEnemiesName', 'rename'],
    ['settingDebugEnemiesCategoryBadge', 'bool', false, 'settingEnemiesCategoryBadge', 'rename'],
    ...MATRIX_ROWS,
    ['settingResourcesFishing', 'bool', false, 'settingFishing', 'product'],
    ['settingResourcesShowHealthBars', 'bool', false, 'settingLivingResourcesHealthBar', 'rename'],
    ['settingDebugResourcesTypeId', 'bool', false, 'settingLivingResourcesID', 'rename'],
    ['livingResourcesID', 'bool', false, 'livingResourcesID', 'remove'],
    ['settingDebugResourcesDbName', 'bool', false, 'settingLivingResourcesName', 'rename'],
    ['settingChestsGreen', 'bool', false, 'settingChestGreen', 'product'],
    ['settingChestsBlue', 'bool', false, 'settingChestBlue', 'product'],
    ['settingChestsPurple', 'bool', false, 'settingChestPurple', 'product'],
    ['settingChestsYellow', 'bool', false, 'settingChestYellow', 'product'],
    ['settingMistsSolo', 'bool', false, 'settingMistSolo', 'product'],
    ['settingMistsDuo', 'bool', false, 'settingMistDuo', 'product'],
    ['settingMistsEnchant0', 'bool', false, 'settingMistE0', 'product'],
    ['settingMistsEnchant1', 'bool', false, 'settingMistE1', 'product'],
    ['settingMistsEnchant2', 'bool', false, 'settingMistE2', 'product'],
    ['settingMistsEnchant3', 'bool', false, 'settingMistE3', 'product'],
    ['settingMistsEnchant4', 'bool', false, 'settingMistE4', 'product'],
    ['settingMistsWispCages', 'bool', false, 'settingCage', 'product'],
    ['settingMistsWisps', 'bool', false, 'settingWispSpawn', 'product'],
    ['settingMistsKnightfallAbbey', 'bool', true, 'settingShowKnightfallAbbey', 'fix'],
    ['settingDebugMistsWispIds', 'bool', false, 'settingWispSpawnDebugID', 'rename'],
    ['settingDungeonsSolo', 'bool', false, 'settingDungeonSolo', 'product'],
    ['settingDungeonsGroup', 'bool', false, 'settingDungeonDuo', 'product'],
    ['settingDungeonsEnchant0', 'bool', false, 'settingDungeonE0', 'product'],
    ['settingDungeonsEnchant1', 'bool', false, 'settingDungeonE1', 'product'],
    ['settingDungeonsEnchant2', 'bool', false, 'settingDungeonE2', 'product'],
    ['settingDungeonsEnchant3', 'bool', false, 'settingDungeonE3', 'product'],
    ['settingDungeonsEnchant4', 'bool', false, 'settingDungeonE4', 'product'],
    ['settingDungeonsCorrupted', 'bool', false, 'settingDungeonCorrupted', 'product'],
    ['settingDungeonsHellgate', 'bool', false, 'settingDungeonHellgate', 'product'],
    ['settingLogLevel', 'enum', 'WARN', 'logLevel', 'rename'],
    ['settingLogCategorySystem', 'bool', false, 'categorySystem', 'rename'],
    ['settingLogCategoryNetwork', 'bool', false, 'categoryNetwork', 'rename'],
    ['settingLogCategoryMap', 'bool', false, 'categoryMap', 'rename'],
    ['settingLogCategoryPlayers', 'bool', false, 'categoryPlayers', 'rename'],
    ['settingLogCategoryMobs', 'bool', false, 'categoryMobs', 'rename'],
    ['settingLogCategoryResources', 'bool', false, 'categoryHarvestables', 'rename'],
    ['settingLogCategoryDungeons', 'bool', false, 'categoryDungeons', 'rename'],
    ['settingLogCategoryFishing', 'bool', false, 'categoryFishing', 'rename'],
    ['categoryRendering', 'bool', false, 'categoryRendering', 'remove'],
    ['settingLogToConsole', 'bool', false, 'settingLogToConsole', 'keep'],
    ['settingLogToServer', 'bool', false, 'settingLogToServer', 'keep'],
    ['settingServerLogsEnabled', 'bool', false, 'settingServerLogsEnabled', 'backend'],
    ['settingPcapRecording', 'bool', false, 'settingPcapRecording', 'backend'],
    ['settingDebugWsCoalescing', 'bool', true, 'settingWsCoalescing', 'rename'],
    ['settingWsThrottling', 'bool', true, 'settingWsThrottling', 'remove'],
    ['settingUiRadarSettingsOpen', 'bool', false, null, 'new'],
    ['settingUiEnemiesClassicOpen', 'bool', true, 'collapse-classic', 'rename'],
    ['settingUiEnemiesMistsOpen', 'bool', true, 'collapse-mists', 'rename'],
    ['settingUiEnemiesOtherOpen', 'bool', false, 'collapse-other', 'rename'],
    ['collapse-debug', 'bool', false, 'collapse-debug', 'remove'],
    ['settingUiResourcesFiberOpen', 'bool', true, 'collapse-fiber', 'rename'],
    ['settingUiResourcesHideOpen', 'bool', false, 'collapse-hide', 'rename'],
    ['settingUiResourcesWoodOpen', 'bool', false, 'collapse-wood', 'rename'],
    ['settingUiResourcesOreOpen', 'bool', false, 'collapse-ore', 'rename'],
    ['settingUiResourcesRockOpen', 'bool', false, 'collapse-rock', 'rename'],
    ['settingUiSettingsLoggingOpen', 'bool', false, 'collapse-settings-logging', 'rename'],
    ['settingUiSettingsDebugOpen', 'bool', false, 'collapse-settings-debug', 'rename'],
    ['settingUiSettingsNetworkOpen', 'bool', false, 'collapse-settings-network', 'rename'],
    ['settingUiSidebarCollapsed', 'bool', false, 'sidebarCollapsed', 'rename'],
];

function scopeOf(key, legacyKey, migration) {
    if (migration === 'backend') return 'backend';
    if (key.startsWith('settingUi') || legacyKey?.startsWith('collapse-')) return 'ui';
    return 'setting';
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}

export const SETTINGS = deepFreeze(ROWS.map(([key, type, def, legacyKey, migration]) => ({
    key,
    type,
    default: structuredClone(def),
    label: '',
    tooltip: '',
    page: '',
    section: '',
    scope: scopeOf(key, legacyKey, migration),
    migration,
    legacyKey,
    networkPath: NETWORK_PATHS[key] ?? null,
    pendingRemoval: migration === 'remove' || migration === 'backend',
})));

const BY_KEY = new Map(SETTINGS.map(entry => [entry.key, entry]));

export function registryEntry(key) {
    return BY_KEY.get(key);
}

export function registryDefault(key) {
    const entry = BY_KEY.get(key);
    if (!entry) throw new Error(`Unknown setting key: ${key}`);
    return entry.default;
}

export const LEGACY_REMOVED = deepFreeze(SETTINGS.filter(e => e.pendingRemoval).map(e => e.legacyKey));

export const MIGRATION_ROWS = deepFreeze(SETTINGS.map(({legacyKey, key, migration, pendingRemoval}) =>
    ({legacyKey, key: pendingRemoval ? null : key, migration})));

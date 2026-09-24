import {ALERT_SOUNDS, DEFAULT_SOUND} from './AlertSoundCatalog.js';

const ENCHANTS = ['e0', 'e1', 'e2', 'e3', 'e4'];

const DEFAULT_MATRIX = Object.fromEntries(ENCHANTS.map(e => [e, [false, false, false, true, true, true, true, true]]));

const MATRIX_ROWS = ['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].flatMap(resource => ['Static', 'Living'].map(kind =>
    [`settingResources${kind}${resource}`, 'json', DEFAULT_MATRIX, `setting${kind}${resource}Enchants`, 'product', {shape: 'matrix'}]));

const NETWORK_PATHS = {
    settingServerLogsEnabled: 'logging.serverLogsEnabled',
    settingPcapRecording: 'logging.pcapRecording',
};

const ROWS = [
    ['settingRadarZoom', 'float', 1, 'settingRadarZoom', 'keep', {min: 0.1, max: 3, step: 0.1}],
    ['settingRadarSize', 'int', 500, 'settingCanvasSize', 'rename', {min: 300, max: 800, step: 50}],
    ['settingRadarFitToScreen', 'bool', false, null, 'new'],
    ['settingRadarIconSize', 'float', 1, 'settingIconSize', 'rename', {min: 0.5, max: 2, step: 0.1}],
    ['settingRadarRotation', 'enum', 0, null, 'new', {values: [0, 90, 180, 270]}],
    ['settingRadarMapBackground', 'bool', true, 'settingShowMap', 'fix'],
    ['settingRadarHudZoneInfo', 'bool', true, null, 'new'],
    ['settingRadarHudStats', 'bool', true, null, 'new'],
    ['settingRadarResourceCount', 'bool', false, 'settingResourceCount', 'rename'],
    ['settingRadarResourceDistance', 'bool', false, 'settingResourceDistance', 'rename'],
    ['settingRadarResourceTierBadges', 'bool', false, 'settingResourceColorBadges', 'rename'],
    ['settingRadarResourceClusters', 'bool', false, 'settingResourceClusters', 'rename'],
    ['settingRadarClusterRadius', 'int', 30, 'settingClusterRadius', 'fix', {min: 10, max: 100, step: 5}],
    ['settingRadarClusterMinSize', 'int', 2, 'settingClusterMinSize', 'fix', {min: 2, max: 10, step: 1}],
    ['settingPlayersDetect', 'bool', true, 'settingShowPlayers', 'product'],
    ['settingPlayersShowEquipment', 'bool', true, 'settingItems', 'product'],
    ['settingPlayersShowSpells', 'bool', false, 'settingShowSpells', 'rename'],
    ['settingPlayersShowHealthBars', 'bool', true, 'settingShowPlayerHealthBar', 'product'],
    ['settingPlayersPassive', 'bool', true, 'settingPassivePlayers', 'fix'],
    ['settingPlayersFaction', 'bool', true, 'settingFactionPlayers', 'fix'],
    ['settingPlayersHostile', 'bool', true, 'settingDangerousPlayers', 'fix'],
    ['settingPlayersMaxDisplayed', 'int', 50, 'settingMaxPlayersDisplay', 'rename', {min: 1, max: 100, step: 1}],
    ['settingAlertFlash', 'bool', false, 'settingFlash', 'rename'],
    ['settingAlertBorder', 'bool', false, 'settingFlashDangerousPlayer', 'rename'],
    ['settingAlertSound', 'bool', false, 'settingSound', 'rename'],
    ['settingAlertSoundFile', 'enum', DEFAULT_SOUND, 'settingSoundFile', 'rename',
        {values: ALERT_SOUNDS.map(sound => sound.file), options: ALERT_SOUNDS}],
    ['settingAlertSoundVolume', 'float', 1, 'settingSoundVolume', 'rename', {min: 0, max: 1, step: 0.05}],
    ['settingAlertSoundCooldown', 'int', 500, 'settingSoundCooldown', 'rename', {min: 0, max: 3000, step: 100}],
    ['settingIgnoreList', 'json', [], 'ignoreList', 'rename', {shape: 'stringList'}],
    ['settingAllEnemies', 'bool', false, 'settingAllEnemies', 'remove'],
    ['settingEnemiesNormal', 'bool', false, 'settingNormalEnemy', 'rename'],
    ['settingEnemiesChampion', 'bool', true, 'settingEnchantedEnemy', 'product'],
    ['settingEnemiesMiniBoss', 'bool', true, 'settingMiniBossEnemy', 'product'],
    ['settingEnemiesBoss', 'bool', true, 'settingBossEnemy', 'product'],
    ['settingEnemiesMinHealthFilter', 'bool', false, 'settingShowMinimumHealthEnemies', 'rename'],
    ['settingEnemiesMinHealth', 'int', 2100, 'settingTextMinimumHealthEnemies', 'rename', {min: 100, max: 1000000, step: 100}],
    ['settingEnemiesMistsCrystalSpider', 'bool', true, 'settingBossCrystalSpider', 'product'],
    ['settingEnemiesMistsFairyDragon', 'bool', true, 'settingBossFairyDragon', 'product'],
    ['settingEnemiesMistsVeilWeaver', 'bool', true, 'settingBossVeilWeaver', 'product'],
    ['settingEnemiesMistsGriffin', 'bool', true, 'settingBossGriffin', 'product'],
    ['settingEnemiesAvalonianDrones', 'bool', false, 'settingAvaloneDrones', 'rename'],
    ['settingEnemiesEvent', 'bool', false, 'settingShowEventEnemies', 'rename'],
    ['settingEnemiesShowHealthBars', 'bool', false, 'settingEnemiesHealthBar', 'rename'],
    ['settingDebugEnemiesUnidentified', 'bool', false, 'settingShowUnmanagedEnemies', 'rename'],
    ['settingDebugEnemiesTypeId', 'bool', false, 'settingEnemiesID', 'rename'],
    ['settingDebugEnemiesTier', 'bool', false, 'settingEnemiesTier', 'rename'],
    ['settingDebugEnemiesName', 'bool', false, 'settingEnemiesName', 'rename'],
    ['settingDebugEnemiesCategoryBadge', 'bool', false, 'settingEnemiesCategoryBadge', 'rename'],
    ...MATRIX_ROWS,
    ['settingResourcesFishing', 'bool', true, 'settingFishing', 'product'],
    ['settingResourcesShowHealthBars', 'bool', false, 'settingLivingResourcesHealthBar', 'rename'],
    ['settingDebugResourcesTypeId', 'bool', false, 'settingLivingResourcesID', 'rename'],
    ['livingResourcesID', 'bool', false, 'livingResourcesID', 'remove'],
    ['settingDebugResourcesDbName', 'bool', false, 'settingLivingResourcesName', 'rename'],
    ['settingChestsGreen', 'bool', true, 'settingChestGreen', 'product'],
    ['settingChestsBlue', 'bool', true, 'settingChestBlue', 'product'],
    ['settingChestsPurple', 'bool', true, 'settingChestPurple', 'product'],
    ['settingChestsYellow', 'bool', true, 'settingChestYellow', 'product'],
    ['settingMistsSolo', 'bool', true, 'settingMistSolo', 'product'],
    ['settingMistsDuo', 'bool', true, 'settingMistDuo', 'product'],
    ['settingMistsEnchant0', 'bool', true, 'settingMistE0', 'product'],
    ['settingMistsEnchant1', 'bool', true, 'settingMistE1', 'product'],
    ['settingMistsEnchant2', 'bool', true, 'settingMistE2', 'product'],
    ['settingMistsEnchant3', 'bool', true, 'settingMistE3', 'product'],
    ['settingMistsEnchant4', 'bool', true, 'settingMistE4', 'product'],
    ['settingMistsWispCages', 'bool', true, 'settingCage', 'product'],
    ['settingMistsWisps', 'bool', true, 'settingWispSpawn', 'product'],
    ['settingMistsKnightfallAbbey', 'bool', true, 'settingShowKnightfallAbbey', 'fix'],
    ['settingDebugMistsWispIds', 'bool', false, 'settingWispSpawnDebugID', 'rename'],
    ['settingDungeonsSolo', 'bool', true, 'settingDungeonSolo', 'product'],
    ['settingDungeonsGroup', 'bool', true, 'settingDungeonDuo', 'product'],
    ['settingDungeonsEnchant0', 'bool', true, 'settingDungeonE0', 'product'],
    ['settingDungeonsEnchant1', 'bool', true, 'settingDungeonE1', 'product'],
    ['settingDungeonsEnchant2', 'bool', true, 'settingDungeonE2', 'product'],
    ['settingDungeonsEnchant3', 'bool', true, 'settingDungeonE3', 'product'],
    ['settingDungeonsEnchant4', 'bool', true, 'settingDungeonE4', 'product'],
    ['settingDungeonsCorrupted', 'bool', true, 'settingDungeonCorrupted', 'product'],
    ['settingDungeonsHellgate', 'bool', true, 'settingDungeonHellgate', 'product'],
    ['settingLogLevel', 'enum', 'WARN', 'logLevel', 'rename', {values: ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG']}],
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

export function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}

export const SETTINGS = deepFreeze(ROWS.map(([key, type, def, legacyKey, migration, extra = {}]) => ({
    key,
    type,
    default: structuredClone(def),
    ...structuredClone(extra),
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

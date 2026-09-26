import {ALERT_SOUNDS, DEFAULT_SOUND} from './AlertSoundCatalog.js';

const ENCHANTS = ['e0', 'e1', 'e2', 'e3', 'e4'];

const DEFAULT_MATRIX = Object.fromEntries(ENCHANTS.map(e => [e, [false, false, false, true, true, true, true, true]]));

export const ALL_FALSE_MATRIX_STRING = JSON.stringify(Object.fromEntries(ENCHANTS.map(e => [e, Array(8).fill(false)])));

const MATRIX_ROWS = ['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].flatMap(resource => ['Static', 'Living'].map(kind =>
    [`settingResources${kind}${resource}`, 'json', DEFAULT_MATRIX, `setting${kind}${resource}Enchants`, 'product', {shape: 'matrix'}]));

const NETWORK_PATHS = {
    settingDebugBackendLogs: 'logging.serverLogsEnabled',
    settingDebugPcapRecording: 'logging.pcapRecording',
};

const ROWS = [
    ['settingRadarZoom', 'float', 1, 'settingRadarZoom', 'keep', {min: 0.1, max: 3, step: 0.1, unit: '%'}],
    ['settingRadarSize', 'int', 500, 'settingCanvasSize', 'rename', {min: 300, max: 1200, step: 50, unit: ' px'}],
    ['settingRadarFitToScreen', 'bool', false, null, 'new'],
    ['settingRadarIconSize', 'float', 1, 'settingIconSize', 'rename', {min: 0.5, max: 2, step: 0.1, unit: '%'}],
    ['settingRadarMapBackground', 'bool', true, 'settingShowMap', 'fix'],
    ['settingRadarHudZoneInfo', 'bool', true, null, 'new'],
    ['settingRadarHudStats', 'bool', true, null, 'new'],
    ['settingRadarPlayersBeside', 'bool', false, null, 'new'],
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
    ['settingAlertSoundVolume', 'float', 1, 'settingSoundVolume', 'rename', {min: 0, max: 1, step: 0.05, unit: '%'}],
    ['settingAlertSoundCooldown', 'int', 500, 'settingSoundCooldown', 'rename', {min: 0, max: 3000, step: 100, unit: ' ms'}],
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
    ['settingDebugBackendLogs', 'bool', false, 'settingServerLogsEnabled', 'backend'],
    ['settingDebugPcapRecording', 'bool', false, 'settingPcapRecording', 'backend'],
    ['settingDebugWsCoalescing', 'bool', true, 'settingWsCoalescing', 'rename'],
    ['settingWsThrottling', 'bool', true, 'settingWsThrottling', 'remove'],
    ['settingUiRadarSettingsOpen', 'bool', false, null, 'new'],
    ['settingUiPlayersDisplayOpen', 'bool', true, null, 'new'],
    ['settingUiPlayersAlertsOpen', 'bool', true, null, 'new'],
    ['settingUiPlayersPlayerTypesOpen', 'bool', true, null, 'new'],
    ['settingUiPlayersLimitsOpen', 'bool', true, null, 'new'],
    ['settingUiChestsChestsOpen', 'bool', true, null, 'new'],
    ['settingUiChestsMistsOpen', 'bool', true, null, 'new'],
    ['settingUiChestsDungeonsOpen', 'bool', true, null, 'new'],
    ['settingUiEnemiesClassicOpen', 'bool', true, 'collapse-classic', 'rename'],
    ['settingUiEnemiesMistsOpen', 'bool', true, 'collapse-mists', 'rename'],
    ['settingUiEnemiesOtherOpen', 'bool', false, 'collapse-other', 'rename'],
    ['settingUiEnemiesDisplayOpen', 'bool', true, null, 'new'],
    ['collapse-debug', 'bool', false, 'collapse-debug', 'remove'],
    ['settingUiResourcesFiberOpen', 'bool', true, 'collapse-fiber', 'rename'],
    ['settingUiResourcesHideOpen', 'bool', false, 'collapse-hide', 'rename'],
    ['settingUiResourcesWoodOpen', 'bool', false, 'collapse-wood', 'rename'],
    ['settingUiResourcesOreOpen', 'bool', false, 'collapse-ore', 'rename'],
    ['settingUiResourcesRockOpen', 'bool', false, 'collapse-rock', 'rename'],
    ['settingUiResourcesOtherOpen', 'bool', true, null, 'new'],
    ['settingUiResourcesDisplayOpen', 'bool', true, null, 'new'],
    ['settingUiSettingsLoggingOpen', 'bool', false, 'collapse-settings-logging', 'rename'],
    ['settingUiSettingsDebugOpen', 'bool', false, 'collapse-settings-debug', 'rename'],
    ['settingUiSettingsNetworkOpen', 'bool', false, 'collapse-settings-network', 'rename'],
    ['settingUiSettingsDangerZoneOpen', 'bool', true, null, 'new'],
    ['settingUiSidebarCollapsed', 'bool', false, 'sidebarCollapsed', 'rename'],
];

const NOT_DETECTED = 'Not detected yet: no mob is classified as this type today.';
const CATEGORY_TIP = 'Keep DEBUG and INFO entries of this area. WARN and above ignore this filter.';

const TEXTS = {
    settingRadarZoom: ['Zoom'],
    settingRadarSize: ['Max size', 'Width and height in pixels, shrunk on small windows. Ignored while Fit to screen is on.'],
    settingRadarFitToScreen: ['Fit to screen', 'Largest square that fits the window, up to 1200 px, next to the player list when the list sits beside. Overrides Max size.'],
    settingRadarIconSize: ['Icon size'],
    settingRadarMapBackground: ['Map background'],
    settingRadarHudZoneInfo: ['Zone info box', 'Top-left box with the zone name, tier and a PvP marker.'],
    settingRadarHudStats: ['Stats box', 'Top-right box: resource and mob counts, plus player count when detection is on.'],
    settingRadarPlayersBeside: ['Players beside radar', 'Shows the player list to the right of the radar when the window is wide enough.'],
    settingRadarResourceCount: ['Resource count', 'Estimated count from size/tier, bonuses excluded. Fishing shows spawned/total fish.'],
    settingRadarResourceDistance: ['Resource distance', 'Distance in meters: hidden under 2 m, green under 10 m, yellow 10-19 m, orange 20 m+.'],
    settingRadarResourceTierBadges: ['Resource tier color badges', 'Colored squares by type instead of icons, with tier. Living creatures get a gold border.'],
    settingRadarResourceClusters: ['Resource clusters', 'Circles groups of nearby same-type nodes, with count and distance. Only nodes your filters show are grouped.'],
    settingRadarClusterRadius: ['Cluster radius (m)', 'Groups same-type, same-tier resources within this range. Default 30 m.'],
    settingRadarClusterMinSize: ['Min nodes per cluster', 'Smallest group drawn as a cluster. Default: 2.'],
    settingUiRadarSettingsOpen: ['Radar settings'],
    settingUiPlayersDisplayOpen: ['Display'],
    settingUiPlayersAlertsOpen: ['Alerts'],
    settingUiPlayersPlayerTypesOpen: ['Player Types'],
    settingUiPlayersLimitsOpen: ['Limits'],
    settingUiChestsChestsOpen: ['Chests'],
    settingUiChestsMistsOpen: ['Mists'],
    settingUiChestsDungeonsOpen: ['Dungeons'],
    settingPlayersDetect: ['Detect players', 'Tracks players in range. Off: no player list, no player counts, no flash, border or sound.'],
    settingPlayersShowEquipment: ['Show Equipment'],
    settingPlayersShowSpells: ['Show Spells'],
    settingPlayersShowHealthBars: ['Show health bars', 'Shows health bar on player cards when health data is available.'],
    settingPlayersPassive: ['Passive', 'Show players who are not flagged for PvP.'],
    settingPlayersFaction: ['Faction', 'Show players flagged for faction warfare.'],
    settingPlayersHostile: ['Hostile', 'Players flagged hostile, meaning everyone in black zones. Does not affect alerts.'],
    settingPlayersMaxDisplayed: ['Maximum Players Displayed', 'Maximum number of players to display (1-100). Default: 50'],
    settingAlertFlash: ['Screen Flash', 'Flashes on threats: hostile players in yellow/red, anyone in black. Ignored names excluded.'],
    settingAlertBorder: ['Pulsating Border While Hostile Nearby', 'Pulses a red border around the radar while a threat is in range. Ignored names do not count.'],
    settingAlertSound: ['Sound Alert', 'Plays the alert sound on the radar PC, same trigger rule as Screen Flash. Ignored names never trigger it.'],
    settingAlertSoundFile: ['Sound'],
    settingAlertSoundVolume: ['Volume'],
    settingAlertSoundCooldown: ['Cooldown', 'Minimum delay between two alert sounds. At zero, every alert plays.'],
    settingIgnoreList: ['Ignored names'],
    settingEnemiesNormal: ['Normal'],
    settingEnemiesChampion: ['Champion', 'Champion mobs, and solo mobs in random dungeons.'],
    settingEnemiesMiniBoss: ['Mini-Boss'],
    settingEnemiesBoss: ['Boss'],
    settingEnemiesMinHealthFilter: ['Show enemies with minimum HP', 'Hides enemies whose max HP is below the minimum, unidentified ones included. Drones, Mists bosses, events and living resources are exempt.'],
    settingEnemiesMinHealth: ['Minimum HP'],
    settingEnemiesMistsCrystalSpider: ['Crystal Spider'],
    settingEnemiesMistsFairyDragon: ['Fairy Dragon'],
    settingEnemiesMistsVeilWeaver: ['Veil Weaver'],
    settingEnemiesMistsGriffin: ['Griffin'],
    settingEnemiesAvalonianDrones: ['Avalonian Drones', NOT_DETECTED],
    settingEnemiesEvent: ['Event Enemies', NOT_DETECTED],
    settingEnemiesShowHealthBars: ['Show health bars'],
    settingDebugEnemiesUnidentified: ['Show unidentified enemies', 'Shows enemies missing from mob data, usually new post-update mobs. Type filters skip them.'],
    settingDebugEnemiesTypeId: ['Show ID'],
    settingDebugEnemiesTier: ['Show Tier'],
    settingDebugEnemiesName: ['Show Name'],
    settingDebugEnemiesCategoryBadge: ['Show Category Badge'],
    ...Object.fromEntries(MATRIX_ROWS.map(([key]) => [key, [key.includes('Living') ? 'Living' : 'Static']])),
    settingResourcesFishing: ['Show Fishing Pools'],
    settingResourcesShowHealthBars: ['Show health bars', 'Display health bar on living resources (mobs).'],
    settingDebugResourcesTypeId: ['Show ID', 'Draws the internal type ID on resource nodes and living resources (debug).'],
    settingDebugResourcesDbName: ['Show DB Name', 'Shows the DB name mapped from the wire type ID (debug, for offset verification).'],
    settingChestsGreen: ['Green'],
    settingChestsBlue: ['Blue'],
    settingChestsPurple: ['Purple'],
    settingChestsYellow: ['Yellow'],
    settingMistsSolo: ['Solo'],
    settingMistsDuo: ['Duo'],
    ...Object.fromEntries([0, 1, 2, 3, 4].flatMap(e => [[`settingMistsEnchant${e}`, [`E${e}`]], [`settingDungeonsEnchant${e}`, [`E${e}`]]])),
    settingMistsWispCages: ['Show Wisp Cages'],
    settingMistsWisps: ['Wisp signs (pre-portal)'],
    settingMistsKnightfallAbbey: ['Show Knightfall Abbey'],
    settingDebugMistsWispIds: ['Show wisp ID (debug)'],
    settingDungeonsSolo: ['Solo'],
    settingDungeonsGroup: ['Group'],
    settingDungeonsCorrupted: ['Corrupted', 'Corrupted dungeon entrances (PvP)'],
    settingDungeonsHellgate: ['Hellgate', 'Hellgate portals (PvP)'],
    settingLogLevel: ['Log Level', 'The lowest level shown, though DEBUG and INFO also need their category on. OFF disables all logging.'],
    ...Object.fromEntries([['System', 'System'], ['Network', 'Network'], ['Map', 'Map'], ['Players', 'Players'], ['Mobs', 'Mobs'],
        ['Resources', 'Harvestables'], ['Dungeons', 'Dungeons'], ['Fishing', 'Fishing']].map(([area, label]) =>
        [`settingLogCategory${area}`, [label, CATEGORY_TIP]])),
    settingLogToConsole: ['Browser Console (F12)'],
    settingLogToServer: ['Save browser logs', 'Saves filtered entries on the radar PC in logs/debug/. Errors are also copied to logs/errors/.'],
    settingDebugBackendLogs: ['Save backend logs', 'Logs one line per game event to logs/sessions/. Only changeable on the radar PC.'],
    settingDebugPcapRecording: ['Record Network Capture (pcap)', 'Records UDP 5056 traffic to logs/captures/, one file per interface. PC-only setting.'],
    settingDebugWsCoalescing: ['Merge entity updates per frame', 'Keeps only the latest move, health and regen update per entity each frame.'],
    settingUiEnemiesClassicOpen: ['Classic Enemies'],
    settingUiEnemiesMistsOpen: ['Mists Bosses'],
    settingUiEnemiesOtherOpen: ['Other Enemies'],
    settingUiEnemiesDisplayOpen: ['Display'],
    ...Object.fromEntries(['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].map(resource => [`settingUiResources${resource}Open`, [resource]])),
    settingUiResourcesOtherOpen: ['Other'],
    settingUiResourcesDisplayOpen: ['Display'],
    settingUiSettingsLoggingOpen: ['Logging'],
    settingUiSettingsDebugOpen: ['Debug'],
    settingUiSettingsNetworkOpen: ['Network'],
    settingUiSettingsDangerZoneOpen: ['Danger Zone'],
};

const LOCATIONS = {
    'Radar > Radar settings > View': ['settingRadarZoom', 'settingRadarSize', 'settingRadarFitToScreen', 'settingRadarIconSize'],
    'Radar > Radar settings > Display': ['settingRadarMapBackground', 'settingRadarHudZoneInfo', 'settingRadarHudStats',
        'settingRadarPlayersBeside'],
    'Radar > Radar settings > Resources': ['settingRadarResourceCount', 'settingRadarResourceDistance',
        'settingRadarResourceTierBadges', 'settingRadarResourceClusters', 'settingRadarClusterRadius',
        'settingRadarClusterMinSize'],
    'Radar > Radar settings': ['settingUiRadarSettingsOpen'],
    'Players > Display': ['settingPlayersDetect', 'settingPlayersShowEquipment', 'settingPlayersShowSpells',
        'settingPlayersShowHealthBars', 'settingUiPlayersDisplayOpen'],
    'Players > Player types': ['settingPlayersPassive', 'settingPlayersFaction', 'settingPlayersHostile',
        'settingUiPlayersPlayerTypesOpen'],
    'Players > Limits': ['settingPlayersMaxDisplayed', 'settingUiPlayersLimitsOpen'],
    'Players > Alerts': ['settingAlertFlash', 'settingAlertBorder', 'settingAlertSound', 'settingAlertSoundFile',
        'settingAlertSoundVolume', 'settingAlertSoundCooldown', 'settingUiPlayersAlertsOpen'],
    'Ignore List': ['settingIgnoreList'],
    'Enemies > Classic': ['settingEnemiesNormal', 'settingEnemiesChampion', 'settingEnemiesMiniBoss', 'settingEnemiesBoss',
        'settingEnemiesMinHealthFilter', 'settingEnemiesMinHealth', 'settingUiEnemiesClassicOpen'],
    'Enemies > Mists bosses': ['settingEnemiesMistsCrystalSpider', 'settingEnemiesMistsFairyDragon',
        'settingEnemiesMistsVeilWeaver', 'settingEnemiesMistsGriffin', 'settingUiEnemiesMistsOpen'],
    'Enemies > Other': ['settingEnemiesAvalonianDrones', 'settingEnemiesEvent', 'settingUiEnemiesOtherOpen'],
    'Enemies > Display': ['settingEnemiesShowHealthBars', 'settingUiEnemiesDisplayOpen'],
    'Settings > Debug > Enemies': ['settingDebugEnemiesUnidentified', 'settingDebugEnemiesTypeId', 'settingDebugEnemiesTier',
        'settingDebugEnemiesName', 'settingDebugEnemiesCategoryBadge'],
    ...Object.fromEntries(['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].flatMap(resource => ['Static', 'Living'].map(kind =>
        [`Resources > ${resource} > ${kind}`, [`settingResources${kind}${resource}`]]))),
    ...Object.fromEntries(['Fiber', 'Hide', 'Wood', 'Ore', 'Rock'].map(resource =>
        [`Resources > ${resource}`, [`settingUiResources${resource}Open`]])),
    'Resources > Other': ['settingResourcesFishing', 'settingUiResourcesOtherOpen'],
    'Resources > Display': ['settingResourcesShowHealthBars', 'settingUiResourcesDisplayOpen'],
    'Settings > Debug > Resources': ['settingDebugResourcesTypeId', 'settingDebugResourcesDbName'],
    'Chests > Chests': ['settingChestsGreen', 'settingChestsBlue', 'settingChestsPurple', 'settingChestsYellow',
        'settingUiChestsChestsOpen'],
    'Chests > Mists': ['settingMistsSolo', 'settingMistsDuo', 'settingMistsEnchant0', 'settingMistsEnchant1',
        'settingMistsEnchant2', 'settingMistsEnchant3', 'settingMistsEnchant4', 'settingMistsWispCages', 'settingMistsWisps',
        'settingMistsKnightfallAbbey', 'settingUiChestsMistsOpen'],
    'Settings > Debug > Mists': ['settingDebugMistsWispIds'],
    'Chests > Dungeons': ['settingDungeonsSolo', 'settingDungeonsGroup', 'settingDungeonsEnchant0', 'settingDungeonsEnchant1',
        'settingDungeonsEnchant2', 'settingDungeonsEnchant3', 'settingDungeonsEnchant4', 'settingDungeonsCorrupted',
        'settingDungeonsHellgate', 'settingUiChestsDungeonsOpen'],
    'Settings > Logging': ['settingLogLevel', 'settingLogCategorySystem', 'settingLogCategoryNetwork', 'settingLogCategoryMap',
        'settingLogCategoryPlayers', 'settingLogCategoryMobs', 'settingLogCategoryResources', 'settingLogCategoryDungeons',
        'settingLogCategoryFishing', 'settingLogToConsole', 'settingLogToServer', 'settingUiSettingsLoggingOpen'],
    'Settings > Debug > Backend logs': ['settingDebugBackendLogs'],
    'Settings > Debug > Network traffic': ['settingDebugPcapRecording', 'settingDebugWsCoalescing'],
    'Settings > Debug': ['settingUiSettingsDebugOpen'],
    'Settings > Network': ['settingUiSettingsNetworkOpen'],
    'Settings > Danger Zone': ['settingUiSettingsDangerZoneOpen'],
    'Layout > Sidebar': ['settingUiSidebarCollapsed'],
};

const LOCATION_OF = new Map(Object.entries(LOCATIONS).flatMap(([location, keys]) => keys.map(key => [key, location])));

function placeOf(key) {
    const [page, ...section] = LOCATION_OF.get(key)?.split(' > ') ?? [''];
    return {page, section: section.join(' > ')};
}

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

const REMOVED = new Set(['remove', 'backend']);

export const SETTINGS = deepFreeze(ROWS.filter(row => row[4] !== 'remove').map(([key, type, def, legacyKey, migration, extra = {}]) => ({
    key,
    type,
    default: structuredClone(def),
    label: TEXTS[key]?.[0] ?? '',
    tooltip: TEXTS[key]?.[1] ?? '',
    ...placeOf(key),
    ...structuredClone(extra),
    scope: scopeOf(key, legacyKey, migration),
    migration,
    legacyKey,
    networkPath: NETWORK_PATHS[key] ?? null,
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

export const LEGACY_REMOVED = deepFreeze(ROWS.filter(row => REMOVED.has(row[4])).map(row => row[3]));

export const MIGRATION_ROWS = deepFreeze(ROWS.map(([key, , , legacyKey, migration]) =>
    ({legacyKey, key: REMOVED.has(migration) ? null : key, migration})));

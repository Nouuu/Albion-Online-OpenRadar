/**
 * Logger Constants - ZQRadar v2.2
 * Centralized definitions for logging categories and their debug settings mapping
 */

/**
 * Log categories
 * @readonly
 */
const CATEGORIES = {
  // Mob/Enemy
  MOB: 'MOB',
  MOB_HEALTH: 'MOB_HEALTH',
  MOB_DRAW: 'MOB_DRAW',

  // Harvesting/Resources
  HARVEST: 'HARVEST',
  HARVEST_HIDE_T4: 'HARVEST_HIDE_T4',

  // Player
  PLAYER: 'PLAYER',
  PLAYER_HEALTH: 'PLAYER_HEALTH',

  // Other features
  CHEST: 'CHEST',
  DUNGEON: 'DUNGEON',
  FISHING: 'FISHING',

  // Network
  PACKET_RAW: 'PACKET_RAW',
  EVENT_DETAIL: 'EVENT_DETAIL',

  // System (always logged)
  WEBSOCKET: 'WEBSOCKET',
  SETTINGS: 'SETTINGS',
  CACHE: 'CACHE',
  DEBUG: 'DEBUG',
  CLUSTER: 'CLUSTER',
  ITEM: 'ITEM',
  MAP: 'MAP',
  MOBS: 'MOBS'
};

/**
 * Common event names (add more as needed)
 * Use strings directly for dynamic/rare events
 */
const EVENTS = {
  // Mob events
  LoadMetadata: 'LoadMetadata',
  LoadMetadataFailed: 'LoadMetadataFailed',
  LoadMetadataNotFound: 'LoadMetadataNotFound',
  EnhancedJSONLoadFailed: 'EnhancedJSONLoadFailed',
  EnhancedJSONLoadError: 'EnhancedJSONLoadError',
  SaveCacheFailed: 'SaveCacheFailed',
  DisplayCachedTypeIDs: 'DisplayCachedTypeIDs',
  NewMobEventError: 'NewMobEventError',
  CollectionGuide: 'CollectionGuide',
  NewMobEvent_ALL_PARAMS: 'NewMobEvent_ALL_PARAMS',
  NewMobEvent_RAW: 'NewMobEvent_RAW',
  NewLivingCreature: 'NewLivingCreature',
  NewMobDebug: 'NewMobDebug',
  MobDied: 'MobDied',
  MobRemoved: 'MobRemoved',
  UsingMobInfo: 'UsingMobInfo',
  MobDrawDetails: 'MobDrawDetails',
  LivingCreatureCSV: 'LivingCreatureCSV',

  // Health events
  HealthUpdate: 'HealthUpdate',
  BulkHPUpdate: 'BulkHPUpdate',
  RegenerationHealthChanged: 'RegenerationHealthChanged',
  RegenerationHealthChanged_DETAIL: 'RegenerationHealthChanged_DETAIL',
  PlayerHealthUpdate_DETAIL: 'PlayerHealthUpdate_DETAIL',

  // Harvest events
  HarvestStart: 'HarvestStart',
  HarvestCancel: 'HarvestCancel',
  ItemIdDiscovery: 'ItemIdDiscovery',
  HarvestUpdateEvent_ALL_PARAMS: 'HarvestUpdateEvent_ALL_PARAMS',
  NewSimpleItem_DETAIL: 'NewSimpleItem_DETAIL',
  StaticResourceNotInList: 'StaticResourceNotInList',
  AlreadyTracked: 'AlreadyTracked',
  TrackingStaticResources: 'TrackingStaticResources',
  UnknownItemId: 'UnknownItemId',
  NoCacheWarning: 'NoCacheWarning',
  Regeneration: 'Regeneration',
  UnknownTypeNumber: 'UnknownTypeNumber',
  Detection: 'Detection',
  SettingsCheck: 'SettingsCheck',
  Update: 'Update',
  UpdateSettingsCheck: 'UpdateSettingsCheck',

  // Player events
  NewPlayerEvent_ALL_PARAMS: 'NewPlayerEvent_ALL_PARAMS',
  PlayerDebugInfo: 'PlayerDebugInfo',
  MoveEvent: 'MoveEvent',
  PlayerPositionUpdate: 'PlayerPositionUpdate',
  PlayerAutoCreated: 'PlayerAutoCreated',
  AudioPlayBlocked: 'AudioPlayBlocked',
  WorldOffsetCalculated: 'WorldOffsetCalculated',
  WorldOffsetSkipped: 'WorldOffsetSkipped',

  // Chest events
  NewChestEvent_ALL_PARAMS: 'NewChestEvent_ALL_PARAMS',

  // Dungeon events
  NewDungeonEvent_ALL_PARAMS: 'NewDungeonEvent_ALL_PARAMS',

  // Fishing events
  FishingEnd: 'FishingEnd',

  // Cache events
  LoadCachedTypeIDs: 'LoadCachedTypeIDs',
  LoadCacheFailed: 'LoadCacheFailed',
  CacheCleared: 'CacheCleared',
  ClearTypeIDCache: 'ClearTypeIDCache',
  CacheAlreadyEmpty: 'CacheAlreadyEmpty',
  TypeIDCacheCleared: 'TypeIDCacheCleared',
  ClearingTypeIDCache: 'ClearingTypeIDCache',
  ReloadingOpenerWindow: 'ReloadingOpenerWindow',
  ReloadingSettingsPage: 'ReloadingSettingsPage',
  ClearCacheFailed: 'ClearCacheFailed',

  // WebSocket events
  Connected: 'Connected',

  // Settings events
  DynamicUpdate: 'DynamicUpdate',
  SamePageUpdate: 'SamePageUpdate',

  // Item events
  ItemLoaded: 'ItemLoaded',
  ItemLoadFailed: 'ItemLoadFailed',

  // Map events
  MapLoaded: 'MapLoaded',
  MapLoadFailed: 'MapLoadFailed',

  // Cluster events
  ComputeFailed: 'ComputeFailed',
  DrawInfoBoxFailed: 'DrawInfoBoxFailed',
  DrawRingsFallbackFailed: 'DrawRingsFallbackFailed',

  // Debug events
  EnemiesList: 'EnemiesList',

  // Packet events
  KeySync: 'KeySync'
};

/**
 * Mapping: Category → Debug Setting
 * null = always logged (not filtered)
 */
const CATEGORY_SETTINGS_MAP = {
  // Mob/Enemy → debugEnemies
  MOB: 'debugEnemies',
  MOB_HEALTH: 'debugEnemies',
  MOB_DRAW: 'debugEnemies',

  // Harvesting → debugHarvestables
  HARVEST: 'debugHarvestables',
  HARVEST_HIDE_T4: 'debugHarvestables',

  // Player → debugPlayers
  PLAYER: 'debugPlayers',
  PLAYER_HEALTH: 'debugPlayers',

  // Specific features
  CHEST: 'debugChests',
  DUNGEON: 'debugDungeons',
  FISHING: 'debugFishing',

  // Raw packets (special handling)
  PACKET_RAW: 'debugRawPackets',
  EVENT_DETAIL: 'debugRawPackets',

  // Always logged
  WEBSOCKET: null,
  SETTINGS: null,
  CACHE: null,
  DEBUG: null,
  CLUSTER: null,
  ITEM: null,
  MAP: null,
  MOBS: null
};

// Export CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES, EVENTS, CATEGORY_SETTINGS_MAP };
}

// Export global pour browser
if (typeof window !== 'undefined') {
  window.CATEGORIES = CATEGORIES;
  window.EVENTS = EVENTS;
  window.CATEGORY_SETTINGS_MAP = CATEGORY_SETTINGS_MAP;
}
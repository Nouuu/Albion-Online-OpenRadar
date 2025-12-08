import settingsSync from "./SettingsSync.js";

export class Settings
{
    constructor()
    {
        //#region Initialization
        this.images = {};
        this.item_images = {}
        this.map_images = {}
        this.flag_images = {}

        // 🔄 Track images currently being loaded to prevent duplicate requests
        this.loading_images = new Set();
        this.loading_item_images = new Set();
        this.loading_map_images = new Set();
        this.loading_flag_images = new Set();
        //#endregion

        //#region Maps
        this.showMapBackground = false;
        //#endregion

        //#region Players
        this.settingShowPlayers = false;
        this.settingNickname = false;
        this.settingHealth = false;
        this.settingMounted = false;
        this.settingItems = false;
        this.settingItemsDev = false;
        this.settingDistance = false;
        this.settingGuild = false;
        this.scale = 4.0;
        this.settingSound = false;
        this.settingFlash = false;

        this.settingPassivePlayers = false;
        this.settingFactionPlayers = false;
        this.settingDangerousPlayers = false;
        //#endregion

        this.ignoreList = [];

        // Array or string delimited by ';'
        // Array => for & if
        // String => Find in string
        //#region Static ressources 
        /* 
        {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };
        */
        this.harvestingStaticFiber = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingStaticWood = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingStaticHide = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingStaticOre = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingStaticRock = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };
        //#endregion

        //#region Living ressources
        /* 
        {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };
        */
        this.harvestingLivingFiber = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingLivingWood = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingLivingHide = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingLivingOre = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.harvestingLivingRock = {
            'e0': [false, false, false, false, false, false, false, false],
            'e1': [false, false, false, false, false, false, false, false],
            'e2': [false, false, false, false, false, false, false, false],
            'e3': [false, false, false, false, false, false, false, false],
            'e4': [false, false, false, false, false, false, false, false],
        };

        this.livingResourcesID = false;
        this.livingResourcesHealthBar = false;
        // logFormat: 'json' | 'human' — controls how logs are pretty-printed in console
        this.logFormat = settingsSync.get('logFormat', 'human');
        //#endregion
        this.resourceSize = false;

        // 📊 Resource Overlay Settings
        this.overlayEnchantment = false; // Default: hide enchantment for static resources
        this.overlayEnchantmentLiving = false; // Default: show enchantment for living resources
        this.overlayResourceCount = false; // Default: hide resource count
        this.overlayDistance = false; // Default: distance indicator off
        this.overlayDistanceLivingOnly = false; // Default : distance indicator for living resources only off
        this.overlayCluster = false; // Default: cluster indicator off
        this.overlayClusterRadius = 30; // Default cluster radius in meters
        this.overlayClusterMinSize = 2; // Default minimum resources to form a cluster

        this.showFish = false;


        //#region Dungeons
        this.mistSolo = false;
        this.mistDuo = false;
        this.mistEnchants = [false, false, false, false, false];
        this.wispCage = false;

        this.dungeonSolo = false;
        this.dungeonGroup = false;
        this.dungeonEnchants = [false, false, false, false, false];

        this.dungeonCorrupted = false;
        this.dungeonHellgate = false;
        //#endregion

        //#region Enemies
        this.enemyLevels = [false, false, false, false, false];

        this.showMinimumHealthEnemies = false;
        this.minimumHealthEnemies = 2100;

        this.avaloneDrones = false;
        this.showUnmanagedEnemies = false;
        this.showEventEnemies = false;

        this.enemiesHealthBar = false;
        this.enemiesID = false;
        this.debugEnemies = false;
        this.debugPlayers = false;
        this.debugChests = false;
        this.debugDungeons = false;
        this.debugFishing = false;
        this.debugHarvestables = false;

        // 🐛 Debug & Logging settings
        this.logToConsole = false; // Default: disbled
        this.logToServer = false; // Default: disabled (requires WebSocket)
        this.debugRawPacketsConsole = false; // Default: disabled (très verbeux)
        this.debugRawPacketsServer = false; // Default: disabled (très verbeux)

        //#region Mists
        this.bossCrystalSpider = false;
        this.bossFairyDragon = false;
        this.bossVeilWeaver = false;
        this.bossGriffin = false;
        //#endregion

        this.enemiesID = false;
        //#endregion

        //#region Chests
        this.chestGreen = false;
        this.chestBlue = false;
        this.chestPurple = false;
        this.chestYellow = false;
        //#endregion  

        this.update();
    }

    preloadImageAndAddToList(path, container)
    {
        return new Promise((resolve, reject) =>
        {
            switch (container)
            {
                case "Resources":
                    // Image already loaded (or already tried and failed - cached as null)
                    if (path in this.images)
                    {
                        // If it's null (404), reject to indicate failure
                        if (this.images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    // Image already being loaded, wait
                    else if (this.loading_images.has(path))
                    {
                        // Don't start a new request, just resolve immediately
                        // The image will be available on next frame
                        resolve();
                    }
                    else
                    {
                        // Mark as loading
                        this.loading_images.add(path);

                        const img = new Image();

                        img.onload = () =>
                        {
                            this.images[path] = img;
                            this.loading_images.delete(path);
                            resolve();
                        };

                        img.onerror = () => 
                        {
                            // Cache the 404 as null to avoid retrying
                            this.images[path] = null;
                            this.loading_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }

                    break;

                case "Maps":
                    // Image already loaded (or already tried and failed - cached as null)
                    if (path in this.map_images)
                    {
                        if (this.map_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    // Image already being loaded, wait
                    else if (this.loading_map_images.has(path))
                    {
                        resolve();
                    }
                    else
                    {
                        // Mark as loading
                        this.loading_map_images.add(path);

                        const img = new Image();

                        img.onload = () =>
                        {
                            this.map_images[path] = img;
                            this.loading_map_images.delete(path);
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            // Cache the 404 as null to avoid retrying
                            this.map_images[path] = null;
                            this.loading_map_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }

                    break;

                case "Items":
                    // Image already loaded (or already tried and failed - cached as null)
                    if (path in this.item_images)
                    {
                        if (this.item_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    // Image already being loaded, wait
                    else if (this.loading_item_images.has(path))
                    {
                        resolve();
                    }
                    else
                    {
                        // Mark as loading
                        this.loading_item_images.add(path);

                        const img = new Image();

                        img.onload = () =>
                        {
                            this.item_images[path] = img;
                            this.loading_item_images.delete(path);
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            // Cache the 404 as null to avoid retrying
                            this.item_images[path] = null;
                            this.loading_item_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }

                    break;
                
                case "Flags":
                    // Image already loaded (or already tried and failed - cached as null)
                    if (path in this.flag_images)
                    {
                        if (this.flag_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    // Image already being loaded, wait
                    else if (this.loading_flag_images.has(path))
                    {
                        resolve();
                    }
                    else
                    {
                        // Mark as loading
                        this.loading_flag_images.add(path);

                        const img = new Image();

                        img.onload = () =>
                        {
                            this.flag_images[path] = img;
                            this.loading_flag_images.delete(path);
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            // Cache the 404 as null to avoid retrying
                            this.flag_images[path] = null;
                            this.loading_flag_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }
                    break;

                default:
                    reject();
                    break;
            }
        });
    }

    GetPreloadedImage(path, container)
    {
        switch (container)
        {
            case "Resources":
                return this.images[path];

            case "Maps":
                return this.map_images[path];

            case "Items":
                return this.item_images[path];
            
            case "Flags":
                return this.flag_images[path];

            default:
                return null;
        }
    }

    update()
    {
        this.showMapBackground = settingsSync.getBool("settingShowMap");

        //#region Players
        this.settingShowPlayers = settingsSync.getBool("settingShowPlayers");
        this.settingNickname = settingsSync.getBool("settingNickname");
        this.settingHealth = settingsSync.getBool("settingHealth");
        this.settingMounted = settingsSync.getBool("settingMounted");
        this.settingItems = settingsSync.getBool("settingItems");
        this.settingItemsDev = settingsSync.getBool("settingItemsDev");
        this.settingDistance = settingsSync.getBool("settingDistance");
        this.settingGuild = settingsSync.getBool("settingGuild");
        this.settingSound = settingsSync.getBool("settingSound");
        this.settingFlash = settingsSync.getBool("settingFlash");

        this.settingPassivePlayers = settingsSync.getBool("settingPassivePlayers");
        this.settingFactionPlayers = settingsSync.getBool("settingFactionPlayers");
        this.settingDangerousPlayers = settingsSync.getBool("settingDangerousPlayers");
        //#endregion

        //#region Resources
        //#region Static Harvestables

        this.harvestingStaticRock = settingsSync.getJSON("settingStaticRockEnchants", this.harvestingStaticRock);
        this.harvestingStaticFiber = settingsSync.getJSON("settingStaticFiberEnchants", this.harvestingStaticFiber);
        this.harvestingStaticHide = settingsSync.getJSON("settingStaticHideEnchants", this.harvestingStaticHide);
        this.harvestingStaticOre = settingsSync.getJSON("settingStaticOreEnchants", this.harvestingStaticOre);
        this.harvestingStaticWood = settingsSync.getJSON("settingStaticWoodEnchants", this.harvestingStaticWood);
        this.harvestingStaticRock = settingsSync.getJSON("settingStaticRockEnchants", this.harvestingStaticRock);
        //#endregion

        //#region Living Harvestables

        this.harvestingLivingFiber = settingsSync.getJSON("settingLivingFiberEnchants", this.harvestingLivingFiber);
        this.harvestingLivingHide = settingsSync.getJSON("settingLivingHideEnchants", this.harvestingLivingHide);
        this.harvestingLivingOre = settingsSync.getJSON("settingLivingOreEnchants", this.harvestingLivingOre);
        this.harvestingLivingWood = settingsSync.getJSON("settingLivingWoodEnchants", this.harvestingLivingWood);
        this.harvestingLivingRock = settingsSync.getJSON("settingLivingRockEnchants", this.harvestingLivingRock);

        //#endregion

        this.livingResourcesHealthBar = settingsSync.getBool("settingLivingResourcesHealthBar");
        this.livingResourcesID = settingsSync.getBool("settingLivingResourcesID");
        this.resourceSize = settingsSync.getBool("settingRawSize");

        // 📊 Load overlay settings from localStorage (matching UI setting names)
        this.overlayEnchantment = settingsSync.getBool("settingResourceEnchantOverlay");
        this.overlayEnchantmentLiving = settingsSync.getBool("settingLivingResourceEnchantOverlay");
        this.overlayResourceCount = settingsSync.getBool("settingResourceCount");
        this.overlayDistance = settingsSync.getBool("settingResourceDistance");
        this.overlayDistanceLivingOnly = settingsSync.getBool("settingResourceDistanceLivingOnly");
        this.overlayCluster = settingsSync.getBool("settingResourceClusters");

        this.overlayClusterRadius = settingsSync.getNumber("settingClusterRadius", 30);
        this.overlayClusterMinSize = settingsSync.getNumber("settingClusterMinSize", 2);

        this.showFish = settingsSync.getBool("settingFishing");
        //#endregion

        //#region Enemies
        this.enemyLevels[0] = settingsSync.getBool("settingNormalEnemy");
        this.enemyLevels[1] = settingsSync.getBool("settingMediumEnemy");
        this.enemyLevels[2] = settingsSync.getBool("settingEnchantedEnemy");
        this.enemyLevels[3] = settingsSync.getBool("settingMiniBossEnemy");
        this.enemyLevels[4] = settingsSync.getBool("settingBossEnemy");


        this.showMinimumHealthEnemies = settingsSync.getBool("settingShowMinimumHealthEnemies");
        this.minimumHealthEnemies = settingsSync.getNumber("settingTextMinimumHealthEnemies", 2100);

        this.avaloneDrones = settingsSync.getBool("settingAvaloneDrones");
        this.showUnmanagedEnemies = settingsSync.getBool("settingShowUnmanagedEnemies");
        this.showEventEnemies = settingsSync.getBool("settingShowEventEnemies");

        this.enemiesHealthBar = settingsSync.getBool("settingEnemiesHealthBar");
        this.enemiesID = settingsSync.getBool("settingEnemiesID");
        this.debugEnemies = settingsSync.getBool("settingDebugEnemies");
        this.debugPlayers = settingsSync.getBool("settingDebugPlayers");
        this.debugChests = settingsSync.getBool("settingDebugChests");
        this.debugDungeons = settingsSync.getBool("settingDebugDungeons");
        this.debugFishing = settingsSync.getBool("settingDebugFishing");
        this.debugHarvestables = settingsSync.getBool("settingDebugHarvestables");

        // 🐛 Debug & Logging settings (dynamic update)
        this.logToConsole = settingsSync.getBool("settingLogToConsole");
        this.logToServer = settingsSync.getBool("settingLogToServer");
        this.debugRawPacketsConsole = settingsSync.getBool("settingDebugRawPacketsConsole");
        this.debugRawPacketsServer = settingsSync.getBool("settingDebugRawPacketsServer");

        //#region Mists
        // TODO
        // Mists beasts
        this.bossCrystalSpider = settingsSync.getBool("settingBossCrystalSpider");
        this.bossFairyDragon = settingsSync.getBool("settingBossFairyDragon");
        this.bossVeilWeaver = settingsSync.getBool("settingBossVeilWeaver");
        this.bossGriffin = settingsSync.getBool("settingBossGriffin");
        //#endregion
        //#endregion

        //#region Chests
        this.chestGreen = settingsSync.getBool("settingChestGreen");
        this.chestBlue = settingsSync.getBool("settingChestBlue");
        this.chestPurple = settingsSync.getBool("settingChestPurple");
        this.chestYellow = settingsSync.getBool("settingChestYellow");
        //#endregion

        //#region Mists
        this.mistSolo = settingsSync.getBool("settingMistSolo");
        this.mistDuo = settingsSync.getBool("settingMistDuo");
        this.wispCage = settingsSync.getBool("settingCage");


        this.mistEnchants[0] = settingsSync.getBool("settingMistE0");
        this.mistEnchants[1] = settingsSync.getBool("settingMistE1");
        this.mistEnchants[2] = settingsSync.getBool("settingMistE2");
        this.mistEnchants[3] = settingsSync.getBool("settingMistE3");
        this.mistEnchants[4] = settingsSync.getBool("settingMistE4");
        //#endregion

        //#region Dungeons
        this.dungeonEnchants[0] = settingsSync.getBool("settingDungeonE0");
        this.dungeonEnchants[1] = settingsSync.getBool("settingDungeonE1");
        this.dungeonEnchants[2] = settingsSync.getBool("settingDungeonE2");
        this.dungeonEnchants[3] = settingsSync.getBool("settingDungeonE3");
        this.dungeonEnchants[4] = settingsSync.getBool("settingDungeonE4");

        this.dungeonSolo = settingsSync.getBool("settingDungeonSolo");
        this.dungeonGroup = settingsSync.getBool("settingDungeonDuo");
        this.dungeonCorrupted = settingsSync.getBool("settingDungeonCorrupted");
        this.dungeonHellgate = settingsSync.getBool("settingDungeonHellgate");
        //#endregion

        this.ignoreList = settingsSync.getJSON("ignoreList", []);
    }

    // Central accessor for overlay distance scale (prefer global helper if present)
    getOverlayDistanceScale() {
        return this.scale;
    }
}

const settingsInstance = new Settings();
export default settingsInstance;
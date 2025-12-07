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

    ClearPreloadedImages(container)
    {
        switch (container)
        {
            case "Resources":
                this.images = {};
                this.loading_images.clear();
                break;

            case "Maps":
                this.map_images = {};
                this.loading_map_images.clear();
                break;

            case "Items":
                this.item_images = {};
                this.loading_item_images.clear();
                break;

            case "_ALL_":
                this.images = {};
                this.map_images = {};
                this.item_images = {};
                this.loading_images.clear();
                this.loading_map_images.clear();
                this.loading_item_images.clear();
                break;
        }
    }

    update()
    {
        this.showMapBackground = settingsSync.getBool("settingShowMap", false);

        //#region Players
        this.settingShowPlayers = settingsSync.getBool("settingShowPlayers", false);
        this.settingNickname = settingsSync.getBool("settingNickname", false);
        this.settingHealth = settingsSync.getBool("settingHealth", false);
        this.settingMounted = settingsSync.getBool("settingMounted", false);
        this.settingItems = settingsSync.getBool("settingItems", false);
        this.settingItemsDev = settingsSync.getBool("settingItemsDev", false);
        this.settingDistance = settingsSync.getBool("settingDistance", false);
        this.settingGuild = settingsSync.getBool("settingGuild", false);
        this.settingSound = settingsSync.getBool("settingSound", false);
        this.settingFlash = settingsSync.getBool("settingFlash", false);

        //#endregion

        //#region Resources
        //#region Static Harvestables

        this.harvestingStaticFiber = settingsSync.get("settingStaticFiberEnchants", this.harvestingStaticFiber);
        if (typeof this.harvestingStaticFiber !== 'object')
            this.harvestingStaticFiber = JSON.parse(this.harvestingStaticFiber);

        this.harvestingStaticHide = settingsSync.get("settingStaticHideEnchants", this.harvestingStaticHide);
        if (typeof this.harvestingStaticHide !== 'object')
            this.harvestingStaticHide = JSON.parse(this.harvestingStaticHide);
        
        this.harvestingStaticOre = settingsSync.get("settingStaticOreEnchants", this.harvestingStaticOre);
        if (typeof this.harvestingStaticOre !== 'object')
            this.harvestingStaticOre = JSON.parse(this.harvestingStaticOre);

        this.harvestingStaticWood = settingsSync.get("settingStaticWoodEnchants", this.harvestingStaticWood);
        if (typeof this.harvestingStaticWood !== 'object')
            this.harvestingStaticWood = JSON.parse(this.harvestingStaticWood);

        this.harvestingStaticRock = settingsSync.get("settingStaticRockEnchants", this.harvestingStaticRock);
        if (typeof this.harvestingStaticRock !== 'object')
            this.harvestingStaticRock = JSON.parse(this.harvestingStaticRock);
        //#endregion

        //#region Living Harvestables
        this.harvestingLivingFiber = settingsSync.get("settingLivingFiberEnchants", this.harvestingLivingFiber);
        if (typeof this.harvestingLivingFiber !== 'object')
            this.harvestingLivingFiber = JSON.parse(this.harvestingLivingFiber);

        this.harvestingLivingHide = settingsSync.get("settingLivingHideEnchants", this.harvestingLivingHide);
        if (typeof this.harvestingLivingHide !== 'object')
            this.harvestingLivingHide = JSON.parse(this.harvestingLivingHide);
        
        this.harvestingLivingOre = settingsSync.get("settingLivingOreEnchants", this.harvestingLivingOre);
        if (typeof this.harvestingLivingOre !== 'object')
            this.harvestingLivingOre = JSON.parse(this.harvestingLivingOre);

        this.harvestingLivingWood = settingsSync.get("settingLivingWoodEnchants", this.harvestingLivingWood);
        if (typeof this.harvestingLivingWood !== 'object')
            this.harvestingLivingWood = JSON.parse(this.harvestingLivingWood);

        this.harvestingLivingRock = settingsSync.get("settingLivingRockEnchants", this.harvestingLivingRock);
        if (typeof this.harvestingLivingRock !== 'object')
            this.harvestingLivingRock = JSON.parse(this.harvestingLivingRock);

        //#endregion

        this.livingResourcesHealthBar = settingsSync.getBool("settingLivingResourcesHealthBar", false);
        this.livingResourcesID = settingsSync.getBool("settingLivingResourcesID", false);
        this.resourceSize = settingsSync.getBool("settingRawSize", false);


        // 📊 Load overlay settings (matching UI setting names)
        this.overlayEnchantment = settingsSync.getBool("settingResourceEnchantOverlay", false);
        this.overlayEnchantmentLiving = settingsSync.getBool("settingLivingResourceEnchantOverlay", false);
        this.overlayResourceCount = settingsSync.getBool("settingResourceCount", false);
        this.overlayDistance = settingsSync.getBool("settingResourceDistance", false);
        this.overlayDistanceLivingOnly = settingsSync.getBool("settingResourceDistanceLivingOnly", false);
        this.overlayCluster = settingsSync.getBool("settingResourceClusters", false);
        this.overlayClusterRadius = parseInt(settingsSync.get("settingClusterRadius", this.overlayClusterRadius));
        this.overlayClusterMinSize = parseInt(settingsSync.get("settingClusterMinSize", this.overlayClusterMinSize));

        this.showFish = settingsSync.getBool("settingFishing", false);
        //#endregion

        //#region Enemies
        this.enemyLevels[0] = settingsSync.getBool("settingNormalEnemy", false);
        this.enemyLevels[1] = settingsSync.getBool("settingMediumEnemy", false);
        this.enemyLevels[2] = settingsSync.getBool("settingEnchantedEnemy", false);
        this.enemyLevels[3] = settingsSync.getBool("settingMiniBossEnemy", false);
        this.enemyLevels[4] = settingsSync.getBool("settingBossEnemy", false);


        this.showMinimumHealthEnemies = settingsSync.getBool("settingShowMinimumHealthEnemies", false);
        this.minimumHealthEnemies = parseInt(settingsSync.get("settingTextMinimumHealthEnemies", this.minimumHealthEnemies));

        this.avaloneDrones = settingsSync.getBool("settingAvaloneDrones",false);
        this.showUnmanagedEnemies = settingsSync.getBool("settingShowUnmanagedEnemies", false);
        this.showEventEnemies = settingsSync.getBool("settingShowEventEnemies", false);

        this.enemiesHealthBar = settingsSync.getBool("settingEnemiesHealthBar", false);
        this.enemiesID = settingsSync.getBool("settingEnemiesID",false);
        this.debugEnemies = settingsSync.getBool("settingDebugEnemies", false);
        this.debugPlayers = settingsSync.getBool("settingDebugPlayers", false);
        this.debugChests = settingsSync.getBool("settingDebugChests",false);
        this.debugDungeons = settingsSync.getBool("settingDebugDungeons",false);
        this.debugFishing = settingsSync.getBool("settingDebugFishing", false);
        this.debugHarvestables = settingsSync.getBool("settingDebugHarvestables",false);

        // 🐛 Debug & Logging settings (dynamic update)
        this.logToConsole = settingsSync.getBool("settingLogToConsole", false);
        this.logToServer = settingsSync.getBool("settingLogToServer", false); // Default: false
        this.debugRawPacketsConsole = settingsSync.getBool("settingDebugRawPacketsConsole", false); // Default: false
        this.debugRawPacketsServer = settingsSync.getBool("settingDebugRawPacketsServer", false); // Default: false

        //#region Mists
        // TODO
        // Mists beasts
        this.bossCrystalSpider = settingsSync.getBool("settingBossCrystalSpider", false);
        this.bossFairyDragon = settingsSync.getBool("settingBossFairyDragon", false);
        this.bossVeilWeaver = settingsSync.getBool("settingBossVeilWeaver", false);
        this.bossGriffin = settingsSync.getBool("settingBossGriffin", false);
        //#endregion
        //#endregion
        
        //#region Chests
        this.chestGreen = settingsSync.getBool("settingChestGreen", false);
        this.chestBlue = settingsSync.getBool("settingChestBlue", false);
        this.chestPurple = settingsSync.getBool("settingChestPurple", false);
        this.chestYellow = settingsSync.getBool("settingChestYellow", false);
        //#endregion

        //#region Mists
        this.mistSolo = settingsSync.getBool("settingMistSolo", false);
        this.mistDuo = settingsSync.getBool("settingMistDuo", false);
        this.wispCage = settingsSync.getBool("settingCage", false);


        this.mistEnchants[0] = settingsSync.getBool("settingMistE0", false);
        this.mistEnchants[1] = settingsSync.getBool("settingMistE1", false);
        this.mistEnchants[2] = settingsSync.getBool("settingMistE2", false);
        this.mistEnchants[3] = settingsSync.getBool("settingMistE3", false);
        this.mistEnchants[4] = settingsSync.getBool("settingMistE4", false);
        //#endregion

        //#region Dungeons
        this.dungeonEnchants[0] = settingsSync.getBool("settingDungeonE0", false);
        this.dungeonEnchants[1] = settingsSync.getBool("settingDungeonE1", false);
        this.dungeonEnchants[2] = settingsSync.getBool("settingDungeonE2", false);
        this.dungeonEnchants[3] = settingsSync.getBool("settingDungeonE3", false);
        this.dungeonEnchants[4] = settingsSync.getBool("settingDungeonE4", false);

        this.dungeonSolo = settingsSync.getBool("settingDungeonSolo", false);
        this.dungeonGroup = settingsSync.getBool("settingDungeonDuo", false);
        this.dungeonCorrupted = settingsSync.getBool("settingDungeonCorrupted", false);
        this.dungeonHellgate = settingsSync.getBool("settingDungeonHellgate", false);
        //#endregion

        this.ignoreList = JSON.parse(settingsSync.get("ignoreList", JSON.stringify(this.ignoreList)));
    }

    // Central accessor for overlay distance scale (prefer global helper if present)
    getOverlayDistanceScale() {
        return this.scale;
    }
}

const settingsInstance = new Settings();
export default settingsInstance;
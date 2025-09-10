
export class Settings
{
    constructor()
    {
        //#region Initialization
        this.images = {};
        this.item_images = {}
        this.map_images = {}
        this.flag_images = {}
        //#endregion

        //#region Maps
        this.showMapBackground = false;
        //#endregion

        //#region Players
        this.settingDot = false;
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

        this.livingResourcesHP = false;
        this.livingResourcesID = false;
        //#endregion
        this.resourceSize = false;

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

        //#region Mists
        this.bossCrystalSpider = false;
        this.bossFairyDragon = false;
        this.bossVeilWeaver = false;
        this.bossGriffin = false;
        //#endregion

        this.enemiesHP = false;
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
                    if (this.images[path])
                    {
                        resolve();
                    }
                    else
                    {
                        const img = new Image();

                        img.onload = () =>
                        {
                            this.images[path] = img;
                            resolve();
                        };

                        img.onerror = () => 
                        {
                            this.images[path] = null;
                            reject();
                        };

                        img.src = path;
                    }

                    break;

                case "Maps":
                    if (this.map_images[path])
                    {
                        resolve();
                    }
                    else
                    {
                        const img = new Image();

                        img.onload = () =>
                        {
                            this.map_images[path] = img; 
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            this.map_images[path] = null;
                            reject();
                        };

                        img.src = path;
                    }

                    break;

                case "Items":
                    if (this.item_images[path])
                    {
                        resolve();
                    }
                    else
                    {
                        const img = new Image();

                        img.onload = () =>
                        {
                            this.item_images[path] = img; 
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            this.item_images[path] = null;
                            reject();
                        };

                        img.src = path;
                    }

                    break;
                
                case "Flags":
                    if (this.flag_images[path])
                    {
                        resolve();
                    }
                    else
                    {
                        const img = new Image();

                        img.onload = () =>
                        {
                            this.flag_images[path] = img; 
                            resolve();
                        };

                        img.onerror = () =>
                        {
                            this.flag_images[path] = null;
                            reject();
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
                break;

            case "Maps":
                this.map_images = {};
                break;

            case "Items":
                this.item_images = {};
                break;

            case "_ALL_":
                this.images = {};
                this.map_images = {};
                this.item_images = {};
                break;
        }
    }

    returnLocalBool(item)
    {
        return localStorage.getItem(item) == "true";
    }

    update()
    {
        this.showMapBackground = this.returnLocalBool("settingShowMap");

        //#region Players
        this.settingDot = this.returnLocalBool("settingDot");
        this.settingNickname = this.returnLocalBool("settingNickname");
        this.settingHealth = this.returnLocalBool("settingHealth");
        this.settingMounted = this.returnLocalBool("settingMounted");
        this.settingItems = this.returnLocalBool("settingItems");
        this.settingItemsDev = this.returnLocalBool("settingItemsDev");
        this.settingDistance = this.returnLocalBool("settingDistance");
        this.settingGuild = this.returnLocalBool("settingGuild");
        this.settingSound = this.returnLocalBool("settingSound");
        this.settingFlash = this.returnLocalBool("settingFlash");

        this.settingPassivePlayers = this.returnLocalBool("settingPassivePlayers");
        this.settingFactionPlayers = this.returnLocalBool("settingFactionPlayers");
        this.settingDangerousPlayers = this.returnLocalBool("settingDangerousPlayers");
        //#endregion

        //#region Resources
        //#region Static Harvestables

        this.harvestingStaticFiber = localStorage.getItem("settingStaticFiberEnchants") || this.harvestingStaticFiber;
        if (typeof this.harvestingStaticFiber !== 'object')
            this.harvestingStaticFiber = JSON.parse(this.harvestingStaticFiber);

        this.harvestingStaticHide = localStorage.getItem("settingStaticHideEnchants") || this.harvestingStaticHide;
        if (typeof this.harvestingStaticHide !== 'object')
            this.harvestingStaticHide = JSON.parse(this.harvestingStaticHide);
        
        this.harvestingStaticOre = localStorage.getItem("settingStaticOreEnchants") || this.harvestingStaticOre;
        if (typeof this.harvestingStaticOre !== 'object')
            this.harvestingStaticOre = JSON.parse(this.harvestingStaticOre);

        this.harvestingStaticWood = localStorage.getItem("settingStaticWoodEnchants") || this.harvestingStaticWood;
        if (typeof this.harvestingStaticWood !== 'object')
            this.harvestingStaticWood = JSON.parse(this.harvestingStaticWood);

        this.harvestingStaticRock = localStorage.getItem("settingStaticRockEnchants") || this.harvestingStaticRock;
        if (typeof this.harvestingStaticRock !== 'object')
            this.harvestingStaticRock = JSON.parse(this.harvestingStaticRock);

        //#endregion


        //#region Living Harvestables

        this.harvestingLivingFiber = localStorage.getItem("settingLivingFiberEnchants") || this.harvestingLivingFiber;
        if (typeof this.harvestingLivingFiber !== 'object')
            this.harvestingLivingFiber = JSON.parse(this.harvestingLivingFiber);

        this.harvestingLivingHide = localStorage.getItem("settingLivingHideEnchants") || this.harvestingLivingHide;
        if (typeof this.harvestingLivingHide !== 'object')
            this.harvestingLivingHide = JSON.parse(this.harvestingLivingHide);
        
        this.harvestingLivingOre = localStorage.getItem("settingLivingOreEnchants") || this.harvestingLivingOre;
        if (typeof this.harvestingLivingOre !== 'object')
            this.harvestingLivingOre = JSON.parse(this.harvestingLivingOre);

        this.harvestingLivingWood = localStorage.getItem("settingLivingWoodEnchants") || this.harvestingLivingWood;
        if (typeof this.harvestingLivingWood !== 'object')
            this.harvestingLivingWood = JSON.parse(this.harvestingLivingWood);

        this.harvestingLivingRock = localStorage.getItem("settingLivingRockEnchants") || this.harvestingLivingRock;
        if (typeof this.harvestingLivingRock !== 'object')
            this.harvestingLivingRock = JSON.parse(this.harvestingLivingRock);

        //#endregion

        this.livingResourcesHP = this.returnLocalBool("settingLivingResourcesHP");
        this.livingResourcesID = this.returnLocalBool("settingLivingResourcesID");
        this.resourceSize = this.returnLocalBool("settingRawSize");
        this.showFish = this.returnLocalBool("settingFishing");
        //#endregion

        //#region Enemies
        this.enemyLevels[0] = this.returnLocalBool("settingNormalEnemy");
        this.enemyLevels[1] = this.returnLocalBool("settingMediumEnemy");
        this.enemyLevels[2] = this.returnLocalBool("settingEnchantedEnemy");
        this.enemyLevels[3] = this.returnLocalBool("settingMiniBossEnemy");
        this.enemyLevels[4] = this.returnLocalBool("settingBossEnemy");


        this.showMinimumHealthEnemies = this.returnLocalBool("settingShowMinimumHealthEnemies");
        this.minimumHealthEnemies = parseInt(localStorage.getItem("settingTextMinimumHealthEnemies"));

        this.avaloneDrones = this.returnLocalBool("settingAvaloneDrones");
        this.showUnmanagedEnemies = this.returnLocalBool("settingShowUnmanagedEnemies");
        this.showEventEnemies = this.returnLocalBool("settingShowEventEnemies");

        this.enemiesHP = this.returnLocalBool("settingEnemiesHP");
        this.enemiesID = this.returnLocalBool("settingEnemiesID");

        //#region Mists
        // TODO
        // Mists beasts
        this.bossCrystalSpider = this.returnLocalBool("settingBossCrystalSpider");
        this.bossFairyDragon = this.returnLocalBool("settingBossFairyDragon");
        this.bossVeilWeaver = this.returnLocalBool("settingBossVeilWeaver");
        this.bossGriffin = this.returnLocalBool("settingBossGriffin");
        //#endregion
        //#endregion
        
        //#region Chests
        this.chestGreen = this.returnLocalBool("settingChestGreen");
        this.chestBlue = this.returnLocalBool("settingChestBlue");
        this.chestPurple = this.returnLocalBool("settingChestPurple");
        this.chestYellow = this.returnLocalBool("settingChestYellow");
        //#endregion

        //#region Mists
        this.mistSolo = this.returnLocalBool("settingMistSolo");
        this.mistDuo = this.returnLocalBool("settingMistDuo");
        this.wispCage = this.returnLocalBool("settingCage");


        this.mistEnchants[0] = this.returnLocalBool("settingMistE0");
        this.mistEnchants[1] = this.returnLocalBool("settingMistE1");
        this.mistEnchants[2] = this.returnLocalBool("settingMistE2");
        this.mistEnchants[3] = this.returnLocalBool("settingMistE3");
        this.mistEnchants[4] = this.returnLocalBool("settingMistE4");
        //#endregion

        //#region Dungeons
        this.dungeonEnchants[0] = this.returnLocalBool("settingDungeonE0");
        this.dungeonEnchants[1] = this.returnLocalBool("settingDungeonE1");
        this.dungeonEnchants[2] = this.returnLocalBool("settingDungeonE2");
        this.dungeonEnchants[3] = this.returnLocalBool("settingDungeonE3");
        this.dungeonEnchants[4] = this.returnLocalBool("settingDungeonE4");

        this.dungeonSolo = this.returnLocalBool("settingDungeonSolo");
        this.dungeonGroup = this.returnLocalBool("settingDungeonDuo");
        this.dungeonCorrupted = this.returnLocalBool("settingDungeonCorrupted");
        this.dungeonHellgate = this.returnLocalBool("settingDungeonHellgate");
        //#endregion

        this.ignoreList = JSON.parse(localStorage.getItem("ignoreList")) || [];
    }
}
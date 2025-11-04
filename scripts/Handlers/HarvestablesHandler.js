const HarvestableType = 
{
    Fiber: 'Fiber',
    Hide: 'Hide',
    Log: 'Log',
    Ore: 'Ore',
    Rock: 'Rock'
};

class Harvestable
{
    constructor(id, type, tier, posX, posY, charges, size)
    {
        this.id = id;
        this.type = type;
        this.tier = tier;
        this.posX = posX;
        this.posY = posY;
        this.hX = 0;
        this.hY = 0;

        this.charges = charges;
        this.size = size;
    }

    setCharges(charges)
    {
        this.charges = charges;
    }
}

class HarvestablesHandler
{
    constructor(settings, mobsHandler = null)
    {
        this.harvestableList = [];
        this.settings = settings;
        this.mobsHandler = mobsHandler;

        // 💾 Cache pour ressources
        this.lastHarvestCache = new Map();

        // 🆕 Tracking de l'inventaire via NewSimpleItem (SOLUTION SIMPLIFIÉE)
        this.lastInventoryQuantities = new Map(); // Map<itemId, lastQuantity>
        this.pendingHarvestableId = null; // ID de la ressource en cours de récolte
        this.isHarvesting = false; // Flag pour savoir si on est en train de récolter

        // 📋 Map pour logger les découvertes itemId → resource (pour debug)
        this.discoveredItemIds = new Map(); // Pas sauvegardé, juste pour logs


        // 📊 Statistics tracking
        this.stats = {
            totalDetected: 0,
            totalHarvested: 0,
            byType: {
                Fiber: { detected: 0, harvested: 0 },
                Hide: { detected: 0, harvested: 0 },
                Log: { detected: 0, harvested: 0 },
                Ore: { detected: 0, harvested: 0 },
                Rock: { detected: 0, harvested: 0 }
            },
            byTier: {},
            byEnchantment: {
                detected: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
                harvested: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
            },
            sessionStart: new Date()
        };

        // Initialize tier stats
        for (let i = 1; i <= 8; i++) {
            this.stats.byTier[i] = { detected: 0, harvested: 0 };
        }
    }

    // 🆕 Appelé par Utils.js lors de HarvestStart
    onHarvestStart(harvestableId) {
        this.pendingHarvestableId = harvestableId;
        this.isHarvesting = true;

        if (window.debugLogs) {
            console.log(`🌱 [HarvestablesHandler] HarvestStart`, {
                harvestableId,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 🆕 Appelé par Utils.js lors de HarvestCancel
    onHarvestCancel() {
        if (window.debugLogs) {
            console.log('❌ [HarvestablesHandler] HarvestCancel - Reset flags');
        }
        this.pendingHarvestableId = null;
        this.isHarvesting = false;
    }

    // 🆕 Appelé par Utils.js lors de NewSimpleItem
    // ✅ SOLUTION SIMPLIFIÉE: On track uniquement les ressources déjà dans harvestableList (détectées par le radar)
    // Parameters[2] = quantité totale dans l'inventaire
    onNewSimpleItem(itemId, newQuantity) {
        const oldQuantity = this.lastInventoryQuantities.get(itemId) || 0;
        const gained = newQuantity - oldQuantity;

        // Mettre à jour la quantité pour le prochain calcul
        this.lastInventoryQuantities.set(itemId, newQuantity);

        // ⚠️ Ne tracker que si on est EN TRAIN de récolter
        if (!this.isHarvesting || !this.pendingHarvestableId) {
            return;
        }

        // Si on a gagné des ressources pendant la récolte
        if (gained > 0) {
            const harvestable = this.harvestableList.find(h => h.id === this.pendingHarvestableId);

            if (harvestable) {
                // ✅ Resource detected by radar (living resources)

                // 📋 Logger la découverte itemId pour référence future (une seule fois)
                if (!this.discoveredItemIds.has(itemId)) {
                    this.discoveredItemIds.set(itemId, { type: harvestable.type, tier: harvestable.tier, charges: harvestable.charges });
                    if (window.debugLogs) {
                        console.log(`🆕 [ItemId Discovery]`, itemId, '=', harvestable.type, `T${harvestable.tier}.${harvestable.charges}`);
                    }
                }


                // Stocker dans le cache
                this.lastHarvestCache.set(this.pendingHarvestableId, {
                    resources: gained,
                    trackedByNewSimpleItem: true,
                    itemId: itemId
                });

                // Mettre à jour les stats avec le nombre EXACT (inclut tous les bonus)
                this.updateStatsHarvested(harvestable.type, harvestable.tier, harvestable.charges, gained);
            } else {
                // ⚠️ Resource NOT detected by radar (static harvestables: Wood, Ore, Rock)
                if (window.debugLogs) {
                    console.warn(`⚠️ [NewSimpleItem] +${gained} resources but harvestable NOT in list (static resource?). ItemId: ${itemId}`);
                }

                // Stocker quand même dans le cache pour éviter double-comptage
                this.lastHarvestCache.set(this.pendingHarvestableId, {
                    resources: gained,
                    trackedByNewSimpleItem: false,
                    itemId: itemId
                });
            }
        }
    }

    // 📊 Update statistics when new harvestable is added (only if enabled in settings)
    updateStats(type, tier, charges, isHarvested = false) {
        const stringType = this.GetStringType(type);
        const isEnabled = this.isResourceEnabled(stringType, tier, charges);

        if (!isHarvested) {
            // DETECTION: Toujours tracker les enchantements, même si ressource désactivée
            if (charges >= 0 && charges <= 4) {
                this.stats.byEnchantment.detected[charges]++;
            }

            // Autres stats: seulement si activé
            if (!isEnabled) return;

            this.stats.totalDetected++;

            if (this.stats.byType[stringType]) {
                this.stats.byType[stringType].detected++;
            }

            if (this.stats.byTier[tier]) {
                this.stats.byTier[tier].detected++;
            }
        } else {
            // HARVEST: Toujours tracker les enchantements, même si ressource désactivée
            if (charges >= 0 && charges <= 4) {
                this.stats.byEnchantment.harvested[charges]++;
            }

            // Autres stats: seulement si activé
            if (!isEnabled) return;

            this.stats.totalHarvested++;

            if (this.stats.byType[stringType]) {
                this.stats.byType[stringType].harvested++;
            }

            if (this.stats.byTier[tier]) {
                this.stats.byTier[tier].harvested++;
            }
        }
    }

    // 📊 Update harvested statistics with EXACT count (includes ALL bonuses)
    // ✅ Cette méthode remplace l'ancienne logique de calcul approximatif
    updateStatsHarvested(type, tier, charges, exactCount) {
        const stringType = this.GetStringType(type);
        const isEnabled = this.isResourceEnabled(stringType, tier, charges);

        // Toujours tracker les enchantements
        if (charges >= 0 && charges <= 4) {
            this.stats.byEnchantment.harvested[charges] += exactCount;
        }

        // Autres stats: seulement si activé
        if (!isEnabled) return;

        this.stats.totalHarvested += exactCount;

        if (this.stats.byType[stringType]) {
            this.stats.byType[stringType].harvested += exactCount;
        }

        if (this.stats.byTier[tier]) {
            this.stats.byTier[tier].harvested += exactCount;
        }
    }

    // Check if a resource is enabled in settings
    isResourceEnabled(type, tier, enchant) {
        if (!this.settings) return true; // Default: track all if no settings

        // Map resource type to settings property
        const settingsMap = {
            'Fiber': 'harvestingLivingFiber',
            'Hide': 'harvestingLivingHide',
            'Log': 'harvestingLivingWood',
            'Ore': 'harvestingLivingOre',
            'Rock': 'harvestingLivingRock'
        };

        const settingsProp = settingsMap[type];
        if (!settingsProp || !this.settings[settingsProp]) {
            return true; // Default: enabled if setting not found
        }

        const enchantKey = `e${enchant}`;
        const tierIndex = tier - 1; // tier 1-8 maps to index 0-7

        // Check if this tier/enchant combo is enabled
        if (this.settings[settingsProp][enchantKey] &&
            this.settings[settingsProp][enchantKey][tierIndex] !== undefined) {
            return this.settings[settingsProp][enchantKey][tierIndex];
        }

        return true; // Default: enabled
    }

    // 🧠 Get resource info from itemId (for static harvestables)
    getResourceInfoFromItemId(itemId) {
        // 📚 Mapping théorique itemId → resource info
        const theoreticalMap = {
            // === FIBER (T2-T8) ===
            412: { type: 'Fiber', tier: 2, charges: 0 },
            413: { type: 'Fiber', tier: 3, charges: 0 },
            414: { type: 'Fiber', tier: 4, charges: 0 }, 419: { type: 'Fiber', tier: 4, charges: 1 }, 424: { type: 'Fiber', tier: 4, charges: 2 }, 429: { type: 'Fiber', tier: 4, charges: 3 }, 434: { type: 'Fiber', tier: 4, charges: 4 },
            415: { type: 'Fiber', tier: 5, charges: 0 }, 420: { type: 'Fiber', tier: 5, charges: 1 }, 425: { type: 'Fiber', tier: 5, charges: 2 }, 430: { type: 'Fiber', tier: 5, charges: 3 }, 435: { type: 'Fiber', tier: 5, charges: 4 },
            416: { type: 'Fiber', tier: 6, charges: 0 }, 421: { type: 'Fiber', tier: 6, charges: 1 }, 426: { type: 'Fiber', tier: 6, charges: 2 }, 431: { type: 'Fiber', tier: 6, charges: 3 }, 436: { type: 'Fiber', tier: 6, charges: 4 },
            417: { type: 'Fiber', tier: 7, charges: 0 }, 422: { type: 'Fiber', tier: 7, charges: 1 }, 427: { type: 'Fiber', tier: 7, charges: 2 }, 432: { type: 'Fiber', tier: 7, charges: 3 }, 437: { type: 'Fiber', tier: 7, charges: 4 },
            418: { type: 'Fiber', tier: 8, charges: 0 }, 423: { type: 'Fiber', tier: 8, charges: 1 }, 428: { type: 'Fiber', tier: 8, charges: 2 }, 433: { type: 'Fiber', tier: 8, charges: 3 }, 438: { type: 'Fiber', tier: 8, charges: 4 },

            // === HIDE (T2-T8) ===
            385: { type: 'Hide', tier: 2, charges: 0 },
            386: { type: 'Hide', tier: 3, charges: 0 },
            387: { type: 'Hide', tier: 4, charges: 0 }, 392: { type: 'Hide', tier: 4, charges: 1 }, 397: { type: 'Hide', tier: 4, charges: 2 }, 402: { type: 'Hide', tier: 4, charges: 3 }, 407: { type: 'Hide', tier: 4, charges: 4 },
            388: { type: 'Hide', tier: 5, charges: 0 }, 393: { type: 'Hide', tier: 5, charges: 1 }, 398: { type: 'Hide', tier: 5, charges: 2 }, 403: { type: 'Hide', tier: 5, charges: 3 }, 408: { type: 'Hide', tier: 5, charges: 4 },
            389: { type: 'Hide', tier: 6, charges: 0 }, 394: { type: 'Hide', tier: 6, charges: 1 }, 399: { type: 'Hide', tier: 6, charges: 2 }, 404: { type: 'Hide', tier: 6, charges: 3 }, 409: { type: 'Hide', tier: 6, charges: 4 },
            390: { type: 'Hide', tier: 7, charges: 0 }, 395: { type: 'Hide', tier: 7, charges: 1 }, 400: { type: 'Hide', tier: 7, charges: 2 }, 405: { type: 'Hide', tier: 7, charges: 3 }, 410: { type: 'Hide', tier: 7, charges: 4 },
            391: { type: 'Hide', tier: 8, charges: 0 }, 396: { type: 'Hide', tier: 8, charges: 1 }, 401: { type: 'Hide', tier: 8, charges: 2 }, 406: { type: 'Hide', tier: 8, charges: 3 }, 411: { type: 'Hide', tier: 8, charges: 4 },

            // === ORE (T2-T8) ===
            357: { type: 'Ore', tier: 2, charges: 0 },
            358: { type: 'Ore', tier: 3, charges: 0 },
            359: { type: 'Ore', tier: 4, charges: 0 }, 364: { type: 'Ore', tier: 4, charges: 1 }, 369: { type: 'Ore', tier: 4, charges: 2 }, 374: { type: 'Ore', tier: 4, charges: 3 }, 379: { type: 'Ore', tier: 4, charges: 4 },
            360: { type: 'Ore', tier: 5, charges: 0 }, 365: { type: 'Ore', tier: 5, charges: 1 }, 370: { type: 'Ore', tier: 5, charges: 2 }, 375: { type: 'Ore', tier: 5, charges: 3 }, 380: { type: 'Ore', tier: 5, charges: 4 },
            361: { type: 'Ore', tier: 6, charges: 0 }, 366: { type: 'Ore', tier: 6, charges: 1 }, 371: { type: 'Ore', tier: 6, charges: 2 }, 376: { type: 'Ore', tier: 6, charges: 3 }, 381: { type: 'Ore', tier: 6, charges: 4 },
            362: { type: 'Ore', tier: 7, charges: 0 }, 367: { type: 'Ore', tier: 7, charges: 1 }, 372: { type: 'Ore', tier: 7, charges: 2 }, 377: { type: 'Ore', tier: 7, charges: 3 }, 382: { type: 'Ore', tier: 7, charges: 4 },
            363: { type: 'Ore', tier: 8, charges: 0 }, 368: { type: 'Ore', tier: 8, charges: 1 }, 373: { type: 'Ore', tier: 8, charges: 2 }, 378: { type: 'Ore', tier: 8, charges: 3 }, 383: { type: 'Ore', tier: 8, charges: 4 },

            // === ROCK (T2-T8) - Seulement .0-.3 (pas de .4) ===
            335: { type: 'Rock', tier: 2, charges: 0 },
            336: { type: 'Rock', tier: 3, charges: 0 },
            337: { type: 'Rock', tier: 4, charges: 0 }, 342: { type: 'Rock', tier: 4, charges: 1 }, 347: { type: 'Rock', tier: 4, charges: 2 }, 352: { type: 'Rock', tier: 4, charges: 3 },
            338: { type: 'Rock', tier: 5, charges: 0 }, 343: { type: 'Rock', tier: 5, charges: 1 }, 348: { type: 'Rock', tier: 5, charges: 2 }, 353: { type: 'Rock', tier: 5, charges: 3 },
            339: { type: 'Rock', tier: 6, charges: 0 }, 344: { type: 'Rock', tier: 6, charges: 1 }, 349: { type: 'Rock', tier: 6, charges: 2 }, 354: { type: 'Rock', tier: 6, charges: 3 },
            340: { type: 'Rock', tier: 7, charges: 0 }, 345: { type: 'Rock', tier: 7, charges: 1 }, 350: { type: 'Rock', tier: 7, charges: 2 }, 355: { type: 'Rock', tier: 7, charges: 3 },
            341: { type: 'Rock', tier: 8, charges: 0 }, 346: { type: 'Rock', tier: 8, charges: 1 }, 351: { type: 'Rock', tier: 8, charges: 2 }, 356: { type: 'Rock', tier: 8, charges: 3 },

            // === LOG/WOOD (T2-T8) ===
            307: { type: 'Log', tier: 2, charges: 0 },
            308: { type: 'Log', tier: 3, charges: 0 },
            309: { type: 'Log', tier: 4, charges: 0 }, 314: { type: 'Log', tier: 4, charges: 1 }, 319: { type: 'Log', tier: 4, charges: 2 }, 324: { type: 'Log', tier: 4, charges: 3 }, 329: { type: 'Log', tier: 4, charges: 4 },
            310: { type: 'Log', tier: 5, charges: 0 }, 315: { type: 'Log', tier: 5, charges: 1 }, 320: { type: 'Log', tier: 5, charges: 2 }, 325: { type: 'Log', tier: 5, charges: 3 }, 330: { type: 'Log', tier: 5, charges: 4 },
            311: { type: 'Log', tier: 6, charges: 0 }, 316: { type: 'Log', tier: 6, charges: 1 }, 321: { type: 'Log', tier: 6, charges: 2 }, 326: { type: 'Log', tier: 6, charges: 3 }, 331: { type: 'Log', tier: 6, charges: 4 },
            312: { type: 'Log', tier: 7, charges: 0 }, 317: { type: 'Log', tier: 7, charges: 1 }, 322: { type: 'Log', tier: 7, charges: 2 }, 327: { type: 'Log', tier: 7, charges: 3 }, 332: { type: 'Log', tier: 7, charges: 4 },
            313: { type: 'Log', tier: 8, charges: 0 }, 318: { type: 'Log', tier: 8, charges: 1 }, 323: { type: 'Log', tier: 8, charges: 2 }, 328: { type: 'Log', tier: 8, charges: 3 }, 333: { type: 'Log', tier: 8, charges: 4 },
        };

        return theoreticalMap[itemId] || null;
    }

    // 📊 Get current statistics
    getStats() {
        const sessionDuration = Math.floor((new Date() - this.stats.sessionStart) / 1000);
        return {
            ...this.stats,
            sessionDuration,
            currentlyVisible: this.harvestableList.length
        };
    }

    // 📊 Reset statistics
    resetStats() {
        this.stats.totalDetected = 0;
        this.stats.totalHarvested = 0;
        this.stats.sessionStart = new Date();

        Object.keys(this.stats.byType).forEach(type => {
            this.stats.byType[type] = { detected: 0, harvested: 0 };
        });

        Object.keys(this.stats.byTier).forEach(tier => {
            this.stats.byTier[tier] = { detected: 0, harvested: 0 };
        });

        // Reset enchantments (detected + harvested)
        Object.keys(this.stats.byEnchantment.detected).forEach(enchant => {
            this.stats.byEnchantment.detected[enchant] = 0;
        });
        Object.keys(this.stats.byEnchantment.harvested).forEach(enchant => {
            this.stats.byEnchantment.harvested[enchant] = 0;
        });
    }


    addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // 🔗 Cross-reference with MobsHandler BEFORE settings check (always register TypeID even if not displayed)
        if (this.mobsHandler && mobileTypeId !== null) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);

            // 🔧 OVERRIDE: Use mobinfo data instead of game typeNumber (fixes Albion server bugs)
            const staticInfo = this.mobsHandler.staticResourceTypeIDs.get(mobileTypeId);
            if (staticInfo && staticInfo.type) {
                // Convert our type name (Fiber/Hide/Log/Ore/Rock) to typeNumber
                const typeMap = {
                    'Fiber': 14,
                    'Hide': 20,
                    'Log': 3,
                    'Rock': 8,
                    'Ore': 25
                };

                if (typeMap[staticInfo.type]) {
                    type = typeMap[staticInfo.type]; // Override game typeNumber
                    tier = staticInfo.tier; // Use our tier too
                }
            }
        }

        // 🐛 DEBUG: Log Hide T4+ enchanted resources
        const stringType = this.GetStringType(type);
        if (stringType === HarvestableType.Hide && tier >= 4 && charges > 0) {
            console.log(`[DEBUG Hide T4+] ID=${id}, TypeID=${mobileTypeId}, type=${type}, tier=${tier}, enchant=${charges}, size=${size}, stringType=${stringType}`);
        }

        switch (stringType)
        {
            case HarvestableType.Fiber:
                if (!this.settings.harvestingStaticFiber[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Hide:
                // 🐛 DEBUG: Log settings check for Hide T4+
                if (tier >= 4 && charges > 0) {
                    const settingKey = `e${charges}`;
                    const settingIndex = tier - 1;
                    const settingValue = this.settings.harvestingStaticHide[settingKey] ? this.settings.harvestingStaticHide[settingKey][settingIndex] : undefined;
                    console.log(`[DEBUG Hide T4+ Settings] tier=${tier}, charges=${charges}, key=${settingKey}, index=${settingIndex}, value=${settingValue}, passed=${!!settingValue}`);
                }
                if (!this.settings.harvestingStaticHide[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Log:
                if (!this.settings.harvestingStaticWood[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Ore:
                if (!this.settings.harvestingStaticOre[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Rock:
                if (!this.settings.harvestingStaticRock[`e${charges}`][tier-1]) return;
                break;

            default:
                return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            const h = new Harvestable(id, type, tier, posX, posY, charges, size);
            this.harvestableList.push(h);

            // 📊 Update statistics
            this.updateStats(type, tier, charges, false);
            //console.log("New Harvestable: " + h.toString());
        }
        else // update
        {
            harvestable.setCharges(charges);
        }
    }

    UpdateHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // 🔗 Cross-reference with MobsHandler BEFORE settings check (always register TypeID even if not displayed)
        if (this.mobsHandler && mobileTypeId !== null) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);


            // 🔧 OVERRIDE: Use mobinfo data instead of game typeNumber (fixes Albion server bugs)
            const staticInfo = this.mobsHandler.staticResourceTypeIDs.get(mobileTypeId);
            if (staticInfo && staticInfo.type) {
                // Convert our type name (Fiber/Hide/Log/Ore/Rock) to typeNumber
                const typeMap = {
                    'Fiber': 14,
                    'Hide': 20,
                    'Log': 3,
                    'Rock': 8,
                    'Ore': 25
                };

                if (typeMap[staticInfo.type]) {
                    type = typeMap[staticInfo.type]; // Override game typeNumber
                    tier = staticInfo.tier; // Use our tier too
                }
            }
        }

        // 🐛 DEBUG: Log Hide T4+ enchanted resources
        const stringType = this.GetStringType(type);
        if (stringType === HarvestableType.Hide && tier >= 4 && charges > 0) {
            console.log(`[DEBUG Hide T4+ UPDATE] ID=${id}, TypeID=${mobileTypeId}, type=${type}, tier=${tier}, enchant=${charges}, size=${size}, stringType=${stringType}`);
        }

        switch (stringType)
        {
            case HarvestableType.Fiber:
                if (!this.settings.harvestingStaticFiber[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Hide:
                // 🐛 DEBUG: Log settings check for Hide T4+
                if (tier >= 4 && charges > 0) {
                    const settingKey = `e${charges}`;
                    const settingIndex = tier - 1;
                    const settingValue = this.settings.harvestingStaticHide[settingKey] ? this.settings.harvestingStaticHide[settingKey][settingIndex] : undefined;
                    console.log(`[DEBUG Hide T4+ UPDATE Settings] tier=${tier}, charges=${charges}, key=${settingKey}, index=${settingIndex}, value=${settingValue}, passed=${!!settingValue}`);
                }
                if (!this.settings.harvestingStaticHide[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Log:
                if (!this.settings.harvestingStaticWood[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Ore:
                if (!this.settings.harvestingStaticOre[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Rock:
                if (!this.settings.harvestingStaticRock[`e${charges}`][tier-1]) return;
                break;

            default:
                return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            this.addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId);
            return;
        }

        harvestable.charges = charges;
        harvestable.size = size;
    }

    harvestFinished(Parameters)
    {
        const id = Parameters[3];

        // ✅ NewSimpleItem s'occupe déjà du tracking des ressources exactes
        // On ne fait plus rien ici sauf décrémenter et reset les flags

        // Reset du pending harvestable et flag harvesting
        this.pendingHarvestableId = null;
        this.isHarvesting = false;

        // Décrémenter 1 stack
        this.updateHarvestable(id, 1);
    }

    HarvestUpdateEvent(Parameters)
    {
        const id = Parameters[0];

        if (Parameters[1] === undefined)
        {
            // 🔥 DERNIER STACK - Appelé AVANT harvestFinished!
            const cacheEntry = this.lastHarvestCache.get(id);

            if (cacheEntry) {
                const resources = cacheEntry.resources;

                // CAS 1: trackedByNewSimpleItem = true → Déjà tracké par NewSimpleItem (living resources)
                if (cacheEntry.trackedByNewSimpleItem) {
                    if (window.debugLogs) {
                        console.log('⏭️ [HarvestUpdateEvent] Already tracked by NewSimpleItem - SKIP');
                    }
                }
                // CAS 2: trackedByNewSimpleItem = false → Static harvestable, on doit tracker ici
                else {
                    // 🎯 Déduire type/tier depuis itemId
                    const resourceInfo = this.getResourceInfoFromItemId(cacheEntry.itemId);

                    if (resourceInfo) {
                        if (window.debugLogs) {
                            console.log(`✅ [HarvestUpdateEvent] Tracking ${resources} static resources:`, resourceInfo.type, `T${resourceInfo.tier}.${resourceInfo.charges}`);
                        }
                        // Tracker avec les vraies infos type/tier
                        this.updateStatsHarvested(resourceInfo.type, resourceInfo.tier, resourceInfo.charges, resources);
                    } else {
                        // Fallback: juste incrémenter le total si on ne peut pas mapper l'itemId
                        if (window.debugLogs) {
                            console.warn(`⚠️ [HarvestUpdateEvent] Unknown itemId ${cacheEntry.itemId} - tracking total only`);
                        }
                        this.stats.totalHarvested += resources;
                    }
                }

                // Nettoyer le cache
                this.lastHarvestCache.delete(id);
            } else {
                // Pas de cache du tout
                if (window.debugLogs) {
                    console.warn('⚠️ [HarvestUpdateEvent] NO CACHE! Resource tracking may be incomplete');
                }
            }

            // ⚠️ NE PAS supprimer ici! NewSimpleItem arrive APRÈS et a besoin du harvestable
            // La suppression sera faite par harvestFinished
            return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);
        if (!harvestable) {
            return;
        }

        // ⚠️ Ne pas mettre à jour si la valeur a diminué (harvestFinished s'en charge)
        // On met à jour uniquement si la valeur a augmenté (régénération)
        const newSize = Parameters[1];
        if (newSize > harvestable.size) {
            if (window.debugLogs) {
                console.log(`🔄 [Regen] ${harvestable.size} → ${newSize}`);
            }
            harvestable.size = newSize;
        }
    }

    // Normally work with everything
    // Good
    newHarvestableObject(id, Parameters) // Update
    {
        const type = Parameters[5];  // typeNumber (0-27)
        const mobileTypeId = Parameters[6];  // 🔗 Mobile TypeID (421, 422, 527, etc.)
        const tier = Parameters[7];
        const location = Parameters[8];

        let enchant = Parameters[11] === undefined ? 0 : Parameters[11];
        let size = Parameters[10] === undefined ? 0 : Parameters[10];


        this.UpdateHarvestable(id, type, tier, location[0], location[1], enchant, size, mobileTypeId);
    }

    base64ToArrayBuffer(base64)
    {
        var binaryString = atob(base64);
        var bytes = new Uint8Array(binaryString.length);

        for (var i = 0; i < binaryString.length; i++)
        {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes;
    }

    // Normally work with everything 
    // Good
    newSimpleHarvestableObject(Parameters) // New
    {
        let a0 = Parameters[0]["data"];
        if  (a0 === undefined)
        {
            a0 = Parameters[0];
        }

        if (a0.length === 0) return;

        const a1 = Parameters[1]["data"];
        const a2 = Parameters[2]["data"];
 
        const a3 = Parameters[3];
        const a4 = Parameters[4]["data"];

        for (let i = 0; i < a0.length; i++) {
            const id = a0[i];
            const type = a1[i];
            const tier = a2[i];
            const posX = a3[i * 2];
            const posY = a3[i * 2 + 1];
            const count = a4[i];

            this.addHarvestable(id, type, tier, posX, posY, 0, count);
        }
    }

    removeNotInRange(lpX, lpY)
    {
        this.harvestableList = this.harvestableList.filter(
            (x) => this.calculateDistance(lpX, lpY, x.posX, x.posY) <= 80
        );

        this.harvestableList = this.harvestableList.filter(item => item.size !== undefined);
    }

    calculateDistance(lpX, lpY, posX, posY)
    {
        const deltaX = lpX - posX;
        const deltaY = lpY - posY;

        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    removeHarvestable(id)
    {
        this.harvestableList = this.harvestableList.filter((x) => x.id !== id);
    }

    getHarvestableList() {
        return [...this.harvestableList];
    }

    updateHarvestable(harvestableId, count)
    {   
        const harvestable = this.harvestableList.find((h) => h.id === harvestableId);

        if (harvestable)
        {
            harvestable.size = harvestable.size - count;

            // 🔥 Remove harvestable when last stack is harvested
            if (harvestable.size <= 0) {
                this.removeHarvestable(harvestableId);
            }
        }
    }

    GetStringType(typeNumber)
    {
        // Si c'est déjà une string (depuis MobsHandler), retourner directement
        if (typeof typeNumber === 'string') {
            // Normaliser le nom
            const normalized = typeNumber.toLowerCase();
            if (normalized === 'fiber') return HarvestableType.Fiber;
            if (normalized === 'hide') return HarvestableType.Hide;
            if (normalized === 'wood' || normalized === 'log' || normalized === 'logs') return HarvestableType.Log;
            if (normalized === 'ore') return HarvestableType.Ore;
            if (normalized === 'rock') return HarvestableType.Rock;
            return typeNumber; // Retourner tel quel si inconnu
        }

        // Mapping typeNumber (0-27) → Resource Type
        if (typeNumber >= 0 && typeNumber <= 5)
        {
            return HarvestableType.Log;
        }
        else if (typeNumber >= 6 && typeNumber <= 10)
        {
            return HarvestableType.Rock;
        }
        else if (typeNumber >= 11 && typeNumber <= 15)
        {
            return HarvestableType.Fiber;
        }
        else if (typeNumber >= 16 && typeNumber <= 22)
        {
            return HarvestableType.Hide;
        }
        else if (typeNumber >= 23 && typeNumber <= 27)
        {
            return HarvestableType.Ore;
        }
        else {
            console.warn(`[GetStringType] Unknown typeNumber: ${typeNumber}`);
            return '';
        }
    }

    Clear()
    {
        this.harvestableList = [];
    }
}
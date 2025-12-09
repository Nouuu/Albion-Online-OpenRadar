import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import settingsSync from "../Utils/SettingsSync.js";
import {getResourceStorageKey} from "../Utils/ResourcesHelper.js";

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

export class HarvestablesHandler
{
    constructor(mobsHandler = null)
    {
        this.harvestableList = [];
        this.mobsHandler = mobsHandler;

        // 💾 Cache pour ressources
        this.lastHarvestCache = new Map();

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

    // Get resource info from itemId (for static harvestables)
    getResourceInfoFromItemId(itemId) {
        // Theoretical mapping itemId → resource info
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

            // === ROCK (T2-T8) - Only .0-.3 (no .4) ===
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

    /**
     * Helper method to check if a harvestable should be displayed based on settings
     * @param {string} stringType - Resource type (Fiber, Hide, Log, Ore, Rock)
     * @param {boolean} isLiving - Is living resource (vs static)
     * @param {number} tier - Resource tier (1-8)
     * @param {number} charges - Enchantment level (0-4)
     * @returns {boolean} - True if should be displayed
     */
    shouldDisplayHarvestable(stringType, isLiving, tier, charges) {
        // Map resource type to settings key suffix
        const settingsMap = {
            [HarvestableType.Fiber]: 'Fiber',
            [HarvestableType.Hide]: 'Hide',
            [HarvestableType.Log]: 'Wood',
            [HarvestableType.Ore]: 'Ore',
            [HarvestableType.Rock]: 'Rock'
        };

        const resourceType = settingsMap[stringType];
        if (!resourceType) return false;

        let prefix;
        if (resourceType === 'Fiber' || resourceType === 'fiber') prefix = 'fsp';
        else if (resourceType === 'Hide' || resourceType === 'hide') prefix = 'hsp';
        else if (resourceType === 'Wood' || resourceType === 'Logs') prefix = 'wsp';
        else if (resourceType === 'Ore' || resourceType === 'ore') prefix = 'osp';
        else if (resourceType === 'Rock' || resourceType === 'rock') prefix = 'rsp';

        let type = isLiving ? 'Living' : 'Static';

        const settingKey = getResourceStorageKey(prefix, type);

        return settingsSync.getJSON(settingKey)?.[`e${charges}`][tier - 1] === true;
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

        // DEBUG: Log ALL harvestable detections (living + static)
        const stringType = this.GetStringType(type);

        // Determine if living or static resource
        const isLiving = mobileTypeId === 65535;


        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Detection, {
            id,
            mobileTypeId,
            type,
            tier,
            enchant: charges,
            size,
            stringType,
            isLiving
        });

        // 🎯 Check if this harvestable should be displayed based on settings
        if (!this.shouldDisplayHarvestable(stringType, isLiving, tier, charges)) {
            return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            const h = new Harvestable(id, type, tier, posX, posY, charges, size);
            this.harvestableList.push(h);
        }
        else // update
        {
            harvestable.setCharges(charges);
        }
    }

    UpdateHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // Cross-reference with MobsHandler BEFORE settings check (always register TypeID even if not displayed)
        if (this.mobsHandler && mobileTypeId !== null) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);


            // OVERRIDE: Use mobinfo data instead of game typeNumber (fixes Albion server bugs)
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

        // DEBUG: Log ALL harvestable updates (living + static)
        const stringType = this.GetStringType(type);

        // Determine if living or static resource
        const isLiving = mobileTypeId === 65535;


        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Update, {
            id,
            mobileTypeId,
            type,
            tier,
            enchant: charges,
            size,
            stringType,
            isLiving
        });

        // 🎯 Check if this harvestable should be displayed based on settings
        if (!this.shouldDisplayHarvestable(stringType, isLiving, tier, charges)) {
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
        // Decrement 1 stack
        this.updateHarvestable(id, 1);
    }

    HarvestUpdateEvent(Parameters)
    {
        // Ultra-detailed debug: Log ALL parameters to identify patterns
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.HarvestUpdateEvent_ALL_PARAMS, {
            harvestableId: Parameters[0],
            charges: Parameters[1],
            typeId: Parameters[5],
            tier: Parameters[6],
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        const id = Parameters[0];

        if (Parameters[1] === undefined)
        {
            // LAST STACK - Called BEFORE harvestFinished!
            const cacheEntry = this.lastHarvestCache.get(id);

            if (cacheEntry) {
                const resources = cacheEntry.resources;

                // CASE 1: trackedByNewSimpleItem = true → Already tracked by NewSimpleItem (living resources)
                if (cacheEntry.trackedByNewSimpleItem) {
                    window.logger?.debug(CATEGORIES.HARVEST, EVENTS.AlreadyTracked, {
                        note: 'Already tracked by NewSimpleItem - SKIP'
                    });
                }
                // CASE 2: trackedByNewSimpleItem = false → Static harvestable, must track here
                else {
                    // Deduce type/tier from itemId
                    const resourceInfo = this.getResourceInfoFromItemId(cacheEntry.itemId);

                    if (resourceInfo) {
                        // INFO (always logged) - Tracking static resources
                        window.logger?.info(CATEGORIES.HARVEST, EVENTS.TrackingStaticResources, {
                            resources,
                            type: resourceInfo.type,
                            tier: resourceInfo.tier,
                            charges: resourceInfo.charges
                        });
                    } else {
                        // Fallback: just increment total if we can't map itemId
                        // WARN (always logged) - Unknown itemId
                        window.logger?.warn(CATEGORIES.HARVEST, EVENTS.UnknownItemId, {
                            itemId: cacheEntry.itemId,
                            note: 'Tracking total only'
                        });
                        this.stats.totalHarvested += resources;
                    }
                }

                // Nettoyer le cache
                this.lastHarvestCache.delete(id);
            } else {
                // No cache at all
                // WARN (always logged) - No cache available
                window.logger?.warn(CATEGORIES.HARVEST, EVENTS.NoCacheWarning, {
                    note: 'NO CACHE! Resource tracking may be incomplete'
                });
            }

            // DO NOT delete here! NewSimpleItem arrives AFTER and needs the harvestable
            // Deletion will be done by harvestFinished
            return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);
        if (!harvestable) {
            return;
        }

        // Do not update if value decreased (harvestFinished handles this)
        // Only update if value increased (regeneration)
        const newSize = Parameters[1];
        if (newSize > harvestable.size) {
            window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Regeneration, {
                oldSize: harvestable.size,
                newSize
            });
            harvestable.size = newSize;
        }
    }

    // Normally work with everything
    // Good
    newHarvestableObject(id, Parameters) // Update
    {

        const type = Parameters[5];  // typeNumber (0-27)
        const mobileTypeId = Parameters[6];  // Mobile TypeID (421, 422, 527, etc.)
        const tier = Parameters[7];
        const location = Parameters[8];

        let enchant = Parameters[11] === undefined ? 0 : Parameters[11];
        let size = Parameters[10] === undefined ? 0 : Parameters[10];


        this.UpdateHarvestable(id, type, tier, location[0], location[1], enchant, size, mobileTypeId);
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

            // Remove harvestable when last stack is harvested
            if (harvestable.size <= 0) {
                this.removeHarvestable(harvestableId);
            }
        }
    }

    GetStringType(typeNumber)
    {
        // If already a string (from MobsHandler), return directly
        if (typeof typeNumber === 'string') {
            // Normalize the name
            const normalized = typeNumber.toLowerCase();
            if (normalized === 'fiber') return HarvestableType.Fiber;
            if (normalized === 'hide') return HarvestableType.Hide;
            if (normalized === 'wood' || normalized === 'log' || normalized === 'logs') return HarvestableType.Log;
            if (normalized === 'ore') return HarvestableType.Ore;
            if (normalized === 'rock') return HarvestableType.Rock;
            return typeNumber; // Return as-is if unknown
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
            // WARN (always logged) - Unknown resource type
            window.logger?.warn(CATEGORIES.HARVEST, EVENTS.UnknownTypeNumber, {
                typeNumber,
                note: 'Unknown typeNumber in GetStringType'
            });
            return '';
        }
    }

    Clear()
    {
        this.harvestableList = [];
    }
}
import {CATEGORIES} from "../constants/LoggerConstants.js";
import {isMobOrigin} from "../utils/LivingResourceFilter.js";

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
    constructor(id, position, tier, posX, posY, rareState, chargeLevel, stringType = null, mobileTypeId = null)
    {
        this.id = id;
        this.position = position;
        this.tier = tier;
        this.posX = posX;
        this.posY = posY;
        this.hX = 0;
        this.hY = 0;

        this.rareState = rareState;
        this.chargeLevel = chargeLevel;
        this.stringType = stringType;
        this.mobileTypeId = mobileTypeId;
        this.lastUpdateTime = Date.now();

        window.logger?.info(CATEGORIES.HARVESTABLES, 'HarvestableCreated', {
            id, position, stringType, tier, rareState, chargeLevel, mobileTypeId,
            note: 'New Harvestable object created'
        });
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class HarvestablesHandler
{
    constructor(mobsHandler = null)
    {
        this.harvestableList = [];
        this.mobsHandler = mobsHandler;

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

    addHarvestable(id, position, tier, posX, posY, rareState, chargeLevel, mobileTypeId = null)
    {
        // Determine resource type: living (animals/creatures) vs static.
        // - mobileTypeId === 65535 or -1 : STATIC (both are int16 decodes of 0xFFFF).
        // - mobileTypeId === null        : STATIC from Event 38 batch spawn.
        // - mobileTypeId === real TypeID : LIVING creature.
        const isLiving = isMobOrigin(mobileTypeId);

        // Get resource type string
        // Living resources: use MobsDatabase (typeNumber is WRONG for living!)
        // Static resources: use HarvestablesDatabase based on typeNumber
        let stringType;
        if (isLiving && window.mobsDatabase?.isLoaded) {
            const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
            stringType = resourceInfo?.type || this.GetStringType(position);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'LivingResource_TypeFromMobsDB', {
                id, mobileTypeId, position,
                mobsDbType: resourceInfo?.type,
                fallbackType: this.GetStringType(position),
                finalStringType: stringType
            });
        } else {
            stringType = this.GetStringType(position);
        }

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(position, tier, rareState)
            : null;

        window.logger?.debug(CATEGORIES.HARVESTABLES, 'detection', {
            id,
            mobileTypeId,
            position,
            tier,
            rareState,
            chargeLevel,
            stringType,
            isLiving,
            databaseLoaded: window.harvestablesDatabase?.isLoaded ?? false,
            databaseValid: databaseValidation
        });

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            const h = new Harvestable(id, position, tier, posX, posY, rareState, chargeLevel, stringType, mobileTypeId);
            this.harvestableList.push(h);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'HarvestableAdded', {
                id, position, stringType, tier, rareState, chargeLevel, mobileTypeId,
                listSize: this.harvestableList.length
            });
        }
        else // update
        {
            harvestable.rareState = rareState;
            harvestable.touch();
            if (stringType) harvestable.stringType = stringType;

            window.logger?.debug(CATEGORIES.HARVESTABLES, 'HarvestableUpdated', {
                id, stringType, newRareState: rareState
            });
        }
    }

    UpdateHarvestable(id, position, tier, posX, posY, rareState, chargeLevel, mobileTypeId = null)
    {
        const isLiving = isMobOrigin(mobileTypeId);

        // Get resource type string
        // Living resources: use MobsDatabase (typeNumber is WRONG for living!)
        // Static resources: use HarvestablesDatabase based on typeNumber
        let stringType;
        if (isLiving && window.mobsDatabase?.isLoaded) {
            const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
            stringType = resourceInfo?.type || this.GetStringType(position);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'UpdateHarvestable_LivingResource_TypeFromMobsDB', {
                id, mobileTypeId, position,
                mobsDbType: resourceInfo?.type,
                fallbackType: this.GetStringType(position),
                finalStringType: stringType
            });
        } else {
            stringType = this.GetStringType(position);
        }

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(position, tier, rareState)
            : null;

        window.logger?.debug(CATEGORIES.HARVESTABLES, 'update', {
            id,
            mobileTypeId,
            position,
            tier,
            rareState,
            chargeLevel,
            stringType,
            isLiving,
            databaseLoaded: window.harvestablesDatabase?.isLoaded ?? false,
            databaseValid: databaseValidation
        });

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            this.addHarvestable(id, position, tier, posX, posY, rareState, chargeLevel, mobileTypeId);
            return;
        }

        window.logger?.info(CATEGORIES.HARVESTABLES, 'UpdateHarvestable_Existing', {
            id,
            oldRareState: harvestable.rareState,
            newRareState: rareState,
            oldChargeLevel: harvestable.chargeLevel,
            newChargeLevel: chargeLevel,
            stringType: harvestable.stringType
        });

        harvestable.rareState = rareState;
        harvestable.chargeLevel = chargeLevel;
        if (stringType) harvestable.stringType = stringType;
    }

    harvestFinished(Parameters)
    {
        // Event 61 is just a notification - Event 46 handles size changes
        const id = Parameters[3];
        window.logger?.debug(CATEGORIES.HARVESTABLES, 'Event61_HarvestFinished', {id});
    }

    HarvestUpdateEvent(Parameters) // Event 46 - HarvestableChangeState
    {
        const id = Parameters[0];
        const newChargeLevel = Parameters[1];
        const rareState = Parameters[2];

        window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_ChangeState', {
            harvestableId: id,
            newChargeLevel,
            rareState
        });

        // newSize undefined = resource depleted, remove it
        if (newChargeLevel === undefined) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_ResourceDepleted', {id});
            this.removeHarvestable(id);
            return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);
        if (!harvestable) {
            return;
        }

        harvestable.touch();

        // Event 46 is the source of truth - accept ALL size changes
        if (newChargeLevel !== harvestable.chargeLevel) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_SizeUpdate', {
                id,
                oldChargeLevel: harvestable.chargeLevel,
                newChargeLevel,
                delta: newChargeLevel - harvestable.chargeLevel
            });
            harvestable.chargeLevel = newChargeLevel;
        }

        // Update enchantment if provided and different (filter applied at render, not here)
        if (rareState !== undefined && rareState !== harvestable.rareState) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_EnchantmentUpdate', {
                id,
                oldRareState: harvestable.rareState,
                newRareState: rareState
            });
            harvestable.rareState = rareState;
        }
    }

    // Normally work with everything
    // Good
    newHarvestableObject(id, Parameters) // Update (Event 40 - Individual spawn)
    {

        const position = Parameters[5];  // typeNumber (0-27)
        const mobileTypeId = Parameters[6];  // Mobile TypeID (421, 422, 527, etc.)
        const tier = Parameters[7];
        const location = Parameters[8];

        let rareState = Parameters[11] === undefined ? 0 : Parameters[11];
        let chargeLevel = Parameters[10] === undefined ? 0 : Parameters[10];

        // 🔍 Log ALL parameters for comparison with Event38
        const allParams40 = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams40[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.info(CATEGORIES.HARVESTABLES, 'Event40_IndividualSpawn_FULL', {
            id,
            position,
            tier,
            rareState,
            chargeLevel,
            mobileTypeId,
            isLiving: isMobOrigin(mobileTypeId),
            allParametersKeys: Object.keys(Parameters),
            allParameters: allParams40
        });

        const isCritterCorpse = isMobOrigin(mobileTypeId);
        if (isCritterCorpse) {
            const dbInfo = window.mobsDatabase?.getMobInfo(mobileTypeId);
            window.logger?.info(CATEGORIES.HARVESTABLES, 'CritterCorpseTierAudit', {
                mobileTypeId,
                serverTier: tier,
                dbCombatTier: dbInfo?.combatTier ?? null,
                dbLootTier: dbInfo?.tier ?? null,
                dbUniqueName: dbInfo?.uniqueName ?? null,
                dbLootType: dbInfo?.lootType ?? null,
                tierDelta: dbInfo ? (tier - (dbInfo.combatTier ?? 0)) : null
            });
        }

        this.UpdateHarvestable(id, position, tier, location[0], location[1], rareState, chargeLevel, mobileTypeId);
    }

    // Normally work with everything
    // Good
    newSimpleHarvestableObject(Parameters) // New (Event 38 - Batch spawn)
    {
        // Validate required parameters exist
        if (!Parameters[0] || !Parameters[1] || !Parameters[2] || !Parameters[3] || !Parameters[4]) {
            window.logger?.warn(CATEGORIES.HARVESTABLES, 'Event38_MissingParams', {
                has0: !!Parameters[0],
                has1: !!Parameters[1],
                has2: !!Parameters[2],
                has3: !!Parameters[3],
                has4: !!Parameters[4]
            });
            return;
        }

        let a0 = Parameters[0]["data"] ?? Parameters[0];
        if (!Array.isArray(a0) || a0.length === 0) return;

        const a1 = Parameters[1]["data"] ?? Parameters[1];
        const a2 = Parameters[2]["data"] ?? Parameters[2];

        const a3 = Parameters[3];
        const a4 = Parameters[4]["data"] ?? Parameters[4];

        // Validate arrays
        if (!Array.isArray(a1) || !Array.isArray(a2) || !Array.isArray(a4)) {
            window.logger?.warn(CATEGORIES.HARVESTABLES, 'Event38_InvalidArrays', {
                a1IsArray: Array.isArray(a1),
                a2IsArray: Array.isArray(a2),
                a4IsArray: Array.isArray(a4)
            });
            return;
        }

        window.logger?.info(CATEGORIES.HARVESTABLES, 'Event38_BatchSpawn', {
            count: a0.length,
            note: 'Resources created with enchant=0 (temporary), Event 46 will update enchantments'
        });

        for (let i = 0; i < a0.length; i++) {
            const id = a0[i];
            const position = a1[i];
            const tier = a2[i];
            const posX = a3[i * 2];
            const posY = a3[i * 2 + 1];
            const chargeLevel = a4[i];

            // 🔍 Event 38 does NOT send enchantment
            // Resources created with enchant=0, Event 46 (HarvestUpdateEvent) will update it
            const rareState = 0;

            this.addHarvestable(id, position, tier, posX, posY, rareState, chargeLevel);
        }
    }

    removeNotInRange(lpX, lpY)
    {
        this.harvestableList = this.harvestableList.filter(
            (x) => this.calculateDistance(lpX, lpY, x.posX, x.posY) <= 80
        );

        this.harvestableList = this.harvestableList.filter(item => item.chargeLevel !== undefined);
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
            harvestable.chargeLevel = harvestable.chargeLevel - count;

            // Remove harvestable when last stack is harvested
            if (harvestable.chargeLevel <= 0) {
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

        // 🔍 Phase 4: Use database (REQUIRED - no fallback)
        if (!window.harvestablesDatabase?.isLoaded) {
            // Database not loaded - use fallback
            window.logger?.warn(CATEGORIES.HARVESTABLES, 'DatabaseNotLoaded', {
                typeNumber,
                note: 'HarvestablesDatabase not loaded - cannot determine resource type'
            });
            return '';
        }

        const resourceType = window.harvestablesDatabase.getResourceTypeFromTypeNumber(typeNumber);
        if (!resourceType) {
            // typeNumber not found in database
            window.logger?.warn(CATEGORIES.HARVESTABLES, 'unknown_type_number', {
                typeNumber,
                note: 'TypeNumber not found in HarvestablesDatabase'
            });
            return '';
        }

        // Convert database format (WOOD, ROCK, etc.) to HarvestableType
        const typeMap = {
            'WOOD': HarvestableType.Log,
            'ROCK': HarvestableType.Rock,
            'FIBER': HarvestableType.Fiber,
            'HIDE': HarvestableType.Hide,
            'ORE': HarvestableType.Ore
        };

        const mappedType = typeMap[resourceType];
        if (!mappedType) {
            // Unknown resource type from database
            window.logger?.warn(CATEGORIES.HARVESTABLES, 'UnknownResourceType', {
                typeNumber,
                resourceType,
                note: 'Database returned unknown resource type'
            });
            return '';
        }

        return mappedType;
    }

    /**
     * 🔍 Phase 4: Helper to convert HarvestableType string to typeNumber for database validation
     * @param {string} stringType - HarvestableType (Fiber, Hide, Log, Ore, Rock)
     * @returns {number|null} - typeNumber (0-27) or null if unknown
     * @private
     */
    _getTypeNumberFromString(stringType) {
        // Map HarvestableType to mid-range typeNumber for each category
        const typeMap = {
            [HarvestableType.Log]: 3,    // Wood mid-range (0-5)
            [HarvestableType.Rock]: 8,   // Rock mid-range (6-10)
            [HarvestableType.Fiber]: 13, // Fiber mid-range (11-15)
            [HarvestableType.Hide]: 19,  // Hide mid-range (16-22)
            [HarvestableType.Ore]: 25    // Ore mid-range (23-27)
        };
        return typeMap[stringType] ?? null;
    }

    Clear()
    {
        this.harvestableList = [];
    }

    /**
     * Remove entities not updated for a given time period
     * @param {number} maxAgeMs - Maximum age in milliseconds (default: 2 minutes)
     * @returns {number} - Number of entities removed
     */
    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.harvestableList.length;

        this.harvestableList = this.harvestableList.filter(entity =>
            (now - entity.lastUpdateTime) < maxAgeMs
        );

        const removed = before - this.harvestableList.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.HARVESTABLES, 'cleanup', {removed, maxAgeMs});
        }
        return removed;
    }

    /**
     * Enforce maximum list size by removing oldest entries
     * @param {number} maxSize - Maximum number of entities (default: 1000)
     * @returns {number} - Number of entities removed
     */
    enforceMaxSize(maxSize = 1000) {
        if (this.harvestableList.length <= maxSize) return 0;

        // Sort by lastUpdateTime (oldest first) and keep newest
        this.harvestableList.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
        const removed = this.harvestableList.length - maxSize;
        this.harvestableList = this.harvestableList.slice(0, maxSize);

        window.logger?.debug(CATEGORIES.HARVESTABLES, 'max_size_enforced', {removed});
        return removed;
    }

    /**
     * Get current list size for monitoring
     * @returns {number}
     */
    getSize() {
        return this.harvestableList.length;
    }
}
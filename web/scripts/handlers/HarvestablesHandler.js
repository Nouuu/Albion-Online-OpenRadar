import {CATEGORIES} from "../constants/LoggerConstants.js";

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
    constructor(id, type, tier, posX, posY, charges, size, stringType = null, mobileTypeId = null)
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
        this.stringType = stringType;
        this.mobileTypeId = mobileTypeId;
        this.lastUpdateTime = Date.now();

        window.logger?.info(CATEGORIES.HARVESTABLES, 'HarvestableCreated', {
            id, type, stringType, tier, charges, size, mobileTypeId,
            note: 'New Harvestable object created'
        });
    }

    setCharges(charges)
    {
        this.charges = charges;
        this.lastUpdateTime = Date.now();
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

    addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // Determine resource type: living (animals/creatures) vs static.
        // - mobileTypeId === 65535 or -1 : STATIC (both are int16 decodes of 0xFFFF).
        // - mobileTypeId === null        : STATIC from Event 38 batch spawn.
        // - mobileTypeId === real TypeID : LIVING creature.
        const isLiving = mobileTypeId !== null && mobileTypeId !== 65535 && mobileTypeId !== -1;

        // Get resource type string
        // Living resources: use MobsDatabase (typeNumber is WRONG for living!)
        // Static resources: use HarvestablesDatabase based on typeNumber
        let stringType;
        if (isLiving && window.mobsDatabase?.isLoaded) {
            const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
            stringType = resourceInfo?.type || this.GetStringType(type);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'LivingResource_TypeFromMobsDB', {
                id, mobileTypeId, type,
                mobsDbType: resourceInfo?.type,
                fallbackType: this.GetStringType(type),
                finalStringType: stringType
            });
        } else {
            stringType = this.GetStringType(type);
        }

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(type, tier, charges)
            : null;

        window.logger?.debug(CATEGORIES.HARVESTABLES, 'detection', {
            id,
            mobileTypeId,
            type,
            tier,
            enchant: charges,
            size,
            stringType,
            isLiving,
            databaseLoaded: window.harvestablesDatabase?.isLoaded ?? false,
            databaseValid: databaseValidation
        });

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            const h = new Harvestable(id, type, tier, posX, posY, charges, size, stringType, mobileTypeId);
            this.harvestableList.push(h);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'HarvestableAdded', {
                id, type, stringType, tier, charges, size, mobileTypeId,
                listSize: this.harvestableList.length
            });
        }
        else // update
        {
            harvestable.setCharges(charges);
            if (stringType) harvestable.stringType = stringType;

            window.logger?.debug(CATEGORIES.HARVESTABLES, 'HarvestableUpdated', {
                id, stringType, newCharges: charges
            });
        }
    }

    UpdateHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        const isLiving = mobileTypeId !== null && mobileTypeId !== 65535 && mobileTypeId !== -1;

        // Get resource type string
        // Living resources: use MobsDatabase (typeNumber is WRONG for living!)
        // Static resources: use HarvestablesDatabase based on typeNumber
        let stringType;
        if (isLiving && window.mobsDatabase?.isLoaded) {
            const resourceInfo = window.mobsDatabase.getResourceInfo(mobileTypeId);
            stringType = resourceInfo?.type || this.GetStringType(type);

            window.logger?.info(CATEGORIES.HARVESTABLES, 'UpdateHarvestable_LivingResource_TypeFromMobsDB', {
                id, mobileTypeId, type,
                mobsDbType: resourceInfo?.type,
                fallbackType: this.GetStringType(type),
                finalStringType: stringType
            });
        } else {
            stringType = this.GetStringType(type);
        }

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(type, tier, charges)
            : null;

        window.logger?.debug(CATEGORIES.HARVESTABLES, 'update', {
            id,
            mobileTypeId,
            type,
            tier,
            enchant: charges,
            size,
            stringType,
            isLiving,
            databaseLoaded: window.harvestablesDatabase?.isLoaded ?? false,
            databaseValid: databaseValidation
        });

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            this.addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId);
            return;
        }

        window.logger?.info(CATEGORIES.HARVESTABLES, 'UpdateHarvestable_Existing', {
            id,
            oldCharges: harvestable.charges,
            newCharges: charges,
            oldSize: harvestable.size,
            newSize: size,
            stringType: harvestable.stringType
        });

        harvestable.charges = charges;
        harvestable.size = size;
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
        const newSize = Parameters[1];
        const enchant = Parameters[2];

        window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_ChangeState', {
            harvestableId: id,
            newSize,
            enchant
        });

        // newSize undefined = resource depleted, remove it
        if (newSize === undefined) {
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
        if (newSize !== harvestable.size) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_SizeUpdate', {
                id,
                oldSize: harvestable.size,
                newSize,
                delta: newSize - harvestable.size
            });
            harvestable.size = newSize;
        }

        // Update enchantment if provided and different (filter applied at render, not here)
        if (enchant !== undefined && enchant !== harvestable.charges) {
            window.logger?.info(CATEGORIES.HARVESTABLES, 'Event46_EnchantmentUpdate', {
                id,
                oldEnchant: harvestable.charges,
                newEnchant: enchant
            });
            harvestable.charges = enchant;
        }
    }

    // Normally work with everything
    // Good
    newHarvestableObject(id, Parameters) // Update (Event 40 - Individual spawn)
    {

        const type = Parameters[5];  // typeNumber (0-27)
        const mobileTypeId = Parameters[6];  // Mobile TypeID (421, 422, 527, etc.)
        const tier = Parameters[7];
        const location = Parameters[8];

        let enchant = Parameters[11] === undefined ? 0 : Parameters[11];
        let size = Parameters[10] === undefined ? 0 : Parameters[10];

        // 🔍 Log ALL parameters for comparison with Event38
        const allParams40 = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams40[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.info(CATEGORIES.HARVESTABLES, 'Event40_IndividualSpawn_FULL', {
            id,
            type,
            tier,
            enchant,
            size,
            mobileTypeId,
            isLiving: mobileTypeId !== null && mobileTypeId !== 65535 && mobileTypeId !== -1,
            allParametersKeys: Object.keys(Parameters),
            allParameters: allParams40
        });

        const isCritterCorpse = mobileTypeId !== null
            && mobileTypeId !== 65535
            && mobileTypeId !== -1
            && mobileTypeId !== undefined;
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

        this.UpdateHarvestable(id, type, tier, location[0], location[1], enchant, size, mobileTypeId);
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
            const type = a1[i];
            const tier = a2[i];
            const posX = a3[i * 2];
            const posY = a3[i * 2 + 1];
            const count = a4[i];

            // 🔍 Event 38 does NOT send enchantment
            // Resources created with enchant=0, Event 46 (HarvestUpdateEvent) will update it
            const enchant = 0;

            this.addHarvestable(id, type, tier, posX, posY, enchant, count);
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
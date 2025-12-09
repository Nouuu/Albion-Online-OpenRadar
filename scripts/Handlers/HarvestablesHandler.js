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

        // 🔍 Phase 4: Validate with HarvestablesDatabase if available
        if (window.harvestablesDatabase?.isLoaded) {
            // Convert HarvestableType to database resource type (WOOD, ROCK, etc.)
            const resourceTypeMap = {
                [HarvestableType.Log]: 'WOOD',
                [HarvestableType.Rock]: 'ROCK',
                [HarvestableType.Fiber]: 'FIBER',
                [HarvestableType.Hide]: 'HIDE',
                [HarvestableType.Ore]: 'ORE'
            };

            const dbResourceType = resourceTypeMap[stringType];
            if (dbResourceType) {
                const isValid = window.harvestablesDatabase.isValidResource(dbResourceType, tier, charges);

                // 🔍 DETAILED DEBUG: Log ALL validation checks
                window.logger?.debug(CATEGORIES.HARVEST, 'ValidationCheck', {
                    stringType,
                    dbResourceType,
                    tier,
                    enchant: charges,
                    isLiving,
                    isValid,
                    validationKey: `${dbResourceType}-${tier}-${charges}`,
                    note: isValid ? 'OK' : 'FILTERED - Not in database'
                });

                if (!isValid) {
                    window.logger?.warn(CATEGORIES.HARVEST, 'InvalidResourceCombination', {
                        stringType,
                        dbResourceType,
                        tier,
                        enchant: charges,
                        isLiving,
                        validationKey: `${dbResourceType}-${tier}-${charges}`,
                        note: 'Not found in harvestables.json - RESOURCE FILTERED'
                    });
                    return false; // Don't display invalid resources
                }
            }
        }

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
        // 🔗 Register static TypeIDs in MobsHandler for analytics (no override)
        if (this.mobsHandler && mobileTypeId !== null && mobileTypeId !== 65535) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);
        }

        // 🔍 Determine resource type: living (animals/creatures) vs static
        // CORRECTED LOGIC (2025-12-09):
        // - mobileTypeId === 65535 → STATIC enchanted resource (no creature, just a node)
        // - mobileTypeId === null → STATIC resource from Event 38 (batch spawn)
        // - mobileTypeId === real TypeID (425, 530, etc.) → LIVING creature (animal that drops resource)
        const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;

        // 🎨 Get resource type string from typeNumber (0-27)
        const stringType = this.GetStringType(type);

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(type, tier, charges)
            : null;

        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Detection, {
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

        // 🎯 Check if this harvestable should be displayed based on settings
        if (!this.shouldDisplayHarvestable(stringType, isLiving, tier, charges)) {
            window.logger?.debug(CATEGORIES.HARVEST, 'FilteredBySettings', {
                id,
                stringType,
                tier,
                enchant: charges,
                isLiving,
                reason: 'settings_disabled_or_invalid_resource'
            });
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
        // 🔗 Register static TypeIDs in MobsHandler for analytics (no override)
        if (this.mobsHandler && mobileTypeId !== null && mobileTypeId !== 65535) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);
        }

        // 🔍 Determine resource type: living (animals/creatures) vs static
        // CORRECTED LOGIC (2025-12-09):
        // - mobileTypeId === 65535 → STATIC enchanted resource (no creature, just a node)
        // - mobileTypeId === null → STATIC resource from Event 38 (batch spawn)
        // - mobileTypeId === real TypeID (425, 530, etc.) → LIVING creature (animal that drops resource)
        const isLiving = mobileTypeId !== null && mobileTypeId !== 65535;

        // 🎨 Get resource type string from typeNumber (0-27)
        const stringType = this.GetStringType(type);

        // 🔍 Phase 4: Check validation with database
        const databaseValidation = window.harvestablesDatabase?.isLoaded
            ? window.harvestablesDatabase.isValidResourceByTypeNumber(type, tier, charges)
            : null;

        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Update, {
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

        // 🎯 Check if this harvestable should be displayed based on settings
        if (!this.shouldDisplayHarvestable(stringType, isLiving, tier, charges)) {
            window.logger?.debug(CATEGORIES.HARVEST, 'FilteredByUpdate', {
                id,
                stringType,
                tier,
                enchant: charges,
                isLiving,
                reason: 'settings_disabled_or_invalid_resource'
            });
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

    HarvestUpdateEvent(Parameters) // Event 46 - HarvestableChangeState
    {
        // Ultra-detailed debug: Log ALL parameters to identify patterns
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }

        const id = Parameters[0];
        const newSize = Parameters[1];
        const enchant = Parameters[2]; // 🔍 ENCHANTMENT / CHARGE

        window.logger?.info(CATEGORIES.HARVEST, 'Event46_ChangeState_FULL', {
            harvestableId: id,
            newSize,
            enchant,
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        if (newSize === undefined)
        {
            // 🔥 DERNIER STACK - Appelé AVANT harvestFinished!
            return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);
        if (!harvestable) {
            window.logger?.warn(CATEGORIES.HARVEST, 'Event46_ResourceNotFound', {
                id,
                note: 'Harvestable not found in list - maybe filtered by settings'
            });
            return;
        }

        // 🔍 Update size if increased (regeneration)
        if (newSize > harvestable.size) {
            window.logger?.debug(CATEGORIES.HARVEST, EVENTS.Regeneration, {
                id,
                oldSize: harvestable.size,
                newSize
            });
            harvestable.size = newSize;
        }

        // 🔍 Update enchantment if provided and different
        if (enchant !== undefined && enchant !== harvestable.charges) {
            window.logger?.info(CATEGORIES.HARVEST, 'EnchantmentUpdate', {
                id,
                oldEnchant: harvestable.charges,
                newEnchant: enchant,
                tier: harvestable.tier,
                type: harvestable.type,
                note: 'Enchantment updated from Event 46'
            });
            harvestable.charges = enchant;

            // ⚠️ Re-check if should be displayed with new enchantment
            const stringType = this.GetStringType(harvestable.type);
            const isLiving = false; // Event 46 is for static resources

            if (!this.shouldDisplayHarvestable(stringType, isLiving, harvestable.tier, enchant)) {
                window.logger?.warn(CATEGORIES.HARVEST, 'EnchantmentUpdate_Filtered', {
                    id,
                    stringType,
                    tier: harvestable.tier,
                    enchant,
                    note: 'Resource now filtered after enchantment update'
                });
                // Remove from list if settings don't allow this enchantment
                this.removeHarvestable(id);
            }
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

        window.logger?.info(CATEGORIES.HARVEST, 'Event40_IndividualSpawn_FULL', {
            id,
            type,
            tier,
            enchant,
            size,
            mobileTypeId,
            // CORRECTED: 65535 = static, real TypeID = living
            isLiving: mobileTypeId !== null && mobileTypeId !== 65535,
            allParametersKeys: Object.keys(Parameters),
            allParameters: allParams40
        });

        this.UpdateHarvestable(id, type, tier, location[0], location[1], enchant, size, mobileTypeId);
    }

    // Normally work with everything
    // Good
    newSimpleHarvestableObject(Parameters) // New (Event 38 - Batch spawn)
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

        window.logger?.info(CATEGORIES.HARVEST, 'Event38_BatchSpawn', {
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
            // ❌ ERROR: Database not loaded!
            window.logger?.error(CATEGORIES.HARVEST, 'DatabaseNotLoaded', {
                typeNumber,
                note: 'HarvestablesDatabase not loaded - cannot determine resource type'
            });
            return '';
        }

        const resourceType = window.harvestablesDatabase.getResourceTypeFromTypeNumber(typeNumber);
        if (!resourceType) {
            // ❌ ERROR: typeNumber not found in database
            window.logger?.error(CATEGORIES.HARVEST, EVENTS.UnknownTypeNumber, {
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
            // ❌ ERROR: Unknown resource type from database
            window.logger?.error(CATEGORIES.HARVEST, 'UnknownResourceType', {
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
}
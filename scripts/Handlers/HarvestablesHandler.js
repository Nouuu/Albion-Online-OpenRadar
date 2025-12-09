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

        // 🔍 Determine resource type: living (animals) vs static
        // - mobileTypeId === 65535 → Living resources (animals: Hide)
        // - mobileTypeId === null → Static resources from Event 38 (batch spawn)
        // - mobileTypeId === other → Static resources from Event 40 with TypeID
        const isLiving = mobileTypeId === 65535;

        // 🎨 Get resource type string from typeNumber (0-27)
        const stringType = this.GetStringType(type);

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
        // 🔗 Register static TypeIDs in MobsHandler for analytics (no override)
        if (this.mobsHandler && mobileTypeId !== null && mobileTypeId !== 65535) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);
        }

        // 🔍 Determine resource type: living (animals) vs static
        const isLiving = mobileTypeId === 65535;

        // 🎨 Get resource type string from typeNumber (0-27)
        const stringType = this.GetStringType(type);

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
            // 🔥 DERNIER STACK - Appelé AVANT harvestFinished!
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
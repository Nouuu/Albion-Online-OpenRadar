/**
 * Mobs Database - Phase 5
 * Parses mobs.json and provides living resource type identification
 * Follows the same pattern as HarvestablesDatabase
 *
 * OBJECTIF: Remplacer MobsInfo.js (235 TypeIDs hardcodés) par cette database
 *
 * Structure mobs.json:
 * {
 *   "Mobs": {
 *     "Mob": [
 *       {
 *         "@uniquename": "KEEPCRITTER_FOREST_SWAMP_GREEN_HIDE",
 *         "@tier": "4",
 *         "Loot": {
 *           "Harvestable": { "@type": "HIDE", "@tier": "4" }
 *         }
 *       }
 *     ]
 *   }
 * }
 */

import { CATEGORIES } from '../constants/LoggerConstants.js';

export class MobsDatabase {
    constructor() {
        /**
         * Map<typeId, {type: string, tier: number, uniqueName: string, category: string}>
         * typeId = index dans le tableau des mobs (comme DeathEye)
         */
        this.mobsById = new Map();

        /**
         * Map<uniqueName, typeId>
         * Pour lookup inverse par nom
         */
        this.mobsByName = new Map();

        /**
         * Set des typeIds qui sont des ressources (ont Loot.Harvestable)
         */
        this.harvestableTypeIds = new Set();

        this.isLoaded = false;
        this.stats = {
            totalMobs: 0,
            harvestables: 0,
            loadTimeMs: 0
        };
    }

    /**
     * Load and parse mobs.json
     * @param {string} jsonPath - Path to mobs.json file
     */
    async load(jsonPath) {
        const startTime = performance.now();

        try {
            window.logger?.info(
                CATEGORIES.ITEM_DATABASE,
                'MobsDatabaseLoading',
                { path: jsonPath }
            );

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch mobs.json: ${response.status}`);
            }

            const jsonData = await response.json();

            // Structure: { "Mobs": { "Mob": [...] } }
            const mobsRoot = jsonData['Mobs'] || jsonData;
            const mobs = mobsRoot['Mob'] || mobsRoot['Mobs']?.['Mob'] || [];

            if (!Array.isArray(mobs)) {
                throw new Error('Invalid mobs.json structure: "Mob" is not an array');
            }

            this._parseMobs(mobs);

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);
            this.isLoaded = true;

            // Log sample harvestable mobs for verification
            const sampleHarvestables = [];
            for (const typeId of Array.from(this.harvestableTypeIds).slice(0, 10)) {
                const info = this.mobsById.get(typeId);
                if (info) {
                    sampleHarvestables.push({
                        typeId,
                        type: info.type,
                        tier: info.tier,
                        uniqueName: info.uniqueName
                    });
                }
            }

            window.logger?.info(
                CATEGORIES.ITEM_DATABASE,
                'MobsDatabaseLoaded',
                {
                    totalMobs: this.stats.totalMobs,
                    harvestables: this.stats.harvestables,
                    loadTimeMs: this.stats.loadTimeMs,
                    sampleHarvestables
                }
            );

        } catch (error) {
            window.logger?.error(
                CATEGORIES.ITEM_DATABASE,
                'MobsDatabaseLoadError',
                {
                    error: error.message,
                    stack: error.stack,
                    path: jsonPath
                }
            );
            throw error;
        }
    }

    /**
     * Parse mobs array from JSON
     * @private
     * @param {Array} mobs - Array of mob objects from mobs.json
     */
    _parseMobs(mobs) {
        // Comme DeathEye: typeId = index dans le tableau
        mobs.forEach((mob, index) => {
            const typeId = index;
            const uniqueName = mob['@uniquename'] || '';
            const tier = parseInt(mob['@tier']) || 0;
            const category = mob['@mobtypecategory'] || mob['@category'] || '';

            // Vérifier si c'est une ressource (a Loot.Harvestable)
            const loot = mob['Loot'];
            const harvestable = loot?.['Harvestable'];

            let resourceType = null;
            let resourceTier = tier;

            if (harvestable) {
                resourceType = this._normalizeResourceType(harvestable['@type']);
                resourceTier = parseInt(harvestable['@tier']) || tier;
                this.harvestableTypeIds.add(typeId);
                this.stats.harvestables++;
            }

            // Stocker les infos du mob
            this.mobsById.set(typeId, {
                type: resourceType,           // null si pas une ressource
                tier: resourceTier,
                uniqueName,
                category,
                isHarvestable: !!resourceType
            });

            this.mobsByName.set(uniqueName, typeId);
            this.stats.totalMobs++;
        });
    }

    /**
     * Normalize resource type from mobs.json to match our naming
     * @private
     * @param {string} type - Type from Loot.Harvestable (HIDE, WOOD, etc.)
     * @returns {string|null} Normalized type (Hide, Log, Fiber, etc.)
     */
    _normalizeResourceType(type) {
        if (!type) return null;

        const normalized = type.toUpperCase();

        // Mapping to match HarvestablesHandler stringType
        const typeMap = {
            'HIDE': 'Hide',
            'LEATHER': 'Hide',  // Alias
            'WOOD': 'Log',
            'FIBER': 'Fiber',
            'ROCK': 'Rock',
            'STONE': 'Rock',    // Alias
            'ORE': 'Ore'
        };

        return typeMap[normalized] || null;
    }

    /**
     * Get mob info by typeId
     * @param {number} typeId - The mob type ID
     * @returns {Object|null} Mob info or null if not found
     */
    getMobInfo(typeId) {
        return this.mobsById.get(typeId) || null;
    }

    /**
     * Check if typeId is a harvestable resource
     * @param {number} typeId - The mob type ID
     * @returns {boolean} True if this mob drops a harvestable resource
     */
    isHarvestable(typeId) {
        return this.harvestableTypeIds.has(typeId);
    }

    /**
     * Get resource info if mob is harvestable
     * @param {number} typeId - The mob type ID
     * @returns {{type: string, tier: number}|null} Resource info or null
     */
    getResourceInfo(typeId) {
        const info = this.mobsById.get(typeId);
        if (info && info.isHarvestable) {
            return {
                type: info.type,
                tier: info.tier
            };
        }
        return null;
    }

    /**
     * Get typeId by unique name
     * @param {string} uniqueName - The mob unique name
     * @returns {number|null} TypeId or null if not found
     */
    getTypeIdByName(uniqueName) {
        return this.mobsByName.get(uniqueName) ?? null;
    }
}


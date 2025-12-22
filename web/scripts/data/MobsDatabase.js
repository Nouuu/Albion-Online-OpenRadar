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

import {CATEGORIES} from '../constants/LoggerConstants.js';

export class MobsDatabase {
    /**
     * OFFSET between mobs.json array index and server TypeID
     * Discovery: Index in mobs.json = server TypeID - 15
     * Reference: DeathEye C# code: TypeId = Convert.ToInt32(parameters[1]) - 15;
     * Verified: T4_MOB_HIDE_SWAMP_MONITORLIZARD at index 410 = TypeID 425
     */
    static OFFSET = 15;

    constructor() {
        /**
         * Map<typeId, {type: string, tier: number, uniqueName: string, category: string}>
         * typeId = server TypeID (index + OFFSET)
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
                CATEGORIES.SYSTEM,
                'MobsDatabaseLoading',
                { path: jsonPath }
            );

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch mobs: ${response.status}`);
            }

            const mobs = await response.json();

            if (!Array.isArray(mobs)) {
                throw new Error('Invalid mobs.min.json structure: expected array');
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
                CATEGORIES.SYSTEM,
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
                CATEGORIES.SYSTEM,
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
        // Server TypeID = index + OFFSET
        mobs.forEach((mob, index) => {
            const typeId = index + MobsDatabase.OFFSET;
            const uniqueName = mob.u || '';
            const tier = mob.t || 0;
            const category = mob.c || '';
            const namelocatag = mob.n || '';

            let resourceType = null;
            let resourceTier = tier;

            if (mob.l) {
                resourceType = this._normalizeResourceType(mob.l);
                resourceTier = mob.lt || tier;

                if (resourceType) {
                    this.harvestableTypeIds.add(typeId);
                    this.stats.harvestables++;
                }
            }

            this.mobsById.set(typeId, {
                type: resourceType,
                tier: resourceTier,
                uniqueName,
                category,
                namelocatag,
                isHarvestable: !!resourceType
            });

            this.mobsByName.set(uniqueName, typeId);
            this.stats.totalMobs++;
        });
    }

    /**
     * Normalize resource type from mobs.json to match our naming
     * @private
     * @param {string} type - Type from Loot.Harvestable (HIDE, HIDE_CRITTER, FIBER_GUARDIAN, etc.)
     * @returns {string|null} Normalized type (Hide, Log, Fiber, Rock, Ore) or null if not a resource
     *
     * Types in mobs.json:
     * - HIDE, HIDE_CRITTER, HIDE_GUARDIAN, HIDE_MINIGUARDIAN, HIDE_TREASURE, etc.
     * - FIBER_CRITTER, FIBER_GUARDIAN, FIBER_MINIGUARDIAN, FIBER_TREASURE, etc.
     * - WOOD_CRITTER, WOOD_GUARDIAN, WOOD_MINIGUARDIAN, WOOD_TREASURE, etc.
     * - ROCK_CRITTER, ROCK_GUARDIAN, ROCK_MINIGUARDIAN, etc.
     * - ORE_CRITTER, ORE_GUARDIAN, ORE_MINIGUARDIAN, ORE_TREASURE, etc.
     * - SILVERCOINS_* (NOT resources, ignored)
     */
    _normalizeResourceType(type) {
        if (!type) return null;

        const normalized = type.toUpperCase();

        // Ignore non-resource types (silver coins, etc.)
        if (normalized.startsWith('SILVERCOINS') || normalized.startsWith('DEADRAT')) {
            return null;
        }

        // Check for resource type prefix
        // Order matters: check longer prefixes first to avoid false matches
        if (normalized.startsWith('HIDE') || normalized.startsWith('LEATHER')) {
            return 'Hide';
        }
        if (normalized.startsWith('FIBER')) {
            return 'Fiber';
        }
        if (normalized.startsWith('WOOD')) {
            return 'Log';
        }
        if (normalized.startsWith('ROCK') || normalized.startsWith('STONE')) {
            return 'Rock';
        }
        if (normalized.startsWith('ORE')) {
            return 'Ore';
        }

        return null;
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


/**
 * Harvestables Database
 * Parses harvestables.json and provides resource type validation
 * Follows the same pattern as ItemsDatabase and SpellsDatabase
 */

import { CATEGORIES } from '../constants/LoggerConstants.js';

export class HarvestablesDatabase {
    constructor() {
        /** @type {Map<string, {resource: string, tiers: Set<number>}>} */
        this.harvestableTypes = new Map();

        /** @type {Set<string>} Valid combinations: "resource-tier-enchant" */
        this.validCombinations = new Set();

        /** @type {Map<string, number>} Resource type to base typeNumber mapping */
        this.resourceToTypeNumber = new Map([
            ['WOOD', 0],   // typeNumber 0-5
            ['ROCK', 6],   // typeNumber 6-10
            ['FIBER', 11], // typeNumber 11-15
            ['HIDE', 16],  // typeNumber 16-22
            ['ORE', 23]    // typeNumber 23-27
        ]);

        this.isLoaded = false;
        this.stats = {
            typesLoaded: 0,
            combinationsLoaded: 0,
            loadTimeMs: 0
        };
    }

    /**
     * Load and parse harvestables.json
     * @param {string} jsonPath - Path to harvestables.json file
     */
    async load(jsonPath) {
        const startTime = performance.now();

        try {
            if (window.logger) {
                window.logger.info(
                    CATEGORIES.ITEM_DATABASE,
                    'HarvestablesLoading',
                    { path: jsonPath }
                );
            }

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch harvestables.json: ${response.status}`);
            }

            const jsonData = await response.json();
            const aoHarvestables = jsonData['AO-Harvestables'];

            if (!aoHarvestables || !aoHarvestables.Harvestable) {
                throw new Error('Invalid harvestables.json structure: missing "AO-Harvestables.Harvestable"');
            }

            const harvestables = Array.isArray(aoHarvestables.Harvestable)
                ? aoHarvestables.Harvestable
                : [aoHarvestables.Harvestable];

            this._parseHarvestables(harvestables);

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);
            this.isLoaded = true;

            if (window.logger) {
                window.logger.info(
                    CATEGORIES.ITEM_DATABASE,
                    'HarvestablesLoaded',
                    {
                        typesLoaded: this.stats.typesLoaded,
                        combinationsLoaded: this.stats.combinationsLoaded,
                        loadTimeMs: this.stats.loadTimeMs,
                        resources: Array.from(this.harvestableTypes.keys()),
                    }
                );
            } else {
                console.log(`✅ HarvestablesDatabase loaded: ${this.stats.typesLoaded} types, ${this.stats.combinationsLoaded} valid combinations (${this.stats.loadTimeMs}ms)`);
            }

        } catch (error) {
            if (window.logger) {
                window.logger.error(
                    CATEGORIES.ITEM_DATABASE,
                    'HarvestablesLoadError',
                    {
                        error: error.message,
                        stack: error.stack,
                        path: jsonPath
                    }
                );
            } else {
                console.error('❌ Error loading HarvestablesDatabase:', error);
            }
            throw error;
        }
    }

    /**
     * Parse harvestables array and build validation structures
     * @param {Array} harvestables - Array of harvestable definitions
     * @private
     */
    _parseHarvestables(harvestables) {
        for (const harvestable of harvestables) {
            const resourceType = harvestable['@resource'];
            if (!resourceType) continue;

            // Track unique resource types
            if (!this.harvestableTypes.has(resourceType)) {
                this.harvestableTypes.set(resourceType, {
                    resource: resourceType,
                    tiers: new Set()
                });
                this.stats.typesLoaded++;
            }

            const resourceData = this.harvestableTypes.get(resourceType);

            // Parse tiers
            if (harvestable.Tier) {
                const tiers = Array.isArray(harvestable.Tier)
                    ? harvestable.Tier
                    : [harvestable.Tier];

                for (const tierData of tiers) {
                    const tier = parseInt(tierData['@tier']);
                    if (isNaN(tier)) continue;

                    resourceData.tiers.add(tier);

                    // Valid enchantments are 0-4
                    const enchants = [0, 1, 2, 3, 4];

                    for (const enchant of enchants) {
                        // Create validation key: "resource-tier-enchant"
                        const key = `${resourceType}-${tier}-${enchant}`;
                        this.validCombinations.add(key);
                    }
                }
            }
        }

        this.stats.combinationsLoaded = this.validCombinations.size;
    }

    /**
     * Check if a resource combination is valid
     * @param {string} resourceType - Resource type (WOOD, ROCK, FIBER, HIDE, ORE)
     * @param {number} tier - Tier (1-8)
     * @param {number} enchant - Enchantment level (0-4)
     * @returns {boolean}
     */
    isValidResource(resourceType, tier, enchant) {
        const key = `${resourceType}-${tier}-${enchant}`;
        return this.validCombinations.has(key);
    }

    /**
     * Check if a resource combination is valid by typeNumber
     * @param {number} typeNumber - Type number (0-27)
     * @param {number} tier - Tier (1-8)
     * @param {number} enchant - Enchantment level (0-4)
     * @returns {boolean}
     */
    isValidResourceByTypeNumber(typeNumber, tier, enchant) {
        const resourceType = this.getResourceTypeFromTypeNumber(typeNumber);
        if (!resourceType) return false;
        return this.isValidResource(resourceType, tier, enchant);
    }

    /**
     * Get resource type from typeNumber
     * @param {number} typeNumber - Type number (0-27)
     * @returns {string|null} - Resource type or null
     */
    getResourceTypeFromTypeNumber(typeNumber) {
        if (typeNumber >= 0 && typeNumber <= 5) return 'WOOD';
        if (typeNumber >= 6 && typeNumber <= 10) return 'ROCK';
        if (typeNumber >= 11 && typeNumber <= 15) return 'FIBER';
        if (typeNumber >= 16 && typeNumber <= 22) return 'HIDE';
        if (typeNumber >= 23 && typeNumber <= 27) return 'ORE';
        return null;
    }

    /**
     * Get harvestable type data
     * @param {string} resourceType - Resource type
     * @returns {{resource: string, tiers: Set<number>}|undefined}
     */
    getResourceData(resourceType) {
        return this.harvestableTypes.get(resourceType);
    }

    /**
     * Get all valid tiers for a resource type
     * @param {string} resourceType - Resource type
     * @returns {number[]} Array of valid tiers
     */
    getValidTiers(resourceType) {
        const data = this.harvestableTypes.get(resourceType);
        return data ? Array.from(data.tiers).sort((a, b) => a - b) : [];
    }
}
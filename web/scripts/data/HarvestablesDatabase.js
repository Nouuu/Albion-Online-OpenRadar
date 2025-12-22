/**
 * Harvestables Database
 * Parses harvestables.json and provides resource type validation
 * Follows the same pattern as ItemsDatabase and SpellsDatabase
 */

import {CATEGORIES} from '../constants/LoggerConstants.js';

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
            window.logger?.info(CATEGORIES.SYSTEM, 'HarvestablesLoading', {path: jsonPath});

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch harvestables: ${response.status}`);
            }

            const data = await response.json();
            this._parseHarvestables(data);

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);
            this.isLoaded = true;

            window.logger?.info(CATEGORIES.SYSTEM, 'HarvestablesLoaded', {
                typesLoaded: this.stats.typesLoaded,
                combinationsLoaded: this.stats.combinationsLoaded,
                loadTimeMs: this.stats.loadTimeMs
            });

        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'HarvestablesLoadError', {
                error: error.message,
                path: jsonPath
            });
            throw error;
        }
    }

    _parseHarvestables(data) {
        for (const [resourceType, tierEntries] of Object.entries(data)) {
            if (!Array.isArray(tierEntries)) continue;

            const tierNumbers = new Set(tierEntries.map(e => e.tier));
            this.harvestableTypes.set(resourceType, {
                resource: resourceType,
                tiers: tierNumbers,
                tierData: tierEntries
            });
            this.stats.typesLoaded++;

            for (const tierNum of tierNumbers) {
                for (const enchant of [0, 1, 2, 3, 4]) {
                    this.validCombinations.add(`${resourceType}-${tierNum}-${enchant}`);
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
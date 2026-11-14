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

        this.isLoaded = false;
        this.stats = {
            typesLoaded: 0,
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

            const response = await fetch(jsonPath, {cache: 'no-cache'});
            if (!response.ok) {
                throw new Error(`Failed to fetch harvestables: ${response.status}`);
            }

            const data = await response.json();
            this._parseHarvestables(data);

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);
            this.isLoaded = true;

            window.logger?.info(CATEGORIES.SYSTEM, 'HarvestablesLoaded', {
                typesLoaded: this.stats.typesLoaded,
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
        }
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
}
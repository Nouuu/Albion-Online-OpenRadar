/**
 * Harvestables Database
 * Parses harvestables.min.json (entries in game file order) and provides resource type validation
 * Follows the same pattern as ItemsDatabase and SpellsDatabase
 */

import {CATEGORIES} from '../constants/LoggerConstants.js';

export class HarvestablesDatabase {
    constructor() {
        /** @type {{n: string, r: string|null, t: Object<string, {y: number[]}>}[]} */
        this.entries = [];

        this.isLoaded = false;
        this.stats = {
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
                entries: this.entries.length,
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
        this.entries = data;
    }

    /**
     * Entry at a 0-based position of the game file
     * @param {number} position
     * @returns {{name: string, resource: string|null, tiers: Object<string, {y: number[]}>}|null}
     */
    entryAt(position) {
        const entry = this.entries[position];
        if (!entry) return null;
        return {name: entry.n, resource: entry.r, tiers: entry.t};
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
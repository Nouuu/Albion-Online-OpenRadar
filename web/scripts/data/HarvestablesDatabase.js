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
     * Resources held at a charge level: the integer part of each level's yield, summed up to that level
     * @param {number} position
     * @param {number} tier
     * @param {number} chargeLevel
     * @returns {number}
     */
    countAt(position, tier, chargeLevel) {
        const yields = this.entries[position]?.t?.[tier]?.y;
        if (!yields || chargeLevel > yields.length) return 0;
        let total = 0;
        for (let level = 0; level < chargeLevel; level++) total += Math.trunc(yields[level]);
        return total;
    }

    /**
     * Resource family of the entry at a position
     * @param {number} position
     * @returns {'WOOD'|'ROCK'|'FIBER'|'HIDE'|'ORE'|null}
     */
    getResource(position) {
        return this.entryAt(position)?.resource ?? null;
    }
}

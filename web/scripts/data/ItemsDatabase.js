/**
 * Items Database
 * Parses items.min.json and provides item lookup by real Albion item id
 *
 * Minified format: [{ n: "uniquename", p: itempower }, ...]
 * Index in array = real Albion item id
 */

import {CATEGORIES} from '../constants/LoggerConstants.js';

export class ItemsDatabase {
    constructor() {
        /** @type {Map<number, {name: string, tier: number, itempower: number, enchant: number}>} */
        this.items = new Map();
        this.isLoaded = false;
    }

    /**
     * Load and parse items.min.json
     * @param {string} jsonPath - Path to items.min.json file
     */
    async load(jsonPath) {
        try {
            window.logger?.info(CATEGORIES.SYSTEM, 'ItemsLoading', {path: jsonPath});

            const response = await fetch(jsonPath, {cache: 'no-cache'});
            if (!response.ok) {
                throw new Error(`Failed to fetch items.min.json: ${response.status}`);
            }

            const items = await response.json();

            if (!Array.isArray(items)) {
                throw new Error('Invalid items.min.json structure: expected array');
            }

            this._parseItems(items);

            this.isLoaded = true;
            window.logger?.info(CATEGORIES.SYSTEM, 'ItemsLoaded', {count: this.items.size});

        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'ItemsLoadError', {error: error.message});
            throw error;
        }
    }

    /**
     * Parse the minified catalog into the id lookup.
     * @param {Array<{n: string, p: number}|null>} items - array indexed by real Albion item id
     */
    _parseItems(items) {
        for (let id = 0; id < items.length; id++) {
            const item = items[id];
            if (item === null || item === undefined) continue;

            const name = item.n;
            if (!name) continue;

            let enchant = 0;
            const atIndex = name.lastIndexOf('@');
            if (atIndex > 0) {
                enchant = parseInt(name.substring(atIndex + 1)) || 0;
            }

            this.items.set(id, {
                name: name,
                tier: this._extractTier(name),
                itempower: item.p || 0,
                enchant: enchant,
            });
        }
    }

    /**
     * Get item by real Albion item id
     * @param {number} id - Real Albion item id
     * @returns {{name: string, tier: number, itempower: number, enchant: number} | undefined}
     */
    getItemById(id) {
        return this.items.get(id);
    }

    /**
     * Extract tier from item uniquename (e.g., "T4_2H_SWORD" → 4)
     * @param {string} uniqueName
     * @returns {number}
     * @private
     */
    _extractTier(uniqueName) {
        const match = uniqueName.match(/^T(\d+)_/);
        return match ? parseInt(match[1]) : 0;
    }
}

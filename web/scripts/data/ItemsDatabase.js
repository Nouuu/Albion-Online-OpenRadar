/**
 * Items Database
 * Parses items.min.json and provides item lookup by sequential ID
 *
 * Minified format: [{ n: "uniquename", p: itempower }, ...]
 * Index in array = sequential ID (0-based, add 1 for game ID)
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

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch items.min.json: ${response.status}`);
            }

            const items = await response.json();

          if (!Array.isArray(items)) {
    throw new Error('Invalid items.min.json structure: expected array');
}

// Array index = real Albion item ID (sparse array; null at unused IDs)
for (let id = 0; id < items.length; id++) {
    const item = items[id];
    if (item === null || item === undefined) continue;

    const name = item.n;
    if (!name) continue;

    // Parse enchant from name (e.g., "T4_2H_SWORD@2" -> enchant 2)
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

            this.isLoaded = true;
            window.logger?.info(CATEGORIES.SYSTEM, 'ItemsLoaded', {count: this.items.size});

        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'ItemsLoadError', {error: error.message});
            throw error;
        }
    }

    /**
     * Get item by sequential ID
     * @param {number} id - Sequential item ID (1, 2, 3...)
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

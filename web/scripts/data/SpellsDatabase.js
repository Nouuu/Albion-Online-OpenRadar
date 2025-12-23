/**
 * SpellsDatabase - Manages spell data from spells.json
 * Uses sequential indexing like AlbionStatistics approach
 *
 * Index mapping:
 * - Index 0, 1, 2... correspond to sequential position in spells.json
 * - Includes: passivespell, activespell, togglespell (in order)
 * - Excludes: colortag elements (skipped in indexing)
 */

import {CATEGORIES} from '../constants/LoggerConstants.js';

export class SpellsDatabase {
    constructor() {
        this.spells = new Map(); // Map<index, spell>
        this.isLoaded = false;
    }

    /**
     * Load and parse spells.json
     * @param {string} jsonPath - Path to spells.json file
     */
    async load(jsonPath) {
        try {
            window.logger?.info(CATEGORIES.SYSTEM, 'SpellsLoading', {path: jsonPath});

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch spells: ${response.status}`);
            }

            const spells = await response.json();

            if (!Array.isArray(spells)) {
                throw new Error('Invalid spells.min.json structure: expected array');
            }

            for (let i = 0; i < spells.length; i++) {
                const spell = spells[i];
                if (!spell.n) continue;

                this.spells.set(i, {
                    index: i,
                    uniqueName: spell.n,
                    uiSprite: spell.i || ''
                });
            }

            this.isLoaded = true;
            window.logger?.info(CATEGORIES.SYSTEM, 'SpellsLoaded', {count: this.spells.size});

        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'SpellsLoadError', {error: error.message});
            throw error;
        }
    }

    /**
     * Add a spell to the database
     * @private
     */
    addSpell(index, spellData, type) {
        const uniqueName = spellData['@uniquename'];

        if (!uniqueName) {
            window.logger?.warn(CATEGORIES.SYSTEM, 'SpellMissingUniquename', {index});
            return;
        }

        const spell = {
            index: index,
            uniqueName: uniqueName,
            uiSprite: spellData['@uisprite'] || '',
            nameLocatag: spellData['@namelocatag'] || '',
            descriptionLocatag: spellData['@descriptionlocatag'] || '',
            type: type
        };

        this.spells.set(index, spell);
    }

    /**
     * Get spell by sequential index
     * @param {number} index - Sequential spell index from packet data
     * @returns {Object|null} Spell object or null if not found
     */
    getSpellByIndex(index) {
        if (!this.isLoaded) {
            window.logger?.warn(CATEGORIES.SYSTEM, 'SpellsDatabase_NotLoaded', {method: 'getSpellByIndex', index});
            return null;
        }

        return this.spells.get(index) || null;
    }

    /**
     * Get spell by unique name (useful for debugging)
     * @param {string} uniqueName - Spell unique name
     * @returns {Object|null} Spell object or null if not found
     */
    getSpellByName(uniqueName) {
        if (!this.isLoaded) {
            window.logger?.warn(CATEGORIES.SYSTEM, 'SpellsDatabase_NotLoaded', {method: 'getSpellByName', uniqueName});
            return null;
        }

        for (const spell of this.spells.values()) {
            if (spell.uniqueName === uniqueName) {
                return spell;
            }
        }

        return null;
    }

    /**
     * Get all unique uisprite names (useful for icon download script)
     * @returns {Set<string>} Set of unique uisprite names
     */
    getAllUiSprites() {
        const uiSprites = new Set();

        for (const spell of this.spells.values()) {
            if (spell.uiSprite) {
                uiSprites.add(spell.uiSprite);
            }
        }

        return uiSprites;
    }

    /**
     * Get database stats
     * @returns {Object} Stats object
     */
    getStats() {
        const stats = {
            total: this.spells.size,
            passive: 0,
            active: 0,
            toggle: 0,
            withIcons: 0
        };

        for (const spell of this.spells.values()) {
            if (spell.type === 'passivespell') stats.passive++;
            else if (spell.type === 'activespell') stats.active++;
            else if (spell.type === 'togglespell') stats.toggle++;

            if (spell.uiSprite) stats.withIcons++;
        }

        return stats;
    }
}
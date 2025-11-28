/**
 * SpellsDatabase - Manages spell data from spells.json
 * Uses sequential indexing like AlbionStatistics approach
 *
 * Index mapping:
 * - Index 0, 1, 2... correspond to sequential position in spells.json
 * - Includes: passivespell, activespell, togglespell (in order)
 * - Excludes: colortag elements (skipped in indexing)
 */

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
            console.log('📄 Loading spells.json...');

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch spells.json: ${response.status}`);
            }

            const jsonData = await response.json();
            const spellsRoot = jsonData.spells;

            if (!spellsRoot) {
                throw new Error('Invalid spells.json structure: missing "spells" root');
            }

            let index = 0;

            // Process passive spells
            if (spellsRoot.passivespell) {
                const passiveSpells = Array.isArray(spellsRoot.passivespell)
                    ? spellsRoot.passivespell
                    : [spellsRoot.passivespell];

                for (const spell of passiveSpells) {
                    this.addSpell(index++, spell, 'passivespell');
                }
            }

            // Process active spells
            if (spellsRoot.activespell) {
                const activeSpells = Array.isArray(spellsRoot.activespell)
                    ? spellsRoot.activespell
                    : [spellsRoot.activespell];

                for (const spell of activeSpells) {
                    this.addSpell(index++, spell, 'activespell');
                }
            }

            // Process toggle spells
            if (spellsRoot.togglespell) {
                const toggleSpells = Array.isArray(spellsRoot.togglespell)
                    ? spellsRoot.togglespell
                    : [spellsRoot.togglespell];

                for (const spell of toggleSpells) {
                    this.addSpell(index++, spell, 'togglespell');
                }
            }

            this.isLoaded = true;
            console.log(`✅ SpellsDatabase loaded: ${this.spells.size} spells indexed`);

        } catch (error) {
            console.error('❌ Error loading SpellsDatabase:', error);
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
            console.warn(`⚠️  Spell at index ${index} missing @uniquename, skipping`);
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
            console.warn('⚠️  SpellsDatabase not loaded yet');
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
            console.warn('⚠️  SpellsDatabase not loaded yet');
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
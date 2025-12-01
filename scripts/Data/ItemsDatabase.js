/**
 * Items Database
 * Parses items.json and provides item lookup by sequential ID
 * Mimics DEATHEYE's ItemData.Load() logic
 */

export class ItemsDatabase {
    constructor() {
        /** @type {Map<number, {name: string, tier: number, itempower: number, enchant: number}>} */
        this.items = new Map();
        this.isLoaded = false;
    }

    /**
     * Load and parse items.json
     * @param {string} jsonPath - Path to items.json file
     */
    async load(jsonPath) {
        try {
            console.log('📄 Loading items.json...');

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch items.json: ${response.status}`);
            }

            const jsonData = await response.json();
            const itemsRoot = jsonData.items;

            if (!itemsRoot) {
                throw new Error('Invalid items.json structure: missing "items" root');
            }

            let id = 1; // Start at 1, like DEATHEYE
            let skipped = 0;

            // Collect all item types (simpleitem, equipmentitem, weapon, etc.)
            const itemTypes = [
                'simpleitem', 'equipmentitem', 'weapon', 'consumableitem',
                'consumablefrominventoryitem', 'farmableitem', 'mount',
                'furnitureitem', 'trackingitem', 'journalitem'
            ];

            for (const itemType of itemTypes) {
                if (!itemsRoot[itemType]) continue;

                const items = Array.isArray(itemsRoot[itemType])
                    ? itemsRoot[itemType]
                    : [itemsRoot[itemType]];

                for (const item of items) {
                    const uniqueName = item['@uniquename'];
                    if (!uniqueName) continue;

                    const itempower = parseInt(item['@itempower'] || '0');

                    // DEATHEYE: Only add items with itempower > 0
                    if (itempower > 0) {
                        // Base item (enchant 0)
                        this.items.set(id++, {
                            name: uniqueName,
                            tier: this._extractTier(uniqueName),
                            itempower: itempower,
                            enchant: 0
                        });
                    } else {
                        skipped++;
                    }

                    // Process enchantments
                    if (item.enchantments && item.enchantments.enchantment) {
                        const enchantments = Array.isArray(item.enchantments.enchantment)
                            ? item.enchantments.enchantment
                            : [item.enchantments.enchantment];

                        for (const enchant of enchantments) {
                            const enchantLevel = parseInt(enchant['@enchantmentlevel'] || '0');
                            const enchantPower = parseInt(enchant['@itempower'] || '0');

                            if (enchantPower > 0) {
                                this.items.set(id++, {
                                    name: `${uniqueName}@${enchantLevel}`,
                                    tier: this._extractTier(uniqueName),
                                    itempower: enchantPower,
                                    enchant: enchantLevel
                                });
                            } else {
                                skipped++;
                            }
                        }
                    }
                }
            }

            this.isLoaded = true;
            console.log(`✅ ItemsDatabase loaded: ${this.items.size} items indexed (skipped ${skipped} without itempower)`);

        } catch (error) {
            console.error('❌ Error loading ItemsDatabase:', error);
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

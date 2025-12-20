import {CATEGORIES} from '../constants/LoggerConstants.js';
import settingsSync from '../Utils/SettingsSync.js';
import {getResourceStorageKey} from "../Utils/ResourcesHelper.js";

export const EnemyType =
    {
        LivingHarvestable: 0,
        LivingSkinnable: 1,
        Enemy: 2,
        MediumEnemy: 3,
        EnchantedEnemy: 4,
        MiniBoss: 5,
        Boss: 6,
        Drone: 7,
        MistBoss: 8,
        Events: 9,
    };

class Mob {
    constructor(id, typeId, posX, posY, health, maxHealth, enchantmentLevel, rarity) {
        this.id = id;
        this.typeId = typeId;
        this.posX = posX;
        this.posY = posY;
        this.health = health;           // Normalized (0-255) = current HP percentage
        this.maxHealth = maxHealth;     // Real max HP
        this.enchantmentLevel = enchantmentLevel;
        this.rarity = rarity;
        this.tier = 0;
        this.type = EnemyType.Enemy;
        this.name = null;
        this.category = null;           // Mob category from database (boss, miniboss, champion, etc.)
        this.namelocatag = null;        // Localization tag for translated name
        this.exp = 0;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now(); // For stale entity cleanup
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }

    /**
     * Get real current HP
     * @returns {number} Current HP (not normalized)
     */
    getCurrentHP() {
        return Math.round((this.health / 255) * this.maxHealth);
    }

    /**
     * Get HP percentage
     * @returns {number} HP percentage (0-100)
     */
    getHealthPercent() {
        return Math.round((this.health / 255) * 100);
    }
}

class Mist {
    constructor(id, posX, posY, name, enchant) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.name = name;
        this.enchant = enchant;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now(); // For stale entity cleanup

        if (name.toLowerCase().includes("solo")) {
            this.type = 0;
        } else {
            this.type = 1;
        }
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class MobsHandler {
    constructor() {
        this.mobsList = [];
        this.mistList = [];
        this.harvestablesNotGood = [];
    }

    /**
     * Calculate enchantment level from game parameters
     * Uses parameters[33] directly (server data is reliable)
     */
    calculateEnchantment(paramsEnchant) {
        if (paramsEnchant !== null && paramsEnchant !== undefined) {
            return Math.max(0, Math.min(4, paramsEnchant));
        }
        return 0;
    }

    normalizeNumber(value, defaultValue = null) {
        if (value === undefined || value === null) return defaultValue;
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
    }

    NewMobEvent(parameters) {
        try {
            const mobId = parseInt(parameters[0]);
            const typeId = parseInt(parameters[1]);

            // 🐛 DEBUG ULTRA-DETAILED: Log ALL parameters to identify patterns
            const allParams = {};
            for (let key in parameters) {
                if (parameters.hasOwnProperty(key)) {
                    allParams[`param[${key}]`] = parameters[key];
                }
            }

            window.logger?.debug(CATEGORIES.MOBS, 'new_mob_all_params', {
                mobId,
                typeId,
                posX: parameters[8],
                posY: parameters[9],
                allParameters: allParams,
                parameterCount: Object.keys(parameters).length
            });

            const loc = parameters[7] || [0, 0];
            const posX = this.normalizeNumber(loc[0], 0);
            const posY = this.normalizeNumber(loc[1], 0);
            const healthNormalized = this.normalizeNumber(parameters[2], 255);  // Current HP (0-255)
            const maxHealth = this.normalizeNumber(parameters[13], 0);          // Max HP (real value)
            const enchant = this.normalizeNumber(parameters[33], 0) || 0;
            const rarity = this.normalizeNumber(parameters[19], null);

            let name;
            try {
                name = parameters[32] || parameters[31] || null;
            } catch (e) {
                window.logger?.error(CATEGORIES.MOBS, 'new_mob_error', e);
                name = null;
            }

            // 🐛 DEBUG: Log raw parameters from server
            window.logger?.debug(CATEGORIES.MOBS, 'new_mob_raw', {
                mobId, typeId,
                params: {
                    health_normalized: parameters[2],
                    maxHP: parameters[13],
                    rarity: parameters[19],
                    enchant: parameters[33],
                    name
                }
            });

            if (name) {
                this.AddMist(mobId, posX, posY, name, enchant);
            } else {
                this.AddEnemy(mobId, typeId, posX, posY, healthNormalized, maxHealth, enchant, rarity);
            }
        } catch (e) {
            // ❌ ERROR (always logged) - Critical error in NewMobEvent
            if (window.logger) {
                window.logger.error(CATEGORIES.MOBS, 'new_mob_error', e);
            }
        }
    }

    AddEnemy(id, typeId, posX, posY, healthNormalized, maxHealth, enchant, rarity) {
        if (this.mobsList.some(m => m.id === id)) return;
        if (this.harvestablesNotGood.some(m => m.id === id)) return;

        // Fix for fort/dungeon NPCs spawning with low HP value (params[2]=5)
        // If healthNormalized is very low (< 10), it's likely a spawn default value, not real HP
        // In that case, assume full health (255)
        const actualHealth = healthNormalized < 10 ? 255 : healthNormalized;

        const mob = new Mob(id, typeId, posX, posY, actualHealth, maxHealth, enchant, rarity);
        Number(actualHealth) || 0;
        // Phase 5: MobsDatabase ONLY (no fallback to test new system)
        const dbInfo = window.mobsDatabase?.getMobInfo(typeId);
        let hasKnownInfo = false;

        if (dbInfo && dbInfo.isHarvestable) {
            // Living resource from MobsDatabase
            mob.tier = dbInfo.tier || 0;
            mob.name = dbInfo.type;  // 'Hide', 'Fiber', 'Log', 'Rock', 'Ore'
            // Hide = LivingSkinnable (animals), others = LivingHarvestable (critters/guardians)
            mob.type = dbInfo.type === 'Hide' ? EnemyType.LivingSkinnable : EnemyType.LivingHarvestable;
            hasKnownInfo = true;

            window.logger?.debug(CATEGORIES.MOBS, 'MobsDatabaseMatch', {
                typeId,
                type: dbInfo.type,
                tier: dbInfo.tier,
                uniqueName: dbInfo.uniqueName,
                assignedEnemyType: this.getEnemyTypeName(mob.type)
            });
        } else if (dbInfo) {
            // Hostile mob from MobsDatabase
            mob.type = this._getEnemyTypeFromCategory(dbInfo.category, dbInfo.uniqueName);
            mob.name = dbInfo.uniqueName;  // For Mist Boss filtering
            mob.tier = dbInfo.tier || 0;   // Store tier for hostile mobs
            mob.category = dbInfo.category || null;  // Store category for badge display
            mob.namelocatag = dbInfo.namelocatag || null;  // Store localization tag for translated name
            hasKnownInfo = true;

            window.logger?.debug(CATEGORIES.MOBS, 'HostileMobMatch', {
                typeId,
                category: dbInfo.category,
                uniqueName: dbInfo.uniqueName,
                tier: dbInfo.tier,
                assignedEnemyType: this.getEnemyTypeName(mob.type)
            });
        } else {
            // Unknown mob (no database entry)
            // Mob stays as EnemyType.Enemy (default)
            window.logger?.debug(CATEGORIES.MOBS, 'UnknownMob_NoDatabase', {
                typeId,
                health: healthNormalized,
                maxHealth
            });
        }

        // 🐛 DEBUG: Log enemy creation with type info
        window.logger?.debug(CATEGORIES.MOBS, 'new_mob_debug', {
            id: id,
            typeId: typeId,
            health: `${mob.getCurrentHP()}/${maxHealth}`,
            healthPercent: mob.getHealthPercent(),
            enchant: enchant,
            rarity: rarity,
            assignedType: mob.type,
            typeName: this.getEnemyTypeName(mob.type),
            name: mob.name,
            hasKnownInfo: hasKnownInfo,
            source: hasKnownInfo ? 'MobsDatabase' : 'none'
        });

        // Calculate enchantment from server data (parameters[33])
        if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
            mob.enchantmentLevel = this.calculateEnchantment(enchant);
        }

        // Filter living resources based on user settings
        if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
            if (mob.tier > 0 && mob.name) {
                const resourceType = mob.name;
                let prefix;
                if (resourceType === 'Fiber' || resourceType === 'fiber') prefix = 'fsp';
                else if (resourceType === 'Hide' || resourceType === 'hide') prefix = 'hsp';
                else if (resourceType === 'Wood' || resourceType === 'Logs') prefix = 'wsp';
                else if (resourceType === 'Ore' || resourceType === 'ore') prefix = 'osp';
                else if (resourceType === 'Rock' || resourceType === 'rock') prefix = 'rsp';
                const settingKey = getResourceStorageKey(prefix, 'Living');

                if (!settingsSync.getJSON(settingKey)?.[`e${mob.enchantmentLevel}`][mob.tier - 1]) {
                    return;
                }
            }
        }

        // Filter enemies based on user settings
        if (mob.type >= EnemyType.Enemy && mob.type <= EnemyType.Boss) {
            // If enemy is not identified (no name from mobinfo), check "Show Unmanaged Enemies" setting
            if (!mob.name || !hasKnownInfo) {
                if (settingsSync.getBool('settingShowUnmanagedEnemies') === false) {
                    return; // Skip unidentified enemies if setting is disabled
                }
            } else {
                // For identified enemies, filter by their specific level (Normal, Enchanted, MiniBoss, Boss)
                // Note: MediumEnemy completely removed - not aligned with game data categories
                const settingName = this._getSettingNameForEnemyType(mob.type);
                if (settingName && settingsSync.getBool(settingName) === false) {
                    return; // Skip if this enemy level is disabled
                }
            }
        }

        // Filter drones based on user settings
        if (mob.type === EnemyType.Drone) {
            if (!settingsSync.getBool('settingAvaloneDrones')) {
                return;
            }
        }

        // Filter mist bosses based on user settings
        if (mob.type === EnemyType.MistBoss) {
            // Mist bosses have individual toggles, but if we don't know which one it is, show it
            // The specific filtering is done in MobsDrawing based on mob name
        }

        // Filter event enemies based on user settings
        if (mob.type === EnemyType.Events) {
            if (!settingsSync.getBool('settingShowEventEnemies')) {
                return;
            }
        }

        this.mobsList.push(mob);
    }

    removeMob(id) {
        const before = this.mobsList.length;
        this.mobsList = this.mobsList.filter(m => m.id !== id);
        this.harvestablesNotGood = this.harvestablesNotGood.filter(x => x.id !== id);
        const after = this.mobsList.length;

        // 🐛 DEBUG (filtered by categoryMobs setting) - Detailed mob removal
        if (before !== after) {
            window.logger?.debug(CATEGORIES.MOBS, 'mob_removed', {
                id: id,
                livingResourcesBefore: before,
                livingResourcesAfter: after
            });
        }
    }

    updateMobPosition(id, posX, posY) {
        const m = this.mobsList.find(x => x.id === id);
        if (m) {
            m.posX = posX;
            m.posY = posY;
            m.touch();
        }
    }

    updateEnchantEvent(parameters) {
        const mobId = parameters[0];
        const enchantmentLevel = parameters[1];
        const found = this.mobsList.find(m => m.id === mobId) || this.harvestablesNotGood.find(m => m.id === mobId);
        if (found) {
            found.enchantmentLevel = enchantmentLevel;
            found.touch();
        }
    }

    // 🐛 DEBUG: Find and log mob info by ID (for HP tracking)
    debugLogMobById(id) {
        const mob = this.mobsList.find(m => m.id === id);
        if (mob) {
            return `TypeID=${mob.typeId} Type=${this.getEnemyTypeName(mob.type)} HP=${mob.getCurrentHP()}/${mob.maxHealth} Name=${mob.name || 'Unknown'}`;
        }
        return 'NOT_FOUND_IN_MOBSLIST';
    }

    /**
     * Update mob health from HealthUpdate event (Event 6)
     * @param {Object} parameters - Event parameters
     * @param {number} parameters[0] - Mob ID
     * @param {number} parameters[2] - HP delta (negative = damage, positive = heal)
     * @param {number} parameters[3] - Current HP (real value, not normalized) - undefined = dead
     * @param {number} parameters[6] - Attacker ID (optional)
     */
    updateMobHealth(parameters) {
        const mobId = parameters[0];
        const hpDelta = parameters[2];
        const currentHP = parameters[3];  // Real HP value (not normalized)
        const attackerId = parameters[6];

        // Find mob in list
        const mob = this.mobsList.find(m => m.id === mobId);
        if (!mob) return; // Not a mob (probably player)

        // 🐛 DEBUG: Log health update
        const oldHP = mob.getCurrentHP();
        window.logger?.debug(CATEGORIES.MOBS, 'health_update', {
            mobId: mobId,
            oldHP: oldHP,
            newHP: currentHP,
            maxHealth: mob.maxHealth,
            delta: hpDelta,
            attackerId: attackerId
        });

        // Handle death (currentHP is undefined when entity dies)
        if (currentHP === undefined || currentHP <= 0) {
            window.logger?.debug(CATEGORIES.MOBS, 'mob_died', {
                mobId: mobId,
                typeId: mob.typeId
            });
            this.removeMob(mobId);
            return;
        }

        // Convert real HP to normalized (0-255)
        if (mob.maxHealth > 0) {
            mob.health = Math.round((currentHP / mob.maxHealth) * 255);
        }
    }

    /**
     * Update mob health from RegenerationHealthChanged event (Event 91)
     * @param {Object} parameters - Event parameters
     * @param {number} parameters[0] - Mob ID
     * @param {number} parameters[2] - Current HP (normalized 0-255)
     * @param {number} parameters[3] - Max HP (normalized 0-255)
     */
    updateMobHealthRegen(parameters) {
        const mobId = parseInt(parameters[0]);
        const mob = this.mobsList.find(m => m.id === mobId);

        // 🐛 DEBUG: Log RegenerationHealthChanged avec analyse HP
        const allParams = {};
        for (let key in parameters) {
            if (parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.MOBS, 'regen_health_detail', {
            mobId,
            eventCode: 91,
            mobFound: !!mob,
            mobTypeId: mob ? mob.typeId : null,
            mobName: mob ? mob.name : null,
            params2_currentHP: parameters[2],
            params3_maxHP: parameters[3],
            hpPercentage: parameters[3] ? Math.round((parameters[2] / parameters[3]) * 100) + '%' : 'N/A',
            allParameters: allParams,
            parameterCount: Object.keys(parameters).length
        });

        // Update normalized health directly if mob exists
        if (mob) {
            mob.health = parameters[2];
        }
    }

    /**
     * Update multiple mob healths from HealthUpdates bulk event (Event 7)
     * @param {Object} parameters - Event parameters with arrays
     * @param {Array} parameters[1] - Array of timestamps
     * @param {Array} parameters[2] - Array of HP deltas
     * @param {Array} parameters[3] - Array of current HPs
     */
    updateMobHealthBulk(parameters) {
        // Event 7 sends arrays of values for multiple entities at once
        const timestamps = parameters[1];
        const hpDeltas = parameters[2];
        const currentHPs = parameters[3];

        if (!Array.isArray(timestamps) || !Array.isArray(currentHPs)) return;

        // Process each entity in the bulk update
        for (let i = 0; i < currentHPs.length; i++) {
            // Create fake parameters object for single update
            const singleParams = {
                0: parameters[0],  // First entity ID (might not be accurate for bulk?)
                2: hpDeltas[i],
                3: currentHPs[i],
                6: parameters[6] ? parameters[6][i] : undefined
            };

            // 🐛 DEBUG: Log bulk processing
            window.logger?.debug(CATEGORIES.MOBS, 'bulk_hp_update', {
                index: i,
                total: currentHPs.length,
                delta: hpDeltas[i],
                newHP: currentHPs[i]
            });

            this.updateMobHealth(singleParams);
        }
    }

    getMobList() {
        return [...this.mobsList];
    }

    AddMist(id, posX, posY, name, enchant) {
        const existing = this.mistList.find(m => m.id === id);
        if (existing) {
            existing.touch();
            return;
        }
        this.mistList.push(new Mist(id, posX, posY, name, enchant));
    }

    removeMist(id) {
        this.mistList = this.mistList.filter(m => m.id !== id);
    }

    updateMistPosition(id, posX, posY) {
        const mist = this.mistList.find(m => m.id === id);
        if (mist) {
            mist.posX = posX;
            mist.posY = posY;
            mist.touch();
        }
    }

    updateMistEnchantmentLevel(id, enchantmentLevel) {
        const mist = this.mistList.find(m => m.id === id);
        if (mist) {
            mist.enchant = enchantmentLevel;
            mist.touch();
        }
    }

    Clear() {
        this.mobsList = [];
        this.mistList = [];
        this.harvestablesNotGood = [];
    }

    /**
     * Map category/mobtypecategory from mobs.xml to EnemyType enum
     *
     * mobs.xml has TWO category attributes:
     * 1. mobtypecategory - Primary type (boss, miniboss, champion, standard, trash, critter, summon, etc.)
     * 2. category - Secondary type (roaming, factionwarfare, rd_solo, camp, static, etc.)
     *
     * MobsDatabase.js reads: mob['@mobtypecategory'] || mob['@category'] || ''
     * So this method must handle values from BOTH attributes.
     *
     * Additionally, uses name-based heuristics to detect elite mobs:
     * - "_VETERAN" (not "_VETERAN_CHAMPION") → MiniBoss
     * - "_ELITE" → MiniBoss
     * - "_BOSS" → Boss
     *
     * @param {string} category - Category from mobs.xml
     * @param {string} uniqueName - Unique name of the mob (for heuristics)
     * @returns {number} EnemyType enum value
     * @private
     */
    _getEnemyTypeFromCategory(category, uniqueName = '') {
        const cat = (category || '').toLowerCase();
        const name = (uniqueName || '').toUpperCase();

        // 🔍 Name-based heuristics (checked FIRST, before category)
        // These override category-based classification

        // VETERAN mobs (elite versions) - MiniBoss tier
        // Example: T6_MOB_MORGANA_CROSSBOWMAN_VETERAN (has category="static" but is elite)
        // Exclude VETERAN_CHAMPION (already handled by category="champion")
        if (name.includes('_VETERAN') && !name.includes('_VETERAN_CHAMPION')) {
            return EnemyType.MiniBoss;
        }

        // ELITE mobs - MiniBoss tier
        if (name.includes('_ELITE')) {
            return EnemyType.MiniBoss;
        }

        // BOSS in name (explicit boss indicators)
        if (name.includes('_BOSS') && !name.includes('MINIBOSS')) {
            return EnemyType.Boss;
        }

        // 📋 Category-based classification (fallback if no name heuristic matched)
        switch(cat) {
            // Boss tier (mobtypecategory="boss" OR category="boss")
            case 'boss':
                return EnemyType.Boss;

            // Mini-boss tier (mobtypecategory="miniboss" OR category="miniboss")
            case 'miniboss':
                return EnemyType.MiniBoss;

            // Enchanted/Champion tier (mobtypecategory="champion" OR category="champion")
            case 'champion':
                return EnemyType.EnchantedEnemy;

            // Random Dungeon elites - treat as bosses/mini-bosses
            case 'rd_elite':      // Random Dungeon elite mobs
            case 'rd_veteran':    // Random Dungeon veteran mobs
                return EnemyType.MiniBoss;

            case 'rd_solo':       // Random Dungeon solo mobs (weaker)
                return EnemyType.EnchantedEnemy;

            // Normal enemy tier - all standard/weak hostile mobs
            case 'standard':      // mobtypecategory="standard"
            case 'trash':         // mobtypecategory="trash"
            case 'summon':        // mobtypecategory="summon"
            case 'roaming':       // category="roaming"
            case 'factionwarfare': // category="factionwarfare"
            case 'camp':          // category="camp"
            case 'static':        // category="static" (WARNING: includes VETERAN mobs, handled by heuristic above)
            case 'avalon':        // category="avalon" (Avalonian mobs)
            case 'homebase':      // category="homebase"
            case 'hidemob':       // category="hidemob"
            case 'territoryguards': // category="territoryguards"
            case 'territoryinvaders': // category="territoryinvaders"
            case 'smugglerguards': // category="smugglerguards"
            case 'crowdcontrol':  // category="crowdcontrol"
            case 'castle':        // category="castle"
            case 'tracking':      // category="tracking"
            default:
                return EnemyType.Enemy;

            // Categories ignored (non-hostile or special):
            // - environment: Non-hostile objects
            // - chest: Treasure chests
            // - harmless: Non-hostile NPCs
            // - vanity: Cosmetic entities
            // - critter: Living resources (handled separately via isHarvestable)
            // - hiddentreasures, crystalcreatures, treasuredrones: Non-mob entities
            // These shouldn't reach this point as they have isHarvestable=false or shouldn't be spawned
        }
    }

    /**
     * Get setting name for enemy type
     * @param {number} type - EnemyType enum value
     * @returns {string|null} Setting name or null if no setting exists
     * @private
     */
    _getSettingNameForEnemyType(type) {
        switch(type) {
            case EnemyType.Enemy:
                return 'settingNormalEnemy';
            case EnemyType.EnchantedEnemy:
                return 'settingEnchantedEnemy';
            case EnemyType.MiniBoss:
                return 'settingMiniBossEnemy';
            case EnemyType.Boss:
                return 'settingBossEnemy';
            default:
                return null;
        }
    }

    /**
     * Get human-readable name for enemy type (for debugging)
     * @param {number} type - EnemyType enum value
     * @returns {string} Type name
     */
    getEnemyTypeName(type) {
        const names = {
            0: "LivingHarvestable",
            1: "LivingSkinnable",
            2: "Enemy",
            3: "MediumEnemy",
            4: "EnchantedEnemy",
            5: "MiniBoss",
            6: "Boss",
            7: "Drone",
            8: "MistBoss",
            9: "Events"
        };
        return names[type] || `Unknown(${type})`;
    }

    /**
     * Remove mobs not updated for a given time period
     * @param {number} maxAgeMs - Maximum age in milliseconds (default: 2 minutes)
     * @returns {number} - Number of entities removed
     */
    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const beforeMobs = this.mobsList.length;
        const beforeMists = this.mistList.length;

        this.mobsList = this.mobsList.filter(entity =>
            (now - entity.lastUpdateTime) < maxAgeMs
        );
        this.mistList = this.mistList.filter(entity =>
            (now - entity.lastUpdateTime) < maxAgeMs
        );

        const removedMobs = beforeMobs - this.mobsList.length;
        const removedMists = beforeMists - this.mistList.length;

        if (removedMobs > 0 || removedMists > 0) {
            window.logger?.debug(CATEGORIES.MOBS, 'cleanup', {removedMobs, removedMists, maxAgeMs});
        }
        return removedMobs + removedMists;
    }

    /**
     * Enforce maximum list sizes by removing oldest entries
     * @param {number} maxMobs - Maximum mobs (default: 500)
     * @param {number} maxMists - Maximum mists (default: 50)
     * @returns {number} - Total entities removed
     */
    enforceMaxSize(maxMobs = 500, maxMists = 50) {
        let totalRemoved = 0;

        if (this.mobsList.length > maxMobs) {
            this.mobsList.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
            const removed = this.mobsList.length - maxMobs;
            this.mobsList = this.mobsList.slice(0, maxMobs);
            totalRemoved += removed;
            window.logger?.debug(CATEGORIES.MOBS, 'max_mobs_enforced', {removed});
        }

        if (this.mistList.length > maxMists) {
            this.mistList.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
            const removed = this.mistList.length - maxMists;
            this.mistList = this.mistList.slice(0, maxMists);
            totalRemoved += removed;
            window.logger?.debug(CATEGORIES.MOBS, 'max_mists_enforced', {removed});
        }

        return totalRemoved;
    }

    /**
     * Get current list sizes for monitoring
     * @returns {object}
     */
    getSize() {
        return {
            mobs: this.mobsList.length,
            mists: this.mistList.length,
            total: this.mobsList.length + this.mistList.length
        };
    }
}
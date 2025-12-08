import { CATEGORIES, EVENTS } from '../constants/LoggerConstants.js';
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
        this.exp = 0;
        this.hX = 0;
        this.hY = 0;
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

        if (name.toLowerCase().includes("solo")) {
            this.type = 0;
        } else {
            this.type = 1;
        }
    }
}

export class MobsHandler {
    constructor() {
        this.mobsList = [];
        this.mistList = [];
        this.mobinfo = {};
        this.harvestablesNotGood = [];

        // Cross-reference with HarvestablesHandler
        this.staticResourceTypeIDs = new Map();
        this._registrationLogState = new Map();
        this._lastHumanLog = new Map();

        // Load living resources metadata for enhanced logging
        this.livingResourcesMetadata = null;
        this.loadLivingResourcesMetadata();

        this.loadCachedTypeIDs();
    }

    async loadLivingResourcesMetadata() {
        try {
            const response = await fetch('/server-scripts/living-resources-enhanced.json');
            if (response.ok) {
                const data = await response.json();

                // Merge animals and all guardian types
                let allResources = data.animals || [];

                if (data.guardians) {
                    // Merge all guardian categories (fiber, hide, etc.)
                    for (const category in data.guardians) {
                        if (Array.isArray(data.guardians[category])) {
                            allResources = allResources.concat(data.guardians[category]);
                        }
                    }
                }

                this.livingResourcesMetadata = allResources;
                // ℹ️ INFO (toujours loggé) - Chargement de metadata
                if (window.logger) {
                    window.logger.info(CATEGORIES.MOB, EVENTS.LoadMetadata, {
                        count: this.livingResourcesMetadata.length
                    });
                }
            } else {
                // ⚠️ WARNING - Fichier non trouvé
                if (window.logger) {
                    window.logger.warn(CATEGORIES.MOB, EVENTS.LoadMetadataNotFound, {
                        status: response.status,
                        statusText: response.statusText,
                        url: response.url
                    });
                } else {
                    if (window.logger) {
                        window.logger.warn(CATEGORIES.MOB, EVENTS.EnhancedJSONLoadFailed, {
                            status: response.status,
                            statusText: response.statusText
                        });
                    }
                }
            }
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Échec critique
            if (window.logger) {
                window.logger.error(CATEGORIES.MOB, EVENTS.LoadMetadataFailed, e);
            } else {
                if (window.logger) {
                    window.logger.error(CATEGORIES.MOB, EVENTS.EnhancedJSONLoadError, e);
                }
            }
        }
    }

    findCreatureMetadata(tier, resourceType, hp) {
        if (!this.livingResourcesMetadata) return null;

        // Filter by tier and type
        const candidates = this.livingResourcesMetadata.filter(m =>
            m.tier === tier &&
            (resourceType === 'hide' ? m.faction?.includes('HIDE') || m.faction?.includes('COUGAR') || m.faction?.includes('WOLF') || m.faction?.includes('BOAR') || m.faction?.includes('BEAR') || m.faction?.includes('FOX') :
                resourceType === 'fiber' ? m.faction?.includes('BEEKEEPER') :
                    false)
        );

        // Find best match by HP (closest match)
        if (candidates.length === 0) return null;

        let bestMatch = null;
        let smallestDiff = Infinity;

        for (const candidate of candidates) {
            const diff = Math.abs(candidate.hp - hp);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                bestMatch = candidate;
            }
        }

        // Only return if HP is reasonably close (within 20%)
        if (bestMatch && smallestDiff <= bestMatch.hp * 0.2) {
            return bestMatch;
        }

        return null;
    }

    loadCachedTypeIDs() {
        try {
            const entries = settingsSync.getJSON('cachedStaticResourceTypeIDs', null);
            if (entries) {
                let loadedCount = 0;
                let skippedCount = 0;
                for (const [typeId, info] of entries) {
                    const numericTypeId = Number(typeId);
                    if (numericTypeId === 65535) {
                        skippedCount++;
                        continue;
                    }
                    this.staticResourceTypeIDs.set(numericTypeId, info);
                    loadedCount++;
                }
                // ℹ️ INFO (toujours loggé) - Chargement du cache
                if (window.logger) {
                    window.logger.info(CATEGORIES.MOB, EVENTS.LoadCachedTypeIDs, {
                        loaded: loadedCount,
                        skipped: skippedCount
                    });
                }
            }
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Échec critique
            if (window.logger) {
                window.logger.error(CATEGORIES.MOB, EVENTS.LoadCacheFailed, e);
            }
        }
    }

    // 🔍 Get base rarity for a given tier (used for enchantment calculation)
    // Note: Only accurate for Harvestable (Fiber/Wood/Ore/Rock), NOT for Skinnable (Hide)
    getBaseRarity(tier) {
        // Base rarity values observed in-game for HARVESTABLE resources
        const baseRarities = {
            1: 0,    // T1
            2: 0,    // T2
            3: 78,   // T3 Fiber observed
            4: 92,   // T4 Fiber observed
            5: 112,  // T5 Fiber observed
            6: 132,  // T6 (estimated +20/tier)
            7: 152,  // T7 (estimated)
            8: 172   // T8 (estimated)
        };
        return baseRarities[tier] || 0;
    }

    // 🔍 Calculate enchantment level from game parameters
    // Harvestable (Fiber/Wood/Ore/Rock): Calculate from rarity (params[19])
    // Skinnable (Hide): Cannot be calculated from rarity (game sends constant values)
    calculateEnchantment(type, tier, rarity, paramsEnchant) {
        // For Harvestable resources (Fiber/Wood/Ore/Rock): rarity is accurate
        if (type === EnemyType.LivingHarvestable) {
            if (rarity === null || rarity === undefined) return 0;

            const baseRarity = this.getBaseRarity(tier);
            if (baseRarity === 0) return 0;

            // Formula validated: enchant increases rarity by ~45 per level
            const diff = rarity - baseRarity;
            const enchant = Math.floor(diff / 45);
            return Math.max(0, Math.min(4, enchant));
        }

        // For Skinnable resources (Hide): rarity is CONSTANT per TypeID (unreliable)
        // Game sends same rarity value regardless of actual enchantment
        // Cannot calculate from rarity - must use TypeID database or harvestable event
        if (type === EnemyType.LivingSkinnable) {
            // TODO: Use MobsInfo enchantment data when available
            // For now, return 0 (will be corrected when harvestable is created)
            return 0;
        }

        return 0;
    }

    // 📊 Enhanced logging for living resources with validation
    logLivingCreatureEnhanced(id, typeId, health, enchant, rarity, tier, type, name) {

        const typeLabel = type === EnemyType.LivingSkinnable ? "Skinnable" : "Harvestable";
        const isAlive = health > 0;
        const timestamp = new Date().toISOString();

        // Calculate REAL enchantment using centralized method
        const realEnchant = this.calculateEnchantment(type, tier, rarity, enchant);

        // Try to find creature metadata
        const metadata = this.findCreatureMetadata(tier, name, health);

        // Build structured log
        const logData = {
            timestamp,
            typeId,
            resource: {
                type: name,
                tier,
                enchant: realEnchant,  // Use calculated enchant
                category: typeLabel
            },
            state: {
                health,
                alive: isAlive,
                rarity
            },
            entityId: id
        };

        // Add validation if metadata found
        if (metadata) {
            const hpDiff = Math.abs(metadata.hp - health);
            const hpMatch = hpDiff <= metadata.hp * 0.2;

            logData.validation = {
                animal: metadata.animal,
                expectedHP: metadata.hp,
                actualHP: health,
                hpDiff,
                match: hpMatch,
                prefab: metadata.prefab
            };
        }

        // JSON for parsing
        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.NewLivingCreature, logData);

        // Human-readable format
        const stateIcon = isAlive ? '🟢' : '🔴';
        const matchIcon = metadata?.validation?.match ? '✓' : '?';
        const animalInfo = metadata ? ` → ${metadata.animal}` : '';
        const hpValidation = metadata ? ` (expected ~${metadata.validation.expectedHP}, diff: ${metadata.validation.hpDiff})` : '';

        window.logger?.debug(CATEGORIES.HARVEST, EVENTS.LivingCreatureCSV, {
            typeId: typeId,
            name: name,
            tier: tier,
            enchant: realEnchant,
            health: health,
            stateIcon: stateIcon,
            matchIcon: matchIcon,
            hpValidation: hpValidation,
            animalInfo: animalInfo
        });
    }

    saveCachedTypeIDs() {
        try {
            const entries = Array.from(this.staticResourceTypeIDs.entries())
                .filter(([typeId]) => typeId !== 65535); // Skip unstable TypeID only
            settingsSync.setJSON('cachedStaticResourceTypeIDs', entries);
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Échec critique de sauvegarde
            if (window.logger) {
                window.logger.error(CATEGORIES.MOB, EVENTS.SaveCacheFailed, e);
            }
        }
    }

    clearCachedTypeIDs() {
        try {
            const count = this.staticResourceTypeIDs.size;
            settingsSync.remove('cachedStaticResourceTypeIDs');
            this.staticResourceTypeIDs.clear();
            this._registrationLogState.clear();
            // ℹ️ INFO (toujours loggé) - Action utilisateur importante
            if (window.logger) {
                window.logger.info(CATEGORIES.MOB, EVENTS.CacheCleared, { count });
            }
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Échec critique
            if (window.logger) {
                window.logger.error(CATEGORIES.MOB, EVENTS.ClearCacheFailed, e);
            }
            throw e;
        }
    }

    showCachedTypeIDs() {
        // ℹ️ INFO (always logged) - Display cache (user action)
        if (window.logger) {
            const sorted = Array.from(this.staticResourceTypeIDs.entries())
                .sort((a, b) => a[0] - b[0]);

            const entries = sorted.map(([typeId, info]) => ({
                typeId,
                type: info.type,
                tier: info.tier
            }));

            window.logger.info(CATEGORIES.MOB, EVENTS.DisplayCachedTypeIDs, {
                total: this.staticResourceTypeIDs.size,
                entries
            });
        }
    }

    normalizeNumber(value, defaultValue = null) {
        if (value === undefined || value === null) return defaultValue;
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
    }


    registerStaticResourceTypeID(typeId, typeNumber, tier) {
        if (typeId === 65535) return;

        // 🔧 PRIORITY 1: Check mobinfo first (overrides game bugs)
        const knownInfo = this.mobinfo && this.mobinfo[typeId];
        let resourceType;

        if (knownInfo && knownInfo[2]) {
            // Use mobinfo name (Fiber, Hide, Wood, Ore, Rock)
            resourceType = knownInfo[2];
            window.logger?.debug(CATEGORIES.MOB, EVENTS.UsingMobInfo, {
                    typeId,
                    resourceType,
                    tier,
                    gameTypeNumber: typeNumber
                });
        } else {
            // Fallback: use game's typeNumber
            resourceType = this.getResourceTypeFromNumber(typeNumber);
        }

        if (!resourceType) return;

        const existing = this.staticResourceTypeIDs.get(typeId);

        // 📊 Log EVERY registration for analysis (capture typeNumber from game)
        if (window.logger) {
            const isUpdate = !!existing;
            const changed = existing && (existing.type !== resourceType || existing.tier !== tier);

            // ℹ️ INFO (toujours loggé) - Enregistrement de TypeID statique (important pour collection)
            window.logger.info(CATEGORIES.MOB, isUpdate ? (changed ? 'STATIC_UPDATE' : 'STATIC_DUPLICATE') : 'STATIC_REGISTER', {
                typeId,
                typeNumber,
                resourceType,
                tier,
                existing: existing || null,
                changed,
                source: knownInfo ? 'mobinfo' : 'game-typeNumber'
            });
        }

        if (existing && existing.type === resourceType && existing.tier === tier) {
            return;
        }

        this.staticResourceTypeIDs.set(typeId, {type: resourceType, tier: tier});
        this.saveCachedTypeIDs();
    }

    getResourceTypeFromNumber(typeNumber) {
        if (typeof typeNumber !== 'number') return null;
        if (typeNumber >= 0 && typeNumber <= 5) return 'Log';
        else if (typeNumber >= 6 && typeNumber <= 10) return 'Rock';
        else if (typeNumber >= 11 && typeNumber <= 15) return 'Fiber';
        else if (typeNumber >= 16 && typeNumber <= 22) return 'Hide';
        else if (typeNumber >= 23 && typeNumber <= 27) return 'Ore';
        return null;
    }

    updateMobInfo(newData) {
        try {
            this.mobinfo = Object.assign({}, newData);
        } catch (e) {
            window.logger?.error(CATEGORIES.MOB, 'UpdateMobInfoError', e);
            this.mobinfo = {};
        }
    }

    NewMobEvent(parameters) {
        try {
            const mobId = parseInt(parameters[0]);
            const typeId = parseInt(parameters[1]);

            // 🐛 DEBUG ULTRA-DÉTAILLÉ: Log ALL parameters pour identifier patterns
            const allParams = {};
            for (let key in parameters) {
                if (parameters.hasOwnProperty(key)) {
                    allParams[`param[${key}]`] = parameters[key];
                }
            }

            window.logger?.debug(CATEGORIES.MOB, EVENTS.NewMobEvent_ALL_PARAMS, {
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
                window.logger?.error(CATEGORIES.MOB, EVENTS.NewMobEvent_NameError, e);
                name = null;
            }

            // 🐛 DEBUG: Log raw parameters from server
            window.logger?.debug(CATEGORIES.MOB, EVENTS.NewMobEvent_RAW, {
                mobId, typeId,
                params: {
                    health_normalized: parameters[2],
                    maxHP: parameters[13],
                    rarity: parameters[19],
                    enchant: parameters[33],
                    name
                }
            });

            // 🔍 DEBUG: Log ALL parameters for living resources to find enchantment
            const knownInfo = this.mobinfo[typeId];
            if (knownInfo && (knownInfo[1] === 0 || knownInfo[1] === 1)) { // Living resources
                window.logger?.debug(CATEGORIES.MOB, EVENTS.NewLivingCreature, {
                    typeId,
                    allParams: {
                        p19_rarity: parameters[19],
                        p33_enchant: parameters[33],
                        p8: parameters[8],
                        p9: parameters[9],
                        p252: parameters[252]
                    }
                });
            }

            if (name) {
                this.AddMist(mobId, posX, posY, name, enchant);
            } else {
                this.AddEnemy(mobId, typeId, posX, posY, healthNormalized, maxHealth, enchant, rarity);
            }
        } catch (e) {
            // ❌ ERROR (toujours loggé) - Erreur critique lors de NewMobEvent
            if (window.logger) {
                window.logger.error(CATEGORIES.MOB, EVENTS.NewMobEventError, e);
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
        const normHealth = Number(actualHealth) || 0;

        // Get known info from mobinfo database
        const knownInfo = this.mobinfo[typeId];
        let hasKnownInfo = false;
        if (Array.isArray(knownInfo)) {
            mob.tier = knownInfo[0] || 0;
            mob.type = knownInfo[1] || EnemyType.Enemy;
            mob.name = knownInfo[2] || null;
            hasKnownInfo = true;
        }

        // 🐛 DEBUG: Log enemy creation with type info
        window.logger?.debug(CATEGORIES.MOB, EVENTS.NewMobDebug, {
            id: id,
            typeId: typeId,
            health: `${mob.getCurrentHP()}/${maxHealth}`,
            healthPercent: mob.getHealthPercent(),
            enchant: enchant,
            rarity: rarity,
            assignedType: mob.type,
            typeName: this.getEnemyTypeName(mob.type),
            name: mob.name,
            hasKnownInfo: hasKnownInfo
        });

        // Get cross-referenced static resource info
        const staticInfo = this.staticResourceTypeIDs.get(typeId);

        // Classification: mobinfo > staticInfo
        if (hasKnownInfo && (knownInfo[1] === EnemyType.LivingHarvestable || knownInfo[1] === EnemyType.LivingSkinnable)) {
            mob.type = knownInfo[1];
        } else if (staticInfo && normHealth > 0) {
            mob.type = EnemyType.LivingHarvestable;
            if (!mob.tier || mob.tier === 0) mob.tier = staticInfo.tier;
            if (!mob.name) mob.name = staticInfo.type;
        }

        // Calculate REAL enchantment using centralized method (after tier/type/name are set)
        if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
            mob.enchantmentLevel = this.calculateEnchantment(mob.type, mob.tier, rarity, enchant);
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
                // For identified enemies, filter by their specific level (Normal, Medium, Enchanted, MiniBoss, Boss)
                const enemyLevelIndex = mob.type - EnemyType.Enemy; // 0-4 for Enemy through Boss
                const settingsEnemyIndexNames = ['settingNormalEnemy', 'settingMediumEnemy', 'settingEnchantedEnemy', 'settingMiniBossEnemy', 'settingBossEnemy'];
                if (enemyLevelIndex >= 0 && enemyLevelIndex < settingsEnemyIndexNames.length) {
                    const settingName = settingsEnemyIndexNames[enemyLevelIndex];
                    if (settingsSync.getBool(settingName) === false) {
                        return; // Skip if this enemy level is disabled
                    }
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

        // 📊 Enhanced logging for living creatures
        if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
            this.logLivingCreatureEnhanced(id, typeId, healthNormalized, enchant, rarity, mob.tier, mob.type, mob.name);
        }
    }

    removeMob(id) {
        const before = this.mobsList.length;
        this.mobsList = this.mobsList.filter(m => m.id !== id);
        this.harvestablesNotGood = this.harvestablesNotGood.filter(x => x.id !== id);
        const after = this.mobsList.length;

        // 🐛 DEBUG (filtré par debugEnemies) - Suppression de mob détaillée
        if (before !== after) {
            window.logger?.debug(CATEGORIES.MOB, EVENTS.MobRemoved, {
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
        }
    }

    updateEnchantEvent(parameters) {
        const mobId = parameters[0];
        const enchantmentLevel = parameters[1];
        const found = this.mobsList.find(m => m.id === mobId) || this.harvestablesNotGood.find(m => m.id === mobId);
        if (found) {
            found.enchantmentLevel = enchantmentLevel;
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
        window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.HealthUpdate, {
            mobId: mobId,
            oldHP: oldHP,
            newHP: currentHP,
            maxHealth: mob.maxHealth,
            delta: hpDelta,
            attackerId: attackerId
        });

        // Handle death (currentHP is undefined when entity dies)
        if (currentHP === undefined || currentHP <= 0) {
            window.logger?.debug(CATEGORIES.MOB, EVENTS.MobDied, {
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

        window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.RegenerationHealthChanged_DETAIL, {
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
            window.logger?.debug(CATEGORIES.MOB_HEALTH, EVENTS.BulkHPUpdate, {
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
        if (this.mistList.some(m => m.id === id)) return;
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
        }
    }

    updateMistEnchantmentLevel(id, enchantmentLevel) {
        const mist = this.mistList.find(m => m.id === id);
        if (mist) {
            mist.enchant = enchantmentLevel;
        }
    }

    Clear() {
        this.mobsList = [];
        this.mistList = [];
        this.harvestablesNotGood = [];
    }

    updateMobInfoEntry(typeId, entry) {
        this.mobinfo[typeId] = entry;
    }

    getMobInfo(typeId) {
        return this.mobinfo[typeId] || null;
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
}
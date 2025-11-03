const EnemyType =
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

class Mob
{
    constructor(id, typeId, posX, posY, health, enchantmentLevel, rarity)
    {
        this.id = id;
        this.typeId = typeId;
        this.posX = posX;
        this.posY = posY;
        this.health = health;
        this.enchantmentLevel = enchantmentLevel;
        this.rarity = rarity;
        this.tier = 0;
        this.type = EnemyType.Enemy;
        this.name = null;
        this.exp = 0;
        this.hX = 0;
        this.hY = 0;
    }
}

class Mist
{
    constructor(id, posX, posY, name, enchant)
    {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.name = name;
        this.enchant = enchant;
        this.hX = 0;
        this.hY = 0;

        if (name.toLowerCase().includes("solo"))
        {
            this.type = 0;
        }
        else
        {
            this.type = 1;
        }
    }
}

class MobsHandler {
    constructor(settings) {
        this.settings = settings;
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
                console.log(`[MobsHandler] ✅ Loaded ${this.livingResourcesMetadata.length} living resources metadata`);
            }
        } catch (e) {
            console.warn('[MobsHandler] Could not load living resources metadata:', e);
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

    printLoggingGuide() {
        if (!this.settings.logLivingCreatures) return;

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║         📋 LIVING RESOURCES COLLECTION GUIDE                   ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('🎯 OBJECTIF: Collecter les TypeIDs des créatures enchantées');
        console.log('');
        console.log('📊 FORMAT DES LOGS:');
        console.log('  - JSON structuré: Pour parsing automatique');
        console.log('  - Validation HP: ✓ si HP correspond à la créature attendue');
        console.log('  - État: ALIVE/DEAD pour suivre les kills');
        console.log('');
        console.log('🔍 CRÉATURES PAR TIER:');

        if (this.livingResourcesMetadata) {
            const tiers = [3, 4, 5, 6, 7, 8];
            tiers.forEach(tier => {
                const creatures = this.livingResourcesMetadata.filter(m => m.tier === tier && m.faction);
                if (creatures.length > 0) {
                    console.log(`\n  T${tier} Hide/Fiber:`);
                    const uniqueAnimals = [...new Set(creatures.map(c => c.animal))];
                    uniqueAnimals.slice(0, 3).forEach(animal => {
                        const example = creatures.find(c => c.animal === animal);
                        console.log(`    - ${animal} (HP ~${example.hp})`);
                    });
                }
            });
        }

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('✅ Logging actif - Bonne collecte!\n');
    }

    loadCachedTypeIDs() {
        try {
            const cached = localStorage.getItem('cachedStaticResourceTypeIDs');
            if (cached) {
                const entries = JSON.parse(cached);
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
                console.log(`[MobsHandler] ✅ Loaded ${loadedCount} cached TypeID mappings${skippedCount > 0 ? ` (skipped ${skippedCount} unstable)` : ''}`);
            }
        } catch (e) {
            console.error('[MobsHandler] Failed to load cached TypeIDs from localStorage:', e);
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
        if (!this.settings.logLivingCreatures) return;

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
        console.log(`[LIVING_JSON] ${JSON.stringify(logData)}`);

        // Human-readable format
        const stateIcon = isAlive ? '🟢' : '🔴';
        const matchIcon = metadata?.validation?.match ? '✓' : '?';
        const animalInfo = metadata ? ` → ${metadata.animal}` : '';
        const hpValidation = metadata ? ` (expected ~${metadata.validation.expectedHP}, diff: ${metadata.validation.hpDiff})` : '';

        console.log(`${stateIcon} ${matchIcon} TypeID ${typeId} | ${name} T${tier}.${realEnchant} | HP: ${health}${hpValidation}${animalInfo}`);
    }

    // 💾 Save cached TypeID mappings to localStorage
    saveCachedTypeIDs() {
        try {
            const entries = Array.from(this.staticResourceTypeIDs.entries())
                .filter(([typeId]) => typeId !== 65535); // Skip unstable TypeID only
            localStorage.setItem('cachedStaticResourceTypeIDs', JSON.stringify(entries));
        } catch (e) {
            console.error('[MobsHandler] Failed to save cache:', e);
        }
    }

    clearCachedTypeIDs() {
        try {
            const count = this.staticResourceTypeIDs.size;
            localStorage.removeItem('cachedStaticResourceTypeIDs');
            this.staticResourceTypeIDs.clear();
            this._registrationLogState.clear();
            console.log(`[MobsHandler] ✅ Cleared ${count} TypeID mappings`);
        } catch (e) {
            console.error('[MobsHandler] Failed to clear cache:', e);
            throw e;
        }
    }

    showCachedTypeIDs() {
        console.log('═════════════════════════════════════════');
        console.log('📦 CACHED TYPEIDS');
        console.log('═════════════════════════════════════════');

        const sorted = Array.from(this.staticResourceTypeIDs.entries())
            .sort((a, b) => a[0] - b[0]);

        sorted.forEach(([typeId, info]) => {
            console.log(`TypeID ${typeId} → ${info.type} T${info.tier}`);
        });

        console.log(`\n📊 Total: ${this.staticResourceTypeIDs.size} TypeIDs`);
        console.log('═════════════════════════════════════════');
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
            console.log(`[registerStaticResourceTypeID] ✅ Using mobinfo: TypeID ${typeId} = ${resourceType} T${tier} (overriding game typeNumber=${typeNumber})`);
        } else {
            // Fallback: use game's typeNumber
            resourceType = this.getResourceTypeFromNumber(typeNumber);
        }

        if (!resourceType) return;

        const existing = this.staticResourceTypeIDs.get(typeId);

        // 📊 Log EVERY registration for analysis (capture typeNumber from game)
        if (this.settings && this.settings.logLivingResources) {
            const isUpdate = !!existing;
            const changed = existing && (existing.type !== resourceType || existing.tier !== tier);

            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                module: 'MobsHandler',
                event: isUpdate ? (changed ? 'STATIC_UPDATE' : 'STATIC_DUPLICATE') : 'STATIC_REGISTER',
                typeId: typeId,
                typeNumber: typeNumber,
                resourceType: resourceType,
                tier: tier,
                existing: existing || null,
                changed: changed,
                source: knownInfo ? 'mobinfo' : 'game-typeNumber'
            }));
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
        try { this.mobinfo = Object.assign({}, newData); } catch (e) { this.mobinfo = {}; }
    }

    NewMobEvent(parameters) {
        const id = this.normalizeNumber(parameters[0], 0);
        const typeId = this.normalizeNumber(parameters[1], 0);
        if (typeId === 0) return;

        const loc = parameters[7] || [0, 0];
        const posX = this.normalizeNumber(loc[0], 0);
        const posY = this.normalizeNumber(loc[1], 0);
        const health = this.normalizeNumber(parameters[2], 0) || this.normalizeNumber(parameters[13], 0) || 0;
        const enchant = this.normalizeNumber(parameters[33], 0) || 0;
        const rarity = this.normalizeNumber(parameters[19], null);

        let name;
        try { name = parameters[32] || parameters[31] || null; } catch (e) { name = null; }

        // 🔍 DEBUG: Log ALL parameters for living resources to find enchantment
        if (this.settings && this.settings.logLivingCreatures) {
            const knownInfo = this.mobinfo[typeId];
            if (knownInfo && (knownInfo[1] === 0 || knownInfo[1] === 1)) { // Living resources
                console.log(`[DEBUG_PARAMS] TypeID ${typeId} | params[19]=${parameters[19]} params[33]=${parameters[33]} params[8]=${parameters[8]} params[9]=${parameters[9]} params[252]=${parameters[252]}`);
            }
        }

        if (name) {
            this.AddMist(id, posX, posY, name, enchant);
        } else {
            this.AddEnemy(id, typeId, posX, posY, health, enchant, rarity);
        }
    }

    AddEnemy(id, typeId, posX, posY, health, enchant, rarity) {
        if (this.mobsList.some(m => m.id === id)) return;
        if (this.harvestablesNotGood.some(m => m.id === id)) return;

        const mob = new Mob(id, typeId, posX, posY, health, enchant, rarity);
        const normHealth = Number(health) || 0;

        // Get known info from mobinfo database
        const knownInfo = this.mobinfo[typeId];
        let hasKnownInfo = false;
        if (Array.isArray(knownInfo)) {
            mob.tier = knownInfo[0] || 0;
            mob.type = knownInfo[1] || EnemyType.Enemy;
            mob.name = knownInfo[2] || null;
            hasKnownInfo = true;
        }

        // Get cross-referenced static resource info
        const staticInfo = this.staticResourceTypeIDs.get(typeId);

        // Classification: mobinfo > staticInfo
        if (hasKnownInfo && (knownInfo[1] === EnemyType.LivingHarvestable || knownInfo[1] === EnemyType.LivingSkinnable)) {
            mob.type = knownInfo[1];
        }
        else if (staticInfo && normHealth > 0) {
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
                let settingKey = null;

                if (resourceType === 'Fiber' || resourceType === 'fiber') settingKey = 'harvestingLivingFiber';
                else if (resourceType === 'Hide' || resourceType === 'hide') settingKey = 'harvestingLivingHide';
                else if (resourceType === 'Wood' || resourceType === 'Logs') settingKey = 'harvestingLivingWood';
                else if (resourceType === 'Ore' || resourceType === 'ore') settingKey = 'harvestingLivingOre';
                else if (resourceType === 'Rock' || resourceType === 'rock') settingKey = 'harvestingLivingRock';

                if (settingKey && this.settings[settingKey]) {
                    const enchantKey = `e${mob.enchantmentLevel}`;
                    const tierIndex = mob.tier - 1;

                    if (this.settings[settingKey][enchantKey] && this.settings[settingKey][enchantKey][tierIndex] === false) {
                        return;
                    }
                }
            }
        }

        this.mobsList.push(mob);

        // 📊 Enhanced logging for living creatures
        if (this.settings && this.settings.logLivingCreatures) {
            if (mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable) {
                this.logLivingCreatureEnhanced(id, typeId, health, enchant, rarity, mob.tier, mob.type, mob.name);
            }
        }
    }

    removeMob(id) {
        const before = this.mobsList.length;
        this.mobsList = this.mobsList.filter(m => m.id !== id);
        this.harvestablesNotGood = this.harvestablesNotGood.filter(x => x.id !== id);
        const after = this.mobsList.length;

        if (this.settings && this.settings.logLivingResources && before !== after) {
            console.log(`[MobsHandler] 🗑️ Removed mob ${id} (living resources: ${before} → ${after})`);
        }
    }

    updateMobPosition(id, posX, posY) {
        const m = this.mobsList.find(x => x.id === id);
        if (m) { m.posX = posX; m.posY = posY; }
    }

    updateEnchantEvent(parameters) {
        const mobId = parameters[0];
        const enchantmentLevel = parameters[1];
        const found = this.mobsList.find(m => m.id === mobId) || this.harvestablesNotGood.find(m => m.id === mobId);
        if (found) { found.enchantmentLevel = enchantmentLevel; }
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
        if (mist) { mist.posX = posX; mist.posY = posY; }
    }

    updateMistEnchantmentLevel(id, enchantmentLevel) {
        const mist = this.mistList.find(m => m.id === id);
        if (mist) { mist.enchant = enchantmentLevel; }
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobsHandler;
}


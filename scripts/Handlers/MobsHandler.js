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

        this.loadCachedTypeIDs();
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
            console.error('[MobsHandler] Failed to load cache:', e);
        }
    }

    saveCachedTypeIDs() {
        try {
            const entries = Array.from(this.staticResourceTypeIDs.entries())
                .filter(([typeId]) => typeId !== 65535);
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
        console.log('🔍 TypeID Cache Status');
        console.log('═════════════════════════════════════════');
        console.log(`\n📦 In-Memory (${this.staticResourceTypeIDs.size} entries):`);
        if (this.staticResourceTypeIDs.size > 0) {
            this.staticResourceTypeIDs.forEach((info, typeId) => {
                console.log(`  TypeID ${typeId}: ${info.type} T${info.tier}`);
            });
        } else {
            console.log('  (empty)');
        }
        console.log('═════════════════════════════════════════\n');
    }

    normalizeNumber(value, defaultValue = null) {
        if (value === undefined || value === null) return defaultValue;
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
    }

    structuredLog(event, payload) {
        const record = Object.assign({
            timestamp: new Date().toISOString(),
            module: 'MobsHandler',
            event: event
        }, payload);

        if (!this.settings || !this.settings.logLivingResources) return;

        // Always log as JSON (NDJSON format)
        console.log(JSON.stringify(record));
    }

    registerStaticResourceTypeID(typeId, typeNumber, tier) {
        if (typeId === 65535) return;

        const resourceType = this.getResourceTypeFromNumber(typeNumber);
        if (!resourceType) return;

        const existing = this.staticResourceTypeIDs.get(typeId);
        if (existing && existing.type === resourceType && existing.tier === tier) {
            return;
        }

        this.staticResourceTypeIDs.set(typeId, {type: resourceType, tier: tier});
        this.saveCachedTypeIDs();
    }

    getResourceTypeFromNumber(typeNumber) {
        if (typeof typeNumber !== 'number') return null;
        if (typeNumber >= 0 && typeNumber <= 5) return 'Wood';
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

        let name = null;
        try { name = parameters[32] || parameters[31] || null; } catch (e) { name = null; }

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

        // Logging
        if (this.settings && this.settings.logLivingResources) {
            const classification = (mob.type === EnemyType.LivingHarvestable) ? 'LIVING_RESOURCE' :
                                  (mob.type === EnemyType.LivingSkinnable) ? 'LIVING_SKINNABLE' : 'ENEMY';

            let emoji = '⚔️';
            if (mob.type === EnemyType.LivingHarvestable) emoji = '🌿';
            else if (mob.type === EnemyType.LivingSkinnable) emoji = '🐾';

            let resolvedBy = 'unknown';
            if (hasKnownInfo) resolvedBy = 'mobinfo';
            else if (staticInfo) resolvedBy = 'cross-reference';

            this.structuredLog('SPAWN', {
                entityId: mob.id,
                reportedTypeId: mob.typeId,
                resolvedBy: resolvedBy,
                classification: classification,
                knownInfo: knownInfo || null,
                staticInfo: staticInfo || null,
                health: normHealth,
                enchant: mob.enchantmentLevel,
                rarity: mob.rarity,
                tier: mob.tier,
                name: mob.name,
                posX: mob.posX,
                posY: mob.posY,
                emoji: emoji
            });
        }
    }

    removeMob(id) {
        this.mobsList = this.mobsList.filter(m => m.id !== id);
        this.harvestablesNotGood = this.harvestablesNotGood.filter(x => x.id !== id);
    }

    updateMobPosition(id, posX, posY) {
        const m = this.mobsList.find(x => x.id === id);
        if (m) { m.posX = posX; m.posY = posY; }
    }

    updateEnchantEvent(parameters) {
        const mobId = parameters[0];
        const enchantmentLevel = parameters[1];
        const found = this.mobsList.find(m => m.id == mobId) || this.harvestablesNotGood.find(m => m.id == mobId);
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


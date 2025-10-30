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

// MIST PORTALS ??
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

class MobsHandler
{
    constructor(settings)
    {
        this.settings = settings;

        this.mobsList = [];
        this.mistList = [];
        this.mobinfo = {};

        this.harvestablesNotGood = [];

        // 🔍 Enhanced logging tracking
        this.detectedTypeIDs = new Set(); // Track unique TypeIDs
        this.loggingStartTime = null;

        // 🔗 Cross-reference with HarvestablesHandler
        this.staticResourceTypeIDs = new Map(); // TypeID → {type: 'Fiber'|'Hide'|'Wood'|'Ore'|'Rock', tier: number}

        // (no DOM wiring here — UI buttons are bound centrally in Utils.js)
    }

    // New helper: normalize numeric values coming from parameters
    normalizeNumber(value, defaultValue = null) {
        if (value === undefined || value === null) return defaultValue;
        const n = Number(value);
        if (Number.isFinite(n)) return n;
        return defaultValue;
    }

    // New helper: structured NDJSON logger for machine parsing
    structuredLog(event, payload) {
        const record = Object.assign({
            timestamp: new Date().toISOString(),
            module: 'MobsHandler',
            event: event
        }, payload);

        const wantLivingLogs = this.settings && this.settings.logLivingResources;
        if (!wantLivingLogs) return; // nothing to do

        const wantHuman = this.settings && this.settings.logLivingHuman;

        // If user wants JSON output for living logs, emit only NDJSON
        if (!wantHuman) {
            try { console.log(JSON.stringify(record)); }
            catch (err) { console.log(record); }
            return;
        }

        // Otherwise wantHuman === true => pretty human output only (no NDJSON for living)
        try {
            if (event !== 'SPAWN' || !payload || !payload.classification || !payload.classification.startsWith('LIVING')) return;

            const time = new Date(record.timestamp).toLocaleTimeString();
            const id = payload.entityId || '';
            const repType = payload.reportedTypeId != null ? payload.reportedTypeId : '';
            const resType = payload.resolvedTypeId != null ? payload.resolvedTypeId : '';
            const resolvedBy = payload.resolvedBy || '';
            const cls = payload.classification || '';
            const health = (payload.health != null) ? payload.health : '';
            const enchant = (payload.enchant != null) ? payload.enchant : null;
            const rarity = (payload.rarity != null) ? payload.rarity : '—';
            const posX = (payload.posX != null) ? payload.posX.toFixed(2) : '—';
            const posY = (payload.posY != null) ? payload.posY.toFixed(2) : '—';
            const emoji = payload.emoji || '';

            // Determine resource subtype for human-readable display (Hide/Fiber/Rock/etc.)
            // resourceSubType: prefer staticInfo.type; fallback: if knownInfo marks LivingSkinnable => 'Hide'
            let resourceSubType = null;
            let name = '';
            let tier = '';
            if (payload.staticInfo && payload.staticInfo.type) {
                resourceSubType = payload.staticInfo.type;
                name = name || payload.staticInfo.type || '';
                tier = tier || (payload.staticInfo.tier != null ? payload.staticInfo.tier : '');
            }

            if ((!name || !tier) && payload.knownInfo && Array.isArray(payload.knownInfo)) {
                tier = payload.knownInfo[0] != null ? payload.knownInfo[0] : '';
                name = payload.knownInfo[2] || '';
                try {
                    if (!resourceSubType && payload.knownInfo[1] === EnemyType.LivingSkinnable) {
                        resourceSubType = 'Hide';
                    }
                } catch (e) { /* ignore */ }
            }

            // Detect conflicts between known info and static cross-ref
            let conflictNote = '';
            if (payload.knownInfo && payload.staticInfo) {
                try {
                    const knownType = payload.knownInfo[1];
                    const staticTypeLabel = payload.staticInfo.type || '';
                    if (knownType === 0 && staticTypeLabel && staticTypeLabel.toUpperCase() !== 'FIBER' && staticTypeLabel.toUpperCase() !== 'HIDE' && staticTypeLabel.toUpperCase() !== 'WOOD' && staticTypeLabel.toUpperCase() !== 'ORE' && staticTypeLabel.toUpperCase() !== 'ROCK') {
                        conflictNote = `⚠️ CONFLICT known(${payload.knownInfo}) vs static(${JSON.stringify(payload.staticInfo)})`;
                    } else if (knownType !== 0 && staticTypeLabel) {
                        // both present but different classification
                        conflictNote = `⚠️ CONFLICT knownType=${knownType} vs staticType=${staticTypeLabel}`;
                    }
                } catch (e) { /* ignore */ }
            }

            // Clarify whether the number reported is Enchant or Tier: display both
            const tierDisplay = tier ? `T${tier}` : 'T?';
            const enchantDisplay = (typeof enchant === 'number') ? `e${enchant}` : '';

            const aliveMarker = (typeof health === 'number' && health > 0) ? '✅ ALIVE' : (health === 0 ? '❌ DEAD' : '');

            console.log('┌' + '─'.repeat(70));
            // Display unified living classification but show subtype (hide/rock/fiber) and name/tier
            const subtypeText = resourceSubType ? `${resourceSubType}` : (name ? `${name}` : '');
            console.log(`│ ${emoji} ${cls} ${subtypeText ? `- ${subtypeText} ${tierDisplay}` : `${tierDisplay}`} ${conflictNote}`);
            console.log('├' + '─'.repeat(70));
            console.log(`│ ⏰ Time:      ${time}`);
            console.log(`│ 🆔 EntityID:  ${id}`);
            console.log(`│ 🔢 TypeIDs:   reported=${repType} resolved=${resType} (${resolvedBy || 'source? '})`);
            console.log(`│ 🏷️ Tier/Enchant: ${tierDisplay} ${enchantDisplay}`);
            console.log(`│ ❤️ Health:     ${health} ${aliveMarker}`);
            console.log(`│ ✨ Enchant:     ${enchantDisplay}`);
            console.log(`│ 💎 Rarity:      ${rarity}`);
            console.log(`│ 📍 Position:    (${posX}, ${posY})`);
            console.log('└' + '─'.repeat(70));
        } catch (e) {
            console.error('Logger pretty-print failed', e);
        }
    }

    // New helper: decide if we should emit a log line (filter enemy spam)
    shouldLogCreature(classification, staticInfo, isLikelyLivingResource, settings) {
        // Always log living resources or cross-referenced types
        if (classification && classification.startsWith('LIVING')) return true;
        if (staticInfo) return true;

        // If user asked to see unmanaged enemies explicitly, allow it
        if (settings && settings.showUnmanagedEnemies) return true;

        // Otherwise, skip logging plain ENEMY to reduce spam
        if (classification === 'ENEMY') return false;

        // Default: log (unknowns) only if verbose/DEBUG mode
        return (settings && settings.logVerbose);
    }

    // 🔗 Called by HarvestablesHandler to register static resource TypeIDs
    registerStaticResourceTypeID(typeId, typeNumber, tier)
    {
        const resourceType = this.getResourceTypeFromNumber(typeNumber);

        if (resourceType && !this.staticResourceTypeIDs.has(typeId)) {
            this.staticResourceTypeIDs.set(typeId, { type: resourceType, tier: tier });

            if (this.settings.logLivingResources) {
                // keep a structured registration log
                this.structuredLog('CROSS_REFERENCE_REGISTERED', {
                    typeId: typeId,
                    staticType: resourceType,
                    staticTier: tier
                });
            }
        }
    }

    // Convert HarvestablesHandler type number to resource type
    getResourceTypeFromNumber(typeNumber)
    {
        if (typeNumber >= 0 && typeNumber <= 5) return 'Wood';
        else if (typeNumber >= 6 && typeNumber <= 10) return 'Rock';
        else if (typeNumber >= 11 && typeNumber <= 15) return 'Fiber';
        else if (typeNumber >= 16 && typeNumber <= 22) return 'Hide';
        else if (typeNumber >= 23 && typeNumber <= 27) return 'Ore';
        else return null;
    }

    updateMobInfo(newData)
    {
        this.mobinfo = newData;
    }

    NewMobEvent(parameters)
    {
        // Removed raw parameters dump to avoid noisy truncated objects

        const id = this.normalizeNumber(parameters[0], 0); // entity id
        let typeId = this.normalizeNumber(parameters[1], 0); // real type id

        const loc = parameters[7] || [0,0];
        let posX = this.normalizeNumber(loc[0], 0);
        let posY = this.normalizeNumber(loc[1], 0);

        let exp = 0
        try
        {
            exp = this.normalizeNumber(parameters[13], 0);
        }
        catch (error)
        {
            exp = 0;
        }

        let name = null;
        try
        {
            name = parameters[32] || parameters[31] || null;
        }
        catch (error)
        {
            name = null;
        }

        let enchant = this.normalizeNumber(parameters[33], 0);

        let rarity = this.normalizeNumber(parameters[19], null);

        if (name != null)
        {
            this.AddMist(id, posX, posY, name, enchant);
        }
        else
        {
            this.AddEnemy(id, typeId, posX, posY, exp, enchant, rarity, parameters);
        }
    }


    AddEnemy(id, typeId, posX, posY, health, enchant, rarity, parameters)
    {
        if (this.mobsList.some(mob => mob.id === id))
            return;

        if (this.harvestablesNotGood.some(mob => mob.id === id))
            return;

        const h = new Mob(id, typeId, posX, posY, health, enchant, rarity);

        // Prepare normalized values
        const normHealth = this.normalizeNumber(health, 0);
        const normEnchant = this.normalizeNumber(enchant, 0);
        const normRarity = this.normalizeNumber(rarity, null);

        // Initialize logging session if needed
        if (!this.loggingStartTime) {
            this.loggingStartTime = new Date();
        }

        // Track unique TypeIDs
        if (!this.detectedTypeIDs.has(typeId)) {
            this.detectedTypeIDs.add(typeId);
        }

        // Collect candidate TypeIDs from other parameter positions to help detect mis-indexed events
        const candidateIndices = [1,6,9,13,17,22,30,252];
        const candidateTypeIds = [];
        try {
            if (parameters) {
                candidateIndices.forEach(idx => {
                    const v = parameters[idx];
                    const n = this.normalizeNumber(v, null);
                    if (n !== null && n !== typeId) candidateTypeIds.push({ idx, value: n });
                });
            }
        } catch (e) {
            // ignore
        }

        // Try to resolve a better TypeID: prefer candidates that map to static resources or known living mobinfo
        let resolvedTypeId = typeId;
        let resolvedBy = 'reported';

        const isLivingMobInfo = (info) => {
            if (!info) return false;
            try { return info[1] === EnemyType.LivingHarvestable || info[1] === EnemyType.LivingSkinnable; } catch (e) { return false; }
        };

        // If reported typeId has no static or known info, search candidates
        const reportedStatic = this.staticResourceTypeIDs.get(typeId);
        const reportedKnown = this.mobinfo[typeId];

        if (!reportedStatic && !isLivingMobInfo(reportedKnown) && candidateTypeIds.length > 0) {
            for (const c of candidateTypeIds) {
                const cand = c.value;
                if (this.staticResourceTypeIDs.has(cand)) {
                    resolvedTypeId = cand; resolvedBy = `candidate_idx_${c.idx}`; break;
                }
                const k = this.mobinfo[cand];
                if (isLivingMobInfo(k)) { resolvedTypeId = cand; resolvedBy = `candidate_idx_${c.idx}`; break; }
            }

            // Informative SUSPECT_TYPEID log when we replaced the id
            if (resolvedTypeId !== typeId && this.settings && this.settings.debugTypeIdMapping) {
                this.structuredLog('SUSPECT_TYPEID_RESOLVED', {
                    entityId: id,
                    reportedTypeId: typeId,
                    resolvedTypeId: resolvedTypeId,
                    resolvedBy: resolvedBy,
                    candidates: candidateTypeIds
                });
            }
            else if (this.settings && this.settings.debugTypeIdMapping) {
                // If not resolved, still emit SUSPECT_TYPEID for inspection
                this.structuredLog('SUSPECT_TYPEID', {
                    entityId: id,
                    reportedTypeId: typeId,
                    classificationGuessed: null,
                    candidates: candidateTypeIds,
                    paramCount: parameters ? Object.keys(parameters).length : 0
                });
            }
        }

        // After resolution, fetch staticInfo/knownInfo for resolvedTypeId
        const staticInfoResolved = this.staticResourceTypeIDs.get(resolvedTypeId);
        const knownInfoResolved = this.mobinfo[resolvedTypeId];

        // 🔍 Improved classification using resolved info + heuristics
         const resolvedKnownInfo = knownInfoResolved || reportedKnown;
         const resolvedStaticInfo = staticInfoResolved || reportedStatic;

         let creatureType = 'UNKNOWN';
         let emoji = '❓';

        // If we have a registered static resource for this typeId -> trust it
        if (resolvedStaticInfo) {
            creatureType = 'LIVING_RESOURCE';
            emoji = (resolvedStaticInfo.type === 'Hide') ? '🐾' : '🌿';
        }
        // Else if we know the mob in mobinfo, use the type field but avoid name string parsing
        else if (resolvedKnownInfo) {
            const kt = resolvedKnownInfo[1];
            if (kt === EnemyType.LivingHarvestable || kt === EnemyType.LivingSkinnable) {
                creatureType = 'LIVING_RESOURCE';
                // Only special-case skinnable for emoji/subtype
                if (kt === EnemyType.LivingSkinnable) {
                    emoji = '🐾';
                } else {
                    emoji = '🌿';
                }
            } else if (kt >= EnemyType.Enemy && kt <= EnemyType.Boss) {
                creatureType = 'ENEMY'; emoji = '⚔️';
            } else creatureType = 'UNKNOWN';
        }
         else {
             // Heuristics fallback using resolvedTypeId
             const isLikelyLivingResource = (resolvedTypeId < 600 && normHealth >= 20 && normHealth <= 2000 && (normRarity === null || (normRarity >= 70 && normRarity <= 150)));
             const isLikelyEnemy = (resolvedTypeId >= 1500 || (normRarity !== null && normRarity > 150));

             if (isLikelyLivingResource) { creatureType = 'LIVING_RESOURCE'; emoji = '🌿'; }
             else if (isLikelyEnemy) { creatureType = 'ENEMY'; emoji = '⚔️'; }
             else { creatureType = 'UNKNOWN'; }
         }

        // Decide whether to log this event (reduce enemy spam)
        const shouldLog = this.shouldLogCreature(creatureType, resolvedStaticInfo, (creatureType.startsWith('LIVING') || creatureType === 'LIVING_RESOURCE'), this.settings);

        if (shouldLog && this.settings && this.settings.logLivingResources) {
            // Build structured payload
            const payload = {
                entityId: id,
                reportedTypeId: typeId,
                resolvedTypeId: resolvedTypeId,
                resolvedBy: resolvedBy,
                classification: creatureType,
                knownInfo: resolvedKnownInfo || null,
                staticInfo: resolvedStaticInfo || null,
                health: normHealth,
                enchant: normEnchant,
                rarity: normRarity,
                posX: Number(posX),
                posY: Number(posY),
                emoji: emoji
            };

            // Optionally include raw parameters only in debug
            if (this.settings.logRawParams) payload.rawParameters = parameters;

            this.structuredLog('SPAWN', payload);
        }

        // Process known mobinfo to decide if we keep or reject the mob for harvesting
        if (this.mobinfo[resolvedTypeId] != null)
        {
            const mobsInfo = this.mobinfo[resolvedTypeId];

            h.tier = mobsInfo[0];
            h.type = mobsInfo[1];
            h.name = mobsInfo[2];

            // Normalise la distinction: on ne veut plus différencier Skinnable vs Harvestable
            if (h.type === EnemyType.LivingSkinnable) {
                h.type = EnemyType.LivingHarvestable;
            }

            // Keep previous human-readable detail only for known living resources if requested
            if (this.settings.logLivingResources && (typeof this.settings.isHumanLogFormat === 'function' ? this.settings.isHumanLogFormat() : this.settings.humanReadableLivingResources)) {
                if (h.type == EnemyType.LivingSkinnable || h.type == EnemyType.LivingHarvestable) {
                    const typeLabel = h.type == EnemyType.LivingSkinnable ? "LivingSkinnable" : "LivingHarvestable";
                    console.log(`🔍 LIVING RESOURCE FOUND (KNOWN): ${typeLabel} ${h.name} T${h.tier} - Health:${normHealth} Enchant:${normEnchant}`);
                }
            }

            if (this.settings.logLivingResources) {
                // minimal separator only when human readable is enabled
                if (this.settings.logLivingHuman) console.log("============================");
                }

            if (h.type == EnemyType.LivingSkinnable)
            {
                if (!this.settings.harvestingLivingHide[`e${normEnchant}`][h.tier-1])
                {
                    this.harvestablesNotGood.push(h);
                    return;
                }

            }
            else if (h.type == EnemyType.LivingHarvestable)
            {
                let iG = true;

                switch (h.name) {
                    case "fiber":
                        if (!this.settings.harvestingLivingFiber[`e${normEnchant}`][h.tier-1]) iG = false;
                        break;

                    case "hide":
                        if (!this.settings.harvestingLivingHide[`e${normEnchant}`][h.tier-1]) iG = false;
                        break;

                    case "Logs":
                        if (!this.settings.harvestingLivingWood[`e${normEnchant}`][h.tier-1]) iG = false;
                        break;

                    case "ore":
                        if (!this.settings.harvestingLivingOre[`e${normEnchant}`][h.tier-1]) iG = false;
                        break;

                    case "rock":
                        if (!this.settings.harvestingLivingRock[`e${normEnchant}`][h.tier-1]) iG = false;
                        break;

                    default:
                        break;
                }

                if (!iG)
                {
                    this.harvestablesNotGood.push(h);
                    return;
                }
            }
            // Should do the work and handle all the enemies
            else if (h.type >= EnemyType.Enemy && h.type <= EnemyType.Boss)
            {
                const offset = EnemyType.Enemy;

                if (!this.settings.enemyLevels[h.type - offset])
                    return;

                if (this.settings.showMinimumHealthEnemies && health < this.settings.minimumHealthEnemies)
                    return;
            }
            else if (h.type == EnemyType.Drone)
            {
                if (!this.settings.avaloneDrones) return;
            }
            else if (h.type == EnemyType.MistBoss)
            {
                if (h.name == "CRYSTALSPIDER" && !this.settings.bossCrystalSpider) return;
                else if (h.name == "FAIRYDRAGON" && !this.settings.settingBossFairyDragon) return;
                else if (h.name == "VEILWEAVER" && !this.settings.bossVeilWeaver) return;
                else if (h.name == "GRIFFIN" && !this.settings.bossGriffin) return;
            }
            // Events
            else if (h.type == EnemyType.Events)
            {
                if (!this.settings.showEventEnemies) return;
            }
            // Unmanaged type
            else if (!this.settings.showUnmanagedEnemies) return;
            else
            {
                if (this.settings.showMinimumHealthEnemies && health < this.settings.minimumHealthEnemies)
                    return;
            }

        }
        // Unmanaged id
        else if (!this.settings.showUnmanagedEnemies) return;
        else
        {
            if (this.settings.showMinimumHealthEnemies && health < this.settings.minimumHealthEnemies)
                return;
        }

        this.mobsList.push(h);
    }

    removeMob(id)
    {
        const pSize = this.mobsList.length;

        this.mobsList = this.mobsList.filter((x) => x.id !== id);

        // That means we already removed the enemy, so it can't be in the other list
        if (this.mobsList.length < pSize) return;

        this.harvestablesNotGood = this.harvestablesNotGood.filter((x) => x.id !== id);
    }

    updateMobPosition(id, posX, posY)
    {
        var enemy = this.mobsList.find((enemy) => enemy.id === id);

        if (enemy)
        {
            enemy.posX = posX;
            enemy.posY = posY;

            return;
        }

        // We don't need to update mobs we don't show yet
        /*enemy = this.harvestablesNotGood.find((enemy) => enemy.id === id);

        if (!enemy) return;

        enemy.posX = posX;
        enemy.posY = posY;*/
    }

    updateEnchantEvent(parameters)
    {
        const mobId = parameters[0];
        const enchantmentLevel = parameters[1];

        // Check in this list for the harvestables & skinnables with the id
        var enemy = this.mobsList.find((mob) => mob.id == mobId);

        if (enemy)
        {
            // normalize any legacy skinnable types to harvestable
            if (enemy.type === EnemyType.LivingSkinnable) enemy.type = EnemyType.LivingHarvestable;
             enemy.enchantmentLevel = enchantmentLevel;
             return;
        }

        // Else try in our not good list
        enemy = this.harvestablesNotGood.find((mob) => mob.id == mobId);

        if (!enemy) return;

        if (enemy.type === EnemyType.LivingSkinnable) enemy.type = EnemyType.LivingHarvestable;
         enemy.enchantmentLevel = enchantmentLevel;

        let hasToSwapFromList = false;

        if (enemy.type == EnemyType.LivingSkinnable)
        {
            if (!this.settings.harvestingLivingHide[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                return;

            hasToSwapFromList = true;
        }
        else if (enemy.type == EnemyType.LivingHarvestable)
        {
            switch (enemy.name) {
                case "fiber":
                    if (!this.settings.harvestingLivingFiber[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                        return;

                    hasToSwapFromList = true;
                    break;

                case "hide":
                    if (!this.settings.harvestingLivingHide[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                        return;

                    hasToSwapFromList = true;
                    break;

                case "Logs":
                    if (!this.settings.harvestingLivingWood[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                        return;

                    hasToSwapFromList = true;
                    break;

                case "ore":
                    if (!this.settings.harvestingLivingOre[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                        return;

                    hasToSwapFromList = true;
                    break;

                case "rock":
                    if (!this.settings.harvestingLivingRock[`e${enemy.enchantmentLevel}`][enemy.tier-1])
                        return;

                    hasToSwapFromList = true;
                    break;

                default:
                    break;
            }
        }

        if (!hasToSwapFromList) return;

        this.mobsList.push(enemy);
        this.harvestablesNotGood = this.harvestablesNotGood.filter((x) => x.id !== enemy.id);
    }

    getMobList()
    {
        return [...this.mobsList];
    }


    AddMist(id, posX, posY, name, enchant)
    {
        if (this.mistList.some((mist) => mist.id === id))
            return;

        const d = new Mist(id, posX, posY, name, enchant);

        this.mistList.push(d);
    }

    removeMist(id)
    {
        this.mistList = this.mistList.filter((mist) => mist.id !== id);
    }

    updateMistPosition(id, posX, posY)
    {
        var mist = this.mistList.find((mist) => mist.id === id);

        if (!mist) return;

        mist.posX = posX;
        mist.posY = posY;
    }

    updateMistEnchantmentLevel(id, enchantmentLevel)
    {
        var mist = this.mistList.find((mist) => mist.id === id);

        if (!mist) return;

        mist.enchant = enchantmentLevel;
    }

    Clear()
    {
        this.mobsList = [];
        this.mistList = [];
        this.harvestablesNotGood = [];
    }
}

// Exports for Node.js testing (safe for browser when module is undefined)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobsHandler;
}

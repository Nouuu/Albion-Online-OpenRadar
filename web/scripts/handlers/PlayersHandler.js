import {CATEGORIES} from "../constants/LoggerConstants.js";
import zonesDatabase from "../data/ZonesDatabase.js";
import settingsSync from "../utils/SettingsSync.js";

class Player {
    // Max Destiny Board specialization bonus at level 120 (+2 IP/level), per Albion's IP formula
    static MAX_SPECIALIZATION_BONUS = 240;
    // Assumed quality bonus (Excellent), per Albion's IP formula
    static MAX_QUALITY_BONUS = 20;

    constructor(posX, posY, id, nickname, guildName1, faction, allianceName, equipments, spells) {
        this.posX = posX;
        this.posY = posY;
        this.oldPosX = posX;
        this.oldPosY = posY;
        this.id = id;
        this.nickname = nickname;
        this.guildName = guildName1;
        this.allianceName = allianceName || null;
        this.faction = faction ?? 0; // 0=passive, 1-6=faction city, 255=hostile
        this.hX = 0;
        this.hY = 0;
        this.currentHealth = 0;
        this.initialHealth = 0;
        this.equipments = equipments || null;
        this.spells = spells || null;
        this.items = null;
        this.mounted = false;
        this.detectedAt = Date.now();
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }

    setMounted(mounted) {
        this.mounted = mounted;
    }

    isHostile() {
        return this.faction === 255;
    }

    isPassive() {
        return this.faction === 0;
    }

    isFactionPlayer() {
        return this.faction >= 1 && this.faction <= 6;
    }

    // Equipment slots: 0-4=combat, 5=Bag, 6=Cape, 7=Mount, 8=Food
    //
    // Item power the game reports for a character also includes item quality
    // and Destiny Board specialization, neither of which is present in the
    // equipment ids broadcast over the network (see docs/technical/DEATHEYE_ANALYSIS.md
    // - even a full MITM decrypt doesn't expose them). This returns an estimated
    // max IP those equipped items could reach: real tier/enchant power plus an
    // assumed Excellent quality (+20) and max possible specialization
    // (+2/level, capped at level 120 = +240) on every combat slot. It is an
    // estimate, not the player's actual current IP.
    getMaxItemPower() {
        // Safety check: ensure equipments is an array
        if (!this.equipments || !Array.isArray(this.equipments) || this.equipments.length === 0) {
            return null;
        }

        // Wait for database to load
        const itemsDB = window.itemsDatabase;
        if (!itemsDB) {
            return null; // Database not loaded yet
        }

        // Filter combat equipment slots (exclude Bag=5, Cape=6, Mount=7)
        // Slots 0-4 (MainHand, OffHand, Head, Chest, Shoes) + Food=8
        const combatSlots = this.equipments.filter((itemId, index) => {
            return (index <= 4 || index === 8) && itemId && itemId > 0;
        });

        if (combatSlots.length === 0) return null;

        // Lookup actual itempower from database, assuming max specialization per item
        let totalPower = 0;
        let validItems = 0;

        for (const itemId of combatSlots) {
            const item = itemsDB.getItemById(itemId);
            if (item && item.itempower > 0) {
                totalPower += item.itempower + Player.MAX_SPECIALIZATION_BONUS + Player.MAX_QUALITY_BONUS;
                validItems++;
            }
        }

        return validItems > 0 ? Math.round(totalPower / validItems) : null;
    }
}

export class PlayersHandler {
    constructor() {
        this.playersList = [];
        this.localPlayer = new Player();
        this.lastFlashAt = 0;
        this.FLASH_DURATION_MS = 300;
    }

    playThreatSound() {
        try {
            const audio = new Audio('/sounds/player.mp3');
            audio.play().catch((err) => {
                window.logger?.debug(CATEGORIES.PLAYERS, 'audio_blocked', {error: err?.message});
            });
        } catch (err) {
            window.logger?.debug(CATEGORIES.PLAYERS, 'audio_error', {error: err?.message});
        }
    }

    triggerScreenFlash() {
        this.lastFlashAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (typeof document === 'undefined') return;
        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-error/60 pointer-events-none z-[9999] transition-opacity duration-300';
        document.body.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0'; });
        setTimeout(() => flash.remove(), this.FLASH_DURATION_MS);
    }

    isPlayerThreat(faction, pvpType) {
        if (pvpType === 'safe') return false;
        if (pvpType === 'black') return true;
        if (pvpType === 'red' || pvpType === 'yellow') return faction === 255;
        return faction === 255;
    }

    updateItems(id, Parameters) {
        let equipment;
        try {
            equipment = Parameters[2];
        } catch (error) {
            window.logger?.warn(CATEGORIES.PLAYERS, 'UpdateItems_Failed', {
                playerId: id,
                error: error?.message
            });
            return;
        }

        if (!Array.isArray(equipment) || equipment.length === 0) {
            return;
        }

        const player = this.playersList.find(p => p.id === id);
        if (!player) return;

        player.equipments = equipment;
        player.touch();

        window.logger?.debug(CATEGORIES.PLAYERS, 'EquipmentUpdated', {
            playerId: id,
            nickname: player.nickname,
            slotCount: equipment.length
        });
    }

    handleNewPlayerEvent(id, Parameters) {
        // 🔍 Check if player detection is enabled
        if (!settingsSync.getBool('settingShowPlayers')) {
            return 2; // Skip detection if disabled
        }

        const nickname = Parameters[1];
        const guildName = Parameters[8];
        const faction = Parameters[53] ?? 0; // 0=passive, 1-6=faction, 255=hostile
        const allianceName = Parameters[51] || null;
        const equipments = Parameters[40] || null;
        const spells = Parameters[43] || null;

        const existingPlayer = this.playersList.find(player => player.id === id);
        const parsedMaxPlayers = settingsSync.getNumber('settingMaxPlayersDisplay', 50);
        const maxPlayers = Math.min(100, parsedMaxPlayers);

        if (existingPlayer) {
            // Upsert: refresh mutable fields on repeat NewCharacter events
            if (Array.isArray(equipments) && equipments.length > 0) {
                existingPlayer.equipments = equipments;
            }
            if (Array.isArray(spells) && spells.length > 0) {
                existingPlayer.spells = spells;
            }
            if (nickname !== undefined) existingPlayer.nickname = nickname;
            if (guildName !== undefined) existingPlayer.guildName = guildName;
            existingPlayer.allianceName = allianceName;
            existingPlayer.faction = faction;
            existingPlayer.touch();
        } else if (this.playersList.length < maxPlayers) {
            const player = new Player(0, 0, id, nickname, guildName, faction, allianceName, equipments, spells);
            this.playersList.push(player);
        }

        const mapId = window.currentMapId;
        const pvpType = zonesDatabase.getPvpType(mapId);
        const isThreat = this.isPlayerThreat(faction, pvpType);

        window.logger?.info(CATEGORIES.PLAYERS, 'PlayerDetected', {
            id,
            nickname,
            guild: guildName,
            alliance: allianceName,
            faction,
            pvpType,
            isThreat,
            playersCount: this.playersList.length
        });

        if (isThreat && mapId && settingsSync.getBool('settingFlash')) {
            this.triggerScreenFlash();
        }

        if (isThreat && mapId && settingsSync.getBool('settingSound')) {
            this.playThreatSound();
        }

        return 2;
    }

    handleMountedPlayerEvent(id, parameters) {
        let ten = parameters[10];

        let mounted = parameters[11];

        if (mounted == "true" || mounted == true) {
            this.updatePlayerMounted(id, true);
        } else if (ten == "-1") {
            this.updatePlayerMounted(id, true);
        } else {
            this.updatePlayerMounted(id, false);
        }
    }

    updateLocalPlayerNextPosition(_posX, _posY) {
        // TODO: Implement update local player next position
        throw new Error('Not implemented');
    }

    updatePlayerMounted(id, mounted) {
        const player = this.playersList.find(p => p.id === id);
        if (player) {
            player.setMounted(mounted);
            player.touch();
        }
    }

    removePlayer(id) {
        this.playersList = this.playersList.filter(player => player.id !== id);
    }

    updateLocalPlayerPosition(posX, posY) {
        this.localPlayer.posX = posX;
        this.localPlayer.posY = posY;
    }

    UpdatePlayerHealth(Parameters) {
        // 🐛 DEBUG: Log player health updates
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.PLAYERS, 'health_update_detail', {
            playerId: Parameters[0],
            params2_currentHP: Parameters[2],
            params3_maxHP: Parameters[3],
            hpPercentage: Parameters[3] ? Math.round((Parameters[2] / Parameters[3]) * 100) + '%' : 'N/A',
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        const uPlayer = this.playersList.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;

        uPlayer.currentHealth = Parameters[2];
        uPlayer.initialHealth = Parameters[3];
        uPlayer.touch();
    }

    UpdatePlayerLooseHealth(Parameters) {
        const uPlayer = this.playersList.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;

        uPlayer.currentHealth = Parameters[3];
        uPlayer.touch();
    }

    Clear() {
        this.playersList = [];
        this.alreadyIgnoredPlayers = [];
    }

    updatePlayerFaction(id, newFaction) {
        const player = this.playersList.find(p => p.id === id);
        if (!player) return;

        const wasHostile = player.isHostile();
        player.faction = newFaction;
        player.touch();

        // Trigger alert if player BECAME hostile
        if (!wasHostile && player.isHostile()) {
            this.triggerHostileAlert(player);
        }
    }

    triggerHostileAlert(player) {
        const pvpType = zonesDatabase.getPvpType(window.currentMapId);
        if (!this.isPlayerThreat(player.faction, pvpType)) return;

        if (settingsSync.getBool('settingFlash')) {
            this.triggerScreenFlash();
        }

        if (settingsSync.getBool('settingSound')) {
            this.playThreatSound();
        }

        window.logger?.info(CATEGORIES.PLAYERS, 'PlayerBecameHostile', {
            id: player.id,
            nickname: player.nickname,
            faction: player.faction,
            pvpType
        });
    }

    /**
     * Remove players not updated for a given time period
     * @param {number} maxAgeMs - Maximum age in milliseconds (default: 5 minutes for players)
     * @returns {number} - Number of players removed
     */
    cleanupStaleEntities(maxAgeMs = 300000) {
        const now = Date.now();
        const before = this.playersList.length;

        this.playersList = this.playersList.filter(player =>
            (now - player.lastUpdateTime) < maxAgeMs
        );

        const removed = before - this.playersList.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.PLAYERS, 'cleanup', {removed, maxAgeMs});
        }
        return removed;
    }

    /**
     * Enforce maximum list size (already enforced in handleNewPlayerEvent, but this is explicit)
     * @param {number} maxSize - Maximum players (default: 50)
     * @returns {number} - Number of players removed
     */
    enforceMaxSize(maxSize = 50) {
        if (this.playersList.length <= maxSize) return 0;

        // Sort by lastUpdateTime (oldest first) and keep newest
        this.playersList.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime);
        const removed = this.playersList.length - maxSize;
        this.playersList = this.playersList.slice(0, maxSize);

        window.logger?.debug(CATEGORIES.PLAYERS, 'max_size_enforced', {removed});
        return removed;
    }

    /**
     * Get current list size for monitoring
     * @returns {number}
     */
    getSize() {
        return this.playersList.length;
    }

    /**
     * Get filtered players based on type settings (zone-aware)
     * In blackzone, ALL players are threats - filter uses showDangerous setting
     * @returns {Player[]} - Filtered list of players
     */
    getFilteredPlayers() {
        const showPassive = settingsSync.getBool('settingPassivePlayers') ?? true;
        const showFaction = settingsSync.getBool('settingFactionPlayers') ?? true;
        const showDangerous = settingsSync.getBool('settingDangerousPlayers') ?? true;

        const pvpType = zonesDatabase.getPvpType(window.currentMapId);

        return this.playersList.filter(player => {
            // In blackzone, ALL players are threats - use showDangerous setting
            if (pvpType === 'black') {
                return showDangerous;
            }

            // In other zones, filter based on player's internal faction
            if (player.isPassive()) return showPassive;
            if (player.isFactionPlayer()) return showFaction;
            return showDangerous;
        });
    }

    getPlayersByType() {
        const filtered = this.getFilteredPlayers();
        const pvpType = zonesDatabase.getPvpType(window.currentMapId);

        // In blackzone, ALL players are threats
        if (pvpType === 'black') {
            return {
                hostile: filtered,
                faction: [],
                passive: []
            };
        }

        return {
            hostile: filtered.filter(p => p.isHostile()),
            faction: filtered.filter(p => p.isFactionPlayer()),
            passive: filtered.filter(p => p.isPassive())
        };
    }

    getThreatPlayers() {
        const pvpType = zonesDatabase.getPvpType(window.currentMapId);
        return this.playersList.filter(p => this.isPlayerThreat(p.faction, pvpType));
    }
}
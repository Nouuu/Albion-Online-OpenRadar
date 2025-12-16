import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import {isCityZone} from "../constants/FactionConstants.js";
import settingsSync from "../Utils/SettingsSync.js";

class Player {
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

    // Equipment slots: 0-4=combat, 5=Cape, 6=Mount, 7=Bag, 8=Food
    getAverageItemPower() {
        // Safety check: ensure equipments is an array
        if (!this.equipments || !Array.isArray(this.equipments) || this.equipments.length === 0) {
            return null;
        }

        // Wait for database to load
        const itemsDB = window.itemsDatabase;
        if (!itemsDB) {
            return null; // Database not loaded yet
        }

        // Filter combat equipment slots (exclude Cape=5, Mount=6, Bag=7)
        // Slots 0-4 (MainHand, OffHand, Head, Chest, Shoes) + Food=8
        const combatSlots = this.equipments.filter((itemId, index) => {
            return (index <= 4 || index === 8) && itemId && itemId > 0;
        });

        if (combatSlots.length === 0) return null;

        // Lookup actual itempower from database
        let totalPower = 0;
        let validItems = 0;

        for (const itemId of combatSlots) {
            const item = itemsDB.getItemById(itemId);
            if (item && item.itempower > 0) {
                totalPower += item.itempower;
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
        this.audio = new Audio('/sounds/player.mp3');
    }

    updateItems(id, Parameters) {
        let items = null;
        try {
            items = Parameters[2];
        } catch {
            items = null;
        }

        if (items != null) {
            this.playersList.forEach(playerOne => {
                if (playerOne.id === id) {
                    playerOne.items = items;
                }
            });
        }
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

        if (!existingPlayer && this.playersList.length < maxPlayers) {
            const player = new Player(0, 0, id, nickname, guildName, faction, allianceName, equipments, spells);
            this.playersList.push(player);
        }

        window.logger?.info(CATEGORIES.PLAYER, 'PlayerDetected', {
            id,
            nickname,
            guild: guildName,
            alliance: allianceName,
            faction,
            playersCount: this.playersList.length
        });

        const isHostile = faction === 255;
        const mapId = window.currentMapId;
        const inCityZone = isCityZone(mapId);

        // Screen flash alert - hostile only, not in city, and mapId must be known
        if (isHostile && mapId && !inCityZone && settingsSync.getBool('settingFlash')) {
            const flash = document.createElement('div');
            flash.className = 'fixed inset-0 bg-error/60 pointer-events-none z-[9999] transition-opacity duration-300';
            document.body.appendChild(flash);
            // Fade out
            requestAnimationFrame(() => {
                flash.style.opacity = '0';
            });
            setTimeout(() => flash.remove(), 300);
        }

        // Sound alert - hostile only, not in city, and mapId must be known
        if (isHostile && mapId && !inCityZone && settingsSync.getBool('settingSound')) {
            this.audio.play().catch(err => {
                window.logger?.debug(CATEGORIES.PLAYER, EVENTS.AudioPlayBlocked, {
                    error: err.message,
                    player: nickname
                });
            });
        }

        return 2; // Return flashTime value
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
        for (const player of this.playersList) {
            if (player.id === id) {
                player.setMounted(mounted);
                break;
            }
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

        window.logger?.debug(CATEGORIES.PLAYER_HEALTH, EVENTS.PlayerHealthUpdate_DETAIL, {
            playerId: Parameters[0],
            params2_currentHP: Parameters[2],
            params3_maxHP: Parameters[3],
            hpPercentage: Parameters[3] ? Math.round((Parameters[2] / Parameters[3]) * 100) + '%' : 'N/A',
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        var uPlayer = this.playersList.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;


        uPlayer.currentHealth = Parameters[2];
        uPlayer.initialHealth = Parameters[3];
    }

    UpdatePlayerLooseHealth(Parameters) {
        var uPlayer = this.playersList.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;

        uPlayer.currentHealth = Parameters[3];
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
        // No alerts in city zones
        if (isCityZone(window.currentMapId)) return;

        if (settingsSync.getBool('settingFlash')) {
            const flash = document.createElement('div');
            flash.className = 'fixed inset-0 bg-error/60 pointer-events-none z-[9999] transition-opacity duration-300';
            document.body.appendChild(flash);
            requestAnimationFrame(() => flash.style.opacity = '0');
            setTimeout(() => flash.remove(), 300);
        }

        if (settingsSync.getBool('settingSound')) {
            this.audio.play().catch(() => {});
        }

        window.logger?.info(CATEGORIES.PLAYER, 'PlayerBecameHostile', {
            id: player.id,
            nickname: player.nickname,
            faction: player.faction
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
            console.log(`[PlayersHandler] Cleaned up ${removed} stale players (>${maxAgeMs/1000}s old)`);
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

        console.log(`[PlayersHandler] Enforced max size: removed ${removed} oldest players`);
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
     * Get filtered players based on type settings
     * @returns {Player[]} - Filtered list of players
     */
    getFilteredPlayers() {
        const showPassive = settingsSync.getBool('settingPassivePlayers') ?? true;
        const showFaction = settingsSync.getBool('settingFactionPlayers') ?? true;
        const showDangerous = settingsSync.getBool('settingDangerousPlayers') ?? true;

        return this.playersList.filter(player => {
            if (player.isPassive()) return showPassive;
            if (player.isFactionPlayer()) return showFaction;
            return showDangerous;
        });
    }

    /**
     * Get players grouped by type for sectioned display
     * @returns {{hostile: Player[], faction: Player[], passive: Player[]}}
     */
    getPlayersByType() {
        const filtered = this.getFilteredPlayers();
        return {
            hostile: filtered.filter(p => p.isHostile()),
            faction: filtered.filter(p => p.isFactionPlayer()),
            passive: filtered.filter(p => p.isPassive())
        };
    }
}
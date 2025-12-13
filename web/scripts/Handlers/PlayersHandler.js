import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import settingsSync from "../Utils/SettingsSync.js";

class Player {
    constructor(posX, posY, id, nickname, guildName1, flagId, allianceName, factionName, equipments, spells) {
        this.posX = posX;
        this.posY = posY;
        this.oldPosX = posX;
        this.oldPosY = posY;
        this.id = id;
        this.nickname = nickname;
        this.guildName = guildName1;
        this.allianceName = allianceName || null; // 👥 Parameters[51]
        this.factionName = factionName || null; // 👥 Parameters[53]
        this.hX = 0;
        this.hY = 0;
        this.currentHealth = 0;
        this.initialHealth = 0;
        this.equipments = equipments || null; // 👥 Parameters[40] - Array of item IDs
        this.spells = spells || null; // 👥 Parameters[43] - Array of spell IDs
        this.items = null; // Legacy field (Event 90 CharacterEquipmentChanged)
        this.flagId = flagId;
        this.mounted = false;
        this.detectedAt = Date.now(); // 👥 Detection timestamp
        this.lastUpdateTime = Date.now(); // For stale entity cleanup
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }

    setMounted(mounted) {
        this.mounted = mounted;
    }

    // 👥 Calculate average item power from equipments
    // Equipment slots: 0=MainHand, 1=OffHand, 2=Head, 3=Chest, 4=Shoes, 5=Cape, 6=Mount, 7=Bag, 8=Food
    // Uses ItemsDatabase to lookup actual itempower values from items.xml
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
        const flagId = Parameters[11] || 0;
        const allianceName = Parameters[51] || null; // 👥 Alliance name (DEATHEYE offset)
        const factionName = Parameters[53] || null; // 👥 Faction (Caerleon, etc.)
        const equipments = Parameters[40] || null; // 👥 Equipment item IDs array
        const spells = Parameters[43] || null; // 👥 Spell IDs array

        // MVP: Track players WITHOUT positions (positions are encrypted)
        // Just add to list for counting and info display
        const existingPlayer = this.playersList.find(player => player.id === id);
        // 👥 Limit playersList to max players
        const parsedMaxPlayers = settingsSync.getNumber('settingMaxPlayersDisplay', 50);
        const maxPlayers = Math.min(100, parsedMaxPlayers);

        if (!existingPlayer && this.playersList.length < maxPlayers) {
            const player = new Player(0, 0, id, nickname, guildName, flagId, allianceName, factionName, equipments, spells);
            this.playersList.push(player);

        }

        // 🐛 DEBUG: Log player equipment on detection
        window.logger?.info(CATEGORIES.PLAYER, 'PlayerDetected_WithEquipment', {
            id: id,
            nickname: nickname,
            guild: guildName,
            alliance: allianceName,
            faction: factionName,
            equipments: equipments,
            spells: spells,
            playersCount: this.playersList.length
        });

        window.logger?.info(CATEGORIES.PLAYER, 'PlayerDetected', {
            id: id,
            nickname: nickname,
            guild: guildName,
            playersCount: this.playersList.length
        });

        // Alerts only for hostile players (flagId = 255)
        const isHostile = flagId === 255;

        // Screen flash alert (Tailwind inline) - hostile only
        if (isHostile && settingsSync.getBool('settingFlash')) {
            const flash = document.createElement('div');
            flash.className = 'fixed inset-0 bg-danger/60 pointer-events-none z-[9999] transition-opacity duration-300';
            document.body.appendChild(flash);
            // Fade out
            requestAnimationFrame(() => {
                flash.style.opacity = '0';
            });
            setTimeout(() => flash.remove(), 300);
        }

        // Sound alert - hostile only
        if (isHostile && settingsSync.getBool('settingSound')) {
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

    updateLocalPlayerNextPosition(posX, posY) {
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
            const flagId = player.flagId || 0;

            // Passive: flagId = 0
            if (flagId === 0) return showPassive;
            // Faction: flagId 1-6
            if (flagId >= 1 && flagId <= 6) return showFaction;
            // Hostile/Dangerous: flagId = 255 or unknown
            return showDangerous;
        });
    }
}
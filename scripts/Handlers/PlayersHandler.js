import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";

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
        this.detectedAt = Date.now(); // 👥 Timestamp de détection
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
    constructor(settings) {
        this.playersList = [];
        this.localPlayer = new Player();
        this.settings = settings;
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
        if (!this.settings.settingShowPlayers) {
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
        const parsedMaxPlayers = parseInt(localStorage.getItem('settingMaxPlayersDisplay'));
        const maxPlayers = Math.min(100, Number.isNaN(parsedMaxPlayers) ? 50 : parsedMaxPlayers);

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

        // Play audio notification
        this.audio.play().catch(err => {
            window.logger?.debug(CATEGORIES.PLAYER, EVENTS.AudioPlayBlocked, {
                error: err.message,
                player: nickname
            });
        });

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
}
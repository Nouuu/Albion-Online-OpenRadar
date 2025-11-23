class Player {
    constructor(posX, posY, id, nickname, guildName1, flagId) {
        this.posX = posX;
        this.posY = posY;
        this.oldPosX = posX;
        this.oldPosY = posY;
        this.id = id;
        this.nickname = nickname;
        this.guildName = guildName1;
        this.hX = 0;
        this.hY = 0;
        this.currentHealth = 0;
        this.initialHealth = 0;
        this.items = null;
        this.flagId = flagId;
        this.mounted = false;
    }

    setMounted(mounted) {
        this.mounted = mounted;
    }
}

export class PlayersHandler {
    constructor(settings) {
        // Import constants once in constructor
        const {CATEGORIES, EVENTS} = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;

        this.playersList = [];
        this.localPlayer = new Player();
        this.settings = settings;
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
        const nickname = Parameters[1];
        const guildName = Parameters[8];
        const flagId = Parameters[11] || 0;

        // ✅ Extract WORLD coords from param[253] (param[19]/[20])
        if (!Parameters[253] || !Parameters[253].spawnPosition) {
            window.logger?.error(CATEGORIES.PLAYER, 'Event29_MissingParam253', {
                playerId: id,
                nickname: nickname,
                note: '❌ param[253] missing - cannot add player'
            });
            return -1;
        }

        const worldPosX = Parameters[253].spawnPosition.x;
        const worldPosY = Parameters[253].spawnPosition.y;

        return this.addPlayer(worldPosX, worldPosY, id, nickname, guildName, flagId);
    }

    handleMountedPlayerEvent(id, parameters)
    {
        let ten = parameters[10];
    
        let mounted = parameters[11];

        if (mounted == "true" || mounted == true)
        {
            this.updatePlayerMounted(id, true);
        } 
        else if (ten == "-1")
        {
            this.updatePlayerMounted(id, true);
        } 
        else
        {
            this.updatePlayerMounted(id, false);
        }
    }

    addPlayer(posX, posY, id, nickname, guildName, flagId) {
        const existingPlayer = this.playersList.find(player => player.id === id);

        if (existingPlayer) {
            window.logger?.debug(this.CATEGORIES.PLAYER, 'PlayerAlreadyExists', {
                playerId: id,
                nickname: nickname,
                existingNickname: existingPlayer.nickname
            });
            // Remove existing player to avoid duplicates
            this.playersList = this.playersList.filter(player => player.id !== id);
        }

        const player = new Player(posX, posY, id, nickname, guildName, flagId);
        this.playersList.push(player);

        // Play audio with error handling (browsers block autoplay)
        const audio = new Audio('/sounds/player.mp3');
        audio.play().catch(err => {
            // Silently ignore autoplay errors (expected in browsers)
            window.logger?.debug(this.CATEGORIES.PLAYER, this.EVENTS.AudioPlayBlocked, {
                error: err.message,
                player: nickname
            });
        });

        return 2;
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

        window.logger?.debug(this.CATEGORIES.PLAYER_HEALTH, this.EVENTS.PlayerHealthUpdate_DETAIL, {
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
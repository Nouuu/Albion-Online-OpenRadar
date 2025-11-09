class Player {
    constructor(posX, posY, id, nickname, guildName1, currentHealth, initialHealth, items, flagId) {
        this.posX = posX;
        this.posY = posY;
        this.oldPosX = posX;
        this.oldPosY = posY;
        this.id = id;
        this.nickname = nickname;
        this.guildName = guildName1;
        this.hX = 0;
        this.hY = 0;
        this.currentHealth = currentHealth;
        this.initialHealth = initialHealth;
        this.items = items;
        this.flagId = flagId;
        this.mounted = false; // Initialize mounted status as false
    }

    setMounted(mounted) {
        this.mounted = mounted;
    }
}

export class PlayersHandler {
    constructor(settings) {
        // Import constants once in constructor
        const { CATEGORIES, EVENTS } = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;
        
        this.playersInRange = [];
        this.localPlayer = new Player();
        this.invalidate = false;

        this.settings = settings;

        this.ignorePlayers = [];
        this.ignoreGuilds = [];
        this.ignoreAlliances = [];

        this.alreadyIgnoredPlayers = [];

        this.settings.ignoreList.forEach((element) => {
            const name = element['Name'];

            switch (element['Type']) {
                case 'Player':
                    this.ignorePlayers.push(name);
                    break;

                case 'Guild':
                    this.ignoreGuilds.push(name);
                    break;

                case 'Alliance':
                    this.ignoreAlliances.push(name);
                    break;
            
                default: // Default is player
                    this.ignorePlayers.push(name);
                    break;
            }
        });
    }

    getPlayersInRange() {
        try {
            return [...this.playersInRange]; // Create a copy of the array
        } finally {

        }
    }

    updateItems(id, Parameters) {

        let items = null;

        try {
            items = Parameters[2];
        }
        catch
        {
            items = null;
        }

        if (items != null) {
            this.playersInRange.forEach(playerOne => {
                if (playerOne.id === id) {
                    playerOne.items = items;
                }
            });
        }
    }

    handleNewPlayerEvent(Parameters, isBZ)
    {
        // 🐛 DEBUG ULTRA-DÉTAILLÉ: Log ALL parameters pour identifier patterns
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }

        window.logger?.debug(this.CATEGORIES.PLAYER, this.EVENTS.NewPlayerEvent_ALL_PARAMS, {
            playerId: Parameters[0],
            nickname: Parameters[1],
            guildName: Parameters[8],
            alliance: Parameters[49],
            health: Parameters[22],
            flagId: Parameters[53],
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        if (!this.settings.settingDot)
            return -1;

        /* General */
        const id = Parameters[0];
        const nickname = Parameters[1];

        if (this.alreadyIgnoredPlayers.find(name => name === nickname.toUpperCase()))
            return -1;

        if (this.ignorePlayers.find(name => name === nickname.toUpperCase()))
        {
            this.alreadyIgnoredPlayers.push(nickname.toUpperCase());
            return -1;
        }

        const guildName = String(Parameters[8]); 

        if (this.ignoreGuilds.find(name => name === guildName.toUpperCase()))
        {
            this.alreadyIgnoredPlayers.push(nickname.toUpperCase());
            return -1;
        }

        const alliance = String(Parameters[49]);

        if (this.ignoreAlliances.find(name => name === alliance.toUpperCase()))
        {
            this.alreadyIgnoredPlayers.push(nickname.toUpperCase());
            return -1;
        }

        /* Position */
        //var positionArray = Parameters[14];
        /*const posX = positionArray[0];
        const posY = positionArray[1];*/

       

        /* Health */
        const currentHealth = Parameters[22];
        const initialHealth = Parameters[23];

        /* Items & flag */
        const items = Parameters[40];
        const flagId = Parameters[53] | 0;

        if (isBZ)
        {
            if (!this.settings.settingDangerousPlayers) return -1;
        }
        else if ((flagId == 0 && !this.settings.settingPassivePlayers)
            || (flagId >= 1 && flagId <= 6 && !this.settings.settingFactionPlayers)
            || (flagId == 255 && !this.settings.settingDangerousPlayers)
        ) return -1;

        return this.addPlayer(0, 0, id, nickname, guildName, currentHealth, initialHealth, items, this.settings.settingSound, flagId);
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

    addPlayer(posX, posY, id, nickname, guildName, currentHealth, initialHealth, items, sound, flagId)
    {
        const existingPlayer = this.playersInRange.find(player => player.id === id);
     
        if (existingPlayer) return -1;

        const player = new Player(posX, posY, id, nickname, guildName, currentHealth, initialHealth, items, flagId);
        this.playersInRange.push(player);

        window.logger?.info(this.CATEGORIES.PLAYER, 'PlayerAdded', {
            playerId: id,
            nickname: nickname,
            guildName: guildName,
            flagId: flagId,
            position: `(${posX}, ${posY})`,
            totalPlayers: this.playersInRange.length
        });

        if (!sound) return 2;

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

    updatePlayerMounted(id, mounted)
    {
        for (const player of this.playersInRange) {
            if (player.id === id) {
                player.setMounted(mounted);
                break;
            }
        }
    }

    removePlayer(id)
    {
        this.playersInRange = this.playersInRange.filter(player => player.id !== id);
    }

    updateLocalPlayerPosition(posX, posY) {
        // Implement a local player lock mechanism
        this.localPlayer.posX = posX;
        this.localPlayer.posY = posY;
    }

    localPlayerPosX() {
        // Implement a local player lock mechanism
        return this.localPlayer.posX;
    }

    localPlayerPosY() {
        // Implement a local player lock mechanism
        return this.localPlayer.posY;
     }

    updatePlayerPosition(id, posX, posY, parameters)
    {
        for (const player of this.playersInRange)
        {
            if (player.id === id)
            {
                const data = parameters[1]["data"];
            }
        }
    }

    UpdatePlayerHealth(Parameters)
    {
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

        var uPlayer = this.playersInRange.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;


        uPlayer.currentHealth = Parameters[2];
        uPlayer.initialHealth = Parameters[3];
    }

    UpdatePlayerLooseHealth(Parameters)
    {
        var uPlayer = this.playersInRange.find(player => player.id === Parameters[0]);

        if (!uPlayer) return;

        uPlayer.currentHealth = Parameters[3];
    }

    Clear()
    {
        this.playersInRange = [];
        this.alreadyIgnoredPlayers = [];
    }
}
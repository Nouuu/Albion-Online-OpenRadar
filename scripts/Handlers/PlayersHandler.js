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

    handleNewPlayerEvent(id, Parameters) {
	const nickname = Parameters[1];
	const guildName = Parameters[8];
	const allianceName = Parameters[9];

	// ✅ PRIORITY 1: Use param[253] structured data from Protocol16Deserializer
	// Server-side creates param[253] with: {objectId, name, guid, guild, spawnPosition: {x, y}}
	let initialPosX, initialPosY;
	let positionSource;

	if (Parameters[253] && Parameters[253].spawnPosition) {
		initialPosX = Parameters[253].spawnPosition.x;
		initialPosY = Parameters[253].spawnPosition.y;
		positionSource = 'param[253]_structured_data';
		
		window.logger?.info(CATEGORIES.PLAYER, 'Player_Using_Param253', {
			playerId: id,
			nickname: nickname,
			spawnX: initialPosX,
			spawnY: initialPosY,
			note: '✅ Using param[253] structured data from Protocol16Deserializer'
		});
	}
	// PRIORITY 2: param[7] deserialized server-side (legacy fallback)
	else if (Array.isArray(Parameters[7]) && Parameters[7].length >= 2) {
		initialPosX = Parameters[7][0];
		initialPosY = Parameters[7][1];
		positionSource = 'param[7]_server_deserialized';
	}
	// PRIORITY 3: param[12]/[13] fallback (edge cases where server didn't deserialize)
	else if (Array.isArray(Parameters[12]) && Parameters[12].length >= 2) {
		initialPosX = Parameters[12][0];
		initialPosY = Parameters[12][1];
		positionSource = 'param[12]_array_fallback';
	}
	else if (Array.isArray(Parameters[13]) && Parameters[13].length >= 2) {
		initialPosX = Parameters[13][0];
		initialPosY = Parameters[13][1];
		positionSource = 'param[13]_array_fallback';
	}
	// PRIORITY 4: World coordinates param[19]/[20] (LAST RESORT - won't work for radar)
	else {
		initialPosX = Parameters[19] || 0;
		initialPosY = Parameters[20] || 0;
		positionSource = 'param[19]_[20]_world_fallback';

		// ⚠️ WARNING: Using world coords means server deserialization may have failed
		window.logger?.warn(CATEGORIES.PLAYER, 'Player_WorldCoords_Fallback', {
			playerId: id,
			nickname: nickname,
			param253: Parameters[253],
			param7: Parameters[7],
			param12: Parameters[12],
			param13: Parameters[13],
			note: '⚠️ Using world coords - param[253] not available'
		});
	}

	window.logger?.debug(CATEGORIES.PLAYER, EVENTS.PLAYER_NEW, {
		playerId: id,
		nickname: nickname,
		guildName: guildName,
		allianceName: allianceName,
		initialPosX: initialPosX,
		initialPosY: initialPosY,
		positionSource: positionSource
	});

	// ✅ CORRECT ORDER: addPlayer(posX, posY, id, nickname, guildName, ...)
	this.addPlayer(initialPosX, initialPosY, id, nickname, guildName, allianceName);
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
     
        if (existingPlayer) {
            window.logger?.debug(this.CATEGORIES.PLAYER, 'PlayerAlreadyExists', {
                playerId: id,
                nickname: nickname,
                existingNickname: existingPlayer.nickname
            });
            return -1;
        }

        const player = new Player(posX, posY, id, nickname, guildName, currentHealth, initialHealth, items, flagId);
        this.playersInRange.push(player);

        // 🔬 DIAG: Verify coordinates are correctly assigned to player object
        window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_PlayerCreated', {
            playerId: id,
            nickname: nickname,
            input_posX: posX,
            input_posY: posY,
            player_posX: player.posX,
            player_posY: player.posY,
            player_oldPosX: player.oldPosX,
            player_oldPosY: player.oldPosY,
            note: 'Player object created - check if coordinates are correctly assigned'
        });

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
        // 🐛 CRITICAL DEBUG: Log position updates to detect corrupted values
        if (!window.__posUpdateCount) window.__posUpdateCount = 0;
        window.__posUpdateCount++;

        if (window.__posUpdateCount % 100 === 1 || Math.abs(posX) > 100000 || Math.abs(posY) > 100000) {
            window.logger?.warn(this.CATEGORIES.PLAYER, 'PlayerPositionUpdate', {
                id,
                posX,
                posY,
                posXType: typeof posX,
                posYType: typeof posY,
                updateCount: window.__posUpdateCount,
                isCorrupted: Math.abs(posX) > 100000 || Math.abs(posY) > 100000
            });
        }

        // Find existing player
        for (const player of this.playersInRange)
        {
            if (player.id === id)
            {
                player.posX = posX;
                player.posY = posY;
                return;
            }
        }

        // Player not found - Move events with Buffer are skipped in Utils.js
        // Only mobs/NPCs with direct param[4]/[5] positions reach here
        // Ignore silently (mob positions are handled by mobsHandler)
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
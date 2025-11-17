export class PlayersDrawing extends DrawingUtils
{
    constructor(Settings)
    {
        super(Settings);
        const { CATEGORIES, EVENTS } = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;

        this.itemsInfo = {};
        this.loggedPlayers = new Set(); // Track players already logged
        this.lastPlayerCount = 0; // Track player count changes
    }

    updateItemsInfo(newData)
    {
        this.itemsInfo = newData;
    }

    drawItems(context, canvas, players, devMode)
    {
        if (!this.settings.settingShowPlayers)
            return;

        let posY = 15;

        if (players.length <= 0)
        {
            this.settings.ClearPreloadedImages("Items");
            return;
        }

        for (const playerOne of players)
        {
            const items = playerOne.items;

            if (items == null) continue;


            let posX = 5;
            const total = posY + 20;

            // TODO
            // Show more than few players 
            if (total > canvas.height) break; // Ecxeed canvas size

            const flagId = playerOne.flagId || 0
            const flagName = FactionFlagInfo[flagId]
            this.DrawCustomImage(context, posX + 10, posY - 5, flagName, 'Flags', 20)
            let posTemp = posX + 25

            const nickname = playerOne.nickname;
            this.drawTextItems(posTemp, posY, nickname, context, "14px", "white");

            posTemp += context.measureText(nickname).width + 10;
            this.drawTextItems(posTemp, posY, playerOne.currentHealth + "/" + playerOne.initialHealth, context, "14px", "red");

            posTemp += context.measureText(playerOne.currentHealth + "/" + playerOne.initialHealth).width + 10;
  
            let itemsListString = "";

            posX += 20;
            posY += 25;

            if (items["type"] === "Buffer") // No items
            {
                posX = 0;
                posY += 50;
                continue;
            }

            for (const item of items)
            {
                const itemInfo = this.itemsInfo[item];

                if (itemInfo != undefined && this.settings.GetPreloadedImage(itemInfo, "Items") !== null)
                {
                    this.DrawCustomImage(context, posX, posY, itemInfo, "Items", 40);
                }

                posX += 10 + 40;
                itemsListString += item.toString() + " ";
            }

            if (devMode)
            {
                this.drawTextItems(posTemp, posY - 5, itemsListString, context, "14px", "white");
            }
      
            posY += 45;
        }
    }
    
    interpolate(players, lpX, lpY, t)
    {
        // ⚠️ GUARD: Don't interpolate if lpX/lpY not initialized yet (both 0 at startup)
        // This prevents players from being placed off-canvas during the ~650ms delay
        // between player detection and first OnRequest_Move event
        if (lpX === 0 && lpY === 0) {
            // 🔬 DIAG: Log when skipping interpolation due to uninitialized lpX/lpY
            if (players.length > 0 && !window.__lpXInitSkipLogged) {
                window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_Interpolate_Skipped', {
                    playerCount: players.length,
                    lpX: lpX,
                    lpY: lpY,
                    note: '⚠️ Skipping interpolation - lpX/lpY not initialized yet (both 0)'
                });
                window.__lpXInitSkipLogged = true;
            }
            return; // Skip interpolation until lpX/lpY are initialized
        }

        // Reset flag once lpX/lpY are initialized
        if (window.__lpXInitSkipLogged && (lpX !== 0 || lpY !== 0)) {
            window.logger?.info(this.CATEGORIES.PLAYER, 'DIAG_Interpolate_Resumed', {
                lpX: lpX,
                lpY: lpY,
                note: '✅ lpX/lpY initialized - resuming player interpolation'
            });
            window.__lpXInitSkipLogged = false;
        }

        // 🔬 DIAG: Log interpolate calculation if players exist
        if (players.length > 0) {
            window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_Interpolate', {
                playerCount: players.length,
                lpX: lpX,
                lpY: lpY,
                t: t,
                firstPlayer: {
                    id: players[0].id,
                    nickname: players[0].nickname,
                    posX: players[0].posX,
                    posY: players[0].posY,
                    oldHX: players[0].hX,
                    oldHY: players[0].hY,
                    calculatedHX: -1 * players[0].posX + lpX,
                    calculatedHY: players[0].posY - lpY
                },
                note: 'Interpolate called - check hX/hY calculation'
            });
        }

        // ✅ FORMULE DE BASE - Identique à Harvestables et Mobs
        for (const playerOne of players)
        {
            const hX = -1 * playerOne.posX + lpX;
            const hY = playerOne.posY - lpY;

            if (playerOne.hY == 0 && playerOne.hX == 0)
            {
                playerOne.hX = hX;
                playerOne.hY = hY;
            }

            playerOne.hX = this.lerp(playerOne.hX, hX, t);
            playerOne.hY = this.lerp(playerOne.hY, hY, t);
        }
    }

    invalidate(context, players)
    {
        // Log player count changes only (INFO level)
        if (players.length !== this.lastPlayerCount) {
            window.logger?.info(this.CATEGORIES.PLAYER, this.EVENTS.PlayerDebugInfo, {
                playersCount: players.length,
                previousCount: this.lastPlayerCount
            });
            this.lastPlayerCount = players.length;
        }

        // 🔬 DIAG: Log players BEFORE position filter
        window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_BeforeFilter', {
            totalPlayers: players.length,
            playersData: players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                posX: p.posX,
                posY: p.posY,
                hX: p.hX,
                hY: p.hY
            })),
            note: 'Players BEFORE position filter'
        });

        // Filter out players without valid positions (world coords OR radar coords not initialized)
        // posX/posY check: player has world coordinates (from NewCharacter event)
        // hX/hY check: player has radar coordinates (from interpolate() with valid lpX/lpY)
        const validPlayers = players.filter(p =>
            (p.posX !== 0 || p.posY !== 0) &&  // Has world coordinates
            (p.hX !== 0 || p.hY !== 0)         // Has radar coordinates (interpolated with valid lpX/lpY)
        );

        // 🔬 DIAG: Log players AFTER position filter
        window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_AfterFilter', {
            beforeFilter: players.length,
            afterFilter: validPlayers.length,
            filteredOut: players.length - validPlayers.length,
            validPlayersData: validPlayers.map(p => ({
                id: p.id,
                nickname: p.nickname,
                posX: p.posX,
                posY: p.posY
            })),
            note: 'Players AFTER position filter - these will be rendered'
        });

        // Limit display to 50 players maximum
        const maxPlayers = 50;
        const playersToDisplay = validPlayers.slice(0, maxPlayers);

        if (validPlayers.length > maxPlayers) {
            window.logger?.warn(this.CATEGORIES.PLAYER, this.EVENTS.PlayerDebugInfo, {
                totalPlayers: validPlayers.length,
                displayedPlayers: maxPlayers,
                hiddenPlayers: validPlayers.length - maxPlayers
            });
        }

        for (const playerOne of playersToDisplay)
        {
            const point = this.transformPoint(playerOne.hX, playerOne.hY);

            // 🔬 DIAG: Log rendering details for each player
            window.logger?.warn(this.CATEGORIES.PLAYER, 'DIAG_Rendering', {
                playerId: playerOne.id,
                nickname: playerOne.nickname,
                posX: playerOne.posX,
                posY: playerOne.posY,
                hX: playerOne.hX,
                hY: playerOne.hY,
                transformedX: point.x,
                transformedY: point.y,
                canvasWidth: context.canvas.width,
                canvasHeight: context.canvas.height,
                isInCanvas: point.x >= 0 && point.x <= context.canvas.width && point.y >= 0 && point.y <= context.canvas.height,
                note: 'Player being rendered - check transformed coordinates'
            });

            // Log new players only (DEBUG level, once per player)
            if (!this.loggedPlayers.has(playerOne.id)) {
                window.logger?.debug(this.CATEGORIES.PLAYER, this.EVENTS.PlayerDebugInfo, {
                    id: playerOne.id,
                    nickname: playerOne.nickname,
                    hX: playerOne.hX,
                    hY: playerOne.hY,
                    pointX: point.x,
                    pointY: point.y,
                    flagId: playerOne.flagId
                });
                this.loggedPlayers.add(playerOne.id);
            }

            // Draw red circle for each player
            this.drawFilledCircle(context, point.x, point.y, 10, '#FF0000');
        }

        // Clean up logged players that are no longer in the list (memory management)
        if (this.loggedPlayers.size > 100) {
            const currentPlayerIds = new Set(players.map(p => p.id));
            this.loggedPlayers = new Set([...this.loggedPlayers].filter(id => currentPlayerIds.has(id)));
        }
    }
}

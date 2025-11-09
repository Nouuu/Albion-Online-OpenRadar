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

        // Filter out players without valid positions (still at 0,0 waiting for Move event)
        const validPlayers = players.filter(p => p.posX !== 0 || p.posY !== 0);

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

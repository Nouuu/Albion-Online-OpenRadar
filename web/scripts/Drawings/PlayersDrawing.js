import {DrawingUtils} from "../Utils/DrawingUtils.js";

export class PlayersDrawing extends DrawingUtils {
    constructor() {
        super();
        this.itemsInfo = {};
    }

    updateItemsInfo(newData) {
        this.itemsInfo = newData;
    }

    interpolate(players, lpX, lpY, t) {
        for (const playerOne of players) {
            this.interpolateEntity(playerOne, lpX, lpY, t);
        }
    }

    invalidate(context, players) {
        // Players list is already filtered by PlayersHandler.getFilteredPlayers()
        for (const playerOne of players) {
            const point = this.transformPoint(playerOne.hX, playerOne.hY);

            // Color based on player type (flagId)
            const flagId = playerOne.flagId || 0;
            let color = '#FF0000'; // Default: Hostile (red)
            if (flagId === 0) {
                color = '#00ff88'; // Passive (green)
            } else if (flagId >= 1 && flagId <= 6) {
                color = '#ffa500'; // Faction (orange)
            }

            // Draw colored circle for each player (scaled with zoom)
            this.drawFilledCircle(context, point.x, point.y, this.getScaledSize(10), color);

            // Display nickname below the circle (font and offset scaled with zoom)
            const nickname = playerOne.nickname || 'Unknown';
            const fontSize = this.getScaledFontSize(12, 8);
            context.font = `${fontSize}px ${this.fontFamily}`;
            const nicknameWidth = context.measureText(nickname).width;
            this.drawTextItems(point.x - nicknameWidth / 2, point.y + this.getScaledSize(26), nickname, context, `${fontSize}px`, "#FFFFFF");
        }
    }
}

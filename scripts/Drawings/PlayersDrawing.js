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
        // Players list is already filtered by PlayersHandler.getDisplayedPlayers()
        for (const playerOne of players) {
            const point = this.transformPoint(playerOne.hX, playerOne.hY);

            // Draw red circle for each player
            this.drawFilledCircle(context, point.x, point.y, 10, '#FF0000');

            // Display nickname below the circle
            const nickname = playerOne.nickname || 'Unknown';
            const nicknameWidth = context.measureText(nickname).width;
            this.drawTextItems(point.x - nicknameWidth / 2, point.y + 26, nickname, context, "12px", "#FFFFFF");
        }
    }
}

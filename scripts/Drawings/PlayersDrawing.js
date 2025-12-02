import {DrawingUtils} from "../Utils/DrawingUtils.js";

export class PlayersDrawing extends DrawingUtils {
    constructor(Settings) {
        super(Settings);
        const {CATEGORIES, EVENTS} = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;

        this.itemsInfo = {};
    }

    updateItemsInfo(newData) {
        this.itemsInfo = newData;
    }

    interpolate(players, lpX, lpY, t) {
        for (const playerOne of players) {
            // Formula from AO-Radar: hX = -1 * p.PosX + lpX; hY = p.PosY - lpY
            // playerOne.posX/posY contain RAW world coordinates from Event 29
            const hX = (-1 * playerOne.posX) + lpX;
            const hY = playerOne.posY - lpY;

            if (playerOne.hY === 0 && playerOne.hX === 0) {
                playerOne.hX = hX;
                playerOne.hY = hY;
            }

            playerOne.hX = this.lerp(playerOne.hX, hX, t);
            playerOne.hY = this.lerp(playerOne.hY, hY, t);
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

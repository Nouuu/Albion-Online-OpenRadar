import {DrawingUtils} from "../utils/DrawingUtils.js";

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

    invalidate(_context, _players) {
        // Disabled: positions are encrypted, all players render at (0,0)
        // TODO: Re-enable when position decryption is implemented
        return;
    }
}

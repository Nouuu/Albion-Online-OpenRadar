import {DrawingUtils} from "../Utils/DrawingUtils.js";
import settingsSync from "../Utils/SettingsSync.js";

export class ChestsDrawing extends DrawingUtils {
    interpolate(chests, lpX, lpY, t) {
        for (const chestOne of chests) {
            const hX = -1 * chestOne.posX + lpX;
            const hY = chestOne.posY - lpY;

            if (chestOne.hY === 0 && chestOne.hX === 0) {
                chestOne.hX = hX;
                chestOne.hY = hY;
            }
            chestOne.hX = this.lerp(chestOne.hX, hX, t);
            chestOne.hY = this.lerp(chestOne.hY, hY, t);
        }
    }

    invalidate(ctx, chests) {
        for (const chestOne of chests) {
            const point = this.transformPoint(chestOne.hX, chestOne.hY);

            if (settingsSync.getBool("settingsChestGreen") && ["standard", "green"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "green", "Resources", 50);
            } else if (settingsSync.getBool("settingsChestBlue") && ["uncommon", "blue"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "blue", "Resources", 50);
            } else if (settingsSync.getBool("settingsChestPurple") && ["rare", "purple"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "rare", "Resources", 50);
            } else if (settingsSync.getBool("settingsChestYellow") && ["legendary", "yellow"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "legendary", "Resources", 50);
            }
        }
    }
}
import {DrawingUtils} from "../Utils/DrawingUtils.js";
import settingsSync from "../Utils/SettingsSync.js";

export class ChestsDrawing extends DrawingUtils {
    interpolate(chests, lpX, lpY, t) {
        for (const chestOne of chests) {
            this.interpolateEntity(chestOne, lpX, lpY, t);
        }
    }

    invalidate(ctx, chests) {
        for (const chestOne of chests) {
            const point = this.transformPoint(chestOne.hX, chestOne.hY);

            if (settingsSync.getBool("settingsChestGreen") && ["standard", "green"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "green", "Resources", 35);
            } else if (settingsSync.getBool("settingsChestBlue") && ["uncommon", "blue"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "blue", "Resources", 35);
            } else if (settingsSync.getBool("settingsChestPurple") && ["rare", "purple"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "rare", "Resources", 35);
            } else if (settingsSync.getBool("settingsChestYellow") && ["legendary", "yellow"].some(sub => chestOne.chestName.toLowerCase().includes(sub))) {
                this.DrawCustomImage(ctx, point.x, point.y, "legendary", "Resources", 35);
            }
        }
    }
}
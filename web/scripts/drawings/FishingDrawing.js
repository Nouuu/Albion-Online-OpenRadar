import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";

export class FishingDrawing extends DrawingUtils
{
    interpolate(fishes, lpX, lpY, t)
    {
        for (const fish of fishes)
        {
            this.interpolateEntity(fish, lpX, lpY, t);
        }
    }

    draw(ctx, fishes)
    {
        if (!settingsSync.getBool("settingFishing")) return;
        const showCount = settingsSync.getBool("settingResourceCount");
        for (const fish of fishes)
        {
            const point = this.transformPoint(fish.hX, fish.hY);

            this.DrawCustomImage(ctx, point.x, point.y, "fish", "Resources", 18);
            if (showCount) {
                this.drawText(point.x, point.y + this.getScaledSize(18), `${fish.sizeSpawned}/${fish.totalSize}`, ctx);
            }
        }
    }
}
import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";

const enabled = key => settingsSync.getBool(key);

export class DungeonsDrawing extends DrawingUtils
{

    interpolate(dungeons, lpX, lpY, t)
    {
        for (const dungoenOne of dungeons)
        {
            this.interpolateEntity(dungoenOne, lpX, lpY, t);
        }
    }

    draw(ctx, dungeons)
    {
        for (const dungeonOne of dungeons)
        {
            if (dungeonOne.drawName === undefined) continue;
            if (!dungeonOne.settingKeys.every(enabled)) continue;

            const point = this.transformPoint(dungeonOne.hX, dungeonOne.hY);
            this.DrawCustomImage(ctx, point.x, point.y, dungeonOne.drawName, "Resources", 28);
        }
    }
}
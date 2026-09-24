import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";

export class WispCageDrawing extends DrawingUtils
{
    constructor(Settings)
    {
        super(Settings);
    }

    interpolate(cages, lpX, lpY, t)
    {
        for (const cage of cages)
        {
            this.interpolateEntity(cage, lpX, lpY, t);
        }
    }

    draw(ctx, cages)
    {
        if (!settingsSync.getBool('settingMistsWispCages')) return;

        for (const cage of cages)
        {
            const point = this.transformPoint(cage.hX, cage.hY);

            this.DrawCustomImage(ctx, point.x, point.y, "cage", "Resources", 18);
        }
    }
}
import {DrawingUtils} from "../Utils/DrawingUtils.js";

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

            const point = this.transformPoint(dungeonOne.hX, dungeonOne.hY);
            this.DrawCustomImage(ctx, point.x, point.y, dungeonOne.drawName, "Resources", 40);
        }
    }
}
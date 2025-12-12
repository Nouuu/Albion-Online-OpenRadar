import {DrawingUtils} from "../Utils/DrawingUtils.js";

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
        for (const fish of fishes)
        {
            const point = this.transformPoint(fish.hX, fish.hY);

            this.DrawCustomImage(ctx, point.x, point.y, "fish", "Resources", 25);
            this.drawText(point.x, point.y + 25, `${fish.sizeSpawned}/${fish.totalSize}`, ctx)
        }
    }
}
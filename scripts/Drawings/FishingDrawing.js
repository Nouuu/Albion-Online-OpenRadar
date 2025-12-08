import {DrawingUtils} from "../Utils/DrawingUtils.js";

export class FishingDrawing extends DrawingUtils
{
    Interpolate(fishes, lpX, lpY, t)
    {
        for (const fish of fishes)
        {
            const hX = -1 * fish.posX + lpX;
            const hY = fish.posY - lpY;

            if (fish.hY == 0 && fish.hX == 0)
            {
                fish.hX = hX;
                fish.hY = hY;
            }

            fish.hX = this.lerp(fish.hX, hX, t);
            fish.hY = this.lerp(fish.hY, hY, t);
        }
    }

    Draw(ctx, fishes)
    {
        for (const fish of fishes)
        {
            const point = this.transformPoint(fish.hX, fish.hY);

            this.DrawCustomImage(ctx, point.x, point.y, "fish", "Resources", 25);
            this.drawText(point.x, point.y + 25, `${fish.sizeSpawned}/${fish.totalSize}`, ctx)
        }
    }
}
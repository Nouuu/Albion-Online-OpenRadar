import {DrawingUtils} from "../Utils/DrawingUtils.js";

export class WispCageDrawing extends DrawingUtils
{
    constructor(Settings)
    {
        super(Settings);
    }

    Interpolate(cages, lpX, lpY, t)
    {
        for (const cage of cages)
        {
            const hX = -1 * cage.posX + lpX;
            const hY = cage.posY - lpY;

            if (cage.hY == 0 && cage.hX == 0)
            {
                cage.hX = hX;
                cage.hY = hY;
            }

            cage.hX = this.lerp(cage.hX, hX, t);
            cage.hY = this.lerp(cage.hY, hY, t);
        }
    }

    Draw(ctx, cages)
    {
        for (const cage of cages)
        {
            const point = this.transformPoint(cage.hX, cage.hY);

            this.DrawCustomImage(ctx, point.x, point.y, "cage", "Resources", 25);
        }
    }
}
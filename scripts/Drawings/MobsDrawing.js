export class MobsDrawing extends DrawingUtils
{
    constructor(Settings)
    {
        super(Settings);
    }

    interpolate(mobs, mists, lpX, lpY, t)
    {
        for (const mobOne of mobs)
        {
            const hX = -1 * mobOne.posX + lpX;
            const hY = mobOne.posY - lpY;

            if (mobOne.hY == 0 && mobOne.hX == 0)
            {
                mobOne.hX = hX;
                mobOne.hY = hY;
            }

            mobOne.hX = this.lerp(mobOne.hX, hX, t);
            mobOne.hY = this.lerp(mobOne.hY, hY, t);
        }

        for (const mistOne of mists)
        {
            const hX = -1 * mistOne.posX + lpX;
            const hY = mistOne.posY - lpY;

            if (mistOne.hY == 0 && mistOne.hX == 0)
            {
                mistOne.hX = hX;
                mistOne.hY = hY;

            }

            mistOne.hX = this.lerp(mistOne.hX, hX, t);
            mistOne.hY = this.lerp(mistOne.hY, hY, t);
        }
    }

    invalidate(ctx, mobs, mists)
    {
        for (const mobOne of mobs)
        {
            const point = this.transformPoint(mobOne.hX, mobOne.hY);

            let imageName = undefined;
            let imageFolder = undefined;

            /* Set by default to enemy, since there are more, so we don't add at each case */
            let drawHp = this.settings.enemiesHP;
            let drawId = this.settings.enemiesID;

            if (mobOne.type == EnemyType.LivingSkinnable || mobOne.type == EnemyType.LivingHarvestable)
            {
                imageName = mobOne.name + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
                imageFolder = "Resources"; // Change folder to living harvestables

                drawHp = this.settings.livingResourcesHp;
                drawId = this.settings.livingResourcesID;
            }
            else if (mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Boss)
            {
                imageName = mobOne.name;
                imageFolder = "Resources"; // Change folder to enemies

                drawHp = this.settings.enemiesHP;
                drawId = this.settings.enemiesID;
            }
            else if (mobOne.type == EnemyType.Drone)
            {
                imageName = mobOne.name;
                imageFolder = "Resources"; // Change folder to enemies

                drawHp = this.settings.enemiesHP;
                drawId = this.settings.enemiesID;
            }
            else if (mobOne.type == EnemyType.MistBoss)
            {
                imageName = mobOne.name;
                imageFolder = "Resources"; // Change folder to enemies

                drawHp = this.settings.enemiesHP;
                drawId = this.settings.enemiesID;
            }
            else if (mobOne.type == EnemyType.Events)
            {
                imageName = mobOne.name;
                imageFolder = "Resources";

                drawHp = this.settings.enemiesHP;
                drawId = this.settings.enemiesID;
            }

            if (imageName !== undefined && imageFolder !== undefined)
                this.DrawCustomImage(ctx, point.x, point.y, imageName, imageFolder, 40);
            else
                this.drawFilledCircle(ctx, point.x, point.y, 10, "#4169E1"); // Unmanaged ids

            if (drawHp)
            {
                // TODO
                // Draw health bar?
                const textWidth = ctx.measureText(mobOne.health).width;
                this.drawTextItems(point.x - textWidth /2, point.y + 24, mobOne.health, ctx, "12px", "yellow");
            }

            if (drawId)
                this.drawText(point.x, point.y - 20, mobOne.typeId, ctx);
        }

        /* Mist portals */
        for (const mistsOne of mists)
        {
            if (!this.settings.mistEnchants[mistsOne.enchant])
            {
                continue;
            }

            if ((this.settings.mistSolo && mistsOne.type == 0) || (this.settings.mistDuo && mistsOne.type == 1))
            {
                // Change image folder
                const point = this.transformPoint(mistsOne.hX, mistsOne.hY);
                this.DrawCustomImage(ctx, point.x, point.y, "mist_" + mistsOne.enchant, "Resources", 30);
            }
        }
    }
}

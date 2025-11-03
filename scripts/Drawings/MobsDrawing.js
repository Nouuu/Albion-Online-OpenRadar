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
                // Only set imageName if mob has been identified (has name from mobinfo or cross-ref)
                // Otherwise leave undefined and fallback circle will be drawn
                if (mobOne.name && mobOne.tier > 0) {
                    imageName = mobOne.name + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
                    imageFolder = "Resources"; // Change folder to living harvestables
                }

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

            // 📊 Enchantment indicator for living resources (same as HarvestablesDrawing)
            if ((mobOne.type === EnemyType.LivingHarvestable || mobOne.type === EnemyType.LivingSkinnable) &&
                mobOne.enchantmentLevel > 0) {
                const enchantColors = {
                    1: "#90FF90",  // .1 - Light green
                    2: "#60D0FF",  // .2 - Cyan
                    3: "#FF90FF",  // .3 - Pink
                    4: "#FFD060"   // .4 - Gold
                };
                const enchantColor = enchantColors[mobOne.enchantmentLevel] || "#FFFFFF";

                // Draw enchantment indicator with background
                ctx.save();

                // Background circle
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 7, 0, 2 * Math.PI);
                ctx.fill();

                // Glowing dot
                ctx.shadowColor = enchantColor;
                ctx.shadowBlur = 10;
                ctx.fillStyle = enchantColor;
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 5, 0, 2 * Math.PI);
                ctx.fill();

                // Border
                ctx.strokeStyle = enchantColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 7, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();

                // Draw enchantment number with better visibility
                ctx.save();
                ctx.font = "bold 9px monospace";
                ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                ctx.shadowBlur = 3;
                ctx.fillStyle = enchantColor;
                ctx.fillText(`.${mobOne.enchantmentLevel}`, point.x + 14, point.y - 20);
                ctx.restore();
            }

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

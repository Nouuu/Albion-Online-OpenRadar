import {DrawingUtils} from "../Utils/DrawingUtils.js";
import {EnemyType} from "../Handlers/MobsHandler.js";
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import settingsSync from "../Utils/SettingsSync.js";

export class MobsDrawing extends DrawingUtils
{
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
        // Note: cluster detection & drawing is handled centrally in Utils.render (merged static + living resources)

        for (const mobOne of mobs)
        {
            const point = this.transformPoint(mobOne.hX, mobOne.hY);

            let imageName = undefined;
            let imageFolder = undefined;

            /* Set by default to enemy, since there are more, so we don't add at each case */
            let drawHealthBar = settingsSync.getBool("settingEnemiesHealthBar");
            let drawId = settingsSync.getBool("settingEnemiesID");
            let isLivingResource = false;

            if (mobOne.type == EnemyType.LivingSkinnable || mobOne.type == EnemyType.LivingHarvestable)
            {
                isLivingResource = true;
                // Only set imageName if mob has been identified (has name from mobinfo or cross-ref)
                // Otherwise leave undefined and fallback circle will be drawn
                if (mobOne.name && mobOne.tier > 0) {
                    imageName = mobOne.name + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
                    imageFolder = "Resources"; // Change folder to living harvestables
                }

                drawHealthBar = settingsSync.getBool("settingLivingResourcesHealthBar");
                drawId = settingsSync.getBool("settingLivingResourcesID");
            }
            else if (mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Boss)
            {
                // Only set imageName if mob has been identified (has name from mobinfo)
                // Otherwise leave undefined and fallback blue circle will be drawn
                if (mobOne.name) {
                    imageName = mobOne.name;
                    imageFolder = "Resources"; // Change folder to enemies
                }

                drawId = settingsSync.getBool("settingEnemiesID");
            }
            else if (mobOne.type == EnemyType.Drone)
            {
                // Only set imageName if mob has been identified (has name from mobinfo)
                // Otherwise leave undefined and fallback blue circle will be drawn
                if (mobOne.name) {
                    imageName = mobOne.name;
                    imageFolder = "Resources"; // Change folder to enemies
                }

                drawId = settingsSync.getBool("settingEnemiesID");
            }
            else if (mobOne.type == EnemyType.MistBoss)
            {
                // Only set imageName if mob has been identified (has name from mobinfo)
                // Otherwise leave undefined and fallback blue circle will be drawn
                if (mobOne.name) {
                    imageName = mobOne.name;
                    imageFolder = "Resources"; // Change folder to enemies
                }

                drawId = settingsSync.getBool("settingEnemiesID");
            }
            else if (mobOne.type == EnemyType.Events)
            {
                // Only set imageName if mob has been identified (has name from mobinfo)
                // Otherwise leave undefined and fallback blue circle will be drawn
                if (mobOne.name) {
                    imageName = mobOne.name;
                    imageFolder = "Resources";
                }

                drawId = settingsSync.getBool("settingEnemiesID");
            }

            if (imageName !== undefined && imageFolder !== undefined)
                this.DrawCustomImage(ctx, point.x, point.y, imageName, imageFolder, 40);
            else {
                // Color-coded circles by enemy type
                const color = this.getEnemyColor(mobOne.type);

                // 🐛 DEBUG: Log color assignment (only once per mob to avoid spam)
                if (!mobOne._debugLogged) {
                    window.logger?.debug(CATEGORIES.MOB_DRAW, EVENTS.MobDrawDetails, {
                        id: mobOne.id,
                        typeId: mobOne.typeId,
                        type: mobOne.type,
                        color: color
                    });
                    mobOne._debugLogged = true;
                }

                this.drawFilledCircle(ctx, point.x, point.y, 10, color);
            }

            // 📊 Enchantment indicator for living resources (if enabled)
            if (isLivingResource && settingsSync.getBool("settingLivingResourceEnchantOverlay") && mobOne.enchantmentLevel > 0) {
                this.drawEnchantmentIndicator(ctx, point.x, point.y, mobOne.enchantmentLevel);
            }

            // 📍 Distance indicator for living resources (if enabled) - use game-units (hX/hY)
            if (isLivingResource && settingsSync.getBool("settingResourceDistance"))
            {
                const distanceGameUnits = this.calculateDistance(mobOne.hX, mobOne.hY, 0, 0);
                this.drawDistanceIndicator(ctx, point.x, point.y, distanceGameUnits);
            }

            // 📊 Display enemy information

            if (drawHealthBar)
            {
                // Draw health bar with gradient colors
                const currentHP = mobOne.getCurrentHP();
                const maxHP = mobOne.maxHealth;
                this.drawHealthBar(ctx, point.x, point.y, currentHP, maxHP, 60, 10);
            }

            if (drawId)
            {
                // Display TypeID below the health bar (or mob if no health bar)
                const idText = `${mobOne.typeId}`;
                const idWidth = ctx.measureText(idText).width;
                const yOffset = drawHealthBar ? 34 : 24; // Adjust position based on health bar presence
                this.drawTextItems(point.x - idWidth / 2, point.y + yOffset, idText, ctx, "10px", "#CCCCCC");
            }
        }

        /* Mist portals */
        for (const mistsOne of mists)
        {
            if (settingsSync.getBool("settingMistE"+mistsOne.enchant))
            {
                continue;
            }

            if (settingsSync.getBool("settingMistSolo") && mistsOne.type == 0 || settingsSync.getBool("settingMistDuo") && mistsOne.type == 1)
            {
                // Change image folder
                const point = this.transformPoint(mistsOne.hX, mistsOne.hY);
                this.DrawCustomImage(ctx, point.x, point.y, "mist_" + mistsOne.enchant, "Resources", 30);
            }
        }
    }

    /**
     * Get color for enemy based on type
     * @param {number} enemyType - EnemyType enum value
     * @returns {string} Hex color code
     */
    getEnemyColor(enemyType) {
        const EnemyType = {
            LivingHarvestable: 0,
            LivingSkinnable: 1,
            Enemy: 2,           // Normal - Green
            MediumEnemy: 3,     // Medium - Yellow
            EnchantedEnemy: 4,  // Enchanted - Purple
            MiniBoss: 5,        // MiniBoss - Orange
            Boss: 6,            // Boss - Red
            Drone: 7,           // Drone - Cyan
            MistBoss: 8,        // MistBoss - Pink
            Events: 9           // Events - White
        };

        switch (enemyType) {
            case EnemyType.Enemy:           // Normal
                return "#00FF00"; // Green 🟢
            case EnemyType.MediumEnemy:     // Medium
                return "#FFFF00"; // Yellow 🟡
            case EnemyType.EnchantedEnemy:  // Enchanted
                return "#9370DB"; // Purple 🟣
            case EnemyType.MiniBoss:        // MiniBoss
                return "#FF8C00"; // Orange 🟠
            case EnemyType.Boss:            // Boss
                return "#FF0000"; // Red 🔴
            case EnemyType.Drone:           // Avalon Drone
                return "#00FFFF"; // Cyan 🔵
            case EnemyType.MistBoss:        // Mist Boss
                return "#FF1493"; // Pink 🩷
            case EnemyType.Events:          // Event enemies
                return "#FFFFFF"; // White ⚪
            case EnemyType.LivingHarvestable:
            case EnemyType.LivingSkinnable:
                return "#FFD700"; // Gold (living resources)
            default:
                return "#4169E1"; // Royal Blue (unmanaged/unknown)
        }
    }
}

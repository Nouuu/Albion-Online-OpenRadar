import {DrawingUtils} from "../utils/DrawingUtils.js";
import {EnemyType, getSettingNameForEnemyType} from "../handlers/MobsHandler.js";
import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "../utils/SettingsSync.js";
import {shouldRenderLivingResource} from "../utils/LivingResourceFilter.js";

export class MobsDrawing extends DrawingUtils
{
    constructor() {
        super();
        this.lastVisibleCount = 0;
    }

    interpolate(mobs, lpX, lpY, t)
    {
        for (const mobOne of mobs)
        {
            this.interpolateEntity(mobOne, lpX, lpY, t);
        }
    }

    invalidate(ctx, mobs)
    {
        // Note: cluster detection & drawing is handled centrally in Utils.render (merged static + living resources)
        this.lastVisibleCount = 0;

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
                if (!shouldRenderLivingResource(mobOne, key => settingsSync.getJSON(key))) {
                    continue;
                }
                // Only set imageName if mob has been identified (has name from mobinfo or cross-ref)
                // Otherwise leave undefined and fallback circle will be drawn
                if (mobOne.name && mobOne.tier > 0) {
                    imageName = mobOne.name.toLowerCase() + "_" + mobOne.tier + "_" + mobOne.enchantmentLevel;
                    imageFolder = "Resources";
                }

                drawHealthBar = settingsSync.getBool("settingLivingResourcesHealthBar");
                drawId = settingsSync.getBool("settingLivingResourcesID");
            }
            else if (mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Boss)
            {
                if (!mobOne.identified) {
                    if (settingsSync.getBool("settingShowUnmanagedEnemies") === false) continue;
                } else {
                    const settingName = getSettingNameForEnemyType(mobOne.type);
                    if (settingName && settingsSync.getBool(settingName) === false) continue;
                }

                if (settingsSync.getBool("settingShowMinimumHealthEnemies")) {
                    const threshold = settingsSync.getNumber("settingTextMinimumHealthEnemies", 2100);
                    if ((mobOne.maxHealth ?? 0) < threshold) continue;
                }

                // Use color-coded circles for hostile mobs (not images)
                // imageName stays undefined to trigger the colored circle rendering below
                // The color is determined by mob.type (Enemy=green, EnchantedEnemy=purple, MiniBoss=orange, Boss=red)

                drawId = settingsSync.getBool("settingEnemiesID");
            }
            else if (mobOne.type == EnemyType.Drone)
            {
                if (!settingsSync.getBool("settingAvaloneDrones")) continue;

                // Use color-coded circles for drones (not images)
                // imageName stays undefined to trigger the colored circle rendering below

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
                if (!settingsSync.getBool("settingShowEventEnemies")) continue;

                // Only set imageName if mob has been identified (has name from mobinfo)
                // Otherwise leave undefined and fallback blue circle will be drawn
                if (mobOne.name) {
                    imageName = mobOne.name;
                    imageFolder = "Resources";
                }

                drawId = settingsSync.getBool("settingEnemiesID");
            }

            this.lastVisibleCount++;

            if (imageName !== undefined && imageFolder !== undefined) {
                const useBadge = isLivingResource && settingsSync.getBool('settingResourceColorBadges');
                const category = useBadge ? this.getResourceCategory(mobOne.name) : null;
                if (useBadge && category) {
                    this.drawResourceBadge(
                        ctx, point.x, point.y, 40,
                        category, mobOne.tier, mobOne.enchantmentLevel, true
                    );
                } else {
                    this.DrawCustomImage(ctx, point.x, point.y, imageName, imageFolder, 40);
                }
            }
            else {
                // Color-coded circles by enemy type
                const color = this.getEnemyColor(mobOne.type);

                // 🐛 DEBUG: Log color assignment (only once per mob to avoid spam)
                if (!mobOne._debugLogged) {
                    window.logger?.debug(CATEGORIES.RENDERING, 'mob_draw_details', {
                        id: mobOne.id,
                        typeId: mobOne.typeId,
                        type: mobOne.type,
                        color: color
                    });
                    mobOne._debugLogged = true;
                }

                this.drawFilledCircle(ctx, point.x, point.y, this.getMarkerSize(6), color);
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
                // Draw health bar with gradient colors (dimensions scaled with zoom)
                const currentHP = mobOne.getCurrentHP();
                const maxHP = mobOne.maxHealth;
                this.drawHealthBar(ctx, point.x, point.y, currentHP, maxHP, this.getScaledSize(60), this.getScaledSize(10));
            }

            // 📊 Display enemy information below the mob (offsets scaled with zoom)
            const offset36 = this.getMarkerSize(36);
            const offset26 = this.getMarkerSize(26);
            const offset12 = this.getScaledSize(12);
            let currentYOffset = drawHealthBar ? offset36 : offset26; // Start position based on health bar presence

            // Scale font sizes for mob info display
            const fontSize10 = `${this.getScaledFontSize(10, 7)}px`;
            const fontSize9 = `${this.getScaledFontSize(9, 6)}px`;

            if (drawId)
            {
                // Display TypeID
                const idText = `${mobOne.typeId}`;
                ctx.font = `${fontSize10} ${this.fontFamily}`;
                const idWidth = ctx.measureText(idText).width;
                this.drawTextItems(point.x - idWidth / 2, point.y + currentYOffset, idText, ctx, fontSize10, "#CCCCCC");
                currentYOffset += offset12; // Move down for next element
            }

            // Display DB uniqueName for living resources (diagnostic overlay)
            if (isLivingResource && settingsSync.getBool("settingLivingResourcesName") && mobOne.uniqueName) {
                const nameText = mobOne.uniqueName;
                ctx.font = `${fontSize9} ${this.fontFamily}`;
                const nameWidth = ctx.measureText(nameText).width;
                this.drawTextItems(point.x - nameWidth / 2, point.y + currentYOffset, nameText, ctx, fontSize9, "#FFD700");
                currentYOffset += offset12;
            }

            // Display Tier (for hostile mobs only, not living resources)
            if (settingsSync.getBool("settingEnemiesTier") && mobOne.tier > 0 &&
                mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Events) {
                const tierText = `T${mobOne.tier}`;
                ctx.font = `${fontSize10} ${this.fontFamily}`;
                const tierWidth = ctx.measureText(tierText).width;
                this.drawTextItems(point.x - tierWidth / 2, point.y + currentYOffset, tierText, ctx, fontSize10, "#FFD700");
                currentYOffset += offset12; // Move down for next element
            }

            // Display Name (localized if available, fallback to technical name)
            if (settingsSync.getBool("settingEnemiesName") && mobOne.name &&
                mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Events) {
                // Try to get localized name first
                let displayName = null;
                if (mobOne.namelocatag && window.localizationDatabase) {
                    displayName = window.localizationDatabase.getText(mobOne.namelocatag);
                }

                // Fallback to technical name if no localization available
                if (!displayName) {
                    // Simplify the technical name by removing tier prefix
                    displayName = mobOne.name.replace(/^T\d+_MOB_/, '').replace(/_/g, ' ');
                }

                // Limit length to prevent overcrowding
                if (displayName.length > 20) {
                    displayName = displayName.substring(0, 17) + '...';
                }
                ctx.font = `${fontSize9} ${this.fontFamily}`;
                const nameWidth = ctx.measureText(displayName).width;
                this.drawTextItems(point.x - nameWidth / 2, point.y + currentYOffset, displayName, ctx, fontSize9, "#FFFFFF");
                currentYOffset += offset12; // Move down for next element
            }

            // Display Category Badge
            if (settingsSync.getBool("settingEnemiesCategoryBadge") && mobOne.category &&
                mobOne.type >= EnemyType.Enemy && mobOne.type <= EnemyType.Events) {
                // Format category for display (uppercase, short)
                let badgeText = mobOne.category.toUpperCase();
                // Use abbreviated versions for common categories
                const categoryMap = {
                    'BOSS': '👑',
                    'MINIBOSS': '⭐',
                    'CHAMPION': '💎',
                    'VETERAN': 'VET',
                    'ELITE': 'ELI',
                    'STANDARD': 'STD',
                    'TRASH': 'TRA'
                };
                badgeText = categoryMap[badgeText] || badgeText.substring(0, 3);

                ctx.font = `${fontSize10} ${this.fontFamily}`;
                const badgeWidth = ctx.measureText(badgeText).width;
                // Use a distinct color for the badge
                this.drawTextItems(point.x - badgeWidth / 2, point.y + currentYOffset, badgeText, ctx, fontSize10, "#FF69B4");
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

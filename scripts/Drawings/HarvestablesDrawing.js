import {DrawingUtils} from "../Utils/DrawingUtils.js";
import settingsSync from "../Utils/SettingsSync.js";

export class HarvestablesDrawing extends DrawingUtils  {
    interpolate(harvestables, lpX, lpY ,t ) {

        for (const harvestableOne of harvestables) {
 
            const hX = -1 * harvestableOne.posX + lpX;
            const hY = harvestableOne.posY - lpY;

       
            if (harvestableOne.hY === 0 && harvestableOne.hX === 0) {
                harvestableOne.hX = hX;
                harvestableOne.hY = hY;

            }
            
            harvestableOne.hX = this.lerp(harvestableOne.hX, hX, t);
            harvestableOne.hY = this.lerp(harvestableOne.hY, hY, t);
            
        }

    }

    invalidate(ctx, harvestables)
    {
        // Clusters are detected and drawn centrally in Utils.render when overlayCluster is enabled
        // (to merge static harvestables and living resources into the same clustering pass)

        for (const harvestableOne of harvestables)
        {
            if (harvestableOne.size <= 0) continue;

            const type = harvestableOne.type;
            let draw = undefined;

            // Map resource type to image name
            if (type >= 0 && type <= 5)
            {
                draw = "Logs_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 6 && type <= 10)
            {
                draw = "rock_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 11 && type <= 15)
            {
                draw = "fiber_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 16 && type <= 22)
            {
                draw = "hide_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 23 && type <= 27)
            {
                draw = "ore_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }

            if (draw === undefined)
                continue;

            const point = this.transformPoint(harvestableOne.hX, harvestableOne.hY);

            // Draw resource icon
            this.DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 50);

            // Debug: TypeID display
            if (settingsSync.getBool('livingResourcesID'))
                this.drawText(point.x, point.y + 20, type.toString(), ctx);

            // 📊 Enchantment indicator (if enabled)
            if (settingsSync.getBool('settingLivingResourceEnchantOverlay') && harvestableOne.charges > 0){
                this.drawEnchantmentIndicator(ctx, point.x, point.y, harvestableOne.charges);
            }

            // 📍 Distance indicator (if enabled) - use game-units (hX/hY) so metrics match clusters
            if (settingsSync.getBool('settingResourceDistance')) {
                const distanceGameUnits = this.calculateDistance(harvestableOne.hX, harvestableOne.hY, 0, 0);
                this.drawDistanceIndicator(ctx, point.x, point.y, distanceGameUnits);
            }

            // 📊 Resource count badge (if enabled)
            if (settingsSync.getBool('settingResourceCount'))
            {
                const realResources = this.calculateRealResources(
                    parseInt(harvestableOne.size),
                    harvestableOne.tier
                );
                this.drawResourceCountBadge(ctx, point.x, point.y, realResources);
            }
        }
    }
}
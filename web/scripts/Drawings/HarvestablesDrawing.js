import {DrawingUtils} from "../Utils/DrawingUtils.js";
import settingsSync from "../Utils/SettingsSync.js";
import {CATEGORIES} from "../constants/LoggerConstants.js";

export class HarvestablesDrawing extends DrawingUtils  {
    interpolate(harvestables, lpX, lpY, t) {
        for (const harvestableOne of harvestables) {
            this.interpolateEntity(harvestableOne, lpX, lpY, t);
        }
    }

    invalidate(ctx, harvestables)
    {
        // Clusters are detected and drawn centrally in Utils.render when overlayCluster is enabled
        // (to merge static harvestables and living resources into the same clustering pass)

        for (const harvestableOne of harvestables)
        {
            if (harvestableOne.size <= 0) continue;

            let draw = undefined;

            // Use stringType if available (corrected by MobsDatabase for living resources)
            if (harvestableOne.stringType) {
                const st = harvestableOne.stringType.toLowerCase();
                if (st === 'log' || st === 'wood' || st === 'logs') {
                    draw = "Logs_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (st === 'rock') {
                    draw = "rock_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (st === 'fiber') {
                    draw = "fiber_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (st === 'hide') {
                    draw = "hide_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (st === 'ore') {
                    draw = "ore_" + harvestableOne.tier + "_" + harvestableOne.charges;
                }

                window.logger?.debug(CATEGORIES.HARVEST, 'Drawing_UsingStringType', {
                    id: harvestableOne.id,
                    stringType: harvestableOne.stringType,
                    type: harvestableOne.type,
                    draw,
                    tier: harvestableOne.tier,
                    charges: harvestableOne.charges
                });
            }

            // Fallback: use type (typeNumber) if no stringType available
            if (!draw) {
                const type = harvestableOne.type;
                if (type >= 0 && type <= 5) {
                    draw = "Logs_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (type >= 6 && type <= 10) {
                    draw = "rock_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (type >= 11 && type <= 15) {
                    draw = "fiber_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (type >= 16 && type <= 22) {
                    draw = "hide_" + harvestableOne.tier + "_" + harvestableOne.charges;
                } else if (type >= 23 && type <= 27) {
                    draw = "ore_" + harvestableOne.tier + "_" + harvestableOne.charges;
                }

                window.logger?.debug(CATEGORIES.HARVEST, 'Drawing_UsingTypeNumber', {
                    id: harvestableOne.id,
                    stringType: harvestableOne.stringType,
                    type: harvestableOne.type,
                    draw,
                    tier: harvestableOne.tier,
                    charges: harvestableOne.charges,
                    note: 'FALLBACK - no stringType available'
                });
            }

            if (draw === undefined) {
                window.logger?.warn(CATEGORIES.HARVEST, 'Drawing_NoMatch', {
                    id: harvestableOne.id,
                    stringType: harvestableOne.stringType,
                    type: harvestableOne.type,
                    note: 'Could not determine resource image'
                });
                continue;
            }

            const point = this.transformPoint(harvestableOne.hX, harvestableOne.hY);

            // Draw resource icon (same size as living resources)
            this.DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 40);

            // Debug: TypeID display (offset scaled with zoom)
            if (settingsSync.getBool('livingResourcesID'))
                this.drawText(point.x, point.y + this.getScaledSize(20), harvestableOne.type.toString(), ctx);

            // Distance indicator (if enabled) - use game-units (hX/hY) so metrics match clusters
            if (settingsSync.getBool('settingResourceDistance')) {
                const distanceGameUnits = this.calculateDistance(harvestableOne.hX, harvestableOne.hY, 0, 0);
                this.drawDistanceIndicator(ctx, point.x, point.y, distanceGameUnits);
            }

            // Resource count badge (if enabled)
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
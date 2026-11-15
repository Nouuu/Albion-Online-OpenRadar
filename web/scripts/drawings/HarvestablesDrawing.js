import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";
import {isMobOrigin, shouldRenderLivingResource, shouldRenderStaticResource} from '../utils/LivingResourceFilter.js';

export class HarvestablesDrawing extends DrawingUtils  {
    constructor() {
        super();
        this.lastVisibleCount = 0;
    }

    interpolate(harvestables, lpX, lpY, t) {
        for (const harvestableOne of harvestables) {
            this.interpolateEntity(harvestableOne, lpX, lpY, t);
        }
    }

    invalidate(ctx, harvestables)
    {
        // Clusters are detected and drawn centrally in Utils.render when overlayCluster is enabled
        // (to merge static harvestables and living resources into the same clustering pass)
        this.lastVisibleCount = 0;

        for (const harvestableOne of harvestables)
        {
            if (harvestableOne.chargeLevel <= 0) continue;

            const filterEntity = {
                name: harvestableOne.stringType,
                tier: harvestableOne.tier,
                enchantmentLevel: harvestableOne.rareState,
            };
            const filterFn = isMobOrigin(harvestableOne.mobileTypeId) ? shouldRenderLivingResource : shouldRenderStaticResource;
            if (!filterFn(filterEntity, key => settingsSync.getJSON(key))) {
                continue;
            }

            let draw = undefined;

            // Use stringType if available (corrected by MobsDatabase for living resources)
            if (harvestableOne.stringType) {
                const st = harvestableOne.stringType.toLowerCase();
                if (st === 'log' || st === 'wood' || st === 'logs') {
                    draw = "log_" + harvestableOne.tier + "_" + harvestableOne.rareState;
                } else if (st === 'rock') {
                    draw = "rock_" + harvestableOne.tier + "_" + harvestableOne.rareState;
                } else if (st === 'fiber') {
                    draw = "fiber_" + harvestableOne.tier + "_" + harvestableOne.rareState;
                } else if (st === 'hide') {
                    draw = "hide_" + harvestableOne.tier + "_" + harvestableOne.rareState;
                } else if (st === 'ore') {
                    draw = "ore_" + harvestableOne.tier + "_" + harvestableOne.rareState;
                }
            }

            if (draw === undefined) {
                continue;
            }

            const point = this.transformPoint(harvestableOne.hX, harvestableOne.hY);

            this.lastVisibleCount++;

            const useBadge = settingsSync.getBool('settingRadarResourceTierBadges');
            const category = useBadge ? this.getResourceCategory(harvestableOne.stringType) : null;
            if (useBadge && category) {
                this.drawResourceBadge(
                    ctx, point.x, point.y, 32,
                    category, harvestableOne.tier, harvestableOne.rareState, false
                );
            } else {
                this.DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 32);
            }

            // Debug: TypeID display (offset scaled with zoom)
            if (settingsSync.getBool('settingDebugResourcesTypeId'))
                this.drawText(point.x, point.y + this.getMarkerSize(20), harvestableOne.position.toString(), ctx);

            // Distance indicator (if enabled) - use game-units (hX/hY) so metrics match clusters
            if (settingsSync.getBool('settingRadarResourceDistance')) {
                const distanceGameUnits = this.calculateDistance(harvestableOne.hX, harvestableOne.hY, 0, 0);
                this.drawDistanceIndicator(ctx, point.x, point.y, distanceGameUnits);
            }

            // Resource count badge (if enabled)
            if (settingsSync.getBool('settingRadarResourceCount'))
            {
                const realResources = this.calculateRealResources(
                    parseInt(harvestableOne.chargeLevel),
                    harvestableOne.tier
                );
                this.drawResourceCountBadge(ctx, point.x, point.y, realResources);
            }
        }
    }
}
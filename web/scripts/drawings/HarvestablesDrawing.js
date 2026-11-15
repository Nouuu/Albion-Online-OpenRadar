import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";
import {isMobOrigin, shouldRenderLivingResource, shouldRenderStaticResource} from '../utils/LivingResourceFilter.js';

const ICON_FAMILY = new Map([
    ['log', 'log'], ['wood', 'log'], ['logs', 'log'],
    ['rock', 'rock'], ['fiber', 'fiber'], ['hide', 'hide'], ['ore', 'ore'],
]);

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

    drawEntryName(ctx, point, harvestable) {
        if (!settingsSync.getBool('settingDebugResourcesDbName')) return;
        const entryName = window.harvestablesDatabase?.entryAt(harvestable.position)?.name;
        if (!entryName) return;
        const text = `T${harvestable.tier}_${entryName}${harvestable.rareState > 0 ? `@${harvestable.rareState}` : ''}`;
        const fontSize = `${this.getScaledFontSize(9, 6)}px`;
        ctx.font = `${fontSize} ${this.fontFamily}`;
        const width = ctx.measureText(text).width;
        this.drawTextItems(point.x - width / 2, point.y + this.getMarkerSize(32), text, ctx, fontSize, '#FFD700');
    }

    iconName(harvestable) {
        const family = ICON_FAMILY.get(harvestable.stringType?.toLowerCase());
        return family && `${family}_${harvestable.tier}_${harvestable.rareState}`;
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

            const draw = this.iconName(harvestableOne);

            if (!draw) {
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

            this.drawEntryName(ctx, point, harvestableOne);

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
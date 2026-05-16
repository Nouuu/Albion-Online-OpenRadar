import {DrawingUtils} from "../utils/DrawingUtils.js";
import settingsSync from "../utils/SettingsSync.js";

export class MistsDungeonDrawing extends DrawingUtils {
    interpolate(portals, lpX, lpY, t) {
        for (const portal of portals) {
            this.interpolateEntity(portal, lpX, lpY, t);
        }
    }

    draw(ctx, portals) {
        if (!settingsSync.getBool('settingShowKnightfallAbbey', true)) return;
        for (const portal of portals) {
            if (!portal.drawName) continue;
            const point = this.transformPoint(portal.hX, portal.hY);
            this.DrawCustomImage(ctx, point.x, point.y, portal.drawName, 'Resources', 32);
        }
    }
}

import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';

export class MistsWispDrawing extends DrawingUtils {
    interpolate(wisps, lpX, lpY, t) {
        for (const w of wisps) {
            this.interpolateEntity(w, lpX, lpY, t);
        }
    }

    invalidate(ctx, wisps) {
        if (!settingsSync.getBool('settingWispSpawn')) return;

        const showId = settingsSync.getBool('settingWispSpawnDebugID');

        for (const w of wisps) {
            const p = this.transformPoint(w.hX, w.hY);
            this.DrawCustomImage(ctx, p.x, p.y, 'mist_0', 'Resources', 20);

            if (showId) {
                this.drawText(p.x, p.y + this.getScaledSize(18), w.id.toString(), ctx);
            }
        }
    }
}

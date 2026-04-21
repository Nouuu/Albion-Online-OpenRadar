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
        const fontSize = `${this.getScaledFontSize(10, 7)}px`;
        const yOffset = this.getScaledSize(26);

        for (const w of wisps) {
            const p = this.transformPoint(w.hX, w.hY);
            this.DrawCustomImage(ctx, p.x, p.y, 'mist_0', 'Resources', 20);

            if (showId && w.id !== undefined) {
                const idText = w.id.toString();
                ctx.font = `${fontSize} ${this.fontFamily}`;
                const idWidth = ctx.measureText(idText).width;
                this.drawTextItems(p.x - idWidth / 2, p.y + yOffset, idText, ctx, fontSize, '#CCCCCC');
            }
        }
    }
}

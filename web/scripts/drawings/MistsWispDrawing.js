import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';

export class MistsWispDrawing extends DrawingUtils {
    interpolate(mists, lpX, lpY, t) {
        for (const m of mists) {
            this.interpolateEntity(m, lpX, lpY, t);
        }
    }

    invalidate(ctx, mists) {
        if (!settingsSync.getBool('settingWispSpawn')) return;

        const showId = settingsSync.getBool('settingWispSpawnDebugID');
        const fontSize = `${this.getScaledFontSize(10, 7)}px`;
        const yOffset = this.getScaledSize(26);

        for (const m of mists) {
            if (!settingsSync.getBool('settingMistE' + m.enchant)) continue;

            const soloAllowed = settingsSync.getBool('settingMistSolo') && m.type == 0;
            const duoAllowed = settingsSync.getBool('settingMistDuo') && m.type == 1;
            if (!soloAllowed && !duoAllowed) continue;

            const p = this.transformPoint(m.hX, m.hY);
            this.DrawCustomImage(ctx, p.x, p.y, 'mist_' + m.enchant, 'Resources', 21);

            if (showId && m.id !== undefined) {
                const idText = m.id.toString();
                ctx.font = `${fontSize} ${this.fontFamily}`;
                const idWidth = ctx.measureText(idText).width;
                this.drawTextItems(p.x - idWidth / 2, p.y + yOffset, idText, ctx, fontSize, '#CCCCCC');
            }
        }
    }
}

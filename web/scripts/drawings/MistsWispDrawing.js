import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';

// Index is the rarity carried by NewMob Parameters[34]. Colors follow the trail a wisp leaves in game.
export const WISP_RARITIES = [
    {name: 'Common', color: '#ffffff', glow: false},
    {name: 'Uncommon', color: '#4ade80', glow: false},
    {name: 'Rare', color: '#3b82f6', glow: false},
    {name: 'Epic', color: '#a855f7', glow: true},
    {name: 'Legendary', color: '#facc15', glow: true},
];

export class MistsWispDrawing extends DrawingUtils {
    interpolate(mists, lpX, lpY, t) {
        for (const m of mists) {
            this.interpolateEntity(m, lpX, lpY, t);
        }
    }

    drawRarityRing(ctx, x, y, rarity) {
        const {color, glow} = WISP_RARITIES[rarity];
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, this.getMarkerSize(13), 0, 2 * Math.PI);
        ctx.lineWidth = Math.max(1.5, this.getMarkerSize(1.5 + rarity * 0.5));
        ctx.strokeStyle = color;
        if (glow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = this.getMarkerSize(10);
        }
        ctx.stroke();
        ctx.restore();
    }

    invalidate(ctx, mists) {
        if (!settingsSync.getBool('settingMistsWisps')) return;

        const showId = settingsSync.getBool('settingDebugMistsWispIds');
        const fontSize = `${this.getScaledFontSize(10, 7)}px`;
        const yOffset = this.getMarkerSize(26);

        for (const m of mists) {
            if (m.enchant === undefined || m.enchant === null || !settingsSync.getBool('settingMistsEnchant' + m.enchant)) continue;

            const soloAllowed = settingsSync.getBool('settingMistsSolo') && m.type == 0;
            const duoAllowed = settingsSync.getBool('settingMistsDuo') && m.type == 1;
            if (!soloAllowed && !duoAllowed) continue;

            const p = this.transformPoint(m.hX, m.hY);
            if (WISP_RARITIES[m.enchant]) this.drawRarityRing(ctx, p.x, p.y, m.enchant);
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

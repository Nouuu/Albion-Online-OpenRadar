import {DrawingUtils} from '../utils/DrawingUtils.js';
import settingsSync from '../utils/SettingsSync.js';
import {ACTION_LIFETIME_MS} from '../handlers/ActionsHandler.js';

const CLASS_COLORS = {hostile: '#ef4444', faction: '#3b82f6', passive: '#22c55e'};
const FAMILY_EMOJI = {presence: '\u{2728}', mount: '\u{1F40E}', combat: '\u{2694}\u{FE0F}', mobility: '\u{1F4A8}'};

export class ActionsDrawing extends DrawingUtils {
    emojiImages = {};

    emojiImage(family, px) {
        const key = `${family} ${px}`;
        if (!(key in this.emojiImages)) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = canvas.height = Math.ceil(px * 1.5);
                ctx.font = `${px}px ${this.fontFamily}`;
                ctx.fillStyle = this.textColor;
                ctx.fillText(FAMILY_EMOJI[family], 0, px);
            }
            this.emojiImages[key] = ctx ? canvas : null;
        }
        return this.emojiImages[key];
    }

    interpolate(markers, lpX, lpY, t) {
        for (const marker of markers) {
            const hX = lpX - marker.x;
            const hY = marker.y - lpY;
            if (marker.hX === undefined) {
                marker.hX = hX;
                marker.hY = hY;
            }
            marker.hX = this.lerp(marker.hX, hX, t);
            marker.hY = this.lerp(marker.hY, hY, t);
        }
    }

    invalidate(ctx, markers, byType) {
        if (!settingsSync.getBool('settingShowPlayers') || !settingsSync.getBool('settingShowPlayerActions')) return;

        const listed = Object.entries(byType).flatMap(([cls, players]) => players.map(player => ({player, cls})));
        const now = Date.now();
        const size = this.getMarkerSize(7);
        const px = this.getScaledFontSize(9, 6);
        const fontSize = `${px}px`;

        for (const marker of markers) {
            const entry = listed.find(e => e.player.id === marker.playerId);
            if (!entry) continue;

            const age = now - marker.at;
            const point = this.transformPoint(marker.hX, marker.hY);
            ctx.globalAlpha = Math.max(0, 1 - age / ACTION_LIFETIME_MS);
            this.drawDiamond(ctx, point.x, point.y, size, CLASS_COLORS[entry.cls]);
            const emoji = this.emojiImage(marker.family, px);
            if (emoji) ctx.drawImage(emoji, point.x + size / 2, point.y - size / 2 - px);

            const label = `${entry.player.nickname} \u{00B7} ${(age / 1000).toFixed(1)}s`;
            ctx.font = `${fontSize} ${this.fontFamily}`;
            const width = ctx.measureText(label).width;
            this.drawTextItems(point.x - width / 2, point.y + size * 2, label, ctx, fontSize, this.textColor);
        }
        ctx.globalAlpha = 1;
    }

    drawDiamond(ctx, x, y, size, color) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.stroke();
    }
}

import {CATEGORIES} from "../constants/LoggerConstants.js";
import imageCache from "./ImageCache.js";
import settingsSync from "./SettingsSync.js";

const SCALE_FACTOR = 1.0;
const BASE_ZOOM = 4;

export class DrawingUtils {
    constructor() {
        this.fontSize = "12px";
        this.fontFamily = "Arial";
        this.textColor = "white";
        this.images = [];
    }

    getZoomLevel() { return settingsSync.getFloat('settingRadarZoom') || 1.0; }
    getScaledSize(baseSize) { return baseSize * this.getZoomLevel(); }
    getScaledFontSize(baseFontSize, minFontSize = 7) { return Math.max(minFontSize, baseFontSize * this.getZoomLevel()); }
    getCanvasSize() { return settingsSync.getNumber('settingCanvasSize') || 500; }
    getCanvasCenter() { return this.getCanvasSize() / 2; }

    drawFilledCircle(context, x, y, radius, color) {
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.fill();
    }

    lerp(a, b, t) { return a + (b - a) * t; }

    interpolateEntity(entity, lpX, lpY, t) {
        const hX = -1 * entity.posX + lpX;
        const hY = entity.posY - lpY;

        if (entity.hY === 0 && entity.hX === 0) {
            entity.hX = hX;
            entity.hY = hY;
        }

        entity.hX = this.lerp(entity.hX, hX, t);
        entity.hY = this.lerp(entity.hY, hY, t);
    }

    DrawCustomImage(ctx, x, y, imageName, folder, size) {
        if (!imageName) return;

        const folderR = (!folder) ? "" : folder + "/";
        const src = "/images/" + folderR + imageName + ".webp";
        const preloadedImage = imageCache.GetPreloadedImage(src, folder);
        const scaledSize = this.getScaledSize(size);

        if (preloadedImage === null) {
            this.drawFilledCircle(ctx, x, y, this.getScaledSize(10), "#4169E1");
            return;
        }

        if (preloadedImage) {
            ctx.drawImage(preloadedImage, x - scaledSize / 2, y - scaledSize / 2, scaledSize, scaledSize);
        } else {
            imageCache.preloadImageAndAddToList(src, folder)
                .then(() => window.logger?.info(CATEGORIES.SYSTEM, 'item_loaded', {src, folder}))
                .catch((error) => window.logger?.warn(CATEGORIES.SYSTEM, 'item_load_failed', {
                    src,
                    folder,
                    error: error?.message
                }));
        }
    }

    transformPoint(x, y) {
        const angle = -0.785398;
        let newX = x * angle - y * angle;
        let newY = x * angle + y * angle;
        const zoom = BASE_ZOOM * this.getZoomLevel();
        newX *= zoom;
        newY *= zoom;
        const center = this.getCanvasCenter();
        newX += center;
        newY += center;
        return { x: newX, y: newY };
    }

    drawText(xTemp, yTemp, text, ctx) {
        const scaledFontSize = `${this.getScaledFontSize(12, 8)}px`;
        ctx.font = scaledFontSize + " " + this.fontFamily;
        ctx.fillStyle = this.textColor;
        const textWidth = ctx.measureText(text).width;
        ctx.fillText(text, xTemp - textWidth / 2, yTemp);
    }

    drawTextItems(xTemp, yTemp, text, ctx, size, color) {
        ctx.font = size + " " + this.fontFamily;
        ctx.fillStyle = color;
        ctx.fillText(text, xTemp, yTemp);
    }

    drawResourceCountBadge(ctx, x, y, count, position = 'bottom-right') {
        const text = count.toString();
        ctx.save();

        const fontSize = this.getScaledFontSize(10, 7);
        ctx.font = `bold ${fontSize}px monospace`;
        const textWidth = ctx.measureText(text).width;

        const padding = this.getScaledSize(4);
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = this.getScaledSize(14);
        const radius = this.getScaledSize(4);

        const offset8 = this.getScaledSize(8);
        const offset6 = this.getScaledSize(6);
        const offset20 = this.getScaledSize(20);

        const positions = {
            'bottom-right': { x: x + offset8, y: y + offset6 },
            'top-right': { x: x + offset8, y: y - offset20 },
            'bottom-left': { x: x - rectWidth - offset8, y: y + offset6 }
        };
        const pos = positions[position] || positions['bottom-right'];
        const rectX = pos.x; const rectY = pos.y;

        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(0,0,0,0.85)");
        gradient.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(rectX + radius, rectY);
        ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight);
        ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, rectX + padding, rectY + fontSize);
        ctx.restore();
    }

    calculateRealResources(size, tier) {
        if (tier <= 3) return size * 3;
        if (tier === 4) return size * 2;
        return size;
    }

    drawDistanceIndicator(ctx, x, y, distance) {
        if (!distance || distance <= 0) return;
        ctx.save();

        const realDistanceFloat = (distance / 3) * SCALE_FACTOR;
        if (realDistanceFloat <= 2) { ctx.restore(); return; }

        const realDistance = Math.round(realDistanceFloat);
        const fontSize = this.getScaledFontSize(9, 6);
        ctx.font = `bold ${fontSize}px monospace`;
        const text = realDistance < 1000 ? `${realDistance}m` : `${(realDistance / 1000).toFixed(1)}km`;

        const textWidth = ctx.measureText(text).width;
        const padding = this.getScaledSize(3);
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = this.getScaledSize(12);
        const radius = this.getScaledSize(3);
        const rectX = x - rectWidth - this.getScaledSize(8);
        const rectY = y - this.getScaledSize(20);

        let color;
        if (realDistance < 10) color = "rgba(0,200,0,0.85)";
        else if (realDistance < 20) color = "rgba(255,200,0,0.85)";
        else color = "rgba(255,100,0,0.85)";

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(rectX + radius, rectY);
        ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight);
        ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, rectX + padding, rectY + fontSize);
        ctx.restore();
    }

    drawHealthBar(ctx, x, y, currentHP, maxHP, width = 50, height = 6) {
        if (!currentHP || !maxHP || maxHP <= 0) return;

        ctx.save();
        const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
        const fillWidth = (width * hpPercent) / 100;
        const barX = x - width / 2;
        const barY = y + this.getScaledSize(16);

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(barX, barY, width, height);

        const gradient = ctx.createLinearGradient(barX, barY, barX + width, barY);
        if (hpPercent > 75) { gradient.addColorStop(0, "#00FF00"); gradient.addColorStop(1, "#88FF88"); }
        else if (hpPercent > 50) { gradient.addColorStop(0, "#BBFF00"); gradient.addColorStop(1, "#FFFF00"); }
        else if (hpPercent > 25) { gradient.addColorStop(0, "#FFAA00"); gradient.addColorStop(1, "#FF6600"); }
        else { gradient.addColorStop(0, "#FF3300"); gradient.addColorStop(1, "#FF0000"); }

        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, fillWidth, height);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, width, height);

        const hpFontSize = this.getScaledFontSize(11, 7);
        ctx.font = `bold ${hpFontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        let hpText = maxHP < 10000 ? `${Math.round(currentHP)}/${maxHP}` : `${Math.round(hpPercent)}%`;

        ctx.shadowColor = "rgba(0, 0, 0, 1.0)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(hpText, x, barY + height / 2);
        ctx.restore();
    }

    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1; const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    drawClusterIndicator(ctx, x, y, count, clusterType = null) {
        if (count <= 1) return;
        ctx.save();
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.15 + 0.85;
        const radius35 = this.getScaledSize(35);
        const radius30 = this.getScaledSize(30);
        ctx.strokeStyle = `rgba(100,200,255,${0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, radius35 * pulse, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = `rgba(100,200,255,${0.6 * pulse})`;
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, radius30 * pulse, 0, 2 * Math.PI); ctx.stroke();

        const fontSize = this.getScaledFontSize(11, 8);
        const text = `×${count}`; ctx.font = `bold ${fontSize}px monospace`;
        const textWidth = ctx.measureText(text).width;
        const padding = this.getScaledSize(4);
        const rectWidth = textWidth + padding * 2;
        const rectHeight = this.getScaledSize(14);
        const radius = this.getScaledSize(4);
        const rectX = x - rectWidth / 2; const rectY = y - radius35;
        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(100,200,255,0.9)"); gradient.addColorStop(1, "rgba(50,150,255,0.8)"); ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.moveTo(rectX + radius, rectY); ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius); ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight); ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius); ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3; ctx.fillStyle = "#FFFFFF"; ctx.fillText(text, rectX + padding, rectY + fontSize);

        if (clusterType) {
            const typeFontSize = this.getScaledFontSize(8, 6);
            ctx.font = `bold ${typeFontSize}px monospace`;
            const typeWidth = ctx.measureText(clusterType).width;
            const typeX = x - typeWidth / 2;
            const typeY = y + this.getScaledSize(42);
            ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 2; ctx.fillStyle = "rgba(100,200,255,0.9)"; ctx.fillText(clusterType, typeX, typeY);
        }
        ctx.restore();
    }

    drawClusterIndicatorFromCluster(ctx, cluster) {
        this.drawClusterRingsFromCluster(ctx, cluster);
        this.drawClusterInfoBox(ctx, cluster);
    }

    drawClusterRingsFromCluster(ctx, cluster) {
        try {
            if (!cluster || !cluster.resources || cluster.count <= 1) return;
            const pts = cluster.resources.filter(r => r.hX !== undefined && r.hY !== undefined).map(r => this.transformPoint(r.hX, r.hY));
            if (pts.length === 0) return;

            let sumX = 0, sumY = 0; for (const p of pts) { sumX += p.x; sumY += p.y; }
            const cx = sumX / pts.length, cy = sumY / pts.length;

            let maxDist = 0; for (const p of pts) { const dx = p.x - cx, dy = p.y - cy; const d = Math.sqrt(dx * dx + dy * dy); if (d > maxDist) maxDist = d; }
            const minRadius = this.getScaledSize(24); const padding = this.getScaledSize(18) + Math.log(Math.max(1, cluster.count)) * this.getScaledSize(6); const visualRadius = Math.max(minRadius, Math.ceil(maxDist) + padding);

            let totalStacks = 0; for (const r of cluster.resources) { const size = (r.size !== undefined && !isNaN(parseInt(r.size))) ? parseInt(r.size) : 1; const tier = (r.tier !== undefined && !isNaN(parseInt(r.tier))) ? parseInt(r.tier) : 4; totalStacks += this.calculateRealResources(size, tier); }

            let color;
            if (cluster.count <= 3 && totalStacks <= 6) color = { outer: `rgba(100,200,255,0.45)`, inner: `rgba(100,200,255,0.65)` };
            else if (cluster.count <= 6 || totalStacks <= 18) color = { outer: `rgba(255,210,100,0.45)`, inner: `rgba(255,180,60,0.65)` };
            else color = { outer: `rgba(255,100,100,0.45)`, inner: `rgba(220,80,80,0.65)` };

            const time = Date.now() / 1000; const pulse = Math.sin(time * 2) * 0.12 + 0.92;

            ctx.save();
            ctx.strokeStyle = color.outer.replace(/,\s*0.45\)/, `, ${0.4 * pulse})`);
            ctx.lineWidth = Math.max(2, Math.min(6, Math.log(cluster.count + 1) * 1.6));
            ctx.beginPath(); ctx.arc(cx, cy, visualRadius * pulse, 0, 2 * Math.PI); ctx.stroke();

            ctx.strokeStyle = color.inner.replace(/,\s*0.65\)/, `, ${0.6 * pulse})`);
            ctx.lineWidth = Math.max(1, Math.min(4, Math.log(cluster.count + 1) * 1.2));
            ctx.beginPath(); ctx.arc(cx, cy, (visualRadius - 6) * pulse, 0, 2 * Math.PI); ctx.stroke();
            ctx.restore();
        } catch (e) {
            window.logger?.error(CATEGORIES.RENDERING, 'cluster_draw_failed', e);
        }
    }

    drawClusterInfoBox(ctx, cluster) {
        if (!cluster || !cluster.resources || cluster.count <= 1) return;
        const pts = cluster.resources.filter(r => r.hX !== undefined && r.hY !== undefined).map(r => this.transformPoint(r.hX, r.hY));
        if (pts.length === 0) return;

        let sumX = 0, sumY = 0; for (const p of pts) { sumX += p.x; sumY += p.y; }
        const cx = sumX / pts.length, cy = sumY / pts.length;

        let maxDist = 0; for (const p of pts) { const dx = p.x - cx, dy = p.y - cy; const d = Math.sqrt(dx * dx + dy * dy); if (d > maxDist) maxDist = d; }
        const minRadius = this.getScaledSize(24); const paddingVal = this.getScaledSize(18) + Math.log(Math.max(1, cluster.count)) * this.getScaledSize(6); const visualRadius = Math.max(minRadius, Math.ceil(maxDist) + paddingVal);

        let totalStacks = 0; for (const r of cluster.resources) { const size = (r.size !== undefined && !isNaN(parseInt(r.size))) ? parseInt(r.size) : 1; const tier = (r.tier !== undefined && !isNaN(parseInt(r.tier))) ? parseInt(r.tier) : 4; totalStacks += this.calculateRealResources(size, tier); }

        const countText = `×${cluster.count}`;
        const typeText = cluster.type || '';
        const tierText = (cluster.tier !== undefined && cluster.tier !== null) ? `T${cluster.tier}` : '';

        const distanceGameUnits = Math.round(this.calculateDistance(cluster.x || 0, cluster.y || 0, 0, 0));
        const distanceMeters = this.convertGameUnitsToMeters(distanceGameUnits);
        const distText = distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(1)}km`;

        const stacksText = `${totalStacks}`;
        const clusterRadiusMeters = settingsSync.getNumber("settingClusterRadius");

        const line1 = `${countText}${typeText ? ' ' + typeText : ''}${tierText ? ' ' + tierText : ''}`;
        const line2 = `${stacksText} stacks · ${distText}${clusterRadiusMeters ? ' · R:' + clusterRadiusMeters + 'm' : ''}`;

        const fontSize1 = this.getScaledFontSize(12, 8);
        const fontSize2 = this.getScaledFontSize(11, 7);
        ctx.font = `bold ${fontSize1}px monospace`;
        const w1 = ctx.measureText(line1).width;
        ctx.font = `${fontSize2}px monospace`;
        const w2 = ctx.measureText(line2).width;

        const boxPadding = this.getScaledSize(16);
        const infoW = Math.ceil(Math.max(w1, w2)) + boxPadding;
        const lineSpacing = this.getScaledSize(6);
        const infoH = this.getScaledSize(8) + fontSize1 + lineSpacing + fontSize2;

        const infoX = cx - infoW / 2;
        const offset8 = this.getScaledSize(8);
        const infoY = cy - visualRadius - infoH - offset8;
        let boxY = infoY;
        if (infoY < 8) boxY = cy + visualRadius + offset8;

        const grad = ctx.createLinearGradient(infoX, boxY, infoX, boxY + infoH);
        grad.addColorStop(0, (cluster.count <= 3 && totalStacks <= 6) ? 'rgba(100,200,255,0.9)' : ((cluster.count <=6 || totalStacks<=18) ? 'rgba(255,210,100,0.95)': 'rgba(255,100,100,0.95)'));
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');

        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.fillStyle = grad; const rbox = this.getScaledSize(8);
        ctx.beginPath(); ctx.moveTo(infoX + rbox, boxY); ctx.lineTo(infoX + infoW - rbox, boxY); ctx.quadraticCurveTo(infoX + infoW, boxY, infoX + infoW, boxY + rbox);
        ctx.lineTo(infoX + infoW, boxY + infoH - rbox); ctx.quadraticCurveTo(infoX + infoW, boxY + infoH, infoX + infoW - rbox, boxY + infoH);
        ctx.lineTo(infoX + rbox, boxY + infoH); ctx.quadraticCurveTo(infoX, boxY + infoH, infoX, boxY + infoH - rbox); ctx.lineTo(infoX, boxY + rbox);
        ctx.quadraticCurveTo(infoX, boxY, infoX + rbox, boxY); ctx.closePath(); ctx.fill(); ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(infoX + 0.5, boxY + 0.5, infoW - 1, infoH - 1);

        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
        ctx.font = `bold ${fontSize1}px monospace`; ctx.fillText(line1, infoX + infoW / 2, boxY + this.getScaledSize(8) + fontSize1 - 2);
        ctx.font = `${fontSize2}px monospace`; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillText(line2, infoX + infoW / 2, boxY + this.getScaledSize(8) + fontSize1 + lineSpacing + fontSize2 - 2);
        ctx.textAlign = 'start';
    }

    convertGameUnitsToMeters(gameUnits) {
        return Math.round((gameUnits / 3) * SCALE_FACTOR);
    }

    metersToGameUnits(meters) {
        if (!meters || meters <= 0) return 0;
        return Math.ceil((meters / SCALE_FACTOR) * 3);
    }

    detectClusters(resources, clusterRadius = 30, minClusterSize = 2) {
        if (!resources || resources.length === 0) return [];
        const gameUnitsRadius = this.metersToGameUnits(clusterRadius);
        const clusters = [];
        const processed = new Set();

        const getTypeName = (res) => {
            if (!res) return 'Resource';
            if (res.name && typeof res.name === 'string') {
                const n = res.name.toLowerCase();
                if (n.includes('fiber')) return 'Fiber';
                if (n.includes('hide')) return 'Hide';
                if (n.includes('wood') || n.includes('log') || n.includes('logs')) return 'Wood';
                if (n.includes('ore')) return 'Ore';
                if (n.includes('rock')) return 'Rock';
            }
            if (res.type && typeof res.type === 'string') {
                const t = res.type.toLowerCase();
                if (t.includes('fiber')) return 'Fiber';
                if (t.includes('hide')) return 'Hide';
                if (t.includes('wood') || t.includes('log')) return 'Wood';
                if (t.includes('ore')) return 'Ore';
                if (t.includes('rock')) return 'Rock';
            }
            return 'Resource';
        };

        for (let i = 0; i < resources.length; i++) {
            if (processed.has(i)) continue;
            if (resources[i].size !== undefined && resources[i].size <= 0) continue;
            const resource = resources[i];
            const typeName = getTypeName(resource);
            const cluster = { x: resource.hX, y: resource.hY, count: 1, type: typeName, tier: resource.tier, resources: [resource] };

            for (let j = i + 1; j < resources.length; j++) {
                if (processed.has(j)) continue;
                if (resources[j].size !== undefined && resources[j].size <= 0) continue;
                const other = resources[j];
                const otherType = getTypeName(other);
                if (otherType !== typeName) continue;
                if ((other.tier !== undefined && resource.tier !== undefined) && other.tier !== resource.tier) continue;
                const dist = this.calculateDistance(resource.hX, resource.hY, other.hX, other.hY);
                if (dist <= gameUnitsRadius) {
                    cluster.count++; cluster.resources.push(other);
                    cluster.x = (cluster.x * (cluster.count - 1) + other.hX) / cluster.count;
                    cluster.y = (cluster.y * (cluster.count - 1) + other.hY) / cluster.count;
                    processed.add(j);
                }
            }

            processed.add(i);
            if (cluster.count >= minClusterSize) clusters.push(cluster);
        }

        return clusters;
    }
}

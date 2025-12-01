class DrawingUtils {
    constructor(settings) {
        const { CATEGORIES, EVENTS } = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;
        
        this.settings = settings || {};
        this.fontSize = "12px";
        this.fontFamily = "Arial";
        this.textColor = "white";
        this.images = [];
    }

    InitOurPlayerCanvas(ourPlayerCanvas, context) {
        this.drawFilledCircle(context, ourPlayerCanvas.width / 2, ourPlayerCanvas.height / 2, 10, "blue");
    }

    initGridCanvas(canvasBottom, contextBottom) {
        //this.fillCtx(canvasBottom, contextBottom);
        this.drawBoard(canvasBottom, contextBottom);
    }

    drawFilledCircle(context, x, y, radius, color) {
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.fill();
    }

    initCanvas(canvas, context) {
    }

    fillCtx(canvasBottom, contextBottom) {
        contextBottom.fillStyle = '#1a1c23';
        contextBottom.fillRect(0, 0, canvasBottom.width, canvasBottom.height);
    }

    drawBoard(canvasBottom, contextBottom) {
        const bw = canvasBottom.width;
        const bh = canvasBottom.height;

        const totalSpace = canvasBottom.height / 10;

        for (let gx = 0; gx <= bw; gx += totalSpace) {
            contextBottom.moveTo(0.5 + gx, 0);
            contextBottom.lineTo(0.5 + gx, bh);
        }

        for (let gy = 0; gy <= bh; gy += 50) {
            contextBottom.moveTo(0, 0.5 + gy);
            contextBottom.lineTo(bw, 0.5 + gy);
        }

        contextBottom.strokeStyle = "grey";
        contextBottom.stroke();
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }


    DrawCustomImage(ctx, x, y, imageName, folder, size) {
        if (!imageName) return;

        const folderR = (!folder) ? "" : folder + "/";
        const src = "/images/" + folderR + imageName + ".png";
        const preloadedImage = this.settings.GetPreloadedImage ? this.settings.GetPreloadedImage(src, folder) : null;

        if (preloadedImage === null) {
            this.drawFilledCircle(ctx, x, y, 10, "#4169E1");
            return;
        }

        if (preloadedImage) {
            ctx.drawImage(preloadedImage, x - size / 2, y - size / 2, size, size);
        } else if (this.settings && typeof this.settings.preloadImageAndAddToList === 'function') {
            this.settings.preloadImageAndAddToList(src, folder)
                .then(() => {
                    window.logger?.info(this.CATEGORIES.ITEM, this.EVENTS.ItemLoaded, { src: src, folder: folder });
                })
                .catch((error) => {
                    window.logger?.warn(this.CATEGORIES.ITEM, this.EVENTS.ItemLoadFailed, { src: src, folder: folder, error: error?.message });
                });
        }
    }

    transformPoint(x, y) {
        // keep original transform
        const angle = -0.785398;
        let newX = x * angle - y * angle;
        let newY = x * angle + y * angle;
        newX *= 4;
        newY *= 4;
        newX += 250;
        newY += 250;
        return { x: newX, y: newY };
    }

    drawText(xTemp, yTemp, text, ctx) {
        ctx.font = this.fontSize + " " + this.fontFamily;
        ctx.fillStyle = this.textColor;
        const textWidth = ctx.measureText(text).width;
        ctx.fillText(text, xTemp - textWidth / 2, yTemp);
    }

    drawTextItems(xTemp, yTemp, text, ctx, size, color) {
        ctx.font = size + " " + this.fontFamily;
        ctx.fillStyle = color;
        ctx.fillText(text, xTemp, yTemp);
    }

    drawEnchantmentIndicator(ctx, x, y, enchantmentLevel) {
        if (!enchantmentLevel || enchantmentLevel <= 0 || enchantmentLevel > 4) return;
        const enchantColors = { 1: "#90FF90", 2: "#60D0FF", 3: "#FF90FF", 4: "#FFD060" };
        const enchantColor = enchantColors[enchantmentLevel] || "#FFFFFF";

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowColor = enchantColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = enchantColor;
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = enchantColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 7, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = "bold 9px monospace";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 3;
        ctx.fillStyle = enchantColor;
        ctx.fillText(`.${enchantmentLevel}`, x + 14, y - 20);
        ctx.restore();
    }

    drawResourceCountBadge(ctx, x, y, count, position = 'bottom-right') {
        const text = count.toString();
        ctx.save();
        ctx.font = "bold 10px monospace";
        const textWidth = ctx.measureText(text).width;
        const padding = 4;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = 14;
        const radius = 4;

        const positions = {
            'bottom-right': { x: x + 8, y: y + 6 },
            'top-right': { x: x + 8, y: y - 20 },
            'bottom-left': { x: x - rectWidth - 8, y: y + 6 }
        };
        const pos = positions[position] || positions['bottom-right'];
        const rectX = pos.x; const rectY = pos.y;

        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(0,0,0,0.85)");
        gradient.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = gradient;

        // rounded rect
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
        ctx.fillText(text, rectX + padding, rectY + 10);
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

        // compute real distance as float (avoid rounding for the threshold check)
        const scaleFactor = this.getOverlayDistanceScale();
        const realDistanceFloat = (distance / 3) * scaleFactor; // baseUnit = 3

        // Don't show distance labels for very close resources (<= 2 meters)
        if (realDistanceFloat <= 2) {
            ctx.restore();
            return;
        }

        // Rounded value for display
        const realDistance = Math.round(realDistanceFloat);

        ctx.font = "bold 9px monospace";
        const text = realDistance < 1000 ? `${realDistance}m` : `${(realDistance / 1000).toFixed(1)}km`;

        const textWidth = ctx.measureText(text).width;
        const padding = 3;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = 12;
        const radius = 3;
        const rectX = x - rectWidth - 8;
        const rectY = y - 20;

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
        ctx.fillText(text, rectX + padding, rectY + 9);
        ctx.restore();
    }

    /**
     * Draw a health bar with gradient colors based on HP percentage
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - Center X position
     * @param {number} y - Center Y position (bar will be drawn below this point)
     * @param {number} currentHP - Current HP value
     * @param {number} maxHP - Maximum HP value
     * @param {number} width - Bar width in pixels (default: 50)
     * @param {number} height - Bar height in pixels (default: 6)
     */
    drawHealthBar(ctx, x, y, currentHP, maxHP, width = 50, height = 6) {
        if (!currentHP || !maxHP || maxHP <= 0) return;

        ctx.save();

        // Calculate HP percentage
        const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
        const fillWidth = (width * hpPercent) / 100;

        // Position (centered horizontally, below the entity)
        const barX = x - width / 2;
        const barY = y + 16; // 16px below entity

        // Background (dark with slight transparency)
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(barX, barY, width, height);

        // Gradient based on HP percentage
        const gradient = ctx.createLinearGradient(barX, barY, barX + width, barY);

        if (hpPercent > 75) {
            // 100-75%: Green gradient
            gradient.addColorStop(0, "#00FF00");
            gradient.addColorStop(1, "#88FF88");
        } else if (hpPercent > 50) {
            // 75-50%: Yellow-green gradient
            gradient.addColorStop(0, "#BBFF00");
            gradient.addColorStop(1, "#FFFF00");
        } else if (hpPercent > 25) {
            // 50-25%: Orange gradient
            gradient.addColorStop(0, "#FFAA00");
            gradient.addColorStop(1, "#FF6600");
        } else {
            // 25-0%: Red gradient
            gradient.addColorStop(0, "#FF3300");
            gradient.addColorStop(1, "#FF0000");
        }

        // Fill HP bar with gradient
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, fillWidth, height);

        // Border (white with transparency)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, width, height);

        // HP text inside bar
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Format HP text
        let hpText;
        if (maxHP < 10000) {
            hpText = `${Math.round(currentHP)}/${maxHP}`;
        } else {
            hpText = `${Math.round(hpPercent)}%`;
        }

        // Text shadow for better readability (stronger shadow)
        ctx.shadowColor = "rgba(0, 0, 0, 1.0)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(hpText, x, barY + height / 2);

        ctx.restore();
    }

    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1; const dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy);
    }

    drawClusterIndicator(ctx, x, y, count, clusterType = null) {
        if (count <= 1) return;
        ctx.save();
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.15 + 0.85;
        ctx.strokeStyle = `rgba(100,200,255,${0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 35 * pulse, 0, 2 * Math.PI); ctx.stroke();
        ctx.strokeStyle = `rgba(100,200,255,${0.6 * pulse})`;
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 30 * pulse, 0, 2 * Math.PI); ctx.stroke();

        const text = `×${count}`; ctx.font = "bold 11px monospace";
        const textWidth = ctx.measureText(text).width; const padding = 4; const rectWidth = textWidth + padding * 2; const rectHeight = 14; const radius = 4;
        const rectX = x - rectWidth / 2; const rectY = y - 35;
        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(100,200,255,0.9)"); gradient.addColorStop(1, "rgba(50,150,255,0.8)"); ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.moveTo(rectX + radius, rectY); ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius); ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight); ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius); ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 3; ctx.fillStyle = "#FFFFFF"; ctx.fillText(text, rectX + padding, rectY + 11);

        if (clusterType) { ctx.font = "bold 8px monospace"; const typeWidth = ctx.measureText(clusterType).width; const typeX = x - typeWidth / 2; const typeY = y + 42; ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 2; ctx.fillStyle = "rgba(100,200,255,0.9)"; ctx.fillText(clusterType, typeX, typeY); }
        ctx.restore();
    }

    drawClusterIndicatorFromCluster(ctx, cluster) {
        // draw rings then info box
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
            const minRadius = 24; const padding = 18 + Math.log(Math.max(1, cluster.count)) * 6; const visualRadius = Math.max(minRadius, Math.ceil(maxDist) + padding);

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
            // ❌ ERROR (toujours loggé) - Erreur critique de fallback de rendu
            window.logger?.error(this.CATEGORIES.CLUSTER, this.EVENTS.DrawRingsFallbackFailed, e);
        }
    }

    drawClusterInfoBox(ctx, cluster) {
        if (!cluster || !cluster.resources || cluster.count <= 1) return;
        const pts = cluster.resources.filter(r => r.hX !== undefined && r.hY !== undefined).map(r => this.transformPoint(r.hX, r.hY));
        if (pts.length === 0) return;

        let sumX = 0, sumY = 0; for (const p of pts) { sumX += p.x; sumY += p.y; }
        const cx = sumX / pts.length, cy = sumY / pts.length;

        let maxDist = 0; for (const p of pts) { const dx = p.x - cx, dy = p.y - cy; const d = Math.sqrt(dx * dx + dy * dy); if (d > maxDist) maxDist = d; }
        const minRadius = 24; const padding = 18 + Math.log(Math.max(1, cluster.count)) * 6; const visualRadius = Math.max(minRadius, Math.ceil(maxDist) + padding);

        let totalStacks = 0; for (const r of cluster.resources) { const size = (r.size !== undefined && !isNaN(parseInt(r.size))) ? parseInt(r.size) : 1; const tier = (r.tier !== undefined && !isNaN(parseInt(r.tier))) ? parseInt(r.tier) : 4; totalStacks += this.calculateRealResources(size, tier); }

        const countText = `×${cluster.count}`;
        const typeText = cluster.type || '';
        const tierText = (cluster.tier !== undefined && cluster.tier !== null) ? `T${cluster.tier}` : '';

        const distanceGameUnits = Math.round(this.calculateDistance(cluster.x || 0, cluster.y || 0, 0, 0));
        const distanceMeters = this.convertGameUnitsToMeters(distanceGameUnits);
        const distText = distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(1)}km`;

        const stacksText = `${totalStacks}`;
        const clusterRadiusMeters = (this.settings && this.settings.overlayClusterRadius) ? this.settings.overlayClusterRadius : null;

        const line1 = `${countText}${typeText ? ' ' + typeText : ''}${tierText ? ' ' + tierText : ''}`;
        const line2 = `${stacksText} stacks · ${distText}${clusterRadiusMeters ? ' · R:' + clusterRadiusMeters + 'm' : ''}`;

        ctx.font = 'bold 12px monospace';
        const w1 = ctx.measureText(line1).width;
        ctx.font = '11px monospace';
        const w2 = ctx.measureText(line2).width;
        const infoW = Math.ceil(Math.max(w1, w2)) + 16;
        const infoH = 8 + 14 + 6 + 12;

        const infoX = cx - infoW / 2;
        const infoY = cy - visualRadius - infoH - 8;
        let boxY = infoY;
        if (infoY < 8) boxY = cy + visualRadius + 8;

        const grad = ctx.createLinearGradient(infoX, boxY, infoX, boxY + infoH);
        grad.addColorStop(0, (cluster.count <= 3 && totalStacks <= 6) ? 'rgba(100,200,255,0.9)' : ((cluster.count <=6 || totalStacks<=18) ? 'rgba(255,210,100,0.95)': 'rgba(255,100,100,0.95)'));
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');

        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.fillStyle = grad; const rbox = 8;
        ctx.beginPath(); ctx.moveTo(infoX + rbox, boxY); ctx.lineTo(infoX + infoW - rbox, boxY); ctx.quadraticCurveTo(infoX + infoW, boxY, infoX + infoW, boxY + rbox);
        ctx.lineTo(infoX + infoW, boxY + infoH - rbox); ctx.quadraticCurveTo(infoX + infoW, boxY + infoH, infoX + infoW - rbox, boxY + infoH);
        ctx.lineTo(infoX + rbox, boxY + infoH); ctx.quadraticCurveTo(infoX, boxY + infoH, infoX, boxY + infoH - rbox); ctx.lineTo(infoX, boxY + rbox);
        ctx.quadraticCurveTo(infoX, boxY, infoX + rbox, boxY); ctx.closePath(); ctx.fill(); ctx.restore();

        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(infoX + 0.5, boxY + 0.5, infoW - 1, infoH - 1);

        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.font = 'bold 12px monospace'; ctx.fillText(line1, infoX + infoW / 2, boxY + 14);
        ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillText(line2, infoX + infoW / 2, boxY + 14 + 16); ctx.textAlign = 'start';
    }

    // Convert game units distance to meters applying global scale factor.
    convertGameUnitsToMeters(gameUnits) {
        const baseUnit = 3;
        const scaleFactor = this.getOverlayDistanceScale();
        const meters = (gameUnits / baseUnit) * scaleFactor;
        return Math.round(meters);
    }

    // Central accessor for overlay distance scale (prefer global helper if present)
    getOverlayDistanceScale() {
        if (typeof window !== 'undefined' && typeof window.getOverlayDistanceScale === 'function') {
            try { return window.getOverlayDistanceScale(); } catch (e) { }
        }
        if (this.settings && typeof this.settings.overlayDistanceScale === 'number') return this.settings.overlayDistanceScale;
        if (typeof window !== 'undefined' && typeof window.overlayDistanceScale === 'number') return window.overlayDistanceScale;
        return 1.0;
    }

    // Inverse conversion: meters -> game units
    metersToGameUnits(meters) {
        if (!meters || meters <= 0) return 0;
        const baseUnit = 3;
        const scale = this.getOverlayDistanceScale();
        if (typeof scale === 'number' && scale > 0) return Math.ceil((meters / scale) * baseUnit);
        for (let gu = 0; gu < 10000; gu++) if (this.convertGameUnitsToMeters(gu) >= meters) return gu;
        return Math.ceil(meters * baseUnit);
    }

    detectClusters(resources, clusterRadius = 30, minClusterSize = 2) {
        if (!resources || resources.length === 0) return [];
        const gameUnitsRadius = this.metersToGameUnits(clusterRadius);
        const clusters = [];
        const processed = new Set();

        const getTypeName = (res) => {
            if (!res) return 'Resource';
            if (typeof this.getClusterCategory === 'function') return this.getClusterCategory(res);
            if (res.name && typeof res.name === 'string') {
                const n = res.name.toLowerCase();
                if (n.includes('fiber')) return 'Fiber';
                if (n.includes('hide')) return 'Hide';
                if (n.includes('wood') || n.includes('log') || n.includes('logs')) return 'Wood';
                if (n.includes('ore')) return 'Ore';
                if (n.includes('rock')) return 'Rock';
            }
            if (typeof res.type === 'number' && typeof this.getResourceTypeName === 'function') return this.getResourceTypeName(res.type);
            if (typeof res.type === 'string') {
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

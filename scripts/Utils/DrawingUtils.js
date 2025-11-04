class DrawingUtils {
    constructor(settings) {
        this.settings = settings;
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
        //this.drawFilledCircle(contextBottom, canvasBottom.width / 2, canvasBottom.height / 2, 10, "blue"); 
    }

    drawBoard(canvasBottom, contextBottom) {
        var bw = canvasBottom.width;
        var bh = canvasBottom.height;

        var p = 0;
        let totalSpace = canvasBottom.height / 10;

        for (var x = 0; x <= bw; x += totalSpace) {
            contextBottom.moveTo(0.5 + x + p, p);
            contextBottom.lineTo(0.5 + x + p, bh + p);
        }

        for (var x = 0; x <= bh; x += 50) {
            contextBottom.moveTo(p, 0.5 + x + p);
            contextBottom.lineTo(bw + p, 0.5 + x + p);
        }

        contextBottom.strokeStyle = "grey";
        contextBottom.stroke();
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }


    DrawCustomImage(ctx, x, y, imageName, folder, size) {
        if (imageName == "" || imageName === undefined)
            return;

        const folderR = folder == "" || folder === undefined ? "" : folder + "/";

        const src = "/images/" + folderR + imageName + ".png";

        const preloadedImage = this.settings.GetPreloadedImage(src, folder);

        if (preloadedImage === null) {
            this.drawFilledCircle(ctx, x, y, 10, "#4169E1");
            return;
        }

        if (preloadedImage) {
            ctx.drawImage(preloadedImage, x - size / 2, y - size / 2, size, size);
        } else {
            this.settings.preloadImageAndAddToList(src, folder)
                .then(() => console.log('Item loaded'))
                .catch(() => console.log('Item not loaded'));
        }
    }

    transformPoint(x, y) {
        //const angle = -0.7071;
        const angle = -0.785398;


        let newX = x * angle - y * angle;
        let newY = x * angle + y * angle;
        newX *= 4;
        newY *= 4;

        newX += 250;
        newY += 250;

        return {x: newX, y: newY};
    }


    drawText(xTemp, yTemp, text, ctx) {
        ctx.font = this.fontSize + " " + this.fontFamily;
        ctx.fillStyle = this.textColor;

        let x = xTemp;
        let y = yTemp;

        const textWidth = ctx.measureText(text).width;

        ctx.fillText(text, x - textWidth / 2, y);
    }


    drawTextItems(xTemp, yTemp, text, ctx, size, color) {
        ctx.font = size + " " + this.fontFamily;
        ctx.fillStyle = color;

        let x = xTemp;
        let y = yTemp;

        ctx.fillText(text, x, y);
    }

    /**
     * 📊 Draw enchantment indicator (common function for all resource types)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position (resource center)
     * @param {number} y - Y position (resource center)
     * @param {number} enchantmentLevel - Enchantment level (1-4)
     */
    drawEnchantmentIndicator(ctx, x, y, enchantmentLevel) {
        if (enchantmentLevel <= 0 || enchantmentLevel > 4) return;

        const enchantColors = {
            1: "#90FF90",  // .1 - Light green
            2: "#60D0FF",  // .2 - Cyan
            3: "#FF90FF",  // .3 - Pink
            4: "#FFD060"   // .4 - Gold
        };
        const enchantColor = enchantColors[enchantmentLevel] || "#FFFFFF";

        // Draw enchantment indicator with background
        ctx.save();

        // Background circle
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 7, 0, 2 * Math.PI);
        ctx.fill();

        // Glowing dot
        ctx.shadowColor = enchantColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = enchantColor;
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 5, 0, 2 * Math.PI);
        ctx.fill();

        // Border
        ctx.strokeStyle = enchantColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + 18, y - 12, 7, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();

        // Draw enchantment number with better visibility
        ctx.save();
        ctx.font = "bold 9px monospace";
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 3;
        ctx.fillStyle = enchantColor;
        ctx.fillText(`.${enchantmentLevel}`, x + 14, y - 20);
        ctx.restore();
    }

    /**
     * 📊 Draw resource count badge (common function)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position (resource center)
     * @param {number} y - Y position (resource center)
     * @param {number} count - Resource count to display
     * @param {string} position - Badge position: 'bottom-right' (default), 'top-right', etc.
     */
    drawResourceCountBadge(ctx, x, y, count, position = 'bottom-right') {
        const text = count.toString();
        ctx.save();

        // Configuration
        ctx.font = "bold 10px monospace";
        const textWidth = ctx.measureText(text).width;
        const padding = 4;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = 14;
        const radius = 4;

        // Position calculation
        const positions = {
            'bottom-right': {x: x + 8, y: y + 6},
            'top-right': {x: x + 8, y: y - 20},
            'bottom-left': {x: x - rectWidth - 8, y: y + 6}
        };
        const pos = positions[position] || positions['bottom-right'];
        const rectX = pos.x;
        const rectY = pos.y;

        // Gradient background
        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.75)");
        ctx.fillStyle = gradient;

        // Rounded rectangle path
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

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text with shadow
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, rectX + padding, rectY + 10);
        ctx.restore();
    }

    /**
     * 📊 Convert harvestable size to real resource count
     * @param {number} size - Stack size
     * @param {number} tier - Resource tier (1-8)
     * @returns {number} - Real resource count
     */
    calculateRealResources(size, tier) {
        // Conversion rates based on tier
        if (tier <= 3) {
            return size * 3;  // T1-T3: 3 resources per stack
        } else if (tier === 4) {
            return size * 2;  // T4: 2 resources per stack
        }
        // T5+: 1:1 ratio
        return size;
    }

    /**
     * 📍 Draw distance indicator (for tracked resources)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} distance - Distance value
     */
    drawDistanceIndicator(ctx, x, y, distance) {
        if (distance <= 0) return;

        ctx.save();

        // Divide distance by 3 for correct scale (game units to meters)
        const realDistance = distance / 3;

        // Format distance (meters)
        const text = realDistance < 1000 ? `${Math.round(realDistance)}m` : `${(realDistance / 1000).toFixed(1)}km`;

        ctx.font = "bold 9px monospace";
        const textWidth = ctx.measureText(text).width;
        const padding = 3;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = 12;
        const radius = 3;

        // Position: top-left
        const rectX = x - rectWidth - 8;
        const rectY = y - 20;

        // Color gradient based on distance (green = close, yellow = medium, red = far)
        let color;
        if (realDistance < 30) {
            color = "rgba(0, 200, 0, 0.85)";  // Green
        } else if (realDistance < 60) {
            color = "rgba(255, 200, 0, 0.85)";  // Yellow
        } else {
            color = "rgba(255, 100, 0, 0.85)";  // Orange
        }

        // Background
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

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 2;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, rectX + padding, rectY + 9);
        ctx.restore();
    }

    /**
     * 📍 Calculate distance between two points
     * @param {number} x1 - X position 1
     * @param {number} y1 - Y position 1
     * @param {number} x2 - X position 2
     * @param {number} y2 - Y position 2
     * @returns {number} - Distance
     */
    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 🗂️ Draw cluster indicator (for groups of nearby resources)
     * Backward-compatible drawing method kept for simple uses (x,y,count)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position (cluster center)
     * @param {number} y - Y position (cluster center)
     * @param {number} count - Number of resources in cluster
     * @param {string} clusterType - Resource type (e.g., "Fiber", "Hide", "Ore")
     */
    drawClusterIndicator(ctx, x, y, count, clusterType = null) {
        if (count <= 1) return; // No need for indicator if only 1 resource

        ctx.save();

        // Pulsing ring effect
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.15 + 0.85; // Pulse between 0.7 and 1.0

        // Outer ring
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 35 * pulse, 0, 2 * Math.PI);
        ctx.stroke();

        // Inner ring
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.6 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 30 * pulse, 0, 2 * Math.PI);
        ctx.stroke();

        // Cluster count badge (top)
        const text = `×${count}`;
        ctx.font = "bold 11px monospace";
        const textWidth = ctx.measureText(text).width;
        const padding = 4;
        const rectWidth = textWidth + (padding * 2);
        const rectHeight = 14;
        const radius = 4;
        const rectX = x - (rectWidth / 2);
        const rectY = y - 35;

        // Background gradient
        const gradient = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectHeight);
        gradient.addColorStop(0, "rgba(100, 200, 255, 0.9)");
        gradient.addColorStop(1, "rgba(50, 150, 255, 0.8)");
        ctx.fillStyle = gradient;

        // Rounded rectangle
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

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 3;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, rectX + padding, rectY + 11);

        // Optional: Type label (bottom)
        if (clusterType) {
            ctx.font = "bold 8px monospace";
            const typeWidth = ctx.measureText(clusterType).width;
            const typeX = x - (typeWidth / 2);
            const typeY = y + 42;

            ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
            ctx.shadowBlur = 2;
            ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
            ctx.fillText(clusterType, typeX, typeY);
        }

        ctx.restore();
    }

    /**
     * 🗂️ Draw cluster indicator using cluster object (better centering and size based on resource spread)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Object} cluster - Cluster object {x, y, count, type, resources: []}
     * This method computes pixel-centroid & pixel-radius from actual resource points to avoid centering/size issues.
     */
    drawClusterIndicatorFromCluster(ctx, cluster) {
        if (!cluster || !cluster.resources || cluster.count <= 1) return;

        // Map resource points to pixel coordinates
        const pts = cluster.resources
            .filter(r => r.hX !== undefined && r.hY !== undefined)
            .map(r => this.transformPoint(r.hX, r.hY));

        if (pts.length === 0) return;

        // Compute centroid in pixel space
        let sumX = 0, sumY = 0;
        for (const p of pts) {
            sumX += p.x;
            sumY += p.y;
        }
        const cx = sumX / pts.length;
        const cy = sumY / pts.length;

        // Compute max distance from centroid (in pixels)
        let maxDist = 0;
        for (const p of pts) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > maxDist) maxDist = d;
        }

        // Determine visual radius: ensure a sensible minimum and padding
        const minRadius = 24; // px
        const padding = 18 + Math.log(Math.max(1, cluster.count)) * 6; // more items -> larger padding
        const visualRadius = Math.max(minRadius, Math.ceil(maxDist) + padding);

        // Compute total collectible stacks (if available) to influence color
        let totalStacks = 0;
        for (const r of cluster.resources) {
            const size = (r.size !== undefined && !isNaN(parseInt(r.size))) ? parseInt(r.size) : 1;
            const tier = (r.tier !== undefined && !isNaN(parseInt(r.tier))) ? parseInt(r.tier) : 4;
            totalStacks += this.calculateRealResources(size, tier);
        }

        // Choose color based on cluster size or stacks
        // small: teal, medium: yellow/orange, large: red
        let color;
        if (cluster.count <= 3 && totalStacks <= 6) {
            color = {
                outer: `rgba(100, 200, 255, 0.45)`,
                inner: `rgba(100, 200, 255, 0.65)`,
                badgeFrom: "rgba(100,200,255,0.9)"
            };
        } else if (cluster.count <= 6 || totalStacks <= 18) {
            color = {
                outer: `rgba(255, 210, 100, 0.45)`,
                inner: `rgba(255, 180, 60, 0.65)`,
                badgeFrom: "rgba(255,210,100,0.95)"
            };
        } else {
            color = {
                outer: `rgba(255, 100, 100, 0.45)`,
                inner: `rgba(220, 80, 80, 0.65)`,
                badgeFrom: "rgba(255,100,100,0.95)"
            };
        }

        // Pulsing effect
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 2) * 0.12 + 0.92; // gentler pulse

        ctx.save();

        // Outer ring
        ctx.strokeStyle = color.outer.replace(/,\s*0.45\)/, `, ${0.4 * pulse})`);
        ctx.lineWidth = Math.max(2, Math.min(6, Math.log(cluster.count + 1) * 1.6));
        ctx.beginPath();
        ctx.arc(cx, cy, visualRadius * pulse, 0, 2 * Math.PI);
        ctx.stroke();

        // Inner ring
        ctx.strokeStyle = color.inner.replace(/,\s*0.65\)/, `, ${0.6 * pulse})`);
        ctx.lineWidth = Math.max(1, Math.min(4, Math.log(cluster.count + 1) * 1.2));
        ctx.beginPath();
        ctx.arc(cx, cy, (visualRadius - 6) * pulse, 0, 2 * Math.PI);
        ctx.stroke();

        // Unified info box above the cluster: count, type, tier, totalStacks, distance
        const countText = `×${cluster.count}`;
        const typeText = cluster.type || '';
        const tierText = (cluster.tier !== undefined && cluster.tier !== null) ? `T${cluster.tier}` : '';

        const distanceGameUnits = Math.round(Math.sqrt((cluster.x || 0) * (cluster.x || 0) + (cluster.y || 0) * (cluster.y || 0)));
        const distanceMeters = Math.round(distanceGameUnits / 3);
        const distText = distanceMeters < 1000 ? `${distanceMeters}m` : `${(distanceMeters / 1000).toFixed(1)}km`;

        const stacksText = `${totalStacks}`;

        const line1 = `${countText}${typeText ? ' ' + typeText : ''}${tierText ? ' ' + tierText : ''}`;
        const line2 = `${stacksText} stakck(s) · ${distText}`;

        ctx.font = 'bold 12px monospace';
        const w1 = ctx.measureText(line1).width;
        ctx.font = '11px monospace';
        const w2 = ctx.measureText(line2).width;
        const infoW = Math.ceil(Math.max(w1, w2)) + 16;
        const infoH = 8 + 14 + 6 + 12; // padding + line1 + gap + line2

        const infoX = cx - infoW / 2;
        const infoY = cy - visualRadius - infoH - 8;

        // If the box would be off-screen top, place below cluster
        let boxY = infoY;
        if (infoY < 8) boxY = cy + visualRadius + 8;

        // Gradient background matching color badgeFrom
        const grad = ctx.createLinearGradient(infoX, boxY, infoX, boxY + infoH);
        grad.addColorStop(0, color.badgeFrom);
        grad.addColorStop(1, 'rgba(0,0,0,0.6)');

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = grad;
        const rbox = 8;
        ctx.beginPath();
        ctx.moveTo(infoX + rbox, boxY);
        ctx.lineTo(infoX + infoW - rbox, boxY);
        ctx.quadraticCurveTo(infoX + infoW, boxY, infoX + infoW, boxY + rbox);
        ctx.lineTo(infoX + infoW, boxY + infoH - rbox);
        ctx.quadraticCurveTo(infoX + infoW, boxY + infoH, infoX + infoW - rbox, boxY + infoH);
        ctx.lineTo(infoX + rbox, boxY + infoH);
        ctx.quadraticCurveTo(infoX, boxY + infoH, infoX, boxY + infoH - rbox);
        ctx.lineTo(infoX, boxY + rbox);
        ctx.quadraticCurveTo(infoX, boxY, infoX + rbox, boxY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Thin border
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(infoX + 0.5, boxY + 0.5, infoW - 1, infoH - 1);

        // Text centered
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(line1, infoX + infoW / 2, boxY + 14);
        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(line2, infoX + infoW / 2, boxY + 14 + 16);
        ctx.textAlign = 'start';

        ctx.restore();
    }

    /**
     * Get resource type name from type ID (for harvestables)
     * @param {number} type - Resource type ID
     * @returns {string} - Resource type name
     */
    getResourceTypeName(type) {
        if (type >= 0 && type <= 5) return "Wood";
        if (type >= 6 && type <= 10) return "Stone";
        if (type >= 11 && type <= 15) return "Fiber";
        if (type >= 16 && type <= 22) return "Hide";
        if (type >= 23 && type <= 27) return "Ore";
        return "Resource";
    }

    /**
     * Get canonical category for clustering from a resource or mob object
     * Returns one of: "Wood", "Rock", "Fiber", "Hide", "Ore", or "Resource"
     * Accepts harvestable objects (with numeric .type) and living mobs (with .name)
     */
    getClusterCategory(resource) {
        if (!resource) return "Resource";

        // If resource has a normalized string name, try to detect the category
        if (resource.name && typeof resource.name === 'string') {
            const n = resource.name.toLowerCase();
            if (n.includes('fiber')) return 'Fiber';
            if (n.includes('hide')) return 'Hide';
            if (n.includes('wood') || n.includes('log') || n.includes('logs')) return 'Wood';
            if (n.includes('ore')) return 'Ore';
            if (n.includes('rock')) return 'Rock';
        }

        // If resource.type is numeric (harvestables), reuse getResourceTypeName
        if (typeof resource.type === 'number') {
            return this.getResourceTypeName(resource.type);
        }

        // Fallback: if the object carries a string-type property (type string)
        if (typeof resource.type === 'string') {
            const t = resource.type.toLowerCase();
            if (t.includes('fiber')) return 'Fiber';
            if (t.includes('hide')) return 'Hide';
            if (t.includes('wood') || t.includes('log')) return 'Wood';
            if (t.includes('ore')) return 'Ore';
            if (t.includes('rock')) return 'Rock';
        }

        return 'Resource';
    }

    detectClusters(resources, clusterRadius = 30, minClusterSize = 2) {
        if (!resources || resources.length === 0) return [];

        // Convert radius from meters to game units (multiply by 3)
        const gameUnitsRadius = clusterRadius * 3;
        const clusters = [];
        const processed = new Set();

        for (let i = 0; i < resources.length; i++) {
            if (processed.has(i)) continue;

            // Skip invalid resources
            if (resources[i].size !== undefined && resources[i].size <= 0) continue;

            const resource = resources[i];

            // Determine canonical category (works for both harvestables and living resources)
            const typeName = this.getClusterCategory(resource);

            const cluster = {
                x: resource.hX,
                y: resource.hY,
                count: 1,
                type: typeName,
                tier: resource.tier,
                resources: [resource]
            };

            // Find nearby resources of same type and tier
            for (let j = i + 1; j < resources.length; j++) {
                if (processed.has(j)) continue;

                // Skip invalid resources
                if (resources[j].size !== undefined && resources[j].size <= 0) continue;

                const other = resources[j];
                const otherType = this.getClusterCategory(other);

                // Must be same category and same tier (if tier info present)
                if (otherType !== typeName) continue;
                if ((other.tier !== undefined && resource.tier !== undefined) && other.tier !== resource.tier) continue;

                const dist = this.calculateDistance(resource.hX, resource.hY, other.hX, other.hY);

                if (dist <= gameUnitsRadius) {
                    cluster.count++;
                    cluster.resources.push(other);
                    // Update cluster center (average position)
                    cluster.x = (cluster.x * (cluster.count - 1) + other.hX) / cluster.count;
                    cluster.y = (cluster.y * (cluster.count - 1) + other.hY) / cluster.count;
                    processed.add(j);
                }
            }

            processed.add(i);
            if (cluster.count >= minClusterSize) { // Only add if it's actually a cluster (2+)
                clusters.push(cluster);
            }
        }

        return clusters;
    }
}

export class HarvestablesDrawing extends DrawingUtils  {


    constructor(Settings) {

        super(Settings);
    
    }
    
    interpolate(harvestables, lpX, lpY ,t ) {

        for (const harvestableOne of harvestables) {
 
            const hX = -1 * harvestableOne.posX + lpX;
            const hY = harvestableOne.posY - lpY;

       
            if (harvestableOne.hY === 0 && harvestableOne.hX === 0) {
                harvestableOne.hX = hX;
                harvestableOne.hY = hY;

            }
            
            harvestableOne.hX = this.lerp(harvestableOne.hX, hX, t);
            harvestableOne.hY = this.lerp(harvestableOne.hY, hY, t);
            
        }

    }

    invalidate(ctx, harvestables)
    {
        for (const harvestableOne of harvestables)
        {
            if (harvestableOne.size <= 0) continue;

            const type = harvestableOne.type;

            let draw = undefined;

            
            if (type >= 0 && type <= 5)
            {
                draw = "Logs_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 6 && type <= 10)
            {
                draw = "rock_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            if (type >= 11 && type <= 15)
            {
                draw = "fiber_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 16 && type <= 22)
            {
                draw = "hide_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }
            else if (type >= 23 && type <= 27)
            {
                draw = "ore_" + harvestableOne.tier + "_" + harvestableOne.charges;
            }

            if (draw === undefined)
                continue;


            const point = this.transformPoint(harvestableOne.hX, harvestableOne.hY);

            // Draw resource icon
            this.DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 50);

            if (this.settings.livingResourcesID)
                this.drawText(point.x, point.y + 20, type.toString(), ctx);

            // 📊 Enchantment indicator (using common function)
            if (harvestableOne.charges > 0) {
                this.drawEnchantmentIndicator(ctx, point.x, point.y, harvestableOne.charges);
            }

            // Resource count with improved background and larger text
            if (this.settings.resourceSize)
            {
                harvestableOne.size = parseInt(harvestableOne.size);
                // Convert stacks to real resources
                let realResources = harvestableOne.size;
                if (harvestableOne.tier <= 3) {
                    realResources = harvestableOne.size * 3;
                } else if (harvestableOne.tier === 4) {
                    realResources = harvestableOne.size * 2;
                }
                // T5+ stays 1:1

                // Background with gradient for better readability
                ctx.save();
                const text = realResources.toString();
                ctx.font = "bold 10px monospace";
                const textWidth = ctx.measureText(text).width;

                // Gradient background
                const gradient = ctx.createLinearGradient(point.x + 8, point.y + 6, point.x + 8, point.y + 20);
                gradient.addColorStop(0, "rgba(0, 0, 0, 0.85)");
                gradient.addColorStop(1, "rgba(0, 0, 0, 0.75)");
                ctx.fillStyle = gradient;

                // Rounded rectangle
                const rectX = point.x + 8;
                const rectY = point.y + 6;
                const rectWidth = textWidth + 8;
                const rectHeight = 14;
                const radius = 4;

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
                ctx.fillText(text, point.x + 12, point.y + 16);
                ctx.restore();
            }
            
        }
    }  
}
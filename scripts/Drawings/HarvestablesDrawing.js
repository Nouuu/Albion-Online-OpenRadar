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

            // Tier display with vibrant colors and shadow (no background overlay)
            let tier = "I";
            let tierColor = "#585858";
            switch (harvestableOne.tier)
            {
                case 1: tier = "I"; tierColor = "#AAAAAA"; break;
                case 2: tier = "II"; tierColor = "#C0C0C0"; break;
                case 3: tier = "III"; tierColor = "#90FF90"; break;
                case 4: tier = "IV"; tierColor = "#70D0FF"; break;
                case 5: tier = "V"; tierColor = "#FFD060"; break;
                case 6: tier = "VI"; tierColor = "#FF9050"; break;
                case 7: tier = "VII"; tierColor = "#FF60FF"; break;
                case 8: tier = "VIII"; tierColor = "#FF6060"; break;
                default: tier = ""; tierColor = "#585858"; break;
            }

            // Draw tier text with strong shadow for visibility (no background)
            ctx.save();
            ctx.font = "bold 12px monospace";
            ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = tierColor;
            ctx.fillText(tier, point.x - 10, point.y - 8);
            ctx.restore();

            // Enchantment indicator with improved visibility
            if (harvestableOne.charges > 0) {
                const enchantColors = {
                    1: "#90FF90",  // .1 - Light green
                    2: "#60D0FF",  // .2 - Cyan
                    3: "#FF90FF",  // .3 - Pink
                    4: "#FFD060"   // .4 - Gold
                };
                const enchantColor = enchantColors[harvestableOne.charges] || "#FFFFFF";

                // Draw enchantment indicator with background
                ctx.save();

                // Background circle
                ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 7, 0, 2 * Math.PI);
                ctx.fill();

                // Glowing dot
                ctx.shadowColor = enchantColor;
                ctx.shadowBlur = 10;
                ctx.fillStyle = enchantColor;
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 5, 0, 2 * Math.PI);
                ctx.fill();

                // Border
                ctx.strokeStyle = enchantColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 7, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();

                // Draw enchantment number with better visibility
                ctx.save();
                ctx.font = "bold 9px monospace";
                ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
                ctx.shadowBlur = 3;
                ctx.fillStyle = enchantColor;
                ctx.fillText(`.${harvestableOne.charges}`, point.x + 14, point.y - 20);
                ctx.restore();
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
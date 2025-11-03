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

            // Tier display with color coding
            let tier = "I";
            let tierColor = "#585858"; // Default gray
            switch (harvestableOne.tier)
            {
                case 1: tier = "I"; tierColor = "#888888"; break;
                case 2: tier = "II"; tierColor = "#A0A0A0"; break;
                case 3: tier = "III"; tierColor = "#90C090"; break;
                case 4: tier = "IV"; tierColor = "#70B0E0"; break;
                case 5: tier = "V"; tierColor = "#D0A060"; break;
                case 6: tier = "VI"; tierColor = "#E08050"; break;
                case 7: tier = "VII"; tierColor = "#D060D0"; break;
                case 8: tier = "VIII"; tierColor = "#FF6060"; break;
                default: tier = ""; tierColor = "#585858"; break;
            }

            this.drawText(point.x - 10, point.y - 10, tier.toString(), ctx, 9, "monospace", tierColor, 10);

            // Enchantment indicator with glow effect
            if (harvestableOne.charges > 0) {
                const enchantColors = {
                    1: "#90FF90",  // .1 - Light green
                    2: "#60D0FF",  // .2 - Cyan
                    3: "#FF90FF",  // .3 - Pink
                    4: "#FFD060"   // .4 - Gold
                };
                const enchantColor = enchantColors[harvestableOne.charges] || "#FFFFFF";

                // Draw enchantment dot with glow
                ctx.save();
                ctx.shadowColor = enchantColor;
                ctx.shadowBlur = 8;
                ctx.fillStyle = enchantColor;
                ctx.beginPath();
                ctx.arc(point.x + 18, point.y - 12, 4, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();

                // Draw enchantment number
                this.drawText(point.x + 18, point.y - 8, `.${harvestableOne.charges}`, ctx, 8, "monospace", enchantColor, 10);
            }

            // Resource count with better visibility
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

                // Background for better readability
                ctx.save();
                ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                const text = realResources.toString();
                const textWidth = ctx.measureText(text).width;
                ctx.fillRect(point.x + 10, point.y + 8, textWidth + 6, 12);
                ctx.restore();

                // Draw resource count in white
                this.drawText(point.x + 13, point.y + 15, realResources, ctx, 8, "monospace", "#FFFFFF", 10);
            }
            
        }
    }  
}
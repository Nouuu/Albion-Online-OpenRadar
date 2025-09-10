export class HarvestablesDrawing extends DrawingUtils  {


    constructor(Settings) {

        super(Settings);
    
    }
    
    interpolate(harvestables, lpX, lpY ,t ) {

        for (const harvestableOne of harvestables) {
 
            const hX = -1 * harvestableOne.posX + lpX;
            const hY = harvestableOne.posY - lpY;

       
            if (harvestableOne.hY == 0 && harvestableOne.hX == 0) {
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

            // TODO
            // Change Resources to Animals/LHarvestables (living harvestables)
            this.DrawCustomImage(ctx, point.x, point.y, draw, "Resources", 50);

            if (this.settings.livingResourcesID)
                this.drawText(point.x, point.y + 20, type.toString(), ctx);

            let tier = "I";
            switch (harvestableOne.tier)
            {
                case 1: tier = "I"; break;
                case 2: tier = "II"; break;
                case 3: tier = "III"; break;
                case 4: tier = "IV"; break;
                case 5: tier = "V"; break;
                case 6: tier = "VI"; break;
                case 6: tier = "VII"; break;
                case 6: tier = "VIII"; break;

                default:
                    tier = "";
                    break;
            }

            this.drawText(point.x - 10, point.y - 10, tier.toString(), ctx, 9, "monospace", "#585858", 10);

            if (this.settings.resourceSize)
            {
                harvestableOne.size = parseInt(harvestableOne.size);
                this.drawText(point.x + 13, point.y + 15, harvestableOne.size, ctx, 8);
            }
            
        }
    }  
}
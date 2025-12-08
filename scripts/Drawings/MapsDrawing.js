import {DrawingUtils} from "../Utils/DrawingUtils.js";
import {CATEGORIES, EVENTS} from "../constants/LoggerConstants.js";
import settingsSync from "../Utils/SettingsSync.js";
import imageCache from "../Utils/ImageCache.js";

export class MapDrawing extends DrawingUtils
{
    interpolate(curr_map, lpX, lpY , t)
    {
        const hX = lpX;
        const hY = -lpY;
        
        curr_map.hX = this.lerp(curr_map.hX, hX, t);
        curr_map.hY = this.lerp(curr_map.hY, hY, t);
    }

    Draw(ctx, curr_map)
    {
        //const point = this.transformPoint(curr_map.hX, curr_map.hY);

        if (curr_map.id < 0)
            return;

        this.DrawImageMap(ctx, curr_map.hX*4, curr_map.hY*4, curr_map.id.toString(), 825*4, curr_map);
    }
    DrawImageMap(ctx, x, y, imageName, size)
    {
        // Fill background => if no map image or corner to prevent glitch textures
        ctx.fillStyle = '#1a1c23';
        ctx.fillRect(0, 0, ctx.width, ctx.height);

        if (!settingsSync.getBool("settingShowMap")) return;

        if (imageName === undefined || imageName == "undefined")
            return;

        const src = "/images/Maps/" + imageName + ".png";

        const preloadedImage = imageCache.GetPreloadedImage(src, "Maps");

        if (preloadedImage === null) return;

        if (preloadedImage)
        {
            ctx.save();

            ctx.scale(1, -1);
            ctx.translate(250, -250);

            ctx.rotate(-0.785398);
            ctx.translate(-x, y);

            ctx.drawImage(preloadedImage, -size/2, -size/2, size, size);
            ctx.restore();
        }
        else
        {
            imageCache.preloadImageAndAddToList(src, "Maps")
            .then(() => {
                window.logger?.info(CATEGORIES.MAP, EVENTS.MapLoaded, { src: src });
            })
            .catch((error) => {
                window.logger?.warn(CATEGORIES.MAP, EVENTS.MapLoadFailed, { src: src, error: error?.message });
            });
        }
    }
}
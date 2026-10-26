import zonesDatabase from '../data/ZonesDatabase.js';
import imageCache from './ImageCache.js';
import settingsSync from './SettingsSync.js';
import {shouldRenderLivingResource, shouldRenderStaticResource} from './LivingResourceFilter.js';

// Same isometric turn the radar applies to its map image, so north stays where it is on the radar.
const TURN = Math.SQRT1_2;

const NODE_COLORS = {
    Fiber: '#4ade80',
    Hide: '#fb923c',
    Log: '#a16207',
    Ore: '#38bdf8',
    Rock: '#cbd5e1',
};

export function mapView(mapId, size) {
    const id = String(mapId);
    const extent = zonesDatabase.getMapAssetExtent(id);
    const center = zonesDatabase.getMapAssetCenter(id);
    const imageSize = size * TURN;
    return {id, size, center, imageSize, pixelsPerUnit: imageSize / extent};
}

export function worldToMap(view, posX, posY) {
    const u = view.pixelsPerUnit * (posX - view.center.x);
    const v = view.pixelsPerUnit * (posY - view.center.y);
    return {x: view.size / 2 + TURN * (u + v), y: view.size / 2 + TURN * (u - v)};
}

export function visibleNodes(harvestables) {
    const getSetting = key => settingsSync.getJSON(key);
    return harvestables.filter(node => {
        if (!(node.size > 0)) return false;
        const entity = {name: node.stringType, tier: node.tier, enchantmentLevel: node.charges};
        const mobileTypeId = node.mobileTypeId;
        const isPureStatic = mobileTypeId === null || mobileTypeId === undefined
            || mobileTypeId === -1 || mobileTypeId === 65535;
        return isPureStatic ? shouldRenderStaticResource(entity, getSetting) : shouldRenderLivingResource(entity, getSetting);
    });
}

function drawBackground(ctx, view) {
    ctx.fillStyle = '#1a1c23';
    ctx.fillRect(0, 0, view.size, view.size);

    const src = `/images/Maps/${view.id}.webp`;
    const image = imageCache.GetPreloadedImage(src, 'Maps');
    if (image) {
        ctx.save();
        ctx.translate(view.size / 2, view.size / 2);
        ctx.transform(TURN, TURN, TURN, -TURN, 0, 0);
        ctx.drawImage(image, -view.imageSize / 2, -view.imageSize / 2, view.imageSize, view.imageSize);
        ctx.restore();
    } else if (image === undefined) {
        imageCache.preloadImageAndAddToList(src, 'Maps').catch(() => {});
    }
}

function drawNode(ctx, point, node) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = NODE_COLORS[node.stringType] ?? '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke();

    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(String(node.tier), point.x, point.y + 0.5);
}

function drawPlayer(ctx, point) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3b82f6';
    ctx.stroke();
}

export function drawFarmRouteMap(canvas, {mapId, lpX, lpY, harvestables}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const view = mapView(mapId, canvas.width);
    drawBackground(ctx, view);

    const nodes = visibleNodes(harvestables);
    for (const node of nodes) drawNode(ctx, worldToMap(view, node.posX, node.posY), node);
    drawPlayer(ctx, worldToMap(view, lpX, lpY));
    return nodes.length;
}

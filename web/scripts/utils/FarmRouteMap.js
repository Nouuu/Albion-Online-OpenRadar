import zonesDatabase from '../data/ZonesDatabase.js';
import imageCache from './ImageCache.js';
import settingsSync from './SettingsSync.js';
import {shouldRenderLivingResource, shouldRenderStaticResource} from './LivingResourceFilter.js';

// Same isometric turn the game and the radar use, so the map keeps the in-game orientation (north on top).
const TURN = Math.SQRT1_2;
const FALLBACK_EXTENT = 120;
const FALLBACK_MARGIN = 1.3;

// Fill follows the tier colors of the game; the ring keeps the resource type.
const TIER_COLORS = {
    1: '#6b7280',
    2: '#9ca3af',
    3: '#22c55e',
    4: '#3b82f6',
    5: '#ef4444',
    6: '#f97316',
    7: '#facc15',
    8: '#ffffff',
};
const FISH_COLOR = '#22d3ee';
const DARK_TEXT_TIERS = new Set([2, 3, 6, 7, 8]);

const NODE_COLORS = {
    Fiber: '#4ade80',
    Hide: '#fb923c',
    Log: '#a16207',
    Ore: '#38bdf8',
    Rock: '#cbd5e1',
};

// Nodes marked on the farm route map, per zone. They live here, not in the radar handlers, so the radar
// forgetting a node (save range, node time) never unmarks it; only resetFarmRoute does.
const zones = new Map();

function zoneStore(mapId) {
    const key = String(mapId);
    if (!zones.has(key)) zones.set(key, {nodes: new Map(), fishes: new Map(), resetAt: 0});
    return zones.get(key);
}

export function rememberNodes(mapId, harvestables) {
    const zone = zoneStore(mapId);
    for (const node of harvestables) {
        if (!(node.size > 0) || node.lastUpdateTime <= zone.resetAt) continue;
        const {id, posX, posY, stringType, tier, charges, size, mobileTypeId} = node;
        zone.nodes.set(id, {id, posX, posY, stringType, tier, charges, size, mobileTypeId});
    }
}

export function savedNodes(mapId) {
    return [...zoneStore(mapId).nodes.values()];
}

export function rememberFishes(mapId, fishes) {
    const zone = zoneStore(mapId);
    for (const fish of fishes) {
        if (fish.lastUpdateTime <= zone.resetAt) continue;
        const {id, posX, posY, sizeSpawned, totalSize} = fish;
        zone.fishes.set(id, {id, posX, posY, sizeSpawned, totalSize});
    }
}

export function savedFishes(mapId) {
    return [...zoneStore(mapId).fishes.values()];
}

// After a reset only nodes the game reports again are marked; the ones the radar still remembers stay out.
export function resetFarmRoute(mapId) {
    const zone = zoneStore(mapId);
    zone.nodes.clear();
    zone.fishes.clear();
    zone.resetAt = Date.now();
}

// Zones without bounds in the zone data (Mists, for one) have no map image either, so the view fits the
// points instead: the saved nodes and the player.
function fitPoints(points) {
    if (!points.length) return {center: {x: 0, y: 0}, extent: FALLBACK_EXTENT};
    const xs = points.map(p => p.posX);
    const ys = points.map(p => p.posY);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return {
        center: {x: (minX + maxX) / 2, y: (minY + maxY) / 2},
        extent: Math.max(FALLBACK_EXTENT, Math.max(maxX - minX, maxY - minY) * FALLBACK_MARGIN),
    };
}

export function mapView(mapId, size, points = []) {
    const id = String(mapId);
    const hasMap = zonesDatabase.hasMapBounds(id);
    const {center, extent} = hasMap
        ? {center: zonesDatabase.getMapAssetCenter(id), extent: zonesDatabase.getMapAssetExtent(id)}
        : fitPoints(points);
    const imageSize = size * TURN;
    return {id, size, center, hasMap, imageSize, pixelsPerUnit: imageSize / extent};
}

export function worldToMap(view, posX, posY) {
    const u = view.pixelsPerUnit * (posX - view.center.x);
    const v = view.pixelsPerUnit * (posY - view.center.y);
    return {x: view.size / 2 + TURN * (u + v), y: view.size / 2 + TURN * (u - v)};
}

export function tierColor(tier) {
    return TIER_COLORS[tier] ?? '#9ca3af';
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

    if (!view.hasMap) return;

    const src = `/images/Maps/${zonesDatabase.getMapImageName(view.id)}.webp`;
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
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = tierColor(node.tier);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = NODE_COLORS[node.stringType] ?? 'rgba(0,0,0,0.85)';
    ctx.stroke();

    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DARK_TEXT_TIERS.has(node.tier) ? '#000000' : '#ffffff';
    ctx.fillText(String(node.tier), point.x, point.y + 0.5);
}

function drawFish(ctx, point, fish) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - 9);
    ctx.lineTo(point.x + 9, point.y);
    ctx.lineTo(point.x, point.y + 9);
    ctx.lineTo(point.x - 9, point.y);
    ctx.closePath();
    ctx.fillStyle = FISH_COLOR;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke();

    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(String(fish.sizeSpawned), point.x, point.y + 0.5);
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

export function drawFarmRouteMap(canvas, {mapId, lpX, lpY, harvestables, fishes = []}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    rememberNodes(mapId, harvestables);
    rememberFishes(mapId, fishes);
    const nodes = settingsSync.getBool('settingRadarShowResources') ? visibleNodes(savedNodes(mapId)) : [];
    const showPools = settingsSync.getBool('settingRadarShowFishing') && settingsSync.getBool('settingResourcesFishing');
    const pools = showPools ? savedFishes(mapId) : [];
    const view = mapView(mapId, canvas.width, [...nodes, ...pools, {posX: lpX, posY: lpY}]);
    drawBackground(ctx, view);
    for (const node of nodes) drawNode(ctx, worldToMap(view, node.posX, node.posY), node);
    for (const fish of pools) drawFish(ctx, worldToMap(view, fish.posX, fish.posY), fish);
    drawPlayer(ctx, worldToMap(view, lpX, lpY));
    return nodes.length + pools.length;
}

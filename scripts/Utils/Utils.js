import { PlayersDrawing } from '../Drawings/PlayersDrawing.js';
import { HarvestablesDrawing } from '../Drawings/HarvestablesDrawing.js';
import { MobsDrawing } from '../Drawings/MobsDrawing.js';
import { ChestsDrawing } from '../Drawings/ChestsDrawing.js';
import { DungeonsDrawing } from '../Drawings/DungeonsDrawing.js';
import { MapDrawing } from '../Drawings/MapsDrawing.js';
import { WispCageDrawing } from '../Drawings/WispCageDrawing.js';
import { FishingDrawing } from '../Drawings/FishingDrawing.js';

import { EventCodes } from './EventCodes.js';

import { PlayersHandler } from '../Handlers/PlayersHandler.js';
import { WispCageHandler } from '../Handlers/WispCageHandler.js';
import { FishingHandler } from '../Handlers/FishingHandler.js';

// Check if canvas elements exist (only on drawing page)
var canvasMap = document.getElementById("mapCanvas");
var contextMap = canvasMap ? canvasMap.getContext("2d") : null;

var canvasGrid = document.getElementById("gridCanvas");
var contextGrid = canvasGrid ? canvasGrid.getContext("2d") : null;

var canvas = document.getElementById("drawCanvas");
var context = canvas ? canvas.getContext("2d") : null;

var canvasFlash = document.getElementById("flashCanvas");
var contextFlash = canvasFlash ? canvasFlash.getContext("2d") : null;

var canvasOurPlayer = document.getElementById("ourPlayerCanvas");
var contextOurPlayer = canvasOurPlayer ? canvasOurPlayer.getContext("2d") : null;

var canvasItems = document.getElementById("thirdCanvas");
var contextItems = canvasItems ? canvasItems.getContext("2d") : null;

import { Settings } from './Settings.js';
const settings = new Settings();



const harvestablesDrawing = new HarvestablesDrawing(settings);
const dungeonsHandler = new DungeonsHandler(settings);

var itemsInfo = new ItemsInfo();
var mobsInfo = new MobsInfo();

itemsInfo.initItems();
mobsInfo.initMobs();

console.log(`[Utils] 📊 MobsInfo loaded: ${Object.keys(mobsInfo.moblist).length} TypeIDs (fusionné)`);

var map = new MapH(-1);
const mapsDrawing = new MapDrawing(settings);

const chestsHandler = new ChestsHandler();
const mobsHandler = new MobsHandler(settings);
mobsHandler.updateMobInfo(mobsInfo.moblist);

// existing logEnemiesList button stays the same
window.addEventListener('load', () => {
    const logEnemiesList = document.getElementById('logEnemiesList');
    if (logEnemiesList) logEnemiesList.addEventListener('click', () => console.log(mobsHandler.getMobList()));

    // Clear TypeID Cache button
    const clearTypeIDCache = document.getElementById('clearTypeIDCache');
    if (clearTypeIDCache) clearTypeIDCache.addEventListener('click', () => {
        try {
            // Show what's in cache BEFORE clearing
            const cached = localStorage.getItem('cachedStaticResourceTypeIDs');
            if (cached) {
                const entries = JSON.parse(cached);
                console.log(`[clearTypeIDCache] 🗑️ Clearing ${entries.length} cached entries:`);
                entries.forEach(([typeId, info]) => {
                    console.log(`  - TypeID ${typeId}: ${info.type} T${info.tier}`);
                });
            } else {
                console.log('[clearTypeIDCache] ℹ️ Cache is already empty');
            }

            // Clear in-memory cache in MobsHandler
            mobsHandler.clearCachedTypeIDs();

            // Confirm
            const shouldReload = confirm('✅ TypeID Cache cleared (in-memory + localStorage)!\n\n🔄 Reload the page to start fresh?\n\n(Recommended: Yes)');
            if (shouldReload) {
                window.location.reload();
            }
        } catch (e) {
            console.error('❌ Failed to clear TypeID cache:', e);
            alert('❌ Failed to clear cache: ' + e.message);
        }
    });

    // Show TypeID Cache button (debug)
    const showTypeIDCache = document.getElementById('showTypeIDCache');
    if (showTypeIDCache) showTypeIDCache.addEventListener('click', () => {
        mobsHandler.showCachedTypeIDs();
    });
});


const harvestablesHandler = new HarvestablesHandler(settings, mobsHandler); // 🔗 Pass MobsHandler reference
const playersHandler = new PlayersHandler(settings);


// 📊 Expose harvestablesHandler globally for statistics access
window.harvestablesHandler = harvestablesHandler;

const wispCageHandler = new WispCageHandler(settings);
const wispCageDrawing = new WispCageDrawing(settings);

const fishingHandler = new FishingHandler(settings);
const fishingDrawing = new FishingDrawing(settings);

const chestsDrawing = new ChestsDrawing(settings);
const mobsDrawing = new MobsDrawing(settings);
const playersDrawing = new PlayersDrawing(settings);
const dungeonsDrawing = new DungeonsDrawing(settings);
playersDrawing.updateItemsInfo(itemsInfo.iteminfo);


let lpX = 0.0;
let lpY = 0.0;

var flashTime = -1;

const drawingUtils = new DrawingUtils();
drawingUtils.initCanvas(canvas, context);
drawingUtils.initGridCanvas(canvasGrid, contextGrid);
drawingUtils.InitOurPlayerCanvas(canvasOurPlayer, contextOurPlayer);


const socket = new WebSocket('ws://localhost:5002');
      
socket.addEventListener('open', (event) => {
  console.log('Connected to the WebSocket server.');

});

socket.addEventListener('message', (event) => {
  var data = JSON.parse(event.data);

  // Extract the string and dictionary from the object
  var extractedString = data.code;

  var extractedDictionary = JSON.parse(data.dictionary);

  switch (extractedString)
  {
    case "request":
        onRequest(extractedDictionary["parameters"]);
        break;

    case "event":
        onEvent(extractedDictionary["parameters"]);
        break;

    case "response":
        onResponse(extractedDictionary["parameters"]);
        break;
  }
});


function onEvent(Parameters)
{
    const id = parseInt(Parameters[0]);
    const eventCode = Parameters[252];

    switch (eventCode)
    {
        // DEBUG

        /*case 506:
            console.log("MistsPlayerJoinedInfo");
            console.log(Parameters);
            break;

        case 474:
            console.log("CarriedObjectUpdate");
            console.log(Parameters);
            break;

        case 530:
            console.log("TemporaryFlaggingStatusUpdate ");
            console.log(Parameters);
            break;*/

        // END DEBUG

        case EventCodes.Leave:
            playersHandler.removePlayer(id);
            mobsHandler.removeMist(id);
            mobsHandler.removeMob(id);
            dungeonsHandler.RemoveDungeon(id);
            chestsHandler.removeChest(id);
            fishingHandler.RemoveFish(id);
            wispCageHandler.RemoveCage(id);
            break;

        case EventCodes.Move:
            const posX = Parameters[4];
            const posY = Parameters[5];

            //playersHandler.updatePlayerPosition(id, posX, posY, Parameters);
            mobsHandler.updateMistPosition(id, posX, posY);
            mobsHandler.updateMobPosition(id, posX, posY);
            break;

        case EventCodes.NewCharacter:
            const ttt = playersHandler.handleNewPlayerEvent(Parameters, map.isBZ);
            flashTime = ttt < 0 ? flashTime : ttt;
            break;

        case EventCodes.NewSimpleHarvestableObjectList:
            harvestablesHandler.newSimpleHarvestableObject(Parameters);
            break;

        case EventCodes.NewHarvestableObject:
            harvestablesHandler.newHarvestableObject(id, Parameters);
            break;

        case EventCodes.HarvestableChangeState:
            harvestablesHandler.HarvestUpdateEvent(Parameters);
            break;

        case EventCodes.HarvestStart:
            if (Parameters[3]) {
                harvestablesHandler.onHarvestStart(Parameters[3]);
            }
            break;

        case EventCodes.HarvestCancel:
            harvestablesHandler.onHarvestCancel();
            break;

        case EventCodes.HarvestFinished:
            harvestablesHandler.harvestFinished(Parameters);
            break;

        // Inventory events
        case EventCodes.InventoryPutItem:
            // 📦 Inventory updates
            break;

        case EventCodes.InventoryDeleteItem:
            // 🗑️ Item removed from inventory
            break;

        case EventCodes.InventoryState:
            // 📋 Full inventory state
            break;

        case EventCodes.NewSimpleItem:
            if (Parameters[1] && Parameters[2]) {
                harvestablesHandler.onNewSimpleItem(Parameters[1], Parameters[2]);
            }
            break;

        case EventCodes.NewEquipmentItem:
            // ⚔️ Equipment updates
            break;

        case EventCodes.NewJournalItem:
            // 📖 Journal updates
            break;

        case EventCodes.UpdateFame:
            // 📊 Fame tracking (not used for resource counting - see NewSimpleItem instead)
            // Parameters[2] = fame gained (varies with gear/food bonuses, but NOT premium)
            break;

        case EventCodes.UpdateMoney:
            // 💰 Money updates
            break;

        case EventCodes.MobChangeState:
            mobsHandler.updateEnchantEvent(Parameters);
            break;

        case EventCodes.RegenerationHealthChanged:
            // 🐛 DEBUG: Log health regeneration events
            if (settings && settings.debugEnemies) {
                const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
                console.log(`[DEBUG_HP] Event 91 (RegenerationHealthChanged) | ID=${Parameters[0]} | ${mobInfo} | params[2]=${Parameters[2]} params[3]=${Parameters[3]} | ALL:`, Parameters);
            }
            playersHandler.UpdatePlayerHealth(Parameters);
            mobsHandler.updateMobHealthRegen(Parameters);  // Update mob HP
            break;

        case EventCodes.HealthUpdate:
            // 🐛 DEBUG: Log health update events
            if (settings && settings.debugEnemies) {
                const mobInfo = mobsHandler.debugLogMobById(Parameters[0]);
                console.log(`[DEBUG_HP] Event 6 (HealthUpdate) | ID=${Parameters[0]} | ${mobInfo} | params[3]=${Parameters[3]} | ALL:`, Parameters);
            }
            playersHandler.UpdatePlayerLooseHealth(Parameters);
            mobsHandler.updateMobHealth(Parameters);  // Update mob HP
            break;

        case EventCodes.HealthUpdates:
            // 🐛 DEBUG: Log bulk health updates (multiple entities at once)
            if (settings && settings.debugEnemies) {
                console.log(`[DEBUG_HP] Event 7 (HealthUpdates - BULK) | ALL:`, Parameters);
            }
            mobsHandler.updateMobHealthBulk(Parameters);
            break;

        case EventCodes.CharacterEquipmentChanged:
            playersHandler.updateItems(id, Parameters);
            break;

        case EventCodes.NewMob:
            mobsHandler.NewMobEvent(Parameters);
            break;

        case EventCodes.Mounted:
            playersHandler.handleMountedPlayerEvent(id, Parameters);
            break;

        case EventCodes.NewRandomDungeonExit:
            dungeonsHandler.dungeonEvent(Parameters);
            break;

        case EventCodes.NewLootChest:
            chestsHandler.addChestEvent(Parameters);
            break;

        case EventCodes.NewMistsCagedWisp:
            wispCageHandler.NewCageEvent(Parameters);
            break;

        case EventCodes.MistsWispCageOpened:
            wispCageHandler.CageOpenedEvent(Parameters);
            break;

        // TODO
        case EventCodes.NewFishingZoneObject:
            fishingHandler.NewFishEvent(Parameters);
            break;

        // TODO
        case EventCodes.FishingFinished:
            fishingHandler.FishingEnd(Parameters);
            break;

        case 590:
            console.log()
            console.log("Key sync")
            console.log(Parameters)
            break;

        /*default:
            console.log("default");
            console.log(Parameters);*/
    }
};

function onRequest(Parameters)
{ 
    // Player moving
    if (Parameters[253] == 21)
    {
        lpX = Parameters[1][0];
        lpY = Parameters[1][1];
        // console.log(lpX)
    }
}

function onResponse(Parameters)
{
    // Player change cluster
    if (Parameters[253] == 35)
    {
        map.id = Parameters[0];
        
        /*console.log()
        console.log("Cluster change")
        console.log(Parameters)*/
    }
    // All data on the player joining the map (us)
    else if (Parameters[253] == 2)
    {
        lpX = Parameters[9][0];
        lpY = Parameters[9][1];

        // TODO bz portals does not trigger this event, so when change map check if map id is portal in event 35 above ^
        // And clear everything too 
        map.isBZ = Parameters[103] == 2;

        /*console.log()
        console.log("Join")
        console.log(Parameters)*/

        ClearHandlers();
    }
    // GetCharacterStats  
    else if (Parameters[253] == 137)
    {
        console.log()
        console.log("GetCharacterStats")
        console.log(Parameters)
    }
};

requestAnimationFrame(gameLoop);

function render()
{

    context.clearRect(0, 0, canvas.width, canvas.height);
    contextMap.clearRect(0, 0, canvasMap.width, canvasMap.height);
    contextFlash.clearRect(0, 0, canvasFlash.width, canvasFlash.height);

    mapsDrawing.Draw(contextMap, map);

    // Unified cluster detection + drawing (merge static harvestables + living resources)
    let __clustersForInfo = null;
    if (settings.overlayCluster) {
        try {
            // Prepare merged list: static harvestables + living resources from mobs
            const staticList = harvestablesHandler.harvestableList || [];
            const livingList = (mobsHandler && mobsHandler.mobsList) ?
                mobsHandler.mobsList.filter(mob => mob.type === EnemyType.LivingHarvestable || mob.type === EnemyType.LivingSkinnable)
                : [];

            // Merge arrays (no deep copy needed) - detectClusters expects objects with hX/hY/tier/name/type/size
            const merged = staticList.concat(livingList);

            const clusters = drawingUtils.detectClusters(merged, settings.overlayClusterRadius, settings.overlayClusterMinSize);

            // Draw only rings now (behind resources)
            for (const cluster of clusters) {
                if (drawingUtils && typeof drawingUtils.drawClusterRingsFromCluster === 'function') {
                    drawingUtils.drawClusterRingsFromCluster(context, cluster);
                } else if (drawingUtils && typeof drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                    // fallback to legacy method
                    drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                }
            }

            // keep clusters for later to draw info boxes above everything
            __clustersForInfo = clusters;
        } catch (e) {
            console.error('[Cluster] Failed to compute/draw clusters:', e);
        }
    }

    harvestablesDrawing.invalidate(context, harvestablesHandler.harvestableList);

    mobsDrawing.invalidate(context, mobsHandler.mobsList, mobsHandler.mistList);
    chestsDrawing.invalidate(context, chestsHandler.chestsList);
    wispCageDrawing.Draw(context, wispCageHandler.cages);
    fishingDrawing.Draw(context, fishingHandler.fishes);
    dungeonsDrawing.Draw(context, dungeonsHandler.dungeonList);
    playersDrawing.invalidate(context, playersHandler.playersInRange);

    // Draw cluster info boxes on top of all elements if any
    if (__clustersForInfo && __clustersForInfo.length) {
        for (const cluster of __clustersForInfo) {
            try {
                if (drawingUtils && typeof drawingUtils.drawClusterInfoBox === 'function') {
                    drawingUtils.drawClusterInfoBox(context, cluster);
                } else if (drawingUtils && typeof drawingUtils.drawClusterIndicatorFromCluster === 'function') {
                    // fallback: draw both (legacy)
                    drawingUtils.drawClusterIndicatorFromCluster(context, cluster);
                }
            } catch (e) {
                console.error('[Cluster] Failed to draw cluster info box:', e);
            }
        }
    }

    // Flash
    if (settings.settingFlash && flashTime >= 0)
    {
        contextFlash.rect(0, 0, 500, 500);
        contextFlash.rect(20, 20, 460, 460);

        contextFlash.fillStyle = 'red';
        contextFlash.fill('evenodd');
    }
}


var previousTime = performance.now();

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}



function update() {

    const currentTime = performance.now();
    const deltaTime = currentTime - previousTime;
    const t = Math.min(1, deltaTime / 100);



    if (settings.showMapBackground)
        mapsDrawing.interpolate(map, lpX, lpY, t);

    harvestablesHandler.removeNotInRange(lpX, lpY);
    harvestablesDrawing.interpolate(harvestablesHandler.harvestableList, lpX, lpY, t);


    mobsDrawing.interpolate(mobsHandler.mobsList, mobsHandler.mistList, lpX, lpY, t);


    chestsDrawing.interpolate(chestsHandler.chestsList, lpX, lpY, t);
    wispCageDrawing.Interpolate(wispCageHandler.cages, lpX, lpY, t);
    fishingDrawing.Interpolate(fishingHandler.fishes, lpX, lpY, t);
    dungeonsDrawing.interpolate(dungeonsHandler.dungeonList, lpX, lpY, t);
    playersDrawing.interpolate(playersHandler.playersInRange, lpX, lpY, t);

    // Flash
    if (flashTime >= 0)
    {
        flashTime -= t;
    }

    previousTime = currentTime;
}

function drawItems() {

    contextItems.clearRect(0, 0, canvasItems.width, canvasItems.height);

    if (settings.settingItems)
    {
        playersDrawing.drawItems(contextItems, canvasItems, playersHandler.playersInRange, settings.settingItemsDev);
    }

}
const intervalItems = 500;
setInterval(drawItems, intervalItems);

function checkLocalStorage()
{
    settings.update(settings);
    setDrawingViews();
}

const interval = 300;
setInterval(checkLocalStorage, interval)



document.getElementById("button").addEventListener("click", function () {
    ClearHandlers();
});

function ClearHandlers()
{
    chestsHandler.chestsList = [];
    dungeonsHandler.dungeonList = [];
    fishingHandler.Clear();
    harvestablesHandler.Clear();
    mobsHandler.Clear();
    playersHandler.Clear();
    wispCageHandler.CLear();
}

setDrawingViews();

function setDrawingViews() {
    const mainWindowMarginXValue = localStorage.getItem("mainWindowMarginX");
    const mainWindowMarginYValue = localStorage.getItem("mainWindowMarginY");
    const itemsWindowMarginXValue = localStorage.getItem("itemsWindowMarginX");
    const itemsWindowMarginYValue = localStorage.getItem("itemsWindowMarginY");
    const settingItemsBorderValue = localStorage.getItem("settingItemsBorder");
    const buttonMarginXValue = localStorage.getItem("buttonMarginX");
    const buttonMarginYValue = localStorage.getItem("buttonMarginY");

    const itemsWidthValue = localStorage.getItem("itemsWidth");
    const itemsHeightValue = localStorage.getItem("itemsHeight");

    // Check if the values exist in local storage and handle them
    if (mainWindowMarginXValue !== null) {
        document.getElementById('bottomCanvas').style.left = mainWindowMarginXValue + "px";
        document.getElementById('drawCanvas').style.left = mainWindowMarginYValue + "px";
    }

    if (mainWindowMarginYValue !== null) {
        document.getElementById('drawCanvas').style.top = mainWindowMarginYValue + "px";
        document.getElementById('bottomCanvas').style.top = mainWindowMarginYValue + "px";
    }

    if (itemsWindowMarginXValue !== null) {
        document.getElementById('thirdCanvas').style.left = itemsWindowMarginXValue + "px";
    }

    if (itemsWindowMarginYValue !== null) {
        document.getElementById('thirdCanvas').style.top = itemsWindowMarginYValue + "px";
    }

    if (itemsWidthValue !== null) {
        document.getElementById('thirdCanvas').style.width = itemsWidthValue + "px";
    }

    if (itemsHeightValue !== null) {
        document.getElementById('thirdCanvas').style.height = itemsHeightValue + "px";
    }

    if (settingItemsBorderValue !== null) {
        // Apply border based on the settingItemsBorderValue
        if (settingItemsBorderValue === "true") {

            document.getElementById('thirdCanvas').style.border = "2px solid grey";
        } else {

            document.getElementById('thirdCanvas').style.border = "none";
        }
    }

    if (buttonMarginXValue !== null) {
        document.getElementById('button').style.left = buttonMarginXValue + "px";
    }

    if (buttonMarginYValue !== null) {
        document.getElementById('button').style.top = buttonMarginYValue + "px";
    }



}
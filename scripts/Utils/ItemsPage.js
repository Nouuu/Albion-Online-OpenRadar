var canvasItems = document.getElementById("thirdCanvas");
var contextItems = canvasItems.getContext("2d");

import { Settings } from './Settings.js';
const settings = new Settings();

var itemsInfo = new ItemsInfo();
itemsInfo.initItems().then(() => {
    var players = [];

    const socket = new WebSocket('ws://localhost:5002');
        
    socket.addEventListener('open', (event) => {
    console.log('Connected to the WebSocket server.');

    });

    socket.addEventListener('message', (event) => {
    var data = JSON.parse(event.data);

    // Extract the string and dictionary from the object
    var extractedString = data.code;

    var extractedDictionary = JSON.parse(data.dictionary);
    var parameters = extractedDictionary["parameters"];

    switch (extractedString)
    {
        case "items":
            switch (parameters[252]) {
                case 1: // Leave
                    RemovePlayer(parameters);
                    break;

                case 28: // NewCharacter
                    AddPlayer(parameters);
                    break;

                case 88: // CharacterEquipmentChanged
                    UpdateItems(parameters);
                    break;
            
                default:
                    break;
            }
            break;
    }
    });


    function AddPlayer(parameters)
    {
        if (!settings.settingDot)
            return;

        /* General */
        const id = parameters[0];
        const nickname = parameters[1];

        /* Health */
        const currentHealth = parameters[20];
        const initialHealth = parameters[21];

        /* Items & flag */
        const items = parameters[38];
        const flagId = parameters[51];

        players.push(new Player(id, items, currentHealth, initialHealth, nickname));
    }

    function RemovePlayer(parameters)
    {
        console.log(players.find(p => p.id == parameters[0]));

        players = players.filter(player => player.id != parameters[0]);
    }

    function UpdateItems(parameters)
    {
        let items = undefined;

        try
        {
            items = Parameters[2];
        }
        catch { }

        if (items == undefined) return;

        var nPlayer = players.find((player) => player.id === parameters[0]);

        if (nPlayer == undefined || nPlayer == null) return;

        nPlayer.items = items;
    }



    function DrawItems()
    {
        contextItems.clearRect(0, 0, canvasItems.width, canvasItems.height);

        if (!settings.settingItems) return;

        let posY = 15;

        if (players.length <= 0)
        {
            settings.ClearPreloadedImages("Items");
            return;
        }

        for (const playerOne of players)
        {
            const items = playerOne.items;

            if (items == null || items == undefined) continue;

            let posX = 5;
            const total = posY + 20;

            // TODO
            // Show more than few players 
            if (total > canvasItems.height) break; // Ecxeed canvas size

            /*const flagId = playerOne.flagId || 0
            const flagName = FactionFlagInfo[flagId]
            DrawCustomImage(context, posX + 10, posY - 5, flagName, 'Flags', 20)
            let posTemp = posX + 25*/

            let posTemp = posX;

            const nickname = playerOne.name;
            drawTextItems(posTemp, posY, nickname, contextItems, "14px", "white");

            posTemp += contextItems.measureText(nickname).width + 10;
            drawTextItems(posTemp, posY, playerOne.cHealth + "/" + playerOne.mHealth, contextItems, "14px", "red");

            posTemp += contextItems.measureText(playerOne.cHealth + "/" + playerOne.mHealth).width + 10;

            let itemsListString = "";

            posX += 20;
            posY += 25;

            if (items["type"] === "Buffer") // No items
            {
                posX = 0;
                posY += 50;
                continue;
            }

            for (const item of items)
            {
                const itemInfo = itemsInfo.get(item);

                if (itemInfo != undefined && settings.GetPreloadedImage(itemInfo, "Items") !== null)
                {
                    DrawCustomImage(contextItems, posX, posY, itemInfo, "Items", 40);
                }

                posX += 10 + 40;
                itemsListString += item.toString() + " ";
            }

            if (settings.settingItemsDev)
            {
                drawTextItems(posTemp, posY - 5, itemsListString, contextItems, "14px", "white");
            }
        
            posY += 45;
        }    
    }

    function drawTextItems(xTemp, yTemp, text, ctx , size , color)
    {
        ctx.font = size + " " + "Arial";
        ctx.fillStyle = color;

        let x = xTemp;
        let y = yTemp;

        ctx.fillText(text, x , y);
    }

    function DrawCustomImage(ctx, x, y, imageName, folder, size)
    {
        if (imageName == "" || imageName === undefined)
            return;
        
        const folderR = folder == "" || folder === undefined ? "" : folder + "/";

        const src = "/images/" + folderR + imageName + ".png"; 

        const preloadedImage = settings.GetPreloadedImage(src, folder);

        if (preloadedImage === null) 
        {
            drawFilledCircle(ctx, x, y, 10, "#4169E1");
            return;
        }

        if (preloadedImage)
        {
            ctx.drawImage(preloadedImage, x - size / 2, y - size / 2, size, size);
        }
        else
        {
            settings.preloadImageAndAddToList(src, folder)
            .then(() => console.log('Item loaded'))
            .catch(() => console.log('Item not loaded'));
        }
    }

    function drawFilledCircle(context, x, y, radius, color)
    {
        context.beginPath();
        context.arc(x , y , radius, 0, 2 * Math.PI);
        context.fillStyle = color;
        context.fill();
    }


    const intervalItems = 300;
    setInterval(DrawItems, intervalItems);

    function checkLocalStorage()
    {
        settings.update(settings);
    }

    const interval = 5000;
    setInterval(checkLocalStorage, interval)
});

class Player
{
    constructor(id, items, cHealth, mHealth, name)
    {
        this.id = id;
        this.items = items;
        this.cHealth = cHealth;
        this.mHealth = mHealth;
        this.name = name;
    }
}
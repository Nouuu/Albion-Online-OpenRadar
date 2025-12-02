class Chest {
    constructor(id, posX, posY, name) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.chestName = name;
        this.hX = 0;
        this.hY = 0;

    }
}

export class ChestsHandler {
    constructor(settings) {
        // Import constants once in constructor
        const { CATEGORIES, EVENTS } = window;
        this.CATEGORIES = CATEGORIES;
        this.EVENTS = EVENTS;
        
        this.settings = settings;
        this.chestsList = [];
    }

    addChest(id, posX, posY, name) {
        const h = new Chest(id, posX, posY, name);
        if (!this.chestsList.some(chest => chest.id === h.id)) {
            this.chestsList.push(h);
        }
    }

    removeChest(id) {
        this.chestsList = this.chestsList.filter(chest => chest.id !== id);
      
    }

    addChestEvent(Parameters)
    {
        // 🐛 DEBUG ULTRA-DÉTAILLÉ: Log ALL parameters pour identifier patterns
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }
        window.logger?.debug(this.CATEGORIES.CHEST, this.EVENTS.NewChestEvent_ALL_PARAMS, {
            chestId: Parameters[0],
            position: Parameters[7],
            allParameters: allParams,
            parameterCount: Object.keys(Parameters).length
        });

        const chestId = Parameters[0];
        const chestsPosition = Parameters[1];
        let chestName = Parameters[3];

        if (chestName.toLowerCase().includes("mist")) {
            chestName = Parameters[4];
        }
        this.addChest(chestId, chestsPosition[0], chestsPosition[1], chestName);
    }
}

import {CATEGORIES} from "../constants/LoggerConstants.js";

class Chest {
    constructor(id, posX, posY, name) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.chestName = name;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class ChestsHandler {
    constructor() {
        this.chestsList = [];
    }

    addChest(id, posX, posY, name) {
        const existing = this.chestsList.find(chest => chest.id === id);
        if (existing) {
            existing.touch();
            return;
        }
        const h = new Chest(id, posX, posY, name);
        this.chestsList.push(h);
    }

    removeChest(id) {
        this.chestsList = this.chestsList.filter(chest => chest.id !== id);
    }

    Clear() {
        this.chestsList = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.chestsList.length;
        this.chestsList = this.chestsList.filter(chest =>
            (now - chest.lastUpdateTime) < maxAgeMs
        );
        const removed = before - this.chestsList.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.DUNGEONS, 'chest_cleanup', {removed, maxAgeMs});
        }
        return removed;
    }

    addChestEvent(Parameters)
    {
        // Ultra-detailed debug: Log ALL parameters to identify patterns
        const allParams = {};
        for (let key in Parameters) {
            if (Parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = Parameters[key];
            }
        }
        window.logger?.debug(CATEGORIES.DUNGEONS, 'new_chest_all_params', {
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

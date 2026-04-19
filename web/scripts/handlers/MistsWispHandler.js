import {CATEGORIES} from '../constants/LoggerConstants.js';

class Wisp {
    constructor(id, posX, posY, orientation, flag) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.orientation = orientation;
        this.flag = flag;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class MistsWispHandler {
    constructor() {
        this.wispList = [];
    }

    newWispEvent(parameters) {
        const id = parameters[0];
        const position = parameters[1];
        if (id === undefined || position === undefined) return;

        const existing = this.wispList.find(w => w.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        this.wispList.push(new Wisp(id, position[0], position[1], parameters[2], parameters[3]));

        window.logger?.debug(CATEGORIES.MOBS, 'MistsWispAdded', {
            id, posX: position[0], posY: position[1]
        });
    }

    removeWisp(id) {
        this.wispList = this.wispList.filter(w => w.id !== id);
    }

    Clear() {
        this.wispList = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.wispList.length;
        this.wispList = this.wispList.filter(w => (now - w.lastUpdateTime) < maxAgeMs);
        return before - this.wispList.length;
    }
}

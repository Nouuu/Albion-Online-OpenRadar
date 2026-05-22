import {CATEGORIES} from "../constants/LoggerConstants.js";

class MistsDungeonPortal {
    constructor(id, posX, posY, name) {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.name = name;
        this.drawName = 'mists_abbey';
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class MistsDungeonHandler {
    constructor() {
        this.portalList = [];
    }

    addPortal(id, posX, posY, name) {
        const existing = this.portalList.find(p => p.id === id);
        if (existing) {
            existing.touch();
            return;
        }
        this.portalList.push(new MistsDungeonPortal(id, posX, posY, name));
        window.logger?.debug(CATEGORIES.MAP, 'MistsDungeonPortalAdded', {id, posX, posY, name});
    }

    removePortal(id) {
        this.portalList = this.portalList.filter(p => p.id !== id);
    }

    cleanupStaleEntities(maxAgeMs = 130000) {
        const now = Date.now();
        this.portalList = this.portalList.filter(p => (now - p.lastUpdateTime) < maxAgeMs);
    }

    Clear() {
        this.portalList = [];
    }
}

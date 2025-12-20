import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "../Utils/SettingsSync.js";

class Cage
{
    constructor(id, posX, posY, name)
    {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.name = name;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class WispCageHandler
{
    constructor()
    {
        this.cages = [];
    }

    newCageEvent(Parameters)
    {
        if (settingsSync.getBool('settingCage') || Parameters[4] != undefined) return;

        const id = Parameters[0];

        const existing = this.cages.find(cage => cage.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        this.cages.push(new Cage(Parameters[0], Parameters[1][0], Parameters[1][1], Parameters[2]));
    }

    cageOpenedEvent(Parameters)
    {
        if (settingsSync.getBool('settingCage')) return;

        const id = Parameters[0];

        if (!this.cages.some(cage => cage.id === id))
            return;

        this.removeCage(id);
    }

    removeCage(id)
    {
        this.cages = this.cages.filter(cage => cage.id !== id);
    }

    Clear()
    {
        this.cages = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.cages.length;
        this.cages = this.cages.filter(cage =>
            (now - cage.lastUpdateTime) < maxAgeMs
        );
        const removed = before - this.cages.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.DUNGEONS, 'cage_cleanup', {removed, maxAgeMs});
        }
        return removed;
    }
}
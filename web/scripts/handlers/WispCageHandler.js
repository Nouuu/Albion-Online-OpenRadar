import {CATEGORIES} from "../constants/LoggerConstants.js";

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
        this.outOfRange = false;
    }

    touch() {
        this.lastUpdateTime = Date.now();
        this.outOfRange = false;
    }
}

export class WispCageHandler
{
    constructor()
    {
        this.cages = [];
    }

    newCageEvent(parameters) {
        const id = parameters[0];
        const position = parameters[2];
        const name = parameters[4];

        if (id === undefined || position === undefined) return;

        const existing = this.cages.find(c => c.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        this.cages.push(new Cage(id, position[0], position[1], name));
    }

    cageOpenedEvent(Parameters)
    {
        const id = Parameters[0];

        if (!this.cages.some(cage => cage.id === id))
            return;

        this.removeCage(id);
    }

    removeCage(id)
    {
        this.cages = this.cages.filter(cage => cage.id !== id);
    }

    markOutOfRange(id)
    {
        const cage = this.cages.find(c => c.id === id);
        if (cage) cage.outOfRange = true;
    }

    removeNotInRange(lpX, lpY, range)
    {
        this.cages = this.cages.filter(cage => Math.hypot(lpX - cage.posX, lpY - cage.posY) <= range);
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
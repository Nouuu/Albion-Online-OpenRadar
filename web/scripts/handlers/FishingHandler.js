import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "../utils/SettingsSync.js";

class Fish
{
    constructor(id, posX, posY, type, sizeSpawned = 0, sizeLeftToSpawn = 0)
    {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.type = type;
        this.sizeSpawned = sizeSpawned;
        this.sizeLeftToSpawn = sizeLeftToSpawn;
        this.totalSize = this.sizeSpawned + this.sizeLeftToSpawn;
        this.hX = 0;
        this.hY = 0;
        this.lastUpdateTime = Date.now();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }
}

export class FishingHandler
{
    constructor()
    {
        this.fishes = [];
    }

    newFishEvent(Parameters)
    {
        if (settingsSync.getBool("settingShowFish") === false) return;

        const id = Parameters[0];
        const type = Parameters[4];
        const coor = Parameters[1];
        const sizeSpawned = Parameters[2];
        const sizeLeftToSpawn = Parameters[3];

        if (!type) return;
        if (!coor) return;

        const posX = coor[0];
        const posY = coor[1];

        this.upsertFish(
            id,
            posX,
            posY,
            type,
            sizeSpawned,
            sizeLeftToSpawn,
        )
    }

    upsertFish(id, posX, posY, type, sizeSpawned, sizeLeftToSpawn)
    {
        const existing = this.fishes.find(f => f.id === id);
        if (existing) {
            existing.posX = posX;
            existing.posY = posY;
            existing.sizeSpawned = sizeSpawned;
            existing.sizeLeftToSpawn = sizeLeftToSpawn;
            existing.totalSize = sizeSpawned + sizeLeftToSpawn;
            existing.touch();
            return;
        }

        const fish = new Fish(id, posX, posY, type, sizeSpawned, sizeLeftToSpawn);
        this.fishes.push(fish);
    }

    fishingEnd(Parameters)
    {
        if (settingsSync.getBool("settingShowFish") === false) return;

        window.logger?.debug(CATEGORIES.FISHING, 'fishing_end', {
            parameters: Parameters
        });

        const id = Parameters[0];

        if (!this.fishes.some(fish => fish.id === id))
            return;

        this.removeFish(id);
    }

    removeFish(id)
    {
        this.fishes = this.fishes.filter(fish => fish.id !== id);
    }

    Clear()
    {
        this.fishes = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.fishes.length;
        this.fishes = this.fishes.filter(fish =>
            (now - fish.lastUpdateTime) < maxAgeMs
        );
        const removed = before - this.fishes.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.FISHING, 'fish_cleanup', {removed, maxAgeMs});
        }
        return removed;
    }
}
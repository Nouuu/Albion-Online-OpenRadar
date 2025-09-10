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
    }
}

export class FishingHandler
{
    constructor(settings)
    {
        this.settings = settings;
        this.fishes = [];
    }

    NewFishEvent(Parameters)
    {
        if (!this.settings.showFish) return;

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

    upsertFish(...args)
    {
        const fish = new Fish(...args);

        const index = this.fishes.findIndex(f => f.id == fish.id)
        if (index != -1) {
            this.fishes[index] = fish;
            return;
        }

        this.fishes.push(fish)
    }

    // TODO
    FishingEnd(Parameters)
    {
        if (!this.settings.showFish) return;

        console.log("Fishing END:");
        console.log(Parameters);
        console.log();

        const id = Parameters[0];

        if (!this.fishes.some(fish => fish.id === id))
            return;

        this.RemoveFish(id);
    }

    RemoveFish(id)
    {
        this.fishes = this.fishes.filter(fish => fish.id !== id);
    }

    Clear()
    {
        this.fishes = [];
    }
}
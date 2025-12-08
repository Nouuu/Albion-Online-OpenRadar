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
    }
}

export class WispCageHandler
{
    constructor()
    {
        this.cages = [];
    }

    NewCageEvent(Parameters)
    {
        if (settingsSync.getBool('settingCage') || Parameters[4] != undefined) return;

        const id = Parameters[0];

        if (this.cages.some(cage => cage.id === id))
            return;

        this.cages.push(new Cage(Parameters[0], Parameters[1][0], Parameters[1][1], Parameters[2]));
    }

    CageOpenedEvent(Parameters)
    {
        if (settingsSync.getBool('settingCage')) return;

        const id = Parameters[0];

        if (!this.cages.some(cage => cage.id === id))
            return;

        this.RemoveCage(id);
    }

    RemoveCage(id)
    {
        this.cages = this.cages.filter(cage => cage.id !== id);
    }

    CLear()
    {
        this.cages = [];
    }
}
const HarvestableType = 
{
    Fiber: 'Fiber',
    Hide: 'Hide',
    Log: 'Log',
    Ore: 'Ore',
    Rock: 'Rock'
};

class Harvestable
{
    constructor(id, type, tier, posX, posY, charges, size)
    {
        this.id = id;
        this.type = type;
        this.tier = tier;
        this.posX = posX;
        this.posY = posY;
        this.hX = 0;
        this.hY = 0;

        this.charges = charges;
        this.size = size;
    }

    setCharges(charges)
    {
        this.charges = charges;
    }
}

class HarvestablesHandler
{
    constructor(settings, mobsHandler = null)
    {
        this.harvestableList = [];
        this.settings = settings;
        this.mobsHandler = mobsHandler; // 🔗 Reference to MobsHandler for cross-referencing
    }

    addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // 🔗 Cross-reference with MobsHandler BEFORE settings check (always register TypeID even if not displayed)
        if (this.mobsHandler && mobileTypeId !== null) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);
        }

        switch (this.GetStringType(type))
        {
            case HarvestableType.Fiber:
                if (!this.settings.harvestingStaticFiber[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Hide:
                if (!this.settings.harvestingStaticHide[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Log:
                if (!this.settings.harvestingStaticWood[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Ore:
                if (!this.settings.harvestingStaticOre[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Rock:
                if (!this.settings.harvestingStaticRock[`e${charges}`][tier-1]) return;
                break;

            default:
                return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            const h = new Harvestable(id, type, tier, posX, posY, charges, size);
            this.harvestableList.push(h);
            //console.log("New Harvestable: " + h.toString());
        }
        else // update
        {
            harvestable.setCharges(charges);
        }
    }

    UpdateHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId = null)
    {
        // 🔗 Cross-reference with MobsHandler BEFORE settings check (always register TypeID even if not displayed)
        if (this.mobsHandler && mobileTypeId !== null) {
            this.mobsHandler.registerStaticResourceTypeID(mobileTypeId, type, tier);
        }

        switch (this.GetStringType(type))
        {
            case HarvestableType.Fiber:
                if (!this.settings.harvestingStaticFiber[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Hide:
                if (!this.settings.harvestingStaticHide[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Log:
                if (!this.settings.harvestingStaticWood[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Ore:
                if (!this.settings.harvestingStaticOre[`e${charges}`][tier-1]) return;
                break;

            case HarvestableType.Rock:
                if (!this.settings.harvestingStaticRock[`e${charges}`][tier-1]) return;
                break;

            default:
                return;
        }

        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable)
        {
            this.addHarvestable(id, type, tier, posX, posY, charges, size, mobileTypeId);
            return;
        }

        harvestable.charges = charges;
        harvestable.size = size;
    }

    harvestFinished(Parameters)
    {

        const id = Parameters[3];
        const count = Parameters[5];

        this.updateHarvestable(id, count);
    }

    HarvestUpdateEvent(Parameters)
    {
        const id = Parameters[0];

        if (Parameters[1] === undefined)
        {
            this.removeHarvestable(id);
            return;
        }
        
        var harvestable = this.harvestableList.find((item) => item.id === id);

        if (!harvestable) return;

        harvestable.size = Parameters[1];
    }

    // Normally work with everything
    // Good
    newHarvestableObject(id, Parameters) // Update
    {
        const type = Parameters[5];  // typeNumber (0-27)
        const mobileTypeId = Parameters[6];  // 🔗 Mobile TypeID (421, 422, 527, etc.)
        const tier = Parameters[7];
        const location = Parameters[8];

        let enchant = Parameters[11] === undefined ? 0 : Parameters[11];
        let size = Parameters[10] === undefined ? 0 : Parameters[10];

        // 🔧 FIX: Remove living mob when it becomes harvestable (killed)
        // This prevents showing both living resource AND harvestable cadaver
        if (this.mobsHandler && id) {
            this.mobsHandler.removeMob(id);
        }

        this.UpdateHarvestable(id, type, tier, location[0], location[1], enchant, size, mobileTypeId);
    }

    base64ToArrayBuffer(base64)
    {
        var binaryString = atob(base64);
        var bytes = new Uint8Array(binaryString.length);

        for (var i = 0; i < binaryString.length; i++)
        {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        return bytes;
    }

    // Normally work with everything 
    // Good
    newSimpleHarvestableObject(Parameters) // New
    {
        let a0 = Parameters[0]["data"];
        if  (a0 == undefined)
        {
            a0 = Parameters[0];
        }

        if (a0.length === 0) return;

        const a1 = Parameters[1]["data"];
        const a2 = Parameters[2]["data"];
 
        const a3 = Parameters[3];
        const a4 = Parameters[4]["data"];

        for (let i = 0; i < a0.length; i++) {
            const id = a0[i];
            const type = a1[i];
            const tier = a2[i];
            const posX = a3[i * 2];
            const posY = a3[i * 2 + 1];
            const count = a4[i];

            this.addHarvestable(id, type, tier, posX, posY, 0, count);
        }
    }

    removeNotInRange(lpX, lpY)
    {
        this.harvestableList = this.harvestableList.filter(
            (x) => this.calculateDistance(lpX, lpY, x.posX, x.posY) <= 80
        );

        this.harvestableList = this.harvestableList.filter(item => item.size !== undefined);
    }

    calculateDistance(lpX, lpY, posX, posY)
    {
        const deltaX = lpX - posX;
        const deltaY = lpY - posY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        return distance;
    }

    removeHarvestable(id)
    {
        this.harvestableList = this.harvestableList.filter((x) => x.id !== id);
    }

    getHarvestableList() {
        return [...this.harvestableList];
    }

    updateHarvestable(harvestableId, count)
    {   
        const harvestable = this.harvestableList.find((h) => h.id == harvestableId);

        if (harvestable)
        {
            harvestable.size = harvestable.size - count;
        }
    }

    GetStringType(typeNumber)
    {
        if (typeNumber >= 0 && typeNumber <= 5)
        {
            return HarvestableType.Log;
        }
        else if (typeNumber >= 6 && typeNumber <= 10)
        {
            return HarvestableType.Rock;
        }
        else if (typeNumber >= 11 && typeNumber <= 15)
        {
            return HarvestableType.Fiber;
        }
        else if (typeNumber >= 16 && typeNumber <= 22)
        {
            return HarvestableType.Hide;
        }
        else if (typeNumber >= 23 && typeNumber <= 27)
        {
            return HarvestableType.Ore;
        }
        else return '';
    }

    Clear()
    {
        this.harvestableList = [];
    }
}
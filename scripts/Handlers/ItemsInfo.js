class ItemsInfo{
    constructor()
    {
        this.iteminfo = {};
    }

    addItem(id, name , val)
    {
        if (val == 0)
        {
            this.iteminfo[id] = name;
        }
        else
        {
            let code = id - 1;
            let itemNameBuilder = name.split('');
            let counter = 0;

            for (let j = 0; j <= 4; j++) 
            {   
                if (j == 0)
                {
                    counter++;
                    name = itemNameBuilder.join('');
                    this.iteminfo[code + counter] = name;
                }
                else
                {            
                    counter++;
                    name = itemNameBuilder.join('') + "@" + j;
                    this.iteminfo[code + counter] = name;
                }
            }
        }
    }

    async initItems()
    {
        const response = await fetch('/scripts/Handlers/items.txt');

        if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.text();
        const lines = data.split('\n');

        for (const line of lines)
        {
            const match = line.match(/^(\d+):\s+([^\s]+)\s+/);
            
            if (match)
            {
                const id = parseInt(match[1]);
                const name = match[2];
                this.addItem(id, name, 0);
            }
        }
    }

    get(id)
    {
        return this.iteminfo[id];
    }
}
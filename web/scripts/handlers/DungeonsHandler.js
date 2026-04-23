import {CATEGORIES} from "../constants/LoggerConstants.js";
import settingsSync from "../utils/SettingsSync.js";

const DungeonType =
{
    Solo: 0,
    Group: 1,
    Corrupted: 2,
    Hellgate: 3
};

class Dungeon
{
    constructor(id, posX, posY, name, type, enchant)
    {
        this.id = id;
        this.posX = posX;
        this.posY = posY;
        this.name = name;
        this.enchant = enchant;

        this.type = type;

        this.drawName = undefined

        this.hY = 0;
        this.hX = 0;
        this.lastUpdateTime = Date.now();

        this.setDrawNameByType();
    }

    touch() {
        this.lastUpdateTime = Date.now();
    }

    setDrawNameByType()
    {
        switch (this.type)
        {
            case DungeonType.Solo:
                this.drawName = "dungeon_" + this.enchant;
                break;

            case DungeonType.Group:
                this.drawName = "group_" + this.enchant;
                break;

            case DungeonType.Corrupted:
                this.drawName = "corrupt";
                break;

            case DungeonType.Hellgate:
                this.drawName = "hellgate";
                break;
        }
    }
}

export class DungeonsHandler
{
    constructor()
    {
        // Import constants once in constructor
        this.dungeonList = [];
    }

    dungeonEvent(parameters)
    {
        // Ultra-detailed debug: Log ALL parameters to identify patterns
        const allParams = {};
        for (let key in parameters) {
            if (parameters.hasOwnProperty(key)) {
                allParams[`param[${key}]`] = parameters[key];
            }
        }

        window.logger?.debug(CATEGORIES.DUNGEONS, 'new_dungeon_all_params', {
            dungeonId: parameters[0],
            position: parameters[7],
            allParameters: allParams,
            parameterCount: Object.keys(parameters).length
        });

        const id = parameters[0];
        const position = parameters[1];
        const name = parameters[3];
        // Parameters[8] is the enchant (0-4) across every dungeon family
        // observed in live traffic: MISTS (0 for Common, 1 for Uncommon),
        // T6_MORGANA (2), T6_UNDEAD / T6_KEEPER / T5_PORTAL_ROYAL_SOLO /
        // CORRUPTED_SOLO_NONLETHAL (all 0 for unenchanted). Parameters[6]
        // used to be read here but is a dungeon type/variant id (2 for
        // MISTS_SOLO_YELLOW, 37-39 for CORRUPTED, 229 for T5_PORTAL_ROYAL,
        // 276 for T6_KEEPER, 310 for T6_UNDEAD, 327 for T6_MORGANA) and
        // caused every non-MISTS group dungeon to be filtered out because
        // settingDungeonE<big-number> never exists.
        const enchant = parameters[8] ?? 0;

        this.addDungeon(id, position[0], position[1], name, enchant);
    }

    addDungeon(id, posX, posY, name, enchant) {
        const existing = this.dungeonList.find(item => item.id === id);
        if (existing) {
            existing.touch();
            return;
        }

        const upperCaseName = name.toUpperCase();
        const lowerCaseName = name.toLowerCase();
        // eslint-disable-next-line no-useless-assignment
        let dungeonType = undefined;

        // MISTS portals (spawned after a feu follet is approached). Checked
        // before "solo" because MISTS_SOLO_<COLOR> would otherwise fall into
        // the Dungeon solo branch and be filtered by the wrong settings.
        // `enchant` here is Parameters[8] (zone rarity) resolved in
        // dungeonEvent, not Parameters[6] (variant/seed).
        if (upperCaseName.startsWith("MISTS_"))
        {
            const isSolo = upperCaseName.includes("_SOLO_");

            if (isSolo) {
                if (!settingsSync.getBool("settingMistSolo") || !settingsSync.getBool("settingMistE" + enchant)) return;
                dungeonType = DungeonType.Solo;
            } else {
                if (!settingsSync.getBool("settingMistDuo") || !settingsSync.getBool("settingMistE" + enchant)) return;
                dungeonType = DungeonType.Group;
            }
        }
        // Corrupted dungeons have "solo" in their names
        // So check before solo to avoid problems
        // "CORRUPTED_SOLO"
        else if (lowerCaseName.includes("corrupted")) // corrupt
        {
            // Test if corrupt checkbox
            if (!settingsSync.getBool("settingDungeonCorrupted")) return;

            dungeonType = DungeonType.Corrupted;
        }
        else if (lowerCaseName.includes("solo")) // solo
        {
            // Test if solo checkbox
            if (!settingsSync.getBool("settingDungeonSolo") || !settingsSync.getBool('settingDungeonE'+enchant)) return;

            dungeonType = DungeonType.Solo;
        }
        // "HELLGATE_2V2_NON_LETHAL"
        else if (lowerCaseName.includes("hellgate")) // hellgate
        {
            if (!settingsSync.getBool('settingDungeonHellgate')) return;

            dungeonType = DungeonType.Hellgate

        }
        else // group
        {
            if (!settingsSync.getBool('settingDungeonDuo') || !settingsSync.getBool('settingDungeonE'+enchant)) return;
            dungeonType = DungeonType.Group;
        }

        const d = new Dungeon(id, posX, posY, name, dungeonType, enchant);
        this.dungeonList.push(d);
    }

    removeDungeon(id)
    {
        this.dungeonList = this.dungeonList.filter((dungeon) => dungeon.id !== id);
    }

    Clear() {
        this.dungeonList = [];
    }

    cleanupStaleEntities(maxAgeMs = 120000) {
        const now = Date.now();
        const before = this.dungeonList.length;
        this.dungeonList = this.dungeonList.filter(dungeon =>
            (now - dungeon.lastUpdateTime) < maxAgeMs
        );
        const removed = before - this.dungeonList.length;
        if (removed > 0) {
            window.logger?.debug(CATEGORIES.DUNGEONS, 'dungeon_cleanup', {removed, maxAgeMs});
        }
        return removed;
    }
}
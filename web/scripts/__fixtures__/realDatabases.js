import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

import {HarvestablesDatabase} from '../data/HarvestablesDatabase.js';
import {MobsDatabase} from '../data/MobsDatabase.js';
import zonesDatabase, {ZonesDatabase} from '../data/ZonesDatabase.js';

const here = dirname(fileURLToPath(import.meta.url));
const dumps = join(here, '..', '..', 'ao-bin-dumps');

function readJSON(name) {
    return JSON.parse(readFileSync(join(dumps, name), 'utf8'));
}

export function loadRealHarvestablesDatabase() {
    const db = new HarvestablesDatabase();
    db._parseHarvestables(readJSON('harvestables.min.json'));
    db.isLoaded = true;
    return db;
}

export function loadRealMobsDatabase() {
    const db = new MobsDatabase();
    db._parseMobs(readJSON('mobs.min.json'));
    db.isLoaded = true;
    return db;
}

export function loadRealZonesDatabase() {
    const db = new ZonesDatabase();
    db.zones = readJSON('zones.json');
    db.loaded = true;
    return db;
}

export function installRealDatabasesOnWindow() {
    window.harvestablesDatabase = loadRealHarvestablesDatabase();
    window.mobsDatabase = loadRealMobsDatabase();
    return {
        harvestablesDatabase: window.harvestablesDatabase,
        mobsDatabase: window.mobsDatabase,
    };
}

export {zonesDatabase as defaultZonesDatabase};

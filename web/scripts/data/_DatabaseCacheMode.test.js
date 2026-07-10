import {describe, test, expect, beforeEach, afterEach} from 'vitest';
import {ItemsDatabase} from './ItemsDatabase.js';
import {SpellsDatabase} from './SpellsDatabase.js';
import {HarvestablesDatabase} from './HarvestablesDatabase.js';
import {MobsDatabase} from './MobsDatabase.js';
import {ZonesDatabase} from './ZonesDatabase.js';
import {LocalizationDatabase} from './LocalizationDatabase.js';

// A browser still holding a `max-age=604800` entry from an older release never
// asks the server. Only a "no-cache" request cache mode revalidates a fresh entry.

const databases = [
    ['ItemsDatabase', () => new ItemsDatabase(), '/ao-bin-dumps/items.min.json'],
    ['SpellsDatabase', () => new SpellsDatabase(), '/ao-bin-dumps/spells.min.json'],
    ['HarvestablesDatabase', () => new HarvestablesDatabase(), '/ao-bin-dumps/harvestables.min.json'],
    ['MobsDatabase', () => new MobsDatabase(), '/ao-bin-dumps/mobs.min.json'],
    ['ZonesDatabase', () => new ZonesDatabase(), '/ao-bin-dumps/zones.json'],
    ['LocalizationDatabase', () => new LocalizationDatabase(), '/ao-bin-dumps/localization.json'],
];

describe('game data is fetched with a revalidating cache mode', () => {
    let originalFetch;
    let calls;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        calls = [];
        globalThis.fetch = (url, init) => {
            calls.push({url, init});
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    test.each(databases)('%s.load() passes cache: no-cache', async (_name, create, path) => {
        await create().load(path).catch(() => {
        });

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(path);
        expect(calls[0].init).toEqual({cache: 'no-cache'});
    });
});

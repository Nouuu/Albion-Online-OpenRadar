import {describe, test, expect, beforeEach, vi} from 'vitest';
import {loadFixture, normalizeParams} from '../__fixtures__/loader.js';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getJSON: vi.fn(() => ({
            e0: Array(8).fill(true),
            e1: Array(8).fill(true),
            e2: Array(8).fill(true),
            e3: Array(8).fill(true),
            e4: Array(8).fill(true),
        })),
    },
}));

const {HarvestablesHandler} = await import('./HarvestablesHandler.js');

describe('HarvestablesHandler', () => {
    let handler;

    beforeEach(() => {
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        window.harvestablesDatabase = {
            isLoaded: true,
            isValidResource: vi.fn(() => true),
            isValidResourceByTypeNumber: vi.fn(() => true),
            getResourceTypeFromTypeNumber: vi.fn((typeNumber) => {
                if (typeNumber <= 5) return 'WOOD';
                if (typeNumber <= 10) return 'ROCK';
                if (typeNumber <= 15) return 'FIBER';
                if (typeNumber <= 22) return 'HIDE';
                return 'ORE';
            }),
        };
        window.mobsDatabase = {
            isLoaded: true,
            getResourceInfo: vi.fn((mobileTypeId) => {
                if (mobileTypeId === 424 || mobileTypeId === 428) return {type: 'Hide', tier: 3};
                if (mobileTypeId === 529 || mobileTypeId === 531) return {type: 'Hide', tier: 3};
                return null;
            }),
        };
        handler = new HarvestablesHandler(null);
    });

    describe('newHarvestableObject (event 40)', () => {
        // @verified 2026-04-18: living resource (mobileTypeId=529) spawns as a Harvestable with tier, charges, position from pcap-derived fixture.
        test('pcap-derived: living hide spawn with mobileTypeId=529 adds one entry', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === 529);
            expect(msg, 'fixture should contain a living mob=529 variant').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            const list = handler.getHarvestableList();
            expect(list).toHaveLength(1);
            expect(list[0].id).toBe(p[0]);
            expect(list[0].tier).toBe(p[7]);
            expect(list[0].posX).toBe(p[8][0]);
            expect(list[0].posY).toBe(p[8][1]);
        });

        // @suspect 2026-04-18: current handler treats mobileTypeId=-1 as LIVING (isLiving check misses -1 sentinel, only guards 65535 + null). Expected STATIC. See coverage doc open suspect.
        test('pcap-derived: static spawn with mobileTypeId=-1 is currently flagged as living', async () => {
            const fx = await loadFixture('harvestables', 'single-spawn');
            const msg = fx.messages.find(m => m.parameters['6'] === -1);
            expect(msg, 'fixture should contain a -1 mobileTypeId variant').toBeDefined();
            const p = normalizeParams(msg.parameters);

            handler.newHarvestableObject(p[0], p);

            expect(window.mobsDatabase.getResourceInfo).toHaveBeenCalledWith(-1);
            expect(handler.getHarvestableList()).toHaveLength(1);
        });
    });
});

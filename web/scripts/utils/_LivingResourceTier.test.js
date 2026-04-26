import {describe, test, expect} from 'vitest';
import {getLivingHarvestTier} from './LivingResourceTier.js';

// After issue #92 fix (OFFSET=15 -> 16 in MobsDatabase + drop of `t-1` shift rule),
// `getLivingHarvestTier` is a pure passthrough of the combat tier. Upstream
// `mobs.xml` Loot.Harvestable @tier equals the Mob @tier on every living
// harvestable entry checked (cross-validated 2026-04-26 against 6469 pcap NewMob
// events and 5889 session-log events). DYNAMIC, DEAD, ROADS_VETERAN, and
// ROADS_ELITE variants all share this contract: harvest tier == combat tier.
describe('getLivingHarvestTier', () => {
    // @verified 2026-04-26: DYNAMIC variants emit the combat tier directly.
    test('DYNAMIC hide T3 returns combat tier 3', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(3);
    });
    test('DYNAMIC hide T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_DYNAMIC_HIDE_SWAMP_GIANTSNAKE', t: 5, l: 'HIDE'})).toBe(5);
    });

    // @verified 2026-04-26: DEAD-suffix variants emit the combat tier.
    test('DEAD fiber critter T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 5, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('DEAD fiber critter T6 returns combat tier 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 6, l: 'FIBER_CRITTER'})).toBe(6);
    });
    test('DEAD fiber critter T7 returns combat tier 7 (regression #92)', () => {
        expect(getLivingHarvestTier({u: 'T7_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 7, l: 'FIBER_CRITTER'})).toBe(7);
    });

    // @verified 2026-04-26: living HIDE returns combat tier with no shift.
    test('Living HIDE T1 toad returns 1', () => {
        expect(getLivingHarvestTier({u: 'T1_MOB_HIDE_SWAMP_TOAD', t: 1, l: 'HIDE'})).toBe(1);
    });
    test('Living HIDE T2 snake returns 2', () => {
        expect(getLivingHarvestTier({u: 'T2_MOB_HIDE_SWAMP_SNAKE', t: 2, l: 'HIDE'})).toBe(2);
    });
    test('Living HIDE T5 mists owl returns 5 (cross-validated wire 374 hp=1094)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_HIDE_MISTS_OWL', t: 5, l: 'HIDE'})).toBe(5);
    });
    test('Living HIDE T6 mists hound returns 6 (cross-validated wire 375 hp=1180)', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_HIDE_MISTS_HOUND', t: 6, l: 'HIDE'})).toBe(6);
    });
    test('Living HIDE T7 direbear returns 7', () => {
        expect(getLivingHarvestTier({u: 'T7_MOB_HIDE_MISTS_DIREBEAR', t: 7, l: 'HIDE'})).toBe(7);
    });

    // @verified 2026-04-26: living FIBER_CRITTER returns combat tier with no shift.
    test('Living FIBER_CRITTER T3 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_CRITTER_FIBER_SWAMP_GREEN', t: 3, l: 'FIBER_CRITTER'})).toBe(3);
    });
    test('Living FIBER_CRITTER T5 returns 5 (regression #92, wire 526 hp=1367)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER', t: 5, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('Living FIBER_CRITTER T7 returns 7 (regression #92)', () => {
        expect(getLivingHarvestTier({u: 'T7_MOB_CRITTER_FIBER', t: 7, l: 'FIBER_CRITTER'})).toBe(7);
    });

    // @verified 2026-04-26: HIDE_CRITTER and HIDE_CRITTER_ROADS return combat tier.
    test('Living HIDE_CRITTER T5 cougar returns 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_HIDE_COUGAR', t: 5, l: 'HIDE_CRITTER'})).toBe(5);
    });
    test('Living HIDE_CRITTER_ROADS T5 mistcougar returns 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_HIDE_MISTCOUGAR', t: 5, l: 'HIDE_CRITTER_ROADS'})).toBe(5);
    });

    // @verified 2026-04-26: ROADS_VETERAN / ROADS_ELITE families (previously absent
    // from the MIN_TIER_BY_TYPE table) now resolve identically since no shift applies.
    test('Living HIDE_CRITTER_ROADS_VETERAN T6 returns 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_HIDE_MISTCOUGAR_VETERAN', t: 6, l: 'HIDE_CRITTER_ROADS_VETERAN'})).toBe(6);
    });
    test('Living HIDE_CRITTER_ROADS_ELITE T7 returns 7', () => {
        expect(getLivingHarvestTier({u: 'T7_MOB_CRITTER_HIDE_MISTCOUGAR_ELITE', t: 7, l: 'HIDE_CRITTER_ROADS_ELITE'})).toBe(7);
    });
    test('Living FIBER_CRITTER_ROADS_VETERAN T8 returns 8', () => {
        expect(getLivingHarvestTier({u: 'T8_MOB_CRITTER_FIBER_ROADS_VETERAN', t: 8, l: 'FIBER_CRITTER_ROADS_VETERAN'})).toBe(8);
    });

    // @verified 2026-04-26: WOOD/ROCK/ORE families.
    test('Living WOOD_CRITTER T4 returns 4', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_WOOD_MISTS_RED', t: 4, l: 'WOOD_CRITTER'})).toBe(4);
    });
    test('Living ROCK_CRITTER T6 returns 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_ROCK_MISTS_GREEN', t: 6, l: 'ROCK_CRITTER'})).toBe(6);
    });
    test('Living ORE_CRITTER T7 returns 7', () => {
        expect(getLivingHarvestTier({u: 'T7_MOB_CRITTER_ORE_MISTS_GREEN', t: 7, l: 'ORE_CRITTER'})).toBe(7);
    });

    // Edge cases.
    test('null mob returns 0', () => {
        expect(getLivingHarvestTier(null)).toBe(0);
    });
    test('undefined mob returns 0', () => {
        expect(getLivingHarvestTier(undefined)).toBe(0);
    });
    test('mob without tier field returns 0', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_BOSS_UNDEAD'})).toBe(0);
    });
});

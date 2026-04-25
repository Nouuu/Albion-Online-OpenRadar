import {describe, test, expect} from 'vitest';
import {getLivingHarvestTier} from './LivingResourceTier.js';

describe('getLivingHarvestTier', () => {
    // DYNAMIC variants: no tier shift, template tier preserved
    test('DYNAMIC hide T3 returns combat tier 3', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_DYNAMIC_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(3);
    });
    test('DYNAMIC hide T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_DYNAMIC_HIDE_SWAMP_GIANTSNAKE', t: 5, l: 'HIDE'})).toBe(5);
    });

    // DEAD variants: no tier shift, template tier preserved
    test('DEAD fiber critter T5 returns combat tier 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 5, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('DEAD fiber critter T6 returns combat tier 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_FIBER_SWAMP_DEAD', t: 6, l: 'FIBER_CRITTER'})).toBe(6);
    });

    // Living HIDE (floor=1): -1 shift
    test('Living HIDE T2 snake returns 1 (floor=1, 2-1=1)', () => {
        expect(getLivingHarvestTier({u: 'T2_MOB_HIDE_SWAMP_SNAKE', t: 2, l: 'HIDE'})).toBe(1);
    });
    test('Living HIDE T3 gianttoad returns 2', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(2);
    });
    test('Living HIDE T5 mists owl returns 4', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_HIDE_MISTS_OWL', t: 5, l: 'HIDE'})).toBe(4);
    });
    test('Living HIDE T6 mists hound returns 5', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_HIDE_MISTS_HOUND', t: 6, l: 'HIDE'})).toBe(5);
    });

    // Living FIBER_CRITTER (floor=3): -1 shift, floor engages at T3
    test('Living FIBER_CRITTER T3 red returns 3 (floor engages: max(3, 2) = 3)', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_CRITTER_FIBER_SWAMP_RED', t: 3, l: 'FIBER_CRITTER'})).toBe(3);
    });
    test('Living FIBER_CRITTER T4 green returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_FIBER_SWAMP_GREEN', t: 4, l: 'FIBER_CRITTER'})).toBe(3);
    });
    test('Living FIBER_CRITTER T5 red returns 4', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_RED', t: 5, l: 'FIBER_CRITTER'})).toBe(4);
    });

    // Living HIDE_CRITTER_ROADS (floor=4)
    test('Living HIDE_CRITTER_ROADS T5 mistcougar returns 4 (floor engages)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_HIDE_MISTCOUGAR', t: 5, l: 'HIDE_CRITTER_ROADS'})).toBe(4);
    });
    test('Living HIDE_CRITTER_ROADS T6 mistcougar returns 5', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_HIDE_MISTCOUGAR', t: 6, l: 'HIDE_CRITTER_ROADS'})).toBe(5);
    });

    // Other families (spot checks, extrapolation validation)
    test('Living WOOD_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_WOOD_MISTS_RED', t: 4, l: 'WOOD_CRITTER'})).toBe(3);
    });
    test('Living ROCK_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ROCK_MISTS_RED', t: 4, l: 'ROCK_CRITTER'})).toBe(3);
    });
    test('Living ORE_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ORE_MISTS_RED', t: 4, l: 'ORE_CRITTER'})).toBe(3);
    });

    // Edge cases
    test('mob without Loot.Harvestable.@type returns combat tier (no shift)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_BOSS_UNDEAD', t: 5})).toBe(5);
    });
    test('null mob returns 0', () => {
        expect(getLivingHarvestTier(null)).toBe(0);
    });
    test('undefined mob returns 0', () => {
        expect(getLivingHarvestTier(undefined)).toBe(0);
    });

    // Regex boundary: DEAD must not match UNDEAD substring
    test('mob with l field and UNDEAD in uniqueName applies tier shift (not treated as DEAD)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_BOSS_UNDEAD', t: 5, l: 'HIDE'})).toBe(4);
    });
});

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

    // MISTS variants: -1 shift with family floor (user-confirmed for Hide MISTS in PR #77
    // and for Fiber MISTS T6->T5 on 2026-04-24)
    test('MISTS HIDE T5 owl returns 4 (combat 5 - 1)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_HIDE_MISTS_OWL', t: 5, l: 'HIDE'})).toBe(4);
    });
    test('MISTS HIDE T6 hound returns 5 (combat 6 - 1)', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_HIDE_MISTS_HOUND', t: 6, l: 'HIDE'})).toBe(5);
    });
    test('MISTS FIBER_CRITTER T6 green returns 5 (combat 6 - 1, floor 3)', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_FIBER_MISTS_GREEN', t: 6, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('MISTS WOOD_CRITTER T4 returns 3 (combat 4 - 1, floor 3)', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_WOOD_MISTS_RED', t: 4, l: 'WOOD_CRITTER'})).toBe(3);
    });
    test('MISTS ROCK_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ROCK_MISTS_RED', t: 4, l: 'ROCK_CRITTER'})).toBe(3);
    });
    test('MISTS ORE_CRITTER T4 returns 3', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_ORE_MISTS_RED', t: 4, l: 'ORE_CRITTER'})).toBe(3);
    });

    // Non-MISTS variants: preserve combat tier (user-confirmed 2026-04-24 on SWAMP Fiber T5->T5)
    test('SWAMP FIBER_CRITTER T4 green returns 4 (no shift, combat preserved)', () => {
        expect(getLivingHarvestTier({u: 'T4_MOB_CRITTER_FIBER_SWAMP_GREEN', t: 4, l: 'FIBER_CRITTER'})).toBe(4);
    });
    test('SWAMP FIBER_CRITTER T5 red returns 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_FIBER_SWAMP_RED', t: 5, l: 'FIBER_CRITTER'})).toBe(5);
    });
    test('SWAMP HIDE T2 snake returns 2', () => {
        expect(getLivingHarvestTier({u: 'T2_MOB_HIDE_SWAMP_SNAKE', t: 2, l: 'HIDE'})).toBe(2);
    });
    test('SWAMP HIDE T3 gianttoad returns 3', () => {
        expect(getLivingHarvestTier({u: 'T3_MOB_HIDE_SWAMP_GIANTTOAD', t: 3, l: 'HIDE'})).toBe(3);
    });

    // ROADS and other non-MISTS biomes: preserve combat tier
    test('HIDE_CRITTER_ROADS T5 mistcougar returns 5 (MISTCOUGAR substring does not match /_MISTS_/)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_HIDE_MISTCOUGAR', t: 5, l: 'HIDE_CRITTER_ROADS'})).toBe(5);
    });
    test('HIDE_CRITTER_ROADS T6 mistcougar returns 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_HIDE_MISTCOUGAR', t: 6, l: 'HIDE_CRITTER_ROADS'})).toBe(6);
    });
    test('FOREST WOOD_CRITTER T5 returns 5 (no MISTS, preserve)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_WOOD_FOREST_RED', t: 5, l: 'WOOD_CRITTER'})).toBe(5);
    });
    test('MOUNTAIN ORE_CRITTER T6 returns 6', () => {
        expect(getLivingHarvestTier({u: 'T6_MOB_CRITTER_ORE_MOUNTAIN_RED', t: 6, l: 'ORE_CRITTER'})).toBe(6);
    });
    test('HIGHLAND ROCK_CRITTER T5 returns 5', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_CRITTER_ROCK_HIGHLAND_RED', t: 5, l: 'ROCK_CRITTER'})).toBe(5);
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

    // Regex boundary: DEAD must not match UNDEAD, MISTS regex requires surrounding underscores
    test('UNDEAD boss with HIDE type preserves combat tier (no MISTS match)', () => {
        expect(getLivingHarvestTier({u: 'T5_MOB_BOSS_UNDEAD', t: 5, l: 'HIDE'})).toBe(5);
    });
});

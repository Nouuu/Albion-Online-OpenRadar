const MIN_TIER_BY_TYPE = {
    FIBER: 2,
    HIDE: 1,
    ORE: 2,
    ROCK: 1,
    WOOD: 1,
    FIBER_CRITTER: 3,
    HIDE_CRITTER: 3,
    ORE_CRITTER: 3,
    ROCK_CRITTER: 3,
    WOOD_CRITTER: 3,
    FIBER_CRITTER_ROADS: 4,
    HIDE_CRITTER_ROADS: 4,
    ORE_CRITTER_ROADS: 4,
    ROCK_CRITTER_ROADS: 4,
    WOOD_CRITTER_ROADS: 4,
};

export function getLivingHarvestTier(mob) {
    if (!mob) return 0;
    const combatTier = mob.t ?? 0;
    if (!mob.l) return combatTier;
    if (/DYNAMIC|_DEAD/.test(mob.u ?? '')) return combatTier;
    const minTier = MIN_TIER_BY_TYPE[mob.l] ?? 1;
    return Math.max(minTier, combatTier - 1);
}

// Issue #92 cross-validation (2026-04-26) confirmed that for every wire-observed
// living mob, the upstream Loot.Harvestable @tier equals the combat @tier in
// mobs.xml. The legacy `max(min_tier_floor, combat - 1)` shift was a coincidence
// compensation for the OFFSET=15 drift in MobsDatabase: under the broken offset
// the lookup landed one DB row too high, and t-1 cancelled the displacement on
// living non-DYNAMIC/non-DEAD entries while DEAD/DYNAMIC branches surfaced it.
// After OFFSET=16 (the HP-verified anchor), no shift is required: harvest tier
// is the combat tier of the resolved DB entry.
export function getLivingHarvestTier(mob) {
    return mob?.t ?? 0;
}

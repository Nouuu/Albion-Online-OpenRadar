// Upstream Loot.Harvestable @tier == Mob @tier on every living harvestable.
export function getLivingHarvestTier(mob) {
    return mob?.t ?? 0;
}

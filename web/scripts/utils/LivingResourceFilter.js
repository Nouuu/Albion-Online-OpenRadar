const LIVING_SETTINGS_KEY_BY_NAME = {
    Fiber: 'settingLivingFiberEnchants',
    Hide: 'settingLivingHideEnchants',
    Log: 'settingLivingWoodEnchants',
    Ore: 'settingLivingOreEnchants',
    Rock: 'settingLivingRockEnchants',
};

export function shouldRenderLivingResource(entity, getSetting) {
    if (!entity) return false;
    const tier = entity.tier ?? 0;
    if (tier < 1 || tier > 8) return false;
    const enchant = entity.enchantmentLevel ?? entity.charges ?? 0;
    if (enchant < 0 || enchant > 4) return false;
    const key = LIVING_SETTINGS_KEY_BY_NAME[entity.name];
    if (!key) return false;
    const settings = getSetting(key);
    return settings?.[`e${enchant}`]?.[tier - 1] === true;
}

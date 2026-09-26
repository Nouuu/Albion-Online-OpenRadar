const LIVING_SETTINGS_KEY_BY_NAME = {
    Fiber: 'settingResourcesLivingFiber',
    Hide: 'settingResourcesLivingHide',
    Log: 'settingResourcesLivingWood',
    Ore: 'settingResourcesLivingOre',
    Rock: 'settingResourcesLivingRock',
};

const STATIC_SETTINGS_KEY_BY_NAME = {
    Fiber: 'settingResourcesStaticFiber',
    Hide: 'settingResourcesStaticHide',
    Log: 'settingResourcesStaticWood',
    Ore: 'settingResourcesStaticOre',
    Rock: 'settingResourcesStaticRock',
};

function resolveSettingsCell(entity, getSetting, keyMap) {
    if (!entity) return false;
    const tier = entity.tier ?? 0;
    if (tier < 1 || tier > 8) return false;
    const enchant = entity.enchantmentLevel ?? entity.charges ?? 0;
    if (enchant < 0 || enchant > 4) return false;
    const key = keyMap[entity.name];
    if (!key) return false;
    const settings = getSetting(key);
    return settings?.[`e${enchant}`]?.[tier - 1] === true;
}

export function shouldRenderLivingResource(entity, getSetting) {
    return resolveSettingsCell(entity, getSetting, LIVING_SETTINGS_KEY_BY_NAME);
}

export function shouldRenderStaticResource(entity, getSetting) {
    return resolveSettingsCell(entity, getSetting, STATIC_SETTINGS_KEY_BY_NAME);
}

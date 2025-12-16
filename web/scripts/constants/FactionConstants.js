// Player Faction Constants - from Photon protocol Parameters[53]

export const Faction = {
    NO_PVP: 0,        // Passive (green)
    MARTLOCK: 1,      // Steppe
    LYMHURST: 2,      // Forest
    BRIDGEWATCH: 3,   // Highland
    FORT_STERLING: 4, // Mountain
    THETFORD: 5,      // Swamp
    CAERLEON: 6,      // Caerleon
    PVP: 255          // Hostile (red)
};

export const FactionNames = {
    [Faction.MARTLOCK]: 'Martlock',
    [Faction.LYMHURST]: 'Lymhurst',
    [Faction.BRIDGEWATCH]: 'Bridgewatch',
    [Faction.FORT_STERLING]: 'Fort Sterling',
    [Faction.THETFORD]: 'Thetford',
    [Faction.CAERLEON]: 'Caerleon'
};

export function isHostile(faction) {
    return faction === Faction.PVP;
}

export function isPassive(faction) {
    return faction === Faction.NO_PVP;
}

export function isFactionPlayer(faction) {
    return faction >= 1 && faction <= 6;
}

export function getFactionName(faction) {
    return FactionNames[faction] || null;
}

// City zone IDs - extracted from ao-bin-dumps/cluster/*_CTY_* files
// PvP is disabled in these zones, no hostile alerts needed
const CityZoneIds = new Set([
    '0000', '0006', '0007', '0008', '0301',
    '0360', '0361', '0362', '0363', '0364', '0365', '0366', '0367',
    '1000', '1001', '1002', '1012', '1013', '1014', '1015', '1016', '1017', '1018', '1019', '1020', '1301',
    '2000', '2003', '2004', '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2301',
    '3003', '3004', '3005', '3006', '3007', '3008', '3010', '3011', '3012', '3013', '3014', '3015', '3016', '3017', '3018', '3019', '3020', '3021', '3030', '3301',
    '4000', '4001', '4002', '4007', '4008', '4009', '4010', '4011', '4012', '4013', '4014', '4299', '4300', '4301',
    '5000', '5001', '5002', '5003'
]);

export function isCityZone(zoneId) {
    if (!zoneId) return false;
    const id = String(zoneId).split('-')[0];
    return CityZoneIds.has(id);
}
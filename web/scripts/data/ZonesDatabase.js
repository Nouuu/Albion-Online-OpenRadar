import { CATEGORIES } from "../constants/LoggerConstants.js";

export class ZonesDatabase {
  constructor() {
    this.zones = {};
    this.overrides = new Map();
    this.loaded = false;
    this.stats = {
      totalZones: 0,
      safe: 0,
      yellow: 0,
      red: 0,
      black: 0,
      loadTimeMs: 0,
    };
  }

  async load(jsonPath = "/ao-bin-dumps/zones.json") {
    const startTime = performance.now();

    try {
      window.logger?.info(CATEGORIES.SYSTEM, "ZonesDatabaseLoading", {
        path: jsonPath,
      });

      const response = await fetch(jsonPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch zones.json: ${response.status}`);
      }

      this.zones = await response.json();
      this.loaded = true;

      // Calculate stats
      for (const zone of Object.values(this.zones)) {
        this.stats.totalZones++;
        if (zone.pvpType === "safe") this.stats.safe++;
        else if (zone.pvpType === "yellow") this.stats.yellow++;
        else if (zone.pvpType === "red") this.stats.red++;
        else if (zone.pvpType === "black") this.stats.black++;
      }

      this.stats.loadTimeMs = Math.round(performance.now() - startTime);

      window.logger?.info(CATEGORIES.SYSTEM, "ZonesDatabaseLoaded", {
        totalZones: this.stats.totalZones,
        safe: this.stats.safe,
        yellow: this.stats.yellow,
        red: this.stats.red,
        black: this.stats.black,
        loadTimeMs: this.stats.loadTimeMs,
      });
    } catch (error) {
      window.logger?.error(CATEGORIES.SYSTEM, "ZonesDatabaseLoadError", {
        error: error.message,
        stack: error.stack,
        path: jsonPath,
      });
      throw error;
    }
  }

  getZone(zoneId) {
    if (!zoneId) return null;
    const id = String(zoneId);
    if (this.overrides.has(id)) return this.overrides.get(id);
    // Try exact match first (handles TNL-XXX, YOURNAME-HIDEOUT, etc.)
    let raw = this.zones[id];
    if (!raw) {
      // Fallback: try base ID for compound numeric IDs like "1234-5"
      const baseId = id.split("-")[0];
      raw = this.zones[baseId] || null;
    }
    return this._applyAvalonRoadsRule(raw);
  }

  // Roads of Avalon are full-loot PvP regardless of origin. zones.json tags TUNNEL_ROYAL
  // and TUNNEL_ROYAL_RED as safe/red, overridden here.
  _applyAvalonRoadsRule(zone) {
    if (!zone) return null;
    if (zone.type === "TUNNEL_ROYAL" || zone.type === "TUNNEL_ROYAL_RED") {
      return { ...zone, pvpType: "black" };
    }
    return zone;
  }

  setMistOverride(mistMapId, originZoneId, forcedPvpType) {
    const origin = this.getZone(originZoneId);
    if (!origin) {
      window.logger?.warn(CATEGORIES.MAP, "MistOverrideUnknownOrigin", {
        mistMapId,
        originZoneId,
      });
      return false;
    }
    const isAbbey = String(mistMapId).startsWith("@MISTSDUNGEON@");
    // Red zones are lethal full-loot; Mists entered from them are lethal black, not red.
    const inheritedPvpType = origin.pvpType === "red" ? "black" : origin.pvpType;
    this.overrides.set(String(mistMapId), {
      name: isAbbey ? `Knightfall Abbey (Mist of ${origin.name})` : `Mist of ${origin.name}`,
      type: "MISTS",
      pvpType: forcedPvpType || inheritedPvpType,
      tier: 0,
      file: origin.file,
      size: origin.size,
      originZoneId: String(originZoneId),
    });
    return true;
  }

  clearMistOverride(mapId) {
    this.overrides.delete(String(mapId));
  }

  clearAllMistOverrides() {
    this.overrides.clear();
  }

  getPvpType(zoneId) {
    return this.getZone(zoneId)?.pvpType || "safe";
  }

  isBlackZone(zoneId) {
    return this.getPvpType(zoneId) === "black";
  }

  isRedZone(zoneId) {
    return this.getPvpType(zoneId) === "red";
  }

  isYellowZone(zoneId) {
    return this.getPvpType(zoneId) === "yellow";
  }

  isSafeZone(zoneId) {
    return this.getPvpType(zoneId) === "safe";
  }

  isDangerousZone(zoneId) {
    const pvp = this.getPvpType(zoneId);
    return pvp === "black" || pvp === "red";
  }

  getZoneName(zoneId) {
    return this.getZone(zoneId)?.name || zoneId;
  }

  getZoneTier(zoneId) {
    return this.getZone(zoneId)?.tier || 0;
  }

  getZoneFile(zoneId) {
    return this.getZone(zoneId)?.file || null;
  }

  getZoneType(zoneId) {
    return this.getZone(zoneId)?.type || "";
  }

  getZoneSize(zoneId) {
    const size = this.getZone(zoneId)?.size;
    if (
      Array.isArray(size) &&
      size.length === 2 &&
      Number.isFinite(size[0]) &&
      Number.isFinite(size[1])
    ) {
      return [size[0], size[1]];
    }
    return [825, 825];
  }
}

const zonesDatabase = new ZonesDatabase();
export default zonesDatabase;

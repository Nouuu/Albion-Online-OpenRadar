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
      bounds: origin.bounds,
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

  getMapAssetExtent(zoneId) {
    const b = this._validBounds(zoneId);
    if (!b) return 825;
    return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
  }

  getMapAssetCenter(zoneId) {
    const b = this._validBounds(zoneId);
    if (!b) return {x: 0, y: 0};
    return {x: (b.min[0] + b.max[0]) / 2, y: (b.min[1] + b.max[1]) / 2};
  }

  _validBounds(zoneId) {
    const b = this.getZone(zoneId)?.bounds;
    if (
      !b ||
      !Array.isArray(b.min) || !Array.isArray(b.max) ||
      b.min.length !== 2 || b.max.length !== 2 ||
      !Number.isFinite(b.min[0]) || !Number.isFinite(b.min[1]) ||
      !Number.isFinite(b.max[0]) || !Number.isFinite(b.max[1])
    ) {
      return null;
    }
    return b;
  }
}

const zonesDatabase = new ZonesDatabase();
export default zonesDatabase;

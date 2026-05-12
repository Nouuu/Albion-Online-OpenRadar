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
    if (this.zones[id]) return this.zones[id];
    // Fallback: try base ID for compound numeric IDs like "1234-5"
    const baseId = id.split("-")[0];
    return this.zones[baseId] || null;
  }

  setMistOverride(mistMapId, originZoneId) {
    const origin = this.getZone(originZoneId);
    if (!origin) {
      window.logger?.warn(CATEGORIES.MAP, "MistOverrideUnknownOrigin", {
        mistMapId,
        originZoneId,
      });
      return false;
    }
    this.overrides.set(String(mistMapId), {
      name: `Mist of ${origin.name}`,
      type: "MISTS",
      pvpType: origin.pvpType,
      tier: 0,
      file: origin.file,
      bounds: origin.bounds,
      asset: origin.asset,
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

  _isValidBounds(b) {
    return (
      b &&
      Array.isArray(b.min) && Array.isArray(b.max) &&
      b.min.length === 2 && b.max.length === 2 &&
      Number.isFinite(b.min[0]) && Number.isFinite(b.min[1]) &&
      Number.isFinite(b.max[0]) && Number.isFinite(b.max[1])
    );
  }

  _resolveBounds(zoneId) {
    const zone = this.getZone(zoneId);
    if (!zone) return null;
    if (this._isValidBounds(zone.asset)) return zone.asset;
    if (this._isValidBounds(zone.bounds)) return zone.bounds;
    return null;
  }

  getMapBoundsSize(zoneId) {
    const b = this._resolveBounds(zoneId);
    if (!b) return [830, 830];
    return [b.max[0] - b.min[0], b.max[1] - b.min[1]];
  }

  getMapBoundsCenter(zoneId) {
    const b = this._resolveBounds(zoneId);
    if (!b) return [0, 0];
    return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
  }
}

const zonesDatabase = new ZonesDatabase();
export default zonesDatabase;

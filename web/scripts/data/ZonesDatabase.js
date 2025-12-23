import {CATEGORIES} from '../constants/LoggerConstants.js';

export class ZonesDatabase {
    constructor() {
        this.zones = {};
        this.loaded = false;
        this.stats = {
            totalZones: 0,
            safe: 0,
            yellow: 0,
            red: 0,
            black: 0,
            loadTimeMs: 0
        };
    }

    async load(jsonPath = '/ao-bin-dumps/zones.json') {
        const startTime = performance.now();

        try {
            window.logger?.info(
                CATEGORIES.SYSTEM,
                'ZonesDatabaseLoading',
                {path: jsonPath}
            );

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch zones.json: ${response.status}`);
            }

            this.zones = await response.json();
            this.loaded = true;

            // Calculate stats
            for (const zone of Object.values(this.zones)) {
                this.stats.totalZones++;
                if (zone.pvpType === 'safe') this.stats.safe++;
                else if (zone.pvpType === 'yellow') this.stats.yellow++;
                else if (zone.pvpType === 'red') this.stats.red++;
                else if (zone.pvpType === 'black') this.stats.black++;
            }

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);

            window.logger?.info(
                CATEGORIES.SYSTEM,
                'ZonesDatabaseLoaded',
                {
                    totalZones: this.stats.totalZones,
                    safe: this.stats.safe,
                    yellow: this.stats.yellow,
                    red: this.stats.red,
                    black: this.stats.black,
                    loadTimeMs: this.stats.loadTimeMs
                }
            );

        } catch (error) {
            window.logger?.error(
                CATEGORIES.SYSTEM,
                'ZonesDatabaseLoadError',
                {
                    error: error.message,
                    stack: error.stack,
                    path: jsonPath
                }
            );
            throw error;
        }
    }

    getZone(zoneId) {
        if (!zoneId) return null;
        // Handle compound IDs like "1234-5" by taking the base ID
        const id = String(zoneId).split('-')[0];
        return this.zones[id] || null;
    }

    getPvpType(zoneId) {
        return this.getZone(zoneId)?.pvpType || 'safe';
    }

    isBlackZone(zoneId) {
        return this.getPvpType(zoneId) === 'black';
    }

    isRedZone(zoneId) {
        return this.getPvpType(zoneId) === 'red';
    }

    isYellowZone(zoneId) {
        return this.getPvpType(zoneId) === 'yellow';
    }

    isSafeZone(zoneId) {
        return this.getPvpType(zoneId) === 'safe';
    }

    isDangerousZone(zoneId) {
        const pvp = this.getPvpType(zoneId);
        return pvp === 'black' || pvp === 'red';
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
        return this.getZone(zoneId)?.type || '';
    }
}

const zonesDatabase = new ZonesDatabase();
export default zonesDatabase;

import {CATEGORIES} from "../constants/LoggerConstants.js";
import {migrateSettings} from "./SettingsMigration.js";
import {deepFreeze, registryEntry} from "./SettingsRegistry.js";

const CHANNEL_NAME = 'openradar-settings';

let migrationError = null;

const MATRIX_KEYS = ['e0', 'e1', 'e2', 'e3', 'e4'];

function isMatrix(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length === MATRIX_KEYS.length && MATRIX_KEYS.every(k =>
        Array.isArray(value[k]) && value[k].length === 8 && value[k].every(cell => typeof cell === 'boolean'));
}

function isStringList(value) {
    return Array.isArray(value) && value.every(item => typeof item === 'string');
}

const SHAPES = {matrix: isMatrix, stringList: isStringList};

export class SettingsSync {
    constructor() {
        this.channel = null;
        this.listeners = new Map();
        this.isInitialized = false;
        this.cache = new Map();
        this.jsonCache = new Map();
        this.unknownKeys = new Set();

        this._boundMessageHandler = (event) => this.handleMessage(event.data);
        this._boundStorageHandler = (event) => {
            if (!event.key) return;
            if (event.newValue === null) {
                this.handleMessage({ type: 'setting-removed', key: event.key, value: null });
            } else {
                this.handleMessage({ type: 'setting-changed', key: event.key, value: event.newValue });
            }
        };
        this._usingFallback = false;

        if (typeof BroadcastChannel !== 'undefined') {
            this.initialize();
        } else {
            this.setupFallback();
        }
    }

    initialize() {
        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);
            this.channel.addEventListener('message', this._boundMessageHandler);
            this.isInitialized = true;
        } catch (e) {
            window.logger?.info(CATEGORIES.SYSTEM, 'BroadcastChannel_Fallback', {reason: e?.message});
            this.setupFallback();
        }
    }

    setupFallback() {
        window.addEventListener('storage', this._boundStorageHandler);
        this._usingFallback = true;
        window.logger?.info(CATEGORIES.SYSTEM, 'SettingsSync_UsingStorageFallback', {});
    }

    _getCached(key) {
        if (this.cache.has(key)) return this.cache.get(key);
        const value = localStorage.getItem(key);
        this.cache.set(key, value);
        return value;
    }

    handleMessage(data) {
        if (data.type === 'setting-changed' || data.type === 'setting-removed') {
            this.jsonCache.delete(data.key);
            if (data.type === 'setting-changed') {
                this.cache.set(data.key, data.value);
            } else {
                this.cache.delete(data.key);
            }

            const listeners = this.listeners.get(data.key) || [];
            listeners.forEach(callback => {
                try { callback(data.key, data.value); } catch (error) {
                    window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncListenerError', {
                        key: data.key,
                        error: error?.message || error
                    });
                }
            });

            const wildcardListeners = this.listeners.get('*') || [];
            wildcardListeners.forEach(callback => {
                try { callback(data.key, data.value); } catch (error) {
                    window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncWildcardListenerError', {
                        key: data.key,
                        error: error?.message || error
                    });
                }
            });
        }
    }

    broadcast(key, value) {
        localStorage.setItem(key, value);

        if (this.channel && this.isInitialized) {
            try {
                this.channel.postMessage({ type: 'setting-changed', key, value, timestamp: Date.now() });
            } catch (error) {
                window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncBroadcastFailed', {
                    key,
                    error: error?.message || error
                });
            }
        }

        this.handleMessage({ type: 'setting-changed', key, value });
    }

    on(key, callback) {
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key).push(callback);
    }

    off(key, callback) {
        if (!this.listeners.has(key)) return;
        const listeners = this.listeners.get(key);
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
    }

    removeAllListeners(key) { this.listeners.delete(key); }

    read(key) {
        this._reportMigrationError();
        const entry = registryEntry(key);
        if (!entry) {
            this._reportUnknownKey(key);
            return undefined;
        }
        const raw = this._getCached(key);
        if (raw === null) return entry.default;
        switch (entry.type) {
            case 'bool':
                return raw === 'true' ? true : raw === 'false' ? false : entry.default;
            case 'int':
            case 'float': {
                const parsed = entry.type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
                if (!Number.isFinite(parsed)) return entry.default;
                return Math.min(entry.max, Math.max(entry.min, parsed));
            }
            case 'enum': {
                const match = entry.values.find(v => typeof v === 'number' ? raw.trim() !== '' && Number(raw) === v : v === raw);
                return match === undefined ? entry.default : match;
            }
            default:
                return this._readJSON(key, entry, raw);
        }
    }

    _readJSON(key, entry, raw) {
        if (this.jsonCache.has(key)) return this.jsonCache.get(key);
        let value = entry.default;
        try {
            const parsed = JSON.parse(raw);
            if (SHAPES[entry.shape](parsed)) value = deepFreeze(parsed);
        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncJSONParseFailed', {
                key,
                error: error?.message || error
            });
        }
        this.jsonCache.set(key, value);
        return value;
    }

    _reportUnknownKey(key) {
        if (!window.logger || this.unknownKeys.has(key)) return;
        this.unknownKeys.add(key);
        window.logger.error(CATEGORIES.SYSTEM, 'SettingsSyncUnknownKey', {key});
    }

    _reportMigrationError() {
        if (!migrationError || !window.logger) return;
        const error = migrationError;
        migrationError = null;
        window.logger.error(CATEGORIES.SYSTEM, 'SettingsMigrationFailed', {error: error?.message || error});
    }

    get(key) { return this.read(key); }

    set(key, value) { this.broadcast(key, value); }

    getBool(key) { return this.read(key) ?? false; }

    setBool(key, value) { this.broadcast(key, value.toString()); }

    getNumber(key) { return this.read(key); }

    setNumber(key, value) { this.broadcast(key, value.toString()); }

    getFloat(key) { return this.read(key); }

    setFloat(key, value) { this.broadcast(key, value.toString()); }

    getJSON(key) { return this.read(key); }

    setJSON(key, value) {
        try { this.broadcast(key, JSON.stringify(value)); } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncJSONStringifyFailed', {
                key,
                error: error?.message || error
            });
        }
    }

    remove(key) {
        localStorage.removeItem(key);

        if (this.channel && this.isInitialized) {
            try {
                this.channel.postMessage({ type: 'setting-removed', key, timestamp: Date.now() });
            } catch (error) {
                window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncRemoveFailed', {
                    key,
                    error: error?.message || error
                });
            }
        }

        this.handleMessage({ type: 'setting-removed', key, value: null });
    }

    destroy() {
        if (this.channel) {
            this.channel.removeEventListener('message', this._boundMessageHandler);
            this.channel.close();
            this.channel = null;
        }
        if (this._usingFallback) {
            window.removeEventListener('storage', this._boundStorageHandler);
        }
        this.listeners.clear();
        this.cache.clear();
        this.jsonCache.clear();
        this.isInitialized = false;
    }
}

let settingsSyncInstance = null;

export function getSettingsSync() {
    if (!settingsSyncInstance) {
        try { migrateSettings(localStorage); } catch (error) { migrationError = error; }
        settingsSyncInstance = new SettingsSync();
        window.addEventListener('beforeunload', () => {
            if (settingsSyncInstance) settingsSyncInstance.destroy();
        });
    }
    return settingsSyncInstance;
}

export default getSettingsSync();

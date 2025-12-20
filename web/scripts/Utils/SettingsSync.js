import {CATEGORIES} from "../constants/LoggerConstants.js";

const CHANNEL_NAME = 'openradar-settings';

export class SettingsSync {
    constructor() {
        this.channel = null;
        this.listeners = new Map();
        this.isInitialized = false;
        this.cache = new Map();

        this._boundMessageHandler = (event) => this.handleMessage(event.data);
        this._boundStorageHandler = (event) => {
            if (event.key && event.newValue !== null) {
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
        } catch {
            this.setupFallback();
        }
    }

    setupFallback() {
        window.addEventListener('storage', this._boundStorageHandler);
        this._usingFallback = true;
    }

    _getCached(key) {
        if (this.cache.has(key)) return this.cache.get(key);
        const value = localStorage.getItem(key);
        this.cache.set(key, value);
        return value;
    }

    handleMessage(data) {
        if (data.type === 'setting-changed' || data.type === 'setting-removed') {
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

    get(key, defaultValue = null) {
        const value = this._getCached(key);
        return value !== null ? value : defaultValue;
    }

    set(key, value) { this.broadcast(key, value); }

    getBool(key, defaultValue = false) {
        const value = this._getCached(key);
        if (value === null) return defaultValue;
        return value === 'true';
    }

    setBool(key, value) { this.broadcast(key, value.toString()); }

    getNumber(key, defaultValue = 0) {
        const value = this._getCached(key);
        if (value === null || value === '') return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    setNumber(key, value) { this.broadcast(key, value.toString()); }

    getFloat(key, defaultValue = 0) {
        const value = this._getCached(key);
        if (value === null || value === '') return defaultValue;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    setFloat(key, value) { this.broadcast(key, value.toString()); }

    getJSON(key, defaultValue = null) {
        const value = this._getCached(key);
        if (value === null || value === '') return defaultValue;
        try { return JSON.parse(value); }
        catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'SettingsSyncJSONParseFailed', {
                key,
                error: error?.message || error
            });
            return defaultValue;
        }
    }

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
        this.isInitialized = false;
    }
}

let settingsSyncInstance = null;

export function getSettingsSync() {
    if (!settingsSyncInstance) {
        settingsSyncInstance = new SettingsSync();
        window.addEventListener('beforeunload', () => {
            if (settingsSyncInstance) settingsSyncInstance.destroy();
        });
    }
    return settingsSyncInstance;
}

export default getSettingsSync();

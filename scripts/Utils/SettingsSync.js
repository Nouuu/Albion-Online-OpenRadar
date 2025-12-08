/**
 * SettingsSync.js
 *
 * Event-driven settings synchronization between main radar and overlay using BroadcastChannel API.
 * Replaces the old 300ms localStorage polling with instant cross-tab communication.
 *
 * Features:
 * - Real-time settings sync between windows
 * - No polling overhead
 * - Backward compatible with localStorage
 * - Automatic cleanup on window unload
 */
import {CATEGORIES} from "../constants/LoggerConstants.js";

const CHANNEL_NAME = 'openradar-settings';

export class SettingsSync {
    constructor() {
        this.channel = null;
        this.listeners = new Map();
        this.isInitialized = false;
        this.cache = new Map(); // 🆕 Cache mémoire pour éviter lectures localStorage répétées

        // Check BroadcastChannel support
        if (typeof BroadcastChannel !== 'undefined') {
            this.initialize();
        } else {
            window.logger?.warn(CATEGORIES.SETTINGS, 'BroadcastChannelNotSupported', { fallback: 'localStorage storage events' });
            this.setupFallback();
        }
    }

    /**
     * Initialize BroadcastChannel for cross-tab communication
     */
    initialize() {
        try {
            this.channel = new BroadcastChannel(CHANNEL_NAME);

            this.channel.addEventListener('message', (event) => {
                this.handleMessage(event.data);
            });

            this.isInitialized = true;
            window.logger?.info(CATEGORIES.SETTINGS, 'SettingsSyncInitialized', { channelName: CHANNEL_NAME });
        } catch (error) {
            window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncInitializeFailed', { error: error?.message || error });
            this.setupFallback();
        }
    }

    /**
     * Fallback to storage events for browsers without BroadcastChannel
     */
    setupFallback() {
        window.addEventListener('storage', (event) => {
            if (event.key && event.newValue !== null) {
                this.handleMessage({
                    type: 'setting-changed',
                    key: event.key,
                    value: event.newValue
                });
            }
        });
        window.logger?.info(CATEGORIES.SETTINGS, 'SettingsSyncFallbackEnabled', { method: 'localStorage storage events' });
    }

    /**
     * Internal method to read from cache or localStorage
     * @param {string} key - Setting key
     * @returns {string|null}
     */
    _getCached(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const value = localStorage.getItem(key);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Handle incoming messages from BroadcastChannel
     * @param {Object} data - Message data
     */
    handleMessage(data) {
        if (data.type === 'setting-changed' || data.type === 'setting-removed') {
            // 🆕 Update cache from other tabs
            if (data.type === 'setting-changed') {
                this.cache.set(data.key, data.value);
            } else {
                this.cache.delete(data.key);
            }

            // Notify all registered listeners
            const listeners = this.listeners.get(data.key) || [];
            listeners.forEach(callback => {
                try {
                    callback(data.key, data.value);
                } catch (error) {
                    window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncListenerError', { key: data.key, error: error?.message || error });
                }
            });

            // Notify wildcard listeners (listen to all changes)
            const wildcardListeners = this.listeners.get('*') || [];
            wildcardListeners.forEach(callback => {
                try {
                    callback(data.key, data.value);
                } catch (error) {
                    window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncWildcardListenerError', { key: data.key, error: error?.message || error });
                }
            });
        }
    }

    /**
     * Broadcast a setting change to all tabs/windows
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     */
    broadcast(key, value) {
        // Update localStorage first (persistence)
        localStorage.setItem(key, value);

        // Broadcast to other tabs/windows
        if (this.channel && this.isInitialized) {
            try {
                this.channel.postMessage({
                    type: 'setting-changed',
                    key: key,
                    value: value,
                    timestamp: Date.now()
                });
            } catch (error) {
                window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncBroadcastFailed', { key, error: error?.message || error });
            }
        }

        // Trigger local listeners immediately (same-page updates)
        this.handleMessage({
            type: 'setting-changed',
            key: key,
            value: value
        });
    }

    /**
     * Register a listener for a specific setting key
     * @param {string} key - Setting key to listen to (use '*' for all keys)
     * @param {Function} callback - Callback function (key, value) => {}
     */
    on(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * Remove a listener
     * @param {string} key - Setting key
     * @param {Function} callback - Callback function to remove
     */
    off(key, callback) {
        if (!this.listeners.has(key)) return;

        const listeners = this.listeners.get(key);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Remove all listeners for a specific key
     * @param {string} key - Setting key
     */
    removeAllListeners(key) {
        this.listeners.delete(key);
    }

    /**
     * Get a setting value (cached)
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if not found
     * @returns {any}
     */
    get(key, defaultValue = null) {
        const value = this._getCached(key);
        return value !== null ? value : defaultValue;
    }

    /**
     * Set a setting value and broadcast it
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     */
    set(key, value) {
        this.broadcast(key, value);
    }

    /**
     * Get a boolean setting (cached)
     * @param {string} key - Setting key
     * @param {boolean} defaultValue - Default value if not found
     * @returns {boolean}
     */
    getBool(key, defaultValue = false) {
        const value = this._getCached(key);
        if (value === null) {
            return defaultValue;
        }
        return value === 'true';
    }

    /**
     * Set a boolean setting and broadcast it
     * @param {string} key - Setting key
     * @param {boolean} value - Boolean value
     */
    setBool(key, value) {
        this.broadcast(key, value.toString());
    }

    /**
     * Get a numeric setting (cached)
     * @param {string} key - Setting key
     * @param {number} defaultValue - Default value if not found or invalid
     * @returns {number}
     */
    getNumber(key, defaultValue = 0) {
        const value = this._getCached(key);
        if (value === null || value === '') {
            return defaultValue;
        }
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * Set a numeric setting and broadcast it
     * @param {string} key - Setting key
     * @param {number} value - Numeric value
     */
    setNumber(key, value) {
        this.broadcast(key, value.toString());
    }

    /**
     * Get a JSON setting (cached)
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if not found or parse error
     * @returns {any}
     */
    getJSON(key, defaultValue = null) {
        const value = this._getCached(key);
        if (value === null || value === '') {
            return defaultValue;
        }
        try {
            return JSON.parse(value);
        } catch (error) {
            window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncJSONParseFailed', {
                key,
                error: error?.message || error
            });
            return defaultValue;
        }
    }

    /**
     * Set a JSON setting and broadcast it
     * @param {string} key - Setting key
     * @param {any} value - Value to JSON.stringify
     */
    setJSON(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            this.broadcast(key, jsonString);
        } catch (error) {
            window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncJSONStringifyFailed', {
                key,
                error: error?.message || error
            });
        }
    }

    /**
     * Remove a setting and broadcast the deletion
     * @param {string} key - Setting key to remove
     */
    remove(key) {
        localStorage.removeItem(key);

        // Broadcast deletion
        if (this.channel && this.isInitialized) {
            try {
                this.channel.postMessage({
                    type: 'setting-removed',
                    key: key,
                    timestamp: Date.now()
                });
            } catch (error) {
                window.logger?.error(CATEGORIES.SETTINGS, 'SettingsSyncRemoveFailed', {
                    key,
                    error: error?.message || error
                });
            }
        }

        // Trigger local listeners
        this.handleMessage({
            type: 'setting-removed',
            key: key,
            value: null
        });
    }

    /**
     * Cleanup - close BroadcastChannel and clear cache
     */
    destroy() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.listeners.clear();
        this.cache.clear(); // 🆕 Clear cache on destroy
        this.isInitialized = false;
        window.logger?.info(CATEGORIES.SETTINGS, 'SettingsSyncDestroyed', {});
    }
}

// Create singleton instance
let settingsSyncInstance = null;

/**
 * Get or create the SettingsSync singleton instance
 * @returns {SettingsSync}
 */
export function getSettingsSync() {
    if (!settingsSyncInstance) {
        settingsSyncInstance = new SettingsSync();

        // Auto-cleanup on window unload
        window.addEventListener('beforeunload', () => {
            if (settingsSyncInstance) {
                settingsSyncInstance.destroy();
            }
        });
    }
    return settingsSyncInstance;
}

// Export default instance
export default getSettingsSync();
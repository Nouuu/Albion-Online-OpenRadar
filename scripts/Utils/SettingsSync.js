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
     * Handle incoming messages from BroadcastChannel
     * @param {Object} data - Message data
     */
    handleMessage(data) {
        if (data.type === 'setting-changed') {
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
     * Get a setting value from localStorage
     * @param {string} key - Setting key
     * @param {any} defaultValue - Default value if not found
     * @returns {any}
     */
    get(key, defaultValue = null) {
        const value = localStorage.getItem(key);
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
     * Get a boolean setting from localStorage
     * @param {string} key - Setting key
     * @param {boolean} defaultValue - Default value if not found
     * @returns {boolean}
     */
    getBool(key, defaultValue = false) {
        const value = localStorage.getItem(key);
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
     * Cleanup - close BroadcastChannel
     */
    destroy() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.listeners.clear();
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
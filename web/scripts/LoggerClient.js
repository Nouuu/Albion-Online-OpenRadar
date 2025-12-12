// LoggerClient.js - Global logger initialization for all pages
// This file is loaded as ES module in layout.ejs to make logger available everywhere

import {CATEGORY_SETTINGS_MAP} from './constants/LoggerConstants.js';
import settingsSync from './Utils/SettingsSync.js';

console.log('🔧 [LoggerClient] Script loaded, initializing logger immediately...');

let socket = null;
let socketConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max delay
const INITIAL_RECONNECT_DELAY = 1000; // 1 second initial delay

// Create Logger class (works with or without WebSocket)
class Logger {
    constructor() {
        this.wsClient = null; // Will be set later when socket connects
        this.buffer = [];
        this.sessionId = this.generateSessionId();
        // Performance optimization: smaller buffer, faster flush
        this.maxBufferSize = 200;    // Reduced from 1000 to save memory
        this.flushInterval = 5000;   // Reduced from 5000ms to 1000ms

        this.startFlushInterval();
        console.log(`📊 [Logger] Initialized with sessionId: ${this.sessionId}`);
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    startFlushInterval() {
        setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }

    /**
     * Centralized filtering: checks if a log should be displayed
     * INFO/WARN/ERROR/CRITICAL are always logged
     * DEBUG logs are filtered based on category → setting mapping
     */
    shouldLog(category, level) {
        // INFO/WARN/ERROR/CRITICAL always logged
        if (level !== 'DEBUG') {
            return true;
        }

        // DEBUG logs filtered by settings
        const settingKey = CATEGORY_SETTINGS_MAP?.[category];

        // No setting = always log (e.g., WEBSOCKET, CACHE, etc.)
        if (!settingKey) {
            return true;
        }

        // Special handling for RAW packets
        if (settingKey === 'debugRawPackets') {
            const consoleEnabled = settingsSync.getBool('settingDebugRawPacketsConsole');
            const serverEnabled = settingsSync.getBool('settingDebugRawPacketsServer');
            return consoleEnabled || serverEnabled;
        }

        // Check the corresponding debug setting
        const localStorageKey = 'setting' + settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
        return settingsSync.getBool(localStorageKey);
    }

    log(level, category, event, data, context = {}) {
        // ⚡ Centralized filtering - exit early if not needed
        if (!this.shouldLog(category, level)) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category: `[CLIENT] ${category}`, // Prefix all client logs with [CLIENT]
            event,
            data,
            context: {
                ...context,
                sessionId: this.sessionId,
                page: window.location.pathname
            }
        };

        // 📺 Always log to console if enabled in settings
        const logToConsole = settingsSync.getBool('settingLogToConsole');
        if (logToConsole) {
            this.logToConsole(logEntry);
        }

        // 📤 Buffer for server if enabled in settings AND connected
        const logToServer = settingsSync.getBool('settingLogToServer');
        const debugRawPacketsServer = settingsSync.getBool('settingDebugRawPacketsServer');

        // Skip RAW packets for server if disabled
        if (logEntry.category === '[CLIENT] PACKET_RAW' && !debugRawPacketsServer) {
            return; // Skip server logging for RAW packets
        }

        if (logToServer && socketConnected) {
            this.buffer.push(logEntry);

            if (this.buffer.length >= this.maxBufferSize) {
                this.flush();
            }
        }
    }

    logToConsole(entry) {
        // Skip RAW packets in console if disabled
        const showRawPacketsConsole = settingsSync.getBool('settingDebugRawPacketsConsole');
        if (entry.category === '[CLIENT] PACKET_RAW' && !showRawPacketsConsole) {
            return; // Skip console display for RAW packets
        }

        const emoji = {
            'DEBUG': '🔍',
            'INFO': 'ℹ️',
            'WARN': '⚠️',
            'ERROR': '❌',
            'CRITICAL': '🚨'
        }[entry.level] || '📝';

        const color = {
            'DEBUG': 'color: #888',
            'INFO': 'color: #0af',
            'WARN': 'color: #fa0',
            'ERROR': 'color: #f00',
            'CRITICAL': 'color: #f0f; font-weight: bold'
        }[entry.level] || 'color: #000';

        const time = new Date(entry.timestamp).toLocaleTimeString('en-GB');
        console.log(
            `%c${emoji} [${entry.level}] ${entry.category}.${entry.event} @ ${time}`,
            color,
            entry.data,
            entry.context.page ? `(page: ${entry.context.page})` : ''
        );
    }

    debug(category, event, data, context) {
        this.log('DEBUG', category, event, data, context);
    }

    info(category, event, data, context) {
        this.log('INFO', category, event, data, context);
    }

    warn(category, event, data, context) {
        this.log('WARN', category, event, data, context);
    }

    error(category, event, data, context) {
        this.log('ERROR', category, event, data, context);
    }

    critical(category, event, data, context) {
        this.log('CRITICAL', category, event, data, context);
    }

    flush() {
        if (this.buffer.length === 0) return;

        if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
            try {
                this.wsClient.send(JSON.stringify({
                    type: 'logs',
                    logs: this.buffer
                }));
                console.log(`📤 [Logger] Flushed ${this.buffer.length} logs to server`);
                this.buffer = [];
            } catch (error) {
                console.error('❌ [Logger] Error flushing logs:', error);
                this.buffer = []; // Discard on error
            }
        } else {
            // Not connected, just discard buffered logs
            this.buffer = [];
        }
    }
}

// ✨ IMMEDIATE INITIALIZATION - Before any other module runs
const globalLogger = new Logger();
window.logger = globalLogger;
console.log('✅ [LoggerClient] Logger initialized and exposed as window.logger');

// 🔄 WebSocket connection with auto-reconnect
function connectLoggerWebSocket() {
    // Close existing socket if any
    if (socket) {
        socket.close();
    }

    console.log('🔌 [LoggerClient] Connecting to WebSocket...');

    try {
        socket = new WebSocket('ws://localhost:5001/ws');

        socket.addEventListener('open', () => {
            reconnectAttempts = 0; // Reset counter on successful connection
            console.log('✅ [LoggerClient] WebSocket connected successfully');
            socketConnected = true;
            globalLogger.wsClient = socket; // Attach socket to logger
        });

        socket.addEventListener('close', () => {
            console.warn('⚠️ [LoggerClient] WebSocket disconnected, will attempt to reconnect...');
            socketConnected = false;
            globalLogger.wsClient = null;
            scheduleLoggerReconnect();
        });

        socket.addEventListener('error', (error) => {
            console.error('❌ [LoggerClient] WebSocket error:', error);
            socketConnected = false;
        });
    } catch (e) {
        console.warn('📡 [LoggerClient] Failed to connect WebSocket - will retry');
        console.warn(e);
        scheduleLoggerReconnect();
    }
}

function scheduleLoggerReconnect() {
    reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
    const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
        MAX_RECONNECT_DELAY
    );

    console.log(`🔄 [LoggerClient] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);

    setTimeout(() => {
        connectLoggerWebSocket();
    }, delay);
}

// ✨ DEFERRED WebSocket connection - After DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 [LoggerClient] DOM ready, connecting WebSocket...');
    connectLoggerWebSocket();
});

// LoggerClient.js - Global logger initialization for all pages

import {CATEGORY_SETTINGS_MAP} from './constants/LoggerConstants.js';
import settingsSync from './Utils/SettingsSync.js';

console.log('🔧 [LoggerClient] Script loaded');

let socket = null;
let socketConnected = false;
let reconnectAttempts = 0;
let reconnectTimeoutId = null;
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

class Logger {
    constructor() {
        this.wsClient = null;
        this.buffer = [];
        this.sessionId = this.generateSessionId();
        this.maxBufferSize = 200;
        this.flushIntervalMs = 5000;
        this.flushIntervalId = null;

        this.startFlushInterval();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    startFlushInterval() {
        if (this.flushIntervalId) clearInterval(this.flushIntervalId);
        this.flushIntervalId = setInterval(() => this.flush(), this.flushIntervalMs);
    }

    stopFlushInterval() {
        if (this.flushIntervalId) {
            clearInterval(this.flushIntervalId);
            this.flushIntervalId = null;
        }
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

// Named handlers for cleanup
function onLoggerSocketOpen() {
    reconnectAttempts = 0;
    socketConnected = true;
    globalLogger.wsClient = socket;
    console.log('✅ [LoggerClient] WebSocket connected');
}

function onLoggerSocketClose() {
    socketConnected = false;
    globalLogger.wsClient = null;
    scheduleLoggerReconnect();
}

function onLoggerSocketError() {
    socketConnected = false;
}

function cleanupLoggerSocket() {
    if (socket) {
        socket.removeEventListener('open', onLoggerSocketOpen);
        socket.removeEventListener('close', onLoggerSocketClose);
        socket.removeEventListener('error', onLoggerSocketError);
        socket.close();
        socket = null;
    }
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
    }
}

function connectLoggerWebSocket() {
    cleanupLoggerSocket();

    try {
        socket = new WebSocket('ws://localhost:5001/ws');
        socket.addEventListener('open', onLoggerSocketOpen);
        socket.addEventListener('close', onLoggerSocketClose);
        socket.addEventListener('error', onLoggerSocketError);
    } catch (e) {
        console.warn('📡 [LoggerClient] Failed to connect WebSocket');
        scheduleLoggerReconnect();
    }
}

function scheduleLoggerReconnect() {
    reconnectAttempts++;
    const delay = Math.min(
        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
        MAX_RECONNECT_DELAY
    );
    reconnectTimeoutId = setTimeout(connectLoggerWebSocket, delay);
}

// Connect when DOM is ready
document.addEventListener('DOMContentLoaded', connectLoggerWebSocket);

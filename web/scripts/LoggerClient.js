import {CATEGORY_SETTINGS_MAP} from './constants/LoggerConstants.js';
import settingsSync from './Utils/SettingsSync.js';

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
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.maxBufferSize = 200;
        this.flushIntervalMs = 5000;
        this.flushIntervalId = null;
        this.startFlushInterval();
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

    shouldLog(category, level) {
        if (level !== 'DEBUG') return true;

        const settingKey = CATEGORY_SETTINGS_MAP?.[category];
        if (!settingKey) return true;

        if (settingKey === 'debugRawPackets') {
            return settingsSync.getBool('settingDebugRawPacketsConsole') ||
                   settingsSync.getBool('settingDebugRawPacketsServer');
        }

        const localStorageKey = 'setting' + settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
        return settingsSync.getBool(localStorageKey);
    }

    log(level, category, event, data, context = {}) {
        if (!this.shouldLog(category, level)) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category: `[CLIENT] ${category}`,
            event,
            data,
            context: { ...context, sessionId: this.sessionId, page: window.location.pathname }
        };

        if (settingsSync.getBool('settingLogToConsole')) {
            this.logToConsole(logEntry);
        }

        const logToServer = settingsSync.getBool('settingLogToServer');
        const debugRawPacketsServer = settingsSync.getBool('settingDebugRawPacketsServer');

        if (logEntry.category === '[CLIENT] PACKET_RAW' && !debugRawPacketsServer) return;

        if (logToServer && socketConnected) {
            this.buffer.push(logEntry);
            if (this.buffer.length >= this.maxBufferSize) this.flush();
        }
    }

    logToConsole(entry) {
        if (entry.category === '[CLIENT] PACKET_RAW' && !settingsSync.getBool('settingDebugRawPacketsConsole')) return;

        const emoji = { 'DEBUG': '🔍', 'INFO': 'ℹ️', 'WARN': '⚠️', 'ERROR': '❌', 'CRITICAL': '🚨' }[entry.level] || '📝';
        const color = {
            'DEBUG': 'color: #888', 'INFO': 'color: #0af', 'WARN': 'color: #fa0',
            'ERROR': 'color: #f00', 'CRITICAL': 'color: #f0f; font-weight: bold'
        }[entry.level] || 'color: #000';

        const time = new Date(entry.timestamp).toLocaleTimeString('en-GB');
        console.log(`%c${emoji} [${entry.level}] ${entry.category}.${entry.event} @ ${time}`, color, entry.data);
    }

    debug(category, event, data, context) { this.log('DEBUG', category, event, data, context); }
    info(category, event, data, context) { this.log('INFO', category, event, data, context); }
    warn(category, event, data, context) { this.log('WARN', category, event, data, context); }
    error(category, event, data, context) { this.log('ERROR', category, event, data, context); }
    critical(category, event, data, context) { this.log('CRITICAL', category, event, data, context); }

    flush() {
        if (this.buffer.length === 0) return;

        if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
            try {
                this.wsClient.send(JSON.stringify({ type: 'logs', logs: this.buffer }));
                this.buffer = [];
                this.buffer = [];
            }
        } else {
            this.buffer = [];
        }
    }
}

const globalLogger = new Logger();
window.logger = globalLogger;

function onLoggerSocketOpen() {
    reconnectAttempts = 0;
    socketConnected = true;
    globalLogger.wsClient = socket;
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
    } catch (_e) {
        scheduleLoggerReconnect();
    }
}

function scheduleLoggerReconnect() {
    reconnectAttempts++;
    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    reconnectTimeoutId = setTimeout(connectLoggerWebSocket, delay);
}

document.addEventListener('DOMContentLoaded', connectLoggerWebSocket);

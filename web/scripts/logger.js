import {CATEGORY_SETTINGS, LOG_LEVELS} from './constants/LoggerConstants.js';
import settingsSync from './utils/SettingsSync.js';

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

    shouldLog(level, category) {
        const minLevelName = settingsSync.get('logLevel', 'WARN');
        const minLevel = LOG_LEVELS[minLevelName] ?? LOG_LEVELS.WARN;

        if (minLevel === LOG_LEVELS.OFF) return false;
        if (level === 'CRITICAL') return true;

        const currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.DEBUG;
        if (currentLevel < minLevel) return false;

        if (level === 'DEBUG' || level === 'INFO') {
            const settingKey = CATEGORY_SETTINGS[category];
            if (settingKey && !settingsSync.getBool(settingKey)) {
                return false;
            }
        }

        return true;
    }

    log(level, category, event, data = {}) {
        if (!this.shouldLog(level, category)) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            event,
            data,
            sessionId: this.sessionId,
            page: window.location.pathname
        };

        if (settingsSync.getBool('settingLogToConsole')) {
            this.logToConsole(logEntry);
        }

        if (settingsSync.getBool('settingLogToServer') && socketConnected) {
            this.buffer.push(logEntry);
            if (this.buffer.length >= this.maxBufferSize) this.flush();
        }
    }

    logToConsole(entry) {
        const emoji = {'DEBUG': '🔍', 'INFO': 'ℹ️', 'WARN': '⚠️', 'ERROR': '❌', 'CRITICAL': '🚨'}[entry.level] || '📝';
        const color = {
            'DEBUG': 'color: #888', 'INFO': 'color: #0af', 'WARN': 'color: #fa0',
            'ERROR': 'color: #f00', 'CRITICAL': 'color: #f0f; font-weight: bold'
        }[entry.level] || 'color: #000';

        const time = new Date(entry.timestamp).toLocaleTimeString('en-GB');
        console.log(`%c${emoji} [${entry.level}] ${entry.category}.${entry.event} @ ${time}`, color, entry.data);
    }

    debug(category, event, data) {
        this.log('DEBUG', category, event, data);
    }

    info(category, event, data) {
        this.log('INFO', category, event, data);
    }

    warn(category, event, data) {
        this.log('WARN', category, event, data);
    }

    error(category, event, data) {
        this.log('ERROR', category, event, data);
    }

    critical(category, event, data) {
        this.log('CRITICAL', category, event, data);
    }

    flush() {
        if (this.buffer.length === 0) return;

        if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
            try {
                this.wsClient.send(JSON.stringify({type: 'logs', logs: this.buffer}));
            } catch (e) {
                // Exception: console allowed here to avoid logger recursion
                console.warn('[Logger] WebSocket send failed:', e?.message);
            }
        }
        this.buffer = [];
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
    } catch (e) {
        // Exception: console allowed here to avoid logger recursion
        console.warn('[Logger] WebSocket connection failed:', e?.message);
        scheduleLoggerReconnect();
    }
}

function scheduleLoggerReconnect() {
    reconnectAttempts++;
    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    reconnectTimeoutId = setTimeout(connectLoggerWebSocket, delay);
}

export {globalLogger as logger};

connectLoggerWebSocket();

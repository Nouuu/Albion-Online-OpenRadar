// LoggerClient.js - Global logger initialization for all pages
// This file is loaded in layout.ejs to make logger available everywhere

console.log('🔧 [LoggerClient] Script loaded, waiting for DOM ready...');

// Logger constants are loaded from LoggerConstants.js (loaded before this file)
// Available as: window.CATEGORIES, window.EVENTS, window.CATEGORY_SETTINGS_MAP

let globalLogger = null;

// Initialize WebSocket and Logger when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 [LoggerClient] Initializing global logger...');

    let socket = null;
    let socketConnected = false;

    // Try to connect to WebSocket (optional, can work offline)
    try {
        socket = new WebSocket('ws://localhost:5002');

        socket.addEventListener('open', () => {
            console.log('📡 [LoggerClient] WebSocket connected');
            socketConnected = true;
        });

        socket.addEventListener('close', () => {
            console.log('📡 [LoggerClient] WebSocket disconnected - logs will be console-only');
            socketConnected = false;
        });

        socket.addEventListener('error', () => {
            console.warn('📡 [LoggerClient] WebSocket error - logs will be console-only');
            socketConnected = false;
        });
    } catch (error) {
        console.warn('📡 [LoggerClient] Failed to connect WebSocket - logs will be console-only');
    }

    // Create Logger class (works with or without WebSocket)
    class Logger {
        constructor() {
            this.wsClient = socket;
            this.buffer = [];
            this.sessionId = this.generateSessionId();
            this.maxBufferSize = 1000;
            this.flushInterval = 5000;

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
            const settingKey = window.CATEGORY_SETTINGS_MAP?.[category];

            // No setting = always log (e.g., WEBSOCKET, CACHE, etc.)
            if (!settingKey) {
                return true;
            }

            // Special handling for RAW packets
            if (settingKey === 'debugRawPackets') {
                const consoleEnabled = localStorage.getItem('settingDebugRawPacketsConsole') === 'true';
                const serverEnabled = localStorage.getItem('settingDebugRawPacketsServer') === 'true';
                return consoleEnabled || serverEnabled;
            }

            // Check the corresponding debug setting
            const localStorageKey = 'setting' + settingKey.charAt(0).toUpperCase() + settingKey.slice(1);
            return localStorage.getItem(localStorageKey) === 'true';
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
            const logToConsole = localStorage.getItem('settingLogToConsole') !== 'false'; // Default: true
            if (logToConsole) {
                this.logToConsole(logEntry);
            }

            // 📤 Buffer for server if enabled in settings AND connected
            const logToServer = localStorage.getItem('settingLogToServer') === 'true'; // Default: false
            const debugRawPacketsServer = localStorage.getItem('settingDebugRawPacketsServer') === 'true'; // Default: false

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
            const showRawPacketsConsole = localStorage.getItem('settingDebugRawPacketsConsole') === 'true';
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

    // Create and expose global logger
    globalLogger = new Logger();
    window.logger = globalLogger;

    console.log('✅ [LoggerClient] Logger initialized and exposed as window.logger');
});

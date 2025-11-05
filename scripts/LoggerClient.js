// LoggerClient.js - Global logger initialization for all pages
// This file is loaded in layout.ejs to make logger available everywhere

let globalLogger = null;

// Initialize WebSocket and Logger when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 [LoggerClient] Initializing global logger...');

    const socket = new WebSocket('ws://localhost:5002');

    socket.addEventListener('open', () => {
        console.log('📡 [LoggerClient] WebSocket connected');

        // Create Logger class inline (no module import needed)
        class Logger {
            constructor(wsClient) {
                this.wsClient = wsClient;
                this.buffer = [];
                this.sessionId = this.generateSessionId();
                this.maxBufferSize = 50;
                this.flushInterval = 5000;

                this.startFlushInterval();
                console.log(`📊 [Logger] Initialized with sessionId: ${this.sessionId}`);
            }

            generateSessionId() {
                return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }

            startFlushInterval() {
                this.flushTimer = setInterval(() => {
                    this.flush();
                }, this.flushInterval);
            }

            log(level, category, event, data, context = {}) {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    level,
                    category,
                    event,
                    data,
                    context: {
                        ...context,
                        sessionId: this.sessionId,
                        page: window.location.pathname
                    }
                };

                // 📺 Affichage console formaté
                this.logToConsole(logEntry);

                this.buffer.push(logEntry);

                if (this.buffer.length >= this.maxBufferSize) {
                    this.flush();
                }
            }

            logToConsole(entry) {
                const emoji = {
                    'DEBUG': '🔍',
                    'INFO': 'ℹ️',
                    'WARN': '⚠️',
                    'ERROR': '❌',
                    'CRITICAL': '��'
                }[entry.level] || '📝';

                const color = {
                    'DEBUG': 'color: #888',
                    'INFO': 'color: #0af',
                    'WARN': 'color: #fa0',
                    'ERROR': 'color: #f00',
                    'CRITICAL': 'color: #f0f; font-weight: bold'
                }[entry.level] || 'color: #000';

                const time = new Date(entry.timestamp).toLocaleTimeString('fr-FR');
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
                    }
                } else {
                    console.warn('⚠️ [Logger] WebSocket not ready, keeping logs in buffer');
                }
            }

            destroy() {
                if (this.flushTimer) {
                    clearInterval(this.flushTimer);
                }
                this.flush();
                console.log('📊 [Logger] Destroyed');
            }
        }

        globalLogger = new Logger(socket);
        window.logger = globalLogger;
        window.isLoggerReady = () => window.logger !== null;

        console.log('✅ [LoggerClient] Logger initialized and exposed as window.logger');
    });

    socket.addEventListener('error', (error) => {
        console.error('❌ [LoggerClient] WebSocket error:', error);
    });

    socket.addEventListener('close', () => {
        console.log('📡 [LoggerClient] WebSocket closed');
        window.logger = null;
    });
});

// Expose immediately (will be null until WebSocket connects)
window.logger = null;
window.isLoggerReady = () => window.logger !== null;

console.log('🔧 [LoggerClient] Script loaded, waiting for DOM ready...');


/**
 * 📋 Logger Client - Simple & TDAH-friendly
 * Envoie les logs au serveur via WebSocket
 */

export class Logger {
    constructor(config = {}) {
        this.config = {
            bufferSize: config.bufferSize || 50,
            flushInterval: config.flushInterval || 5000,
            logToServer: config.logToServer !== false,
            logToConsole: config.logToConsole || false
        };

        this.buffer = [];
        this.sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.websocket = null;
        this.flushTimer = null;
        this.startFlushTimer();
    }

    connectWebSocket(ws) {
        this.websocket = ws;
    }

    log(level, category, event, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            event,
            data,
            sessionId: this.sessionId
        };

        if (this.config.logToConsole) {
            console.log(`[${level}][${category}] ${event}:`, data);
        }

        this.buffer.push(logEntry);

        if (this.buffer.length >= this.config.bufferSize) {
            this.flush();
        }
    }

    debug(category, event, data) { this.log('DEBUG', category, event, data); }
    info(category, event, data) { this.log('INFO', category, event, data); }
    warn(category, event, data) { this.log('WARN', category, event, data); }
    error(category, event, data) { this.log('ERROR', category, event, data); }

    flush() {
        if (this.buffer.length === 0) return;
        if (!this.config.logToServer) {
            this.buffer = [];
            return;
        }

        const logsToSend = [...this.buffer];
        this.buffer = [];

        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
                this.websocket.send(JSON.stringify({
                    type: 'logs',
                    payload: logsToSend
                }));
            } catch (e) {
                console.error('[Logger] Failed to send logs:', e);
            }
        }
    }

    startFlushTimer() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
    }

    destroy() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flush();
    }

    setConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (updates.flushInterval) this.startFlushTimer();
    }

    getStats() {
        return {
            sessionId: this.sessionId,
            bufferSize: this.buffer.length,
            config: this.config
        };
    }
}

// Instance globale (singleton)
let loggerInstance = null;

export function initLogger(config = {}) {
    if (loggerInstance) {
        loggerInstance.setConfig(config);
        return loggerInstance;
    }
    loggerInstance = new Logger(config);
    if (typeof window !== 'undefined') {
        window.__logger = loggerInstance;
    }
    return loggerInstance;
}

export function getLogger() {
    if (!loggerInstance) {
        return initLogger();
    }
    return loggerInstance;
}

export default { Logger, initLogger, getLogger };


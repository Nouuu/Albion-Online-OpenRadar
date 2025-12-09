// LoggerServer.js - Server-side logger with JSONL persistence
import fs from 'fs';
import path from 'path';

class LoggerServer {
    constructor(logsDir = './logs') {
        this.logsDir = logsDir;
        this.enabled = true; // Logs enabled by default
        this.initializeDirectories();
        this.createSessionFile();
        console.log(`📊 [LoggerServer] Session file: ${this.currentSessionFile}`);
        console.log(`📊 [LoggerServer] Logging enabled: ${this.enabled}`);
    }

    /**
     * Enable or disable server-side logging
     * @param {boolean} enabled - true to enable, false to disable
     */
    setEnabled(enabled) {
        this.enabled = !!enabled;
        console.log(`📊 [LoggerServer] Logging ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Get current logging state
     * @returns {boolean} - true if enabled, false if disabled
     */
    isEnabled() {
        return this.enabled;
    }

    initializeDirectories() {
        const dirs = [
            path.join(this.logsDir, 'sessions'),
            path.join(this.logsDir, 'errors'),
            path.join(this.logsDir, 'debug')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 [LoggerServer] Created directory: ${dir}`);
            }
        });
    }

    createSessionFile() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        this.currentSessionFile = path.join(this.logsDir, 'sessions', `session_${timestamp}.jsonl`);
        this.sessionStartTime = new Date();
    }

    /**
     * Write logs array to JSONL file
     * @param {Array} logsArray - Array of log entries
     */
    writeLogs(logsArray) {
        if (!Array.isArray(logsArray) || logsArray.length === 0) return;

        try {
            const lines = logsArray.map(log => JSON.stringify(log)).join('\n') + '\n';
            fs.appendFileSync(this.currentSessionFile, lines, 'utf8');
        } catch (error) {
            console.error('❌ [LoggerServer] Error writing logs:', error);
        }
    }

    /**
     * Log a single entry
     * @param {string} level - DEBUG, INFO, WARN, ERROR, CRITICAL
     * @param {string} category - HARVESTABLE, MOB, PLAYER, etc.
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @param {Object} context - Additional context
     */
    log(level, category, event, data, context = {}) {
        if (!this.enabled) return; // Skip if logging is disabled
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            category: `[SERVER] ${category}`, // Prefix all server logs with [SERVER]
            event,
            data,
            context: {
                ...context,
                sessionDuration: Math.floor((new Date() - this.sessionStartTime) / 1000)
            }
        };
        this.writeLogs([logEntry]);
    }

    /**
     * Log error to dedicated error file
     */
    error(category, event, data, context = {}) {
        this.log('ERROR', category, event, data, context);

        // Also write to dedicated error file
        try {
            const date = new Date().toISOString().split('T')[0];
            const errorFile = path.join(this.logsDir, 'errors', `errors_${date}.log`);
            const errorLine = `[${new Date().toISOString()}] ${category}.${event}: ${JSON.stringify(data)}\n`;
            fs.appendFileSync(errorFile, errorLine, 'utf8');
        } catch (err) {
            console.error('❌ [LoggerServer] Error writing error log:', err);
        }
    }

    /**
     * Convenience methods matching LoggerClient API
     */
    debug(category, event, data, context = {}) {
        this.log('DEBUG', category, event, data, context);
    }

    info(category, event, data, context = {}) {
        this.log('INFO', category, event, data, context);
    }

    warn(category, event, data, context = {}) {
        this.log('WARN', category, event, data, context);
    }

    critical(category, event, data, context = {}) {
        this.log('CRITICAL', category, event, data, context);
    }

    /**
     * Get session statistics
     */
    getSessionStats() {
        if (!fs.existsSync(this.currentSessionFile)) {
            return { lineCount: 0, fileSize: 0 };
        }

        const stats = fs.statSync(this.currentSessionFile);
        const content = fs.readFileSync(this.currentSessionFile, 'utf8');
        const lineCount = content.split('\n').filter(line => line.trim()).length;

        return {
            sessionFile: this.currentSessionFile,
            lineCount,
            fileSize: stats.size,
            sessionDuration: Math.floor((new Date() - this.sessionStartTime) / 1000)
        };
    }
}

export default LoggerServer;

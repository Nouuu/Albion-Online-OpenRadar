import {CATEGORIES} from '../constants/LoggerConstants.js';
import settingsSync from './SettingsSync.js';

const COALESCABLE_EVENTS = new Set([3, 6, 91]);

export class WebSocketEventQueue {
    constructor() {
        this.eventQueue = new Map();
        this.flushScheduled = false;
        this.flushCallback = null;
        this.rafId = null;  // Track RAF for cleanup
    }

    get enableCoalescing() {
        return settingsSync.getBool('settingDebugWsCoalescing');
    }

    setFlushCallback(callback) {
        this.flushCallback = callback;
    }

    parseMessage(msg) {
        const dict = typeof msg.dictionary === 'string' ? JSON.parse(msg.dictionary) : msg.dictionary;
        return { code: msg.code, params: dict.parameters };
    }

    queueRawMessage(rawData) {
        try {
            const data = JSON.parse(rawData);
            const messages = data.type === 'batch' ? data.messages : [data];

            for (const msg of messages) {
                const { code, params } = this.parseMessage(msg);
                this.queueEventInternal(code, params);
            }
        } catch (e) {
            window.logger?.warn(CATEGORIES.NETWORK, 'MalformedWSMessage', {error: e?.message});
        }
    }

    queueEventInternal(messageType, params) {
        if (messageType !== 'event') {
            this.processImmediately(messageType, params);
            return;
        }

        const eventCode = params[252];
        const entityId = params[0];

        const queueKey = this.enableCoalescing && COALESCABLE_EVENTS.has(eventCode)
            ? `${eventCode}-${entityId}`
            : `${eventCode}-${performance.now()}-${Math.random()}`;

        this.eventQueue.set(queueKey, { messageType, params });
        this.scheduleFlush();
    }

    processImmediately(messageType, params) {
        if (this.flushCallback) this.flushCallback(messageType, params);
    }

    scheduleFlush() {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        this.rafId = requestAnimationFrame(() => this.flush());
    }

    flush() {
        this.rafId = null;
        this.flushScheduled = false;
        if (this.eventQueue.size === 0) return;

        // Guard: Don't flush if callback was cleared (destroyed)
        if (!this.flushCallback) return;

        for (const [, event] of this.eventQueue) {
            this.flushCallback(event.messageType, event.params);
        }
        this.eventQueue.clear();
    }

    destroy() {
        // Cancel pending RAF first
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.flushScheduled = false;

        this.eventQueue.clear();
        this.flushCallback = null;
    }
}

let instance = null;

export function getEventQueue() {
    if (!instance) instance = new WebSocketEventQueue();
    return instance;
}

export function destroyEventQueue() {
    if (instance) {
        instance.destroy();
        instance = null;
    }
}

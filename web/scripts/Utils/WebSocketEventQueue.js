const COALESCABLE_EVENTS = new Set([3, 6, 91]);
const THROTTLED_EVENTS = { 6: 50, 91: 100 };

export class WebSocketEventQueue {
    constructor() {
        this.eventQueue = new Map();
        this.throttleMap = new Map();
        this.flushScheduled = false;
        this.flushCallback = null;
        this.rafId = null;  // Track RAF for cleanup
        this.cleanupInterval = setInterval(() => this.cleanupThrottleMap(), 30000);
    }

    get enableCoalescing() {
        return window.settingsSync?.getBool('settingWsCoalescing', true) ?? true;
    }

    get enableThrottling() {
        return window.settingsSync?.getBool('settingWsThrottling', true) ?? true;
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
        } catch {
            // Skip malformed message
        }
    }

    queueEventInternal(messageType, params) {
        if (messageType !== 'event') {
            this.processImmediately(messageType, params);
            return;
        }

        const eventCode = params[252];
        const entityId = params[0];

        if (this.enableThrottling && THROTTLED_EVENTS[eventCode]) {
            const throttleKey = `${eventCode}-${entityId}`;
            const lastProcessed = this.throttleMap.get(throttleKey) || 0;
            const now = performance.now();

            if (now - lastProcessed < THROTTLED_EVENTS[eventCode]) return;
            this.throttleMap.set(throttleKey, now);
        }

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

    cleanupThrottleMap() {
        const now = performance.now();
        for (const [key, timestamp] of this.throttleMap) {
            if (now - timestamp > 5000) this.throttleMap.delete(key);
        }
    }

    destroy() {
        // Cancel pending RAF first
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.flushScheduled = false;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.eventQueue.clear();
        this.throttleMap.clear();
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

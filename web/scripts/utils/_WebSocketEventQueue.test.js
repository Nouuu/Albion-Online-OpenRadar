// synthetic: hand-built WebSocket batches fed to the queue, frames flushed by hand.
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {registryDefault} from './SettingsRegistry.js';
import {WebSocketEventQueue} from './WebSocketEventQueue.js';

function event(code, id, value) {
    return {code: 'event', dictionary: {parameters: {0: id, 1: value, 252: code}}};
}

function batch(...messages) {
    return JSON.stringify({type: 'batch', messages});
}

describe('WebSocketEventQueue', () => {
    let queue;
    let delivered;

    beforeEach(() => {
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
        vi.stubGlobal('settingsSync', {getBool: vi.fn(key => registryDefault(key))});
        delivered = [];
        queue = new WebSocketEventQueue();
        queue.setFlushCallback((type, params) => delivered.push(`${params[252]}:${params[0]}:${params[1]}`));
    });

    afterEach(() => {
        queue.destroy();
        vi.unstubAllGlobals();
    });

    test('coalescing keeps the latest move, health and regeneration event per entity in a frame', () => {
        queue.queueRawMessage(batch(
            event(3, 1, 'a'), event(3, 1, 'b'), event(3, 1, 'c'),
            event(6, 1, 'a'), event(6, 1, 'b'),
            event(91, 1, 'a'), event(91, 1, 'b'),
            event(3, 2, 'a'), event(6, 2, 'a'),
        ));
        queue.flush();
        expect(delivered.sort()).toEqual(['3:1:c', '3:2:a', '6:1:b', '6:2:a', '91:1:b']);
    });

    test('other events are never merged', () => {
        queue.queueRawMessage(batch(event(1, 1, 'a'), event(1, 1, 'b')));
        queue.flush();
        expect(delivered).toEqual(['1:1:a', '1:1:b']);
    });

    test('health and regeneration updates of consecutive frames all reach the router', () => {
        for (const value of ['a', 'b', 'c']) {
            queue.queueRawMessage(batch(event(6, 1, value), event(91, 1, value)));
            queue.flush();
        }
        expect(delivered).toEqual(['6:1:a', '91:1:a', '6:1:b', '91:1:b', '6:1:c', '91:1:c']);
    });
});

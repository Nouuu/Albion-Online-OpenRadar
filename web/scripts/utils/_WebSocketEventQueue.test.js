// synthetic: HealthUpdate and HealthUpdates messages built from actions/heal.json and actions/health-updates.json values;
// window.settingsSync is unset, so coalescing and throttling take their default, on.

import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {WebSocketEventQueue} from './WebSocketEventQueue.js';
import {EventCodes} from './EventCodes.js';

describe('WebSocketEventQueue health events', () => {
    let queue;
    let delivered;

    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

    beforeEach(() => {
        queue = new WebSocketEventQueue();
        delivered = [];
        queue.setFlushCallback((_kind, params) => delivered.push(params));
    });

    afterEach(() => {
        queue.destroy();
        vi.restoreAllMocks();
    });

    // @characterization 2026-09-23: current code drops a HealthUpdate on a target within 50 ms of the last one it kept
    // for that target, so a heal then a hit on the same target reach the router as the heal alone.
    test('a heal then a hit on the same target within 50 ms reach the router as the heal alone', async () => {
        const heal = {0: 1656044, 2: 276, 6: 1655584, 252: EventCodes.HealthUpdate};
        const hit = {0: 1656044, 2: -187, 6: 1656011, 252: EventCodes.HealthUpdate};

        queue.queueEventInternal('event', heal);
        queue.queueEventInternal('event', hit);
        await nextFrame();

        expect(delivered).toEqual([heal]);
    });

    // @characterization 2026-09-23: current code keeps one HealthUpdate per target per frame, the last one, so two
    // updates 60 ms apart that land in one frame reach the router as the second alone.
    test('two HealthUpdates on the same target 60 ms apart in one frame reach the router as the second alone', async () => {
        vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1060);
        const heal = {0: 1656044, 2: 276, 6: 1655584, 252: EventCodes.HealthUpdate};
        const hit = {0: 1656044, 2: -187, 6: 1656011, 252: EventCodes.HealthUpdate};

        queue.queueEventInternal('event', heal);
        queue.queueEventInternal('event', hit);
        await nextFrame();

        expect(delivered).toEqual([hit]);
    });

    // @characterization 2026-09-23: HealthUpdates is neither throttled nor coalesced, so two on the same target in one
    // frame both reach the router.
    test('two HealthUpdates messages on the same target in one frame both reach the router', async () => {
        const first = {0: 1655584, 2: [-124], 6: [1656011], 252: EventCodes.HealthUpdates};
        const second = {0: 1655584, 2: [646], 6: [1655584], 252: EventCodes.HealthUpdates};

        queue.queueEventInternal('event', first);
        queue.queueEventInternal('event', second);
        await nextFrame();

        expect(delivered).toEqual([first, second]);
    });
});

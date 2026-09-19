import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';
import {FameHandler, KILL_WINDOW_MS, POPUP_DURATION_MS, parseFameAmount} from './FameHandler.js';
import {formatFame, formatDuration} from '../utils/RadarRenderer.js';

// pcap-derived: UpdateFame layout from harvestables/finished.pcap (post-Dragonfire)
//   [0] local player id, [1] total fame x10000, [2] fame gained x10000
function fameEvent(gained, total = 11624003.6717) {
    return {0: 12081, 1: Math.round(total * 10000), 2: Math.round(gained * 10000), 252: 82};
}

// pcap-derived: UpdateMoney layout from router/change-cluster.pcap
//   [0] local player id, [1] total silver x10000, [2] unconfirmed (ignored)
function moneyEvent(total) {
    return {0: 6740, 1: Math.round(total * 10000), 2: 5000000, 252: 81};
}

describe('FameHandler', () => {
    let handler;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
        sessionStorage.clear();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new FameHandler();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('pcap values decode to fame (18 and 30 fame per gather tick)', () => {
        const p1 = handler.onUpdateFame({0: 12081, 1: 116239736717, 2: 180000, 252: 82});
        const p2 = handler.onUpdateFame({0: 12081, 1: 116240036717, 2: 300000, 15: true, 252: 82});

        expect(p1.amount).toBe(18);
        expect(p2.amount).toBe(30);
        expect(handler.session.fame).toBe(48);
        expect(handler.session.totalFame).toBeCloseTo(11624003.6717, 4);
    });

    test('fame right after a mob death is credited to the kill, at the mob position', () => {
        handler.onMobDied({posX: 120, posY: -45, name: 'T6_MOB_WOLF'});
        vi.advanceTimersByTime(300);

        const popup = handler.onUpdateFame(fameEvent(1240));

        expect(popup).toMatchObject({amount: 1240, kill: true, posX: 120, posY: -45, name: 'T6_MOB_WOLF'});
        expect(handler.session.kills).toBe(1);
        expect(handler.session.killFame).toBe(1240);
    });

    test('fame without a recent death is not a kill (gathering, etc.)', () => {
        handler.onMobDied({posX: 1, posY: 2});
        vi.advanceTimersByTime(KILL_WINDOW_MS + 1);

        const popup = handler.onUpdateFame(fameEvent(30));

        expect(popup.kill).toBe(false);
        expect(handler.session.kills).toBe(0);
        expect(handler.session.fame).toBe(30);
    });

    test('several deaths are matched to fame events in order', () => {
        handler.onMobDied({posX: 1, posY: 1, name: 'A'});
        handler.onMobDied({posX: 2, posY: 2, name: 'B'});

        expect(handler.onUpdateFame(fameEvent(100)).name).toBe('A');
        vi.advanceTimersByTime(600);
        expect(handler.onUpdateFame(fameEvent(200)).name).toBe('B');
        expect(handler.session.kills).toBe(2);
    });

    test('a follow-up fame event for the same kill merges into its popup', () => {
        handler.onMobDied({posX: 5, posY: 5});
        const first = handler.onUpdateFame(fameEvent(1000));
        vi.advanceTimersByTime(100);
        const second = handler.onUpdateFame(fameEvent(250));

        expect(second).toBe(first);
        expect(first.amount).toBe(1250);
        expect(handler.session.kills).toBe(1);
        expect(handler.session.killFame).toBe(1250);
        expect(handler.popups).toHaveLength(1);
    });

    test('zero, negative or missing fame is ignored', () => {
        expect(handler.onUpdateFame(fameEvent(0))).toBeNull();
        expect(handler.onUpdateFame({0: 1, 252: 82})).toBeNull();
        expect(handler.hasSession()).toBe(false);
    });

    test('popups expire after their display duration', () => {
        handler.onUpdateFame(fameEvent(10));
        expect(handler.getActivePopups()).toHaveLength(1);

        vi.advanceTimersByTime(POPUP_DURATION_MS);
        expect(handler.getActivePopups()).toHaveLength(0);
    });

    test('fame per hour waits for a minute of data', () => {
        handler.onUpdateFame(fameEvent(5000));
        expect(handler.getFamePerHour()).toBeNull();

        vi.advanceTimersByTime(30 * 60 * 1000);
        expect(handler.getFamePerHour()).toBe(10000);
    });

    test('session survives a new handler (page navigation) and can be reset', () => {
        handler.onMobDied({posX: 0, posY: 0});
        handler.onUpdateFame(fameEvent(700));

        const restored = new FameHandler();
        expect(restored.session).toMatchObject({fame: 700, kills: 1, killFame: 700});

        restored.resetSession();
        expect(restored.hasSession()).toBe(false);
        expect(new FameHandler().hasSession()).toBe(false);
    });
});

describe('FameHandler silver', () => {
    let handler;

    beforeEach(() => {
        sessionStorage.clear();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new FameHandler();
    });

    test('pcap value decodes to the silver total', () => {
        handler.onUpdateMoney({0: 6740, 1: 109353757954, 2: 5000000, 252: 81});
        expect(handler.session.silverTotal).toBeCloseTo(10935375.7954, 4);
    });

    test('first event only sets the baseline, later increases count as earned', () => {
        expect(handler.onUpdateMoney(moneyEvent(100000))).toBeNull();
        expect(handler.hasSession()).toBe(false);

        const popup = handler.onUpdateMoney(moneyEvent(101250));
        expect(popup).toMatchObject({amount: 1250, silver: true, kill: false});
        expect(handler.session.silver).toBe(1250);
    });

    test('spending lowers the baseline without subtracting earned silver', () => {
        handler.onUpdateMoney(moneyEvent(100000));
        handler.onUpdateMoney(moneyEvent(101000));
        expect(handler.onUpdateMoney(moneyEvent(95000))).toBeNull();
        handler.onUpdateMoney(moneyEvent(95500));

        expect(handler.session.silver).toBe(1500);
    });

    test('reset keeps the silver baseline', () => {
        handler.onUpdateMoney(moneyEvent(100000));
        handler.onUpdateMoney(moneyEvent(100200));
        handler.resetSession();

        expect(handler.session.silver).toBe(0);
        expect(handler.onUpdateMoney(moneyEvent(100300)).amount).toBe(100);
    });
});

describe('FameHandler goal', () => {
    let handler;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
        sessionStorage.clear();
        window.logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};
        handler = new FameHandler();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('no goal set returns null', () => {
        expect(handler.getGoalProgress(0)).toBeNull();
    });

    test('progress and time left follow the session fame rate', () => {
        handler.onUpdateFame(fameEvent(250000));
        expect(handler.getGoalProgress(1000000).etaMs).toBeNull();

        vi.advanceTimersByTime(60 * 60 * 1000);
        const progress = handler.getGoalProgress(1000000);
        expect(progress.ratio).toBe(0.25);
        expect(progress.etaMs).toBe(3 * 60 * 60 * 1000);
    });

    test('reached goal is capped at 100% with nothing left', () => {
        handler.onUpdateFame(fameEvent(2000));
        expect(handler.getGoalProgress(1000)).toMatchObject({ratio: 1, etaMs: 0});
    });
});

describe('parseFameAmount', () => {
    test.each([
        ['1000000', 1000000],
        ['1,000,000', 1000000],
        ['500k', 500000],
        ['1.5m', 1500000],
        [' 2M ', 2000000],
        ['', 0],
        ['abc', 0],
        ['5x', 0],
    ])('parseFameAmount(%j) = %d', (text, expected) => {
        expect(parseFameAmount(text)).toBe(expected);
    });
});

describe('formatDuration', () => {
    test.each([
        [20000, '<1m'],
        [45 * 60000, '45m'],
        [135 * 60000, '2h 15m'],
    ])('formatDuration(%d) = %s', (ms, expected) => {
        expect(formatDuration(ms)).toBe(expected);
    });
});

describe('formatFame', () => {
    test.each([
        [1240, false, '1,240'],
        [18, false, '18'],
        [2.5, false, '2.5'],
        [12345, true, '12.3k'],
        [9999, true, '9,999'],
        [1250000, true, '1.3M'],
        [500000, true, '500k'],
        [1000000, true, '1M'],
    ])('formatFame(%d, %s) = %s', (amount, compact, expected) => {
        expect(formatFame(amount, compact)).toBe(expected);
    });
});

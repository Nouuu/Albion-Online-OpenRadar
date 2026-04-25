import {describe, test, expect} from 'vitest';
import {loadFixture, normalizeParams} from './loader.js';

describe('fixture loader', () => {
    test('loadFixture reads a real committed fixture', async () => {
        const fx = await loadFixture('harvestables', 'single-spawn');
        expect(fx.handler).toBe('harvestables');
        expect(Array.isArray(fx.messages)).toBe(true);
        expect(fx.messages.length).toBeGreaterThan(0);
        expect(fx.messages[0].kind).toBe('event');
    });

    test('normalizeParams coerces string keys to numeric', () => {
        const out = normalizeParams({'0': 42, '252': 40});
        expect(out[0]).toBe(42);
        expect(out[252]).toBe(40);
        expect(Object.keys(out).every(k => Number.isInteger(Number(k)))).toBe(true);
    });

    test('normalizeParams on empty object returns empty object', () => {
        expect(normalizeParams({})).toEqual({});
    });
});
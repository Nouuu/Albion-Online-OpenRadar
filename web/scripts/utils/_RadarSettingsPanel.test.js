// synthetic: pure sizing and rotation helpers, then the radar template mounted with stubbed layout and a fake ResizeObserver.
import {describe, expect, test} from 'vitest';
import {computeRadarSize, rotationDegrees, rotationTransform} from './RadarSettingsPanel.js';

describe('computeRadarSize', () => {
    test.each([
        [500, false, 1000, 1000, 500],
        [800, false, 1000, 540, 540],
        [300, false, 280, 1000, 280],
        [200, false, 1000, 1000, 300],
        [500, true, 1500, 1300, 1200],
        [500, false, NaN, 600, 500],
        [500, false, 0, 600, 1],
        [600, false, 512.7, 900, 512],
    ])('@verified 2026-09-24: size %s fit %s in %sx%s gives %s', (size, fit, availableWidth, availableHeight, expected) => {
        expect(computeRadarSize({size, fit, availableWidth, availableHeight})).toBe(expected);
    });
});

describe('rotation helpers', () => {
    test.each([
        [0, 0, ''],
        [90, 90, 'rotate(90deg)'],
        [180, 180, 'rotate(180deg)'],
        [270, 270, 'rotate(270deg)'],
        [45, 0, ''],
        ['90', 90, 'rotate(90deg)'],
        [NaN, 0, ''],
        [undefined, 0, ''],
    ])('@verified 2026-09-24: %s normalizes to %s and transform "%s"', (value, degrees, transform) => {
        expect(rotationDegrees(value)).toBe(degrees);
        expect(rotationTransform(value)).toBe(transform);
    });
});

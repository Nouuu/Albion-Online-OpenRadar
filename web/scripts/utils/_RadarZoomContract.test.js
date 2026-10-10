// synthetic: radar template mounted from internal/templates and checked against the settings registry.
import {describe, expect, test} from 'vitest';
import {registryEntry} from './SettingsRegistry.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

describe('radar zoom range contract', () => {
    // @verified 2026-08-14: zooming out to ten percent gives a wider view, three is the closest zoom.
    test('allows zooming out to ten percent for a wider view', () => {
        const {min, max, step} = registryEntry('settingRadarZoom');
        expect([min, max, step]).toEqual([0.1, 3, 0.1]);
        const slider = mountPage('radar').querySelector('[data-setting="settingRadarZoom"], #settingRadarZoom');
        expect([slider.min, slider.max, slider.step].map(Number)).toEqual([min, max, step]);
    });
});

import {registryEntry} from './SettingsRegistry.js';

const FIT_CAP = 1200;
const QUARTER_TURNS = [90, 180, 270];

function unbounded(value) {
    return Number.isFinite(value) ? value : Infinity;
}

export function computeRadarSize({size, fit, availableWidth, availableHeight}) {
    const {min, max} = registryEntry('settingRadarSize');
    const cap = fit ? FIT_CAP : Math.min(max, Math.max(min, size));
    return Math.max(1, Math.floor(Math.min(cap, unbounded(availableWidth), unbounded(availableHeight))));
}

export function rotationDegrees(value) {
    const degrees = Number(value);
    return QUARTER_TURNS.includes(degrees) ? degrees : 0;
}

export function rotationTransform(value) {
    const degrees = rotationDegrees(value);
    return degrees ? `rotate(${degrees}deg)` : '';
}

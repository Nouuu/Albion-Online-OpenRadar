import {vi} from 'vitest';

const LOGGED_METHODS = [
    'arc', 'beginPath', 'clearRect', 'closePath', 'drawImage', 'fill', 'fillRect', 'fillText',
    'lineTo', 'moveTo', 'quadraticCurveTo', 'restore', 'rotate', 'save', 'scale', 'setLineDash',
    'stroke', 'strokeRect', 'translate',
];

export function createRecordingContext(canvas) {
    const calls = [];
    const ctx = {
        canvas,
        calls,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        globalAlpha: 1,
        measureText: text => ({width: String(text).length * 6}),
        createLinearGradient: () => ({addColorStop() {}}),
    };
    for (const name of LOGGED_METHODS) {
        ctx[name] = (...args) => calls.push([name, ...args]);
    }
    return ctx;
}

export function installRecordingContext() {
    return vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(function () { return createRecordingContext(this); });
}

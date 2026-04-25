// synthetic: pure DOM-mocked tests for the centering fix.
import {beforeEach, describe, test, expect, vi} from 'vitest';
import {createCanvasManager, clampForViewport} from './CanvasManager.js';

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('CanvasManager.setupOurPlayerCanvas', () => {
    test('@verified 2026-04-25: blue dot uses canvas.width/2 not setting', () => {
        const op = {width: 343, height: 343};
        const ctx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillStyle: ''
        };

        const mgr = createCanvasManager();
        mgr.canvases.ourPlayerCanvas = op;
        mgr.contexts.ourPlayerCanvas = ctx;

        mgr.setupOurPlayerCanvas();

        expect(ctx.arc).toHaveBeenCalledWith(171.5, 171.5, 5, 0, 2 * Math.PI);
        expect(ctx.arc).not.toHaveBeenCalledWith(250, 250, 5, 0, 2 * Math.PI);
    });
});

describe('clampForViewport', () => {
    test('@verified 2026-04-25: returns size when ample room', () => {
        const cardBody = document.createElement('div');
        cardBody.style.width = '800px';
        cardBody.style.padding = '0px';
        Object.defineProperty(cardBody, 'clientWidth', {value: 800, configurable: true});
        const container = document.createElement('div');
        cardBody.appendChild(container);
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        document.body.appendChild(cardBody);

        Object.defineProperty(window, 'innerWidth', {value: 1280, configurable: true});

        expect(clampForViewport(500, canvas)).toBe(500);
    });

    test('@verified 2026-04-25: clamps to inner width on narrow viewport', () => {
        const cardBody = document.createElement('div');
        Object.defineProperty(cardBody, 'clientWidth', {value: 343, configurable: true});
        const container = document.createElement('div');
        cardBody.appendChild(container);
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        document.body.appendChild(cardBody);

        Object.defineProperty(window, 'innerWidth', {value: 375, configurable: true});

        const result = clampForViewport(500, canvas);
        expect(result).toBeLessThanOrEqual(343);
        expect(result).toBeGreaterThanOrEqual(200);
    });

    test('@verified 2026-04-25: never returns below 200 floor', () => {
        const cardBody = document.createElement('div');
        Object.defineProperty(cardBody, 'clientWidth', {value: 100, configurable: true});
        const container = document.createElement('div');
        cardBody.appendChild(container);
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        document.body.appendChild(cardBody);

        Object.defineProperty(window, 'innerWidth', {value: 200, configurable: true});

        expect(clampForViewport(500, canvas)).toBe(200);
    });
});

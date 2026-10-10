// synthetic: DOM-mocked canvases with a recording 2D context.
import {beforeEach, describe, test, expect, vi} from 'vitest';
import {createCanvasManager} from './CanvasManager.js';
import {installRecordingContext} from '../__fixtures__/recordingContext.js';

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

describe('CanvasManager canvasSizeChanged listener', () => {
    test('@verified 2026-09-24: only redraws the player dot and leaves the bitmaps to the panel', () => {
        const getContext = installRecordingContext();
        document.body.innerHTML = ['mapCanvas', 'drawCanvas', 'ourPlayerCanvas', 'uiCanvas']
            .map(id => `<canvas id="${id}" width="500" height="500"></canvas>`).join('');
        const mgr = createCanvasManager();
        mgr.initialize();
        const dot = mgr.getContext('ourPlayerCanvas');
        dot.calls.length = 0;

        window.dispatchEvent(new CustomEvent('canvasSizeChanged', {detail: {size: 300}}));

        expect(Object.values(mgr.getAllCanvases()).map(canvas => [canvas.width, canvas.height]))
            .toEqual(Array(4).fill([500, 500]));
        expect(dot.calls).toContainEqual(['arc', 250, 250, 5, 0, 2 * Math.PI]);
        mgr.destroy();
        getContext.mockRestore();
    });
});

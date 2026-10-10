// synthetic: drives the PictureInPictureManager singleton's compositeFrame directly with a recording context.
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {createRecordingContext} from '../__fixtures__/recordingContext.js';
import pictureInPictureManager from './PictureInPictureManager.js';

const SIZE = 500;

function makeCanvases() {
    return {
        mapCanvas: {width: SIZE, height: SIZE},
        drawCanvas: {width: SIZE, height: SIZE},
        ourPlayerCanvas: {width: SIZE, height: SIZE},
        uiCanvas: {width: SIZE, height: SIZE},
    };
}

describe('PictureInPictureManager.compositeFrame', () => {
    let ctx;
    let canvases;

    beforeEach(() => {
        localStorage.clear();
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx = createRecordingContext(canvas);
        canvases = makeCanvases();

        pictureInPictureManager.pipCanvas = canvas;
        pictureInPictureManager.pipCtx = ctx;
        pictureInPictureManager.size = SIZE;
        pictureInPictureManager.canvasManager = {canvases};
    });

    afterEach(() => {
        pictureInPictureManager.pipCanvas = null;
        pictureInPictureManager.pipCtx = null;
        pictureInPictureManager.canvasManager = null;
    });

    test('@verified 2026-09-25: clears then draws the map, draw, player and UI layers in canvas layer order', () => {
        pictureInPictureManager.compositeFrame();

        expect(ctx.calls).toEqual([
            ['clearRect', 0, 0, SIZE, SIZE],
            ['drawImage', canvases.mapCanvas, 0, 0],
            ['drawImage', canvases.drawCanvas, 0, 0],
            ['drawImage', canvases.ourPlayerCanvas, 0, 0],
            ['drawImage', canvases.uiCanvas, 0, 0],
        ]);
    });

    test('@verified 2026-10-10: a 358 px source on a 500 px PiP canvas resizes the canvas and clears 358', () => {
        const narrow = 358;
        Object.values(canvases).forEach(canvas => {
            canvas.width = narrow;
            canvas.height = narrow;
        });

        pictureInPictureManager.compositeFrame();

        expect([pictureInPictureManager.pipCanvas.width, pictureInPictureManager.pipCanvas.height]).toEqual([narrow, narrow]);
        expect(pictureInPictureManager.size).toBe(narrow);
        expect(ctx.calls[0]).toEqual(['clearRect', 0, 0, narrow, narrow]);
    });
});

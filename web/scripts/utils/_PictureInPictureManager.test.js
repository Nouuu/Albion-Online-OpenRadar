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

describe('PictureInPictureManager.compositeFrame with the players panel', () => {
    let ctx;
    let canvases;

    function useSettings(position) {
        window.settingsSync = {
            get: key => (key === 'settingRadarPipPlayers' ? position : undefined),
            getBool: () => true,
        };
    }

    beforeEach(() => {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        ctx = createRecordingContext(canvas);
        canvases = makeCanvases();

        pictureInPictureManager.pipCanvas = canvas;
        pictureInPictureManager.pipCtx = ctx;
        pictureInPictureManager.size = SIZE;
        pictureInPictureManager.canvasManager = {canvases};
        window.playersHandler = {
            getPlayersByType: () => ({
                hostile: [{
                    id: 1, nickname: 'Zed', guildName: 'Night', allianceName: null, faction: 255, mounted: false,
                    detectedAt: Date.now(), currentHealth: 0, initialHealth: 0, equipments: null, spells: null,
                    getAverageItemPower: () => 1400,
                }],
                faction: [],
                passive: [],
            }),
        };
    });

    afterEach(() => {
        delete window.settingsSync;
        delete window.playersHandler;
        pictureInPictureManager.pipCanvas = null;
        pictureInPictureManager.pipCtx = null;
        pictureInPictureManager.canvasManager = null;
    });

    test('off keeps the square canvas and draws no panel', () => {
        useSettings('off');
        pictureInPictureManager.compositeFrame();

        expect([pictureInPictureManager.pipCanvas.width, pictureInPictureManager.pipCanvas.height]).toEqual([SIZE, SIZE]);
        expect(ctx.calls.filter(call => call[0] === 'fillText')).toEqual([]);
    });

    test('beside widens the canvas, keeps the four layers at the origin and draws the panel after them', () => {
        useSettings('right');
        pictureInPictureManager.compositeFrame();

        expect([pictureInPictureManager.pipCanvas.width, pictureInPictureManager.pipCanvas.height]).toEqual([810, SIZE]);
        expect(ctx.calls[0]).toEqual(['clearRect', 0, 0, 810, SIZE]);
        const layers = ctx.calls.filter(call => call[0] === 'drawImage');
        expect(layers.map(call => call[1])).toEqual([canvases.mapCanvas, canvases.drawCanvas, canvases.ourPlayerCanvas, canvases.uiCanvas]);
        const firstText = ctx.calls.findIndex(call => call[0] === 'fillText');
        const lastLayer = ctx.calls.lastIndexOf(layers[layers.length - 1]);
        expect(firstText).toBeGreaterThan(lastLayer);
        expect(ctx.calls.filter(call => call[0] === 'fillText').map(call => call[1])).toContain('Zed');
    });

    test('under makes the canvas taller and keeps its width', () => {
        useSettings('bottom');
        pictureInPictureManager.compositeFrame();

        expect(pictureInPictureManager.pipCanvas.width).toBe(SIZE);
        expect(pictureInPictureManager.pipCanvas.height).toBeGreaterThan(SIZE);
    });

    test('switching the panel off again restores the square canvas', () => {
        useSettings('right');
        pictureInPictureManager.compositeFrame();
        useSettings('off');
        ctx.calls.length = 0;
        pictureInPictureManager.compositeFrame();

        expect([pictureInPictureManager.pipCanvas.width, pictureInPictureManager.pipCanvas.height]).toEqual([SIZE, SIZE]);
        expect(ctx.calls[0]).toEqual(['clearRect', 0, 0, SIZE, SIZE]);
    });
});

describe('PictureInPictureManager.createVideoElement', () => {
    afterEach(() => {
        pictureInPictureManager.videoElement?.remove();
        pictureInPictureManager.videoElement = null;
    });

    test('@verified 2026-10-10: the hidden video is pinned to the top left so it adds no page scroll', () => {
        pictureInPictureManager.createVideoElement();
        const style = pictureInPictureManager.videoElement.style;
        expect([style.position, style.top, style.left]).toEqual(['absolute', '0px', '0px']);
        expect([style.opacity, style.pointerEvents]).toEqual(['0', 'none']);
    });
});

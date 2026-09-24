// synthetic: drives the PictureInPictureManager singleton's compositeFrame directly with a recording context.
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import settingsSync from './SettingsSync.js';
import {createRecordingContext} from '../__fixtures__/recordingContext.js';
import pictureInPictureManager from './PictureInPictureManager.js';

const SIZE = 500;
const HALF = SIZE / 2;

function makeCanvases() {
    return {
        mapCanvas: {width: SIZE, height: SIZE},
        drawCanvas: {width: SIZE, height: SIZE},
        ourPlayerCanvas: {width: SIZE, height: SIZE},
        uiCanvas: {width: SIZE, height: SIZE},
    };
}

function frame(canvases, rotateArgs) {
    const calls = [
        ['clearRect', 0, 0, SIZE, SIZE],
        ['save'],
    ];
    if (rotateArgs !== null) {
        calls.push(
            ['translate', HALF, HALF],
            ['rotate', rotateArgs],
            ['translate', -HALF, -HALF],
        );
    }
    calls.push(
        ['drawImage', canvases.mapCanvas, 0, 0],
        ['drawImage', canvases.drawCanvas, 0, 0],
        ['drawImage', canvases.ourPlayerCanvas, 0, 0],
        ['drawImage', canvases.uiCanvas, 0, 0],
        ['restore'],
    );
    return calls;
}

describe('PictureInPictureManager.compositeFrame rotation', () => {
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

    test('@verified 2026-09-24: rotation 270 rotates about the frame center, twice over two frames', () => {
        settingsSync.set('settingRadarRotation', '270');

        pictureInPictureManager.compositeFrame();
        pictureInPictureManager.compositeFrame();

        const rotated = frame(canvases, 3 * Math.PI / 2);
        expect(ctx.calls).toEqual([...rotated, ...rotated]);
    });

    test.each(['0', '45'])('@verified 2026-09-24: stored rotation %s gives no rotate call', (value) => {
        settingsSync.set('settingRadarRotation', value);

        pictureInPictureManager.compositeFrame();

        expect(ctx.calls).toEqual(frame(canvases, null));
    });
});

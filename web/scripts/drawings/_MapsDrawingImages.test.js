// synthetic: zone ids picked by hand, not observable in a capture. Reads the real zones.json and the shipped
// web/images/Maps folder; only canvas, settings and image cache are stubbed.

import {describe, test, expect, beforeAll, beforeEach, vi} from 'vitest';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

vi.mock('../utils/SettingsSync.js', () => ({
    default: {
        getBool: vi.fn(() => true),
        getFloat: vi.fn(() => null),
    },
}));

vi.mock('../utils/ImageCache.js', () => ({
    default: {
        GetPreloadedImage: vi.fn(() => ({width: 800, height: 800})),
        preloadImageAndAddToList: vi.fn(() => Promise.resolve()),
    },
}));

const {MapDrawing} = await import('./MapsDrawing.js');
const zonesDatabase = (await import('../data/ZonesDatabase.js')).default;
const imageCache = (await import('../utils/ImageCache.js')).default;

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..', '..');

function buildCtx() {
    return {
        width: 500,
        height: 500,
        fillStyle: '',
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage: vi.fn(),
    };
}

function requestedSrc(zoneId) {
    const drawing = new MapDrawing();
    drawing.getZoomLevel = vi.fn(() => 1.0);
    drawing.getCanvasCenter = vi.fn(() => 250);
    drawing.draw(buildCtx(), {id: zoneId, hX: 0, hY: 0});
    return imageCache.GetPreloadedImage.mock.calls[0][0];
}

beforeAll(() => {
    zonesDatabase.zones = JSON.parse(readFileSync(join(webRoot, 'ao-bin-dumps', 'zones.json'), 'utf8'));
});

beforeEach(() => {
    vi.clearAllMocks();
    zonesDatabase.clearAllMistOverrides();
});

describe('MapsDrawing requests the image shipped on disk', () => {
    test.each([
        ['Avalon road', 'TNL-201', 'TNL-001'],
        ['numbered passage', 'PSG-0039#2', 'PSG-0039'],
        ['zone whose id equals its file prefix', '1000', '1000'],
    ])('%s %s', (_label, zoneId, imageName) => {
        const src = requestedSrc(zoneId);

        expect(src).toBe(`/images/Maps/${imageName}.webp`);
        expect(existsSync(join(webRoot, src))).toBe(true);
    });

    test('Mist instance keeps its own id: no map image is shipped for it', () => {
        zonesDatabase.setMistOverride('@MISTS@abc', '3316');

        const src = requestedSrc('@MISTS@abc');

        expect(src).toBe('/images/Maps/@MISTS@abc.webp');
        expect(existsSync(join(webRoot, src))).toBe(false);
    });
});

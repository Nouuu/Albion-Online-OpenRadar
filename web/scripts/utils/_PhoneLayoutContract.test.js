// synthetic: source text and template markup, not a capture.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {mountPage} from '../__fixtures__/pageMarkup.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const inputCss = readFileSync(join(ROOT, 'web/styles/input.css'), 'utf8');
const baseLayout = readFileSync(join(ROOT, 'internal/templates/layouts/base.gohtml'), 'utf8');

describe('phone layout contract', () => {
    test('input.css declares the phone-landscape custom variant', () => {
        expect(inputCss).toContain('@custom-variant phone-landscape (@media (orientation: landscape) and (max-height: 500px));');
    });

    test('base.gohtml uses h-dvh, not h-screen', () => {
        expect(baseLayout).toContain('h-dvh');
        expect(baseLayout).not.toContain('h-screen');
    });

    test('the radar settings panel markup holds no hidden sm: class', () => {
        mountPage('radar');
        const panel = document.getElementById('radarSettingsPanel');
        expect(panel).not.toBeNull();
        expect(panel.outerHTML).not.toContain('hidden sm:');
    });

    test('radar canvases carry no sm:m-2.5 and the container carries ring-2', () => {
        mountPage('radar');
        const container = document.getElementById('canvasContainer');
        expect(container.className).toContain('ring-2');
        for (const canvas of container.querySelectorAll('canvas')) {
            expect(canvas.className).not.toContain('sm:m-2.5');
        }
    });
});

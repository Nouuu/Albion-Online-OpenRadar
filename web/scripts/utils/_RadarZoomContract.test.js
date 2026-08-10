import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

const radarTemplate = readFileSync(
    'internal/templates/pages/radar.gohtml',
    'utf8',
);

describe('radar zoom range contract', () => {
    test('allows zooming out to ten percent for a wider view', () => {
        expect(radarTemplate).toContain(
            'id="settingRadarZoom" min="0.1" max="3" step="0.1"',
        );
        expect(radarTemplate).toContain(
            'Math.max(0.1, Math.min(3, value))',
        );
    });
});

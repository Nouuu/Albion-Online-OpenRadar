import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

const playersTemplate = readFileSync(
    'internal/templates/pages/players.gohtml',
    'utf8',
);

describe('alert sound ui contract', () => {
    // @verified 2026-08-23: the slider must reach silence and full, and write through settingsSync.
    test('the volume slider covers silence to full', () => {
        expect(playersTemplate).toContain(
            'id="settingSoundVolume" min="0" max="1" step="0.05"',
        );
        expect(playersTemplate).toContain(
            'settingsSync.setFloat("settingSoundVolume"',
        );
    });
});

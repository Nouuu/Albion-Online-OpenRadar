// synthetic: reads internal/templates/pages/players.gohtml as text, no capture involved
import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

const playersTemplate = readFileSync(
    'internal/templates/pages/players.gohtml',
    'utf8',
);

describe('player actions ui contract', () => {
    // @verified 2026-09-23: the switch lives in the Display card, next to the other radar and card toggles.
    test('the actions switch is a checkbox of the display card', () => {
        const at = playersTemplate.indexOf(
            '<input type="checkbox" id="settingShowPlayerActions" class="checkbox checkbox-primary">',
        );
        expect(at).toBeGreaterThan(playersTemplate.indexOf('id="settingShowPlayerHealthBar"'));
        expect(at).toBeLessThan(playersTemplate.indexOf('<!-- Alerts Section -->'));
    });

    // @verified 2026-09-23: bound like its neighbours, so it reads getBool with no default and stays off until ticked.
    test('the actions switch is bound through bindCheckbox', () => {
        expect(playersTemplate).toMatch(/\[[^\]]*"settingShowPlayerActions"[^\]]*\]\.forEach\(bindCheckbox\)/);
    });
});

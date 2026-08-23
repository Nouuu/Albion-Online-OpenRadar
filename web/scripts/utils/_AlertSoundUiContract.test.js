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

    // @verified 2026-08-23: a slider with no readout leaves the player guessing what they just set.
    test('the volume slider shows its level on hover', () => {
        expect(playersTemplate).toContain('id="settingSoundVolumeTip"');
        expect(playersTemplate).toContain('tip.dataset.tip');
    });

    // @verified 2026-08-23: preview binds to the button, never to the select, or arrowing fires audio.
    test('the picker and its preview button are labelled and keyboard safe', () => {
        expect(playersTemplate).toContain('<label for="settingSoundFile"');
        expect(playersTemplate).toContain('<select id="settingSoundFile"');
        expect(playersTemplate).toContain('aria-label="Play the selected alert sound"');
        expect(playersTemplate).toContain('addListener(previewEl, "click"');
        expect(playersTemplate).not.toContain('addListener(soundFileEl, "change", () => alertSound.preview');
    });

    // @verified 2026-08-23: a selection left over from a sound that no longer ships must not
    // leave the picker blank. AlertSound already resolves a stale name to the default and warns,
    // so the picker reads through it rather than assigning the stored string straight to the select.
    test('the picker resolves a stale selection through the catalog', () => {
        expect(playersTemplate).toContain('soundFileEl.value = alertSound.resolve().file');
        expect(playersTemplate).not.toContain('soundFileEl.value = settingsSync.get(');
    });

    // @verified 2026-08-23: the cooldown is a player setting, and zero must be reachable so every detection can sound.
    test('the cooldown slider reaches zero and three seconds', () => {
        expect(playersTemplate).toContain(
            'id="settingSoundCooldown" min="0" max="3000" step="100"',
        );
        expect(playersTemplate).toContain(
            'settingsSync.setNumber("settingSoundCooldown"',
        );
    });
});

// synthetic: players template mounted from internal/templates and checked against the settings registry.
import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {registryEntry} from './SettingsRegistry.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

const playersTemplate = readFileSync('internal/templates/pages/players.gohtml', 'utf8');

function bounds(key) {
    const slider = mountPage('players').querySelector(`input[type="range"][data-setting="${key}"]`);
    return [slider.min, slider.max, slider.step].map(Number);
}

describe('alert sound ui contract', () => {
    // @verified 2026-08-23: the slider must reach silence and full, and write through settingsSync.
    test('the volume slider covers silence to full', () => {
        const {min, max, step} = registryEntry('settingAlertSoundVolume');
        expect([min, max, step]).toEqual([0, 1, 0.05]);
        expect(bounds('settingAlertSoundVolume')).toEqual([0, 1, 0.05]);
    });

    // @verified 2026-08-23: a slider with no readout leaves the player guessing what they just set.
    test('the volume slider shows its level', () => {
        expect(mountPage('players').querySelector('[data-value-for="settingAlertSoundVolume"]')).not.toBeNull();
    });

    // @verified 2026-08-23: preview binds to the button, never to the select, or arrowing fires audio.
    test('the picker and its preview button are labelled and keyboard safe', () => {
        const root = mountPage('players');
        const select = root.querySelector('select[data-setting="settingAlertSoundFile"]');
        expect(root.querySelector(`label[for="${select.id}"]`)).not.toBeNull();
        expect(root.querySelector('#previewSound').getAttribute('aria-label')).toBe('Play the selected alert sound');
        expect(playersTemplate).toContain("querySelector('#previewSound').addEventListener('click', () => alertSound.preview()");
        expect(playersTemplate).not.toMatch(/'change',\s*\(\)\s*=>\s*alertSound\.preview/);
    });

    // @verified 2026-08-23: a selection left over from a sound that no longer ships must not
    // leave the picker blank. AlertSound already resolves a stale name to the default and warns,
    // so the picker reads through it rather than assigning the stored string straight to the select.
    test('the picker resolves a stale selection through the catalog', () => {
        expect(playersTemplate).toContain('.value = alertSound.resolve().file');
    });

    // @verified 2026-08-23: the cooldown is a player setting, and zero must be reachable so every detection can sound.
    test('the cooldown slider reaches zero and three seconds', () => {
        const {min, max, step} = registryEntry('settingAlertSoundCooldown');
        expect([min, max, step]).toEqual([0, 3000, 100]);
        expect(bounds('settingAlertSoundCooldown')).toEqual([0, 3000, 100]);
    });
});

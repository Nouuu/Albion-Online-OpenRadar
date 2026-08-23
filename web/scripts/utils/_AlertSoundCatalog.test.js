// synthetic: the catalog is a static declaration, not observable in a capture
import {readdirSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

import {ALERT_SOUNDS, DEFAULT_SOUND, LICENCE_EXEMPT, findSound, defaultSound} from './AlertSoundCatalog.js';

describe('AlertSoundCatalog', () => {
    // @verified 2026-08-23: a catalog entry with no file on disk is a silent alert in production.
    test('synthetic: every entry names a file present under web/sounds', () => {
        const onDisk = readdirSync('web/sounds');
        for (const entry of ALERT_SOUNDS) {
            expect(onDisk).toContain(entry.file);
        }
    });

    // @verified 2026-08-23: the project is MIT and ships a public binary, so terms travel with the file.
    test('synthetic: every entry records a source and a licence', () => {
        for (const entry of ALERT_SOUNDS) {
            expect(entry.source).toBeTruthy();
            expect(entry.licence).toBeTruthy();
        }
    });

    // @verified 2026-08-23: only the sound that predates the catalog may claim an unknown origin.
    test('synthetic: a sound added by this feature cannot record an unknown licence', () => {
        for (const entry of ALERT_SOUNDS.filter(e => !LICENCE_EXEMPT.includes(e.file))) {
            expect(entry.licence).not.toBe('unknown');
        }
    });

    // @verified 2026-08-23: the fallback target must itself be in the list.
    test('synthetic: the default is in the catalog', () => {
        expect(findSound(DEFAULT_SOUND)).not.toBeNull();
        expect(defaultSound().file).toBe(DEFAULT_SOUND);
    });

    // @verified 2026-08-23: an unknown stored value must be reportable, not silently coerced.
    test('synthetic: an unknown file resolves to null', () => {
        expect(findSound('nope.mp3')).toBeNull();
    });

    // @verified 2026-08-23: the picker renders these, so a blank label would render a blank option.
    test('synthetic: every entry carries a display label', () => {
        for (const entry of ALERT_SOUNDS) {
            expect(entry.label).toBeTruthy();
        }
    });
});

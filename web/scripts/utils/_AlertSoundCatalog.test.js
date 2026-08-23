// synthetic: the catalog is a static declaration, not observable in a capture
import {readdirSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

import {ALERT_SOUNDS, DEFAULT_SOUND, findSound} from './AlertSoundCatalog.js';

describe('AlertSoundCatalog', () => {
    // @verified 2026-08-23: a catalog entry with no file on disk is a silent alert in production.
    test('synthetic: every entry names a file present under web/sounds', () => {
        const onDisk = readdirSync('web/sounds');
        for (const entry of ALERT_SOUNDS) {
            expect(onDisk).toContain(entry.file);
        }
    });

    // @verified 2026-08-23: a file dropped under web/sounds with no entry never reaches the picker,
    // and the Go process decodes it at startup for nothing. The drift has to fail on both sides.
    test('synthetic: every sound under web/sounds has an entry', () => {
        const onDisk = readdirSync('web/sounds').filter(f => f.toLowerCase().endsWith('.wav'));
        const catalogued = ALERT_SOUNDS.map(entry => entry.file);
        expect(onDisk.filter(file => !catalogued.includes(file))).toEqual([]);
    });


    // @verified 2026-08-23: the fallback target must itself be in the list.
    test('synthetic: the default is in the catalog', () => {
        expect(findSound(DEFAULT_SOUND)).not.toBeNull();
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

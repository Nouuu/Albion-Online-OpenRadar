// synthetic: the shipped README text is a build artifact, not something a capture can observe
import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

const generator = readFileSync('tools/generate-readmes.ts', 'utf8');

describe('shipped release README contract', () => {
    // @verified 2026-08-14: cmd/radar/main.go resolves interfaces through resolvePersisted, there is no prompt.
    test('synthetic: does not tell the user to pick an adapter at startup', () => {
        expect(generator).not.toMatch(/select your network adapter/i);
        expect(generator).not.toMatch(/adapter selection prompt/i);
    });

    // @verified 2026-08-14: interfaces are auto-selected on first boot and changed from the settings page.
    test('synthetic: points at the settings page for interface changes', () => {
        expect(generator).toMatch(/Settings -> Network/);
    });

    // @verified 2026-08-14: the startup banner prints a LAN URL, which is what answers the two-PC question.
    test('synthetic: mentions the LAN URL', () => {
        expect(generator).toMatch(/LAN/);
    });

    // @verified 2026-08-14: the release notes require 1.87+, the README used to say 1.84 and link that installer.
    test('synthetic: requires the same Npcap version as the release notes', () => {
        expect(generator).toMatch(/1\.87/);
        expect(generator).not.toMatch(/npcap-1\.84\.exe/);
    });

    // @verified 2026-08-14: a bare -ldflags "-s -w" build measures 61 MB, not the 95 MB the text claimed.
    test('synthetic: carries no hardcoded binary size', () => {
        expect(generator).not.toMatch(/~?\d+\s*MB/);
    });
});

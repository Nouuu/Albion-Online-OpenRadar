// synthetic: public docs are build artifacts checked against HEAD, not something a capture can observe.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, test, expect} from 'vitest';
import {MIGRATION_ROWS} from './SettingsRegistry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');

function toPosix(p) {
    return p.split('\\').join('/');
}

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

function read(relPath) {
    return readFileSync(join(ROOT, relPath), 'utf8');
}

function normalize(text) {
    return text.replace(/\s+/g, ' ');
}

function docFiles() {
    return [join(ROOT, 'README.md'), ...walk(join(ROOT, 'docs'))]
        .map(absFile => ({absFile, relFile: toPosix(relative(ROOT, absFile))}))
        .filter(({relFile}) => relFile.endsWith('.md'))
        .filter(({relFile}) => !relFile.startsWith('docs/releases/'));
}

const legacyTokens = MIGRATION_ROWS
    .filter(row => row.migration !== 'keep' && row.legacyKey !== null && row.legacyKey !== row.key)
    .map(row => row.legacyKey);

describe('docs contract', () => {
    // @verified 2026-09-25: every renamed setting key stays out of shipped docs under its old name.
    test('no legacy setting key appears backticked in README or docs, outside releases', () => {
        const hits = [];
        for (const {absFile, relFile} of docFiles()) {
            const content = readFileSync(absFile, 'utf8');
            for (const legacyKey of legacyTokens) {
                if (content.includes('`' + legacyKey + '`')) hits.push(`${relFile}: \`${legacyKey}\``);
            }
        }
        expect(hits).toEqual([]);
    });

    const logging = read('docs/technical/LOGGING.md');

    // @verified 2026-09-25: web/scripts/logger.js dropped LoggerClient, the CATEGORY_SETTINGS_MAP name and the
    // raw-packet toggles; the settings banner text changed with the Logging section rewrite.
    test('LOGGING.md carries no retired logger internals', () => {
        for (const forbidden of [
            'LoggerClient', 'CATEGORIES.MOB,', 'EVENTS.', 'CATEGORY_SETTINGS_MAP',
            'settingDebugRawPackets', 'Errors are always saved on the backend side',
        ]) {
            expect(logging).not.toContain(forbidden);
        }
    });

    // @verified 2026-09-25: web/scripts/logger.js exposes Logger.shouldLog(level, category); boot order comes
    // from cmd/radar/main.go's bootInterfaces; the banner text is copied from settings.gohtml verbatim.
    test('LOGGING.md describes the current logger filter, boot flow and banner', () => {
        const flat = normalize(logging);
        expect(flat).toContain('Logger.shouldLog(level, category)');
        expect(flat).toContain('bootInterfaces');
        expect(flat).toContain('Backend errors are always saved to');
        expect(flat).toContain('Browser errors are saved only while this browser sends its logs');
    });

    const readme = read('README.md');

    // @verified 2026-09-25: manual radar rotation and the Rings control were removed from the radar panel.
    test('README Radar Controls table has no Rings control', () => {
        expect(readme).not.toMatch(/\bRings\b/);
    });

    // @verified 2026-09-25: internal/server/network_api.go, settings_api.go and settings.gohtml host-lock text.
    test('README carries the current LAN, threat, alert, map background and chest facts', () => {
        const flat = normalize(readme);
        expect(flat).toContain(normalize(
            'Network interfaces, backend logs and pcap recording can only be changed from the PC running the radar. '
            + 'Another device can open Settings, but those controls are disabled.'
        ));
        expect(flat).toContain('hostile-flagged players only (faction warfare flags do not alert)');
        expect(flat).toContain(normalize(
            'An alert flashes the screen and plays a sound, each with its own toggle on the Players page. '
            + 'While a threat is around, the radar border pulses red. Players on your ignore list never flash, '
            + 'sound or pulse the border. Alerts need player detection on.'
        ));
        expect(flat).toContain('Turn off Map background in the radar settings panel on the Radar page.');
        expect(flat).toMatch(/chest name/i);
        expect(flat).toMatch(/not drawn/i);
    });

    const players = read('docs/technical/PLAYERS.md');

    const playersFlat = normalize(players);

    // @verified 2026-09-25: web/scripts/core/EventRouter.js dispatch table for player-touching event codes.
    // Table rows are single lines in the source, so these match on the raw (un-flattened) file.
    test('PLAYERS.md event table matches the router dispatch at HEAD', () => {
        expect(players).toMatch(/29[^\n]*spawn[^\n]*no health/i);
        expect(players).toMatch(/Leave[^\n]*\|\s*1\s*\|[^\n]*despawn/i);
        expect(players).toMatch(/6[^\n]*current HP[^\n]*P(?:arameters)?\[3\]/);
        expect(players).toMatch(/90[^\n]*equipment/i);
        expect(players).toMatch(/91[^\n]*current and max HP[^\n]*P(?:arameters)?\[2\][^\n]*P(?:arameters)?\[3\]/);
        expect(players).toMatch(/211[^\n]*mounted/i);
        expect(players).toMatch(/365[^\n]*P(?:arameters)?\[0\][^\n]*P(?:arameters)?\[1\]/);
        expect(playersFlat).toMatch(/Move[^.]*\b3\b[^.]*not used for players/i);
        expect(playersFlat).toMatch(/HealthUpdates[^.]*\b7\b[^.]*not used for players/i);
    });

    // @verified 2026-09-25: RadarRenderer.js reads PlayersHandler.getThreatPlayers, which excludes ignored players.
    test('PLAYERS.md states ignored players do not pulse the border', () => {
        expect(playersFlat).toMatch(/ignored players[^.]*do not pulse the border/i);
    });
});

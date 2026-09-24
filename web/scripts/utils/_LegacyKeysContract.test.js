// synthetic: contract asserting no renamed setting key still appears under its legacy name.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, test, expect} from 'vitest';
import {MIGRATION_ROWS} from './SettingsRegistry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');

const EXCLUDED_FILES = new Set([
    'web/scripts/utils/SettingsRegistry.js',
    'web/scripts/utils/SettingsMigration.js',
    'web/scripts/utils/_SettingsRegistry.test.js',
    'web/scripts/utils/_SettingsMigration.test.js',
    'web/scripts/utils/_SettingsSync.test.js',
    'web/scripts/utils/_LegacyKeysContract.test.js',
]);

const EXCLUDED_DIR_PREFIXES = [
    'web/scripts/__fixtures__/settings/',
];

const KNOWN_EXCEPTIONS = [
    {file: 'internal/templates/layouts/base.gohtml', legacyKey: 'sidebarCollapsed', allowed: 1},
];

const LEGACY_BUILDER_PREFIXES = ['settingStatic', 'settingLiving', 'settingMistE', 'settingDungeonE'];

const SCAN_ROOTS = ['web/scripts', 'internal/templates'];

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

function toPosix(p) {
    return p.split('\\').join('/');
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const legacyRows = MIGRATION_ROWS.filter(r => r.key !== null && r.legacyKey !== null && r.legacyKey !== r.key);

function scannableFiles() {
    return SCAN_ROOTS.flatMap(scanRoot => walk(join(ROOT, scanRoot)))
        .map(absFile => ({absFile, relFile: toPosix(relative(ROOT, absFile))}))
        .filter(({relFile}) => !EXCLUDED_FILES.has(relFile))
        .filter(({relFile}) => !EXCLUDED_DIR_PREFIXES.some(prefix => relFile.startsWith(prefix)));
}

describe('legacy setting keys contract', () => {
    test('no legacy key literal remains outside the migration layer', () => {
        const hits = [];

        for (const {absFile, relFile} of scannableFiles()) {
            const content = readFileSync(absFile, 'utf8');

            for (const {legacyKey, key} of legacyRows) {
                const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(legacyKey)}(?![A-Za-z0-9_])`, 'g');
                const count = (content.match(re) ?? []).length;
                if (count === 0) continue;

                const exception = KNOWN_EXCEPTIONS.find(e => e.file === relFile && e.legacyKey === legacyKey);
                const allowed = exception ? exception.allowed : 0;
                if (count > allowed) {
                    hits.push(`${relFile}: found "${legacyKey}" ${count}x, expected "${key}"`);
                }
            }
        }

        expect(hits).toEqual([]);
    });

    test('no legacy prefix used by a dynamic key builder remains', () => {
        const hits = [];

        for (const {absFile, relFile} of scannableFiles()) {
            const content = readFileSync(absFile, 'utf8');

            for (const prefix of LEGACY_BUILDER_PREFIXES) {
                const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(prefix)}`, 'g');
                const count = (content.match(re) ?? []).length;
                if (count > 0) hits.push(`${relFile}: found builder prefix "${prefix}" ${count}x`);
            }

            const enchantsBacktickCount = (content.match(/Enchants`/g) ?? []).length;
            if (enchantsBacktickCount > 0) {
                hits.push(`${relFile}: found "Enchants\`" ${enchantsBacktickCount}x`);
            }
        }

        expect(hits).toEqual([]);
    });
});

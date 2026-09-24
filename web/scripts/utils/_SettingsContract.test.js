// synthetic: source scan of production scripts and templates for settings access rules.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, test, expect} from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const SCAN_ROOTS = ['web/scripts', 'internal/templates'];
const STORAGE_OWNERS = new Set(['web/scripts/utils/SettingsSync.js', 'web/scripts/utils/SettingsMigration.js']);
const STORAGE_EXCEPTIONS = {
    'internal/templates/layouts/base.gohtml': 3,
};

const GETTER = /settingsSync\??\.(get|getBool|getNumber|getFloat|getJSON)\(/g;
const LITERAL_FALLBACK = /^\s*(\|\||\?\?)\s*(-?\d|'|"|`|true\b|false\b|null\b|\[|\{)/;

function walk(dir) {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

function productionFiles() {
    return SCAN_ROOTS.flatMap(root => walk(join(ROOT, root)))
        .map(abs => ({abs, rel: relative(ROOT, abs).split('\\').join('/')}))
        .filter(({rel}) => !rel.includes('/__fixtures__/') && !/\/_[^/]*\.test\.js$/.test(rel));
}

function callEnd(content, openIndex) {
    let depth = 0;
    let topLevelComma = false;
    for (let i = openIndex; i < content.length; i++) {
        const ch = content[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            if (depth === 0) return {end: i + 1, topLevelComma};
        } else if (ch === ',' && depth === 1) topLevelComma = true;
    }
    return {end: content.length, topLevelComma};
}

function lineOf(content, index) {
    return content.slice(0, index).split('\n').length;
}

describe('settings access contract', () => {
    test('no settingsSync getter takes a caller default or a literal fallback', () => {
        const hits = [];
        for (const {abs, rel} of productionFiles()) {
            const content = readFileSync(abs, 'utf8');
            for (const match of content.matchAll(GETTER)) {
                const {end, topLevelComma} = callEnd(content, match.index + match[0].length - 1);
                if (topLevelComma) hits.push(`${rel}:${lineOf(content, match.index)} default argument`);
                if (LITERAL_FALLBACK.test(content.slice(end, end + 40))) {
                    hits.push(`${rel}:${lineOf(content, match.index)} literal fallback`);
                }
            }
        }
        expect(hits).toEqual([]);
    });

    test('localStorage is only touched by the settings store', () => {
        const hits = [];
        for (const {abs, rel} of productionFiles()) {
            if (STORAGE_OWNERS.has(rel)) continue;
            const count = (readFileSync(abs, 'utf8').match(/localStorage/g) ?? []).length;
            if (count > (STORAGE_EXCEPTIONS[rel] ?? 0)) hits.push(`${rel}: localStorage ${count}x`);
        }
        expect(hits).toEqual([]);
    });
});

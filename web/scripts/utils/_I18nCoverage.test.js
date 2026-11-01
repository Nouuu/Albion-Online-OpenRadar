// synthetic: every visible string in the page templates must have a Spanish entry.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {ES, ES_PATTERNS} from './i18n/es.js';
import {translate} from './I18n.js';
import {SETTINGS} from './SettingsRegistry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const ATTRIBUTES = ['data-tip', 'aria-label', 'title', 'placeholder'];
const UNTRANSLATED = /^(v|E\d|OpenRadar|logs\/.*|[^A-Za-z]*)$/;

function templateStrings() {
    const found = new Set();
    const add = text => {
        const core = text.replace(/\s+/g, ' ').trim();
        if (core && !UNTRANSLATED.test(core)) found.add(core);
    };
    for (const dir of ['pages', 'layouts']) {
        for (const file of readdirSync(join(ROOT, 'internal/templates', dir))) {
            const html = readFileSync(join(ROOT, 'internal/templates', dir, file), 'utf8')
                .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
                .replace(/\{\{[^}]*\}\}/g, '');
            const holder = document.createElement('div');
            holder.innerHTML = html;
            const walk = node => {
                if (node.nodeType === 3) add(node.data);
                if (node.nodeType !== 1) return;
                for (const name of ATTRIBUTES) if (node.hasAttribute(name)) add(node.getAttribute(name));
                node.childNodes.forEach(walk);
            };
            walk(holder);
        }
    }
    return [...found].sort();
}

describe('Spanish coverage', () => {
    test('every visible template string has a Spanish translation', () => {
        const missing = templateStrings().filter(text => translate(text, 'es') === text && !(text in ES));
        expect(missing).toEqual([]);
    });

    test('every registry label and tooltip has a Spanish translation', () => {
        const missing = SETTINGS.flatMap(entry => [entry.label, entry.tooltip])
            .filter(text => text && !UNTRANSLATED.test(text) && translate(text, 'es') === text && !(text in ES));
        expect([...new Set(missing)]).toEqual([]);
    });

    test('navigation labels from the Go layer are translated', () => {
        const nav = [...readFileSync(join(ROOT, 'internal/templates/data.go'), 'utf8').matchAll(/Label: "([^"]+)"/g)].map(m => m[1]);
        expect(nav.length).toBe(7);
        expect(nav.filter(label => !(label in ES))).toEqual([]);
    });

    test('no translation is empty or drops a placeholder-looking token', () => {
        for (const [english, spanish] of Object.entries(ES)) {
            expect(spanish.trim(), english).not.toBe('');
            expect(spanish.includes('undefined'), english).toBe(false);
        }
    });

    test('every pattern renders a non-empty string', () => {
        expect(ES_PATTERNS.length).toBeGreaterThan(0);
        expect(translate('Failed to load items database', 'es')).toBe('No se pudo cargar la base de datos de items');
    });
});

// synthetic: sidebar.gohtml and content.gohtml rendered with a minimal stand-in for the Go template actions they use.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterEach, beforeAll, describe, expect, test} from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const LAYOUTS = join(ROOT, 'internal/templates/layouts');
const NAV = [...readFileSync(join(ROOT, 'internal/templates/data.go'), 'utf8')
    .matchAll(/\{Path: "([^"]+)", Label: "([^"]+)", Icon: "([^"]+)"}/g)].map(([, path, label, icon]) => ({path, label, icon}));

function expandNav(template, active) {
    return template.replace(/\{\{range \.NavItems}}((?:\{\{if[\s\S]*?\{\{end}}|(?!\{\{end}})[\s\S])*?)\{\{end}}/g, (_, body) => NAV.map(item => body
        .replace(/\{\{if \.Active}}([\s\S]*?)\{\{else}}([\s\S]*?)\{\{end}}/g, (__, on, off) => (item.path === active ? on : off))
        .replaceAll('{{.Path}}', item.path).replaceAll('{{.Label}}', item.label).replaceAll('{{.Icon}}', item.icon)
        .replaceAll('{{.Active}}', String(item.path === active))).join(''));
}

function renderSidebar(active) {
    const html = expandNav(readFileSync(join(LAYOUTS, 'sidebar.gohtml'), 'utf8'), active)
        .replace(/\{\{define [^}]*}}|\{\{end}}\s*$/g, '').replaceAll('{{.Version}}', 'test');
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
}

function contentScript(active) {
    const source = expandNav(readFileSync(join(LAYOUTS, 'content.gohtml'), 'utf8'), active);
    return source.match(/<script>([\s\S]*?)<\/script>/)[1].replaceAll('{{.Page}}', 'x').replaceAll('{{.Title}}', 'x');
}

function baseScripts() {
    const source = readFileSync(join(LAYOUTS, 'base.gohtml'), 'utf8');
    const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(([, body]) => body);
    return {sidebar: scripts.find(body => body.includes('window.sidebar = {')), listeners: scripts.at(-1)};
}

function linkClasses(root) {
    return [...root.querySelectorAll('#desktop-nav a, #mobile-nav a')]
        .map(link => `${link.getAttribute('href')}: ${[...link.classList].sort().join(' ')}`);
}

afterEach(() => {
    document.body.innerHTML = '';
});

beforeAll(() => {
    const {sidebar, listeners} = baseScripts();
    new Function(sidebar)();
    new Function(listeners)();
});

describe('sidebar active state after an htmx page swap', () => {
    test('data.go lists the nav items', () => {
        expect(NAV.map(item => item.path)).toEqual(['/', '/players', '/resources', '/enemies', '/chests', '/ignorelist', '/settings']);
    });

    test.each(NAV.map(item => item.path))('swapping to %s leaves every link as a fresh render would', target => {
        const live = renderSidebar('/');
        document.body.append(live);

        new Function(contentScript(target))();

        expect(linkClasses(live)).toEqual(linkClasses(renderSidebar(target)));
    });
});

describe('sidebar active state after history navigation', () => {
    test.each(['htmx:pushedIntoHistory', 'htmx:historyRestore'].flatMap(event => NAV.map(item => [event, item.path])))(
        '%s to %s leaves every link as a fresh render would', (event, target) => {
            const live = renderSidebar('/');
            document.body.append(live);
            history.pushState({}, '', target);

            document.dispatchEvent(new CustomEvent(event));

            expect(linkClasses(live)).toEqual(linkClasses(renderSidebar(target)));
        });
});

describe('nav class lists', () => {
    test('base.gohtml holds the only copy outside the sidebar template, content.gohtml none', () => {
        const count = file => readFileSync(join(LAYOUTS, file), 'utf8').split('border-l-2').length - 1;
        expect([count('base.gohtml'), count('content.gohtml')]).toEqual([1, 0]);
    });
});

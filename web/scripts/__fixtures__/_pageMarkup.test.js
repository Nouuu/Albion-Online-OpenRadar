// synthetic: mounts the committed page templates, no capture involved.

import {afterEach, describe, expect, test} from 'vitest';
import {mountPage} from './pageMarkup.js';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('mountPage', () => {
    test('mounts the page body under #page-content with its data-page', () => {
        const root = mountPage('enemies');

        expect(root).toBe(document.getElementById('page-content'));
        expect(root.tagName).toBe('MAIN');
        expect(root.dataset.page).toBe('enemies');
        expect(root.innerHTML).not.toContain('{{');
        expect(root.querySelector('script')).toBeNull();
        expect(root.querySelector('#settingEnemiesBoss')).not.toBeNull();
    });

    test.each(['chests', 'enemies', 'ignorelist', 'players', 'radar', 'resources', 'settings'])('mounts %s', name => {
        expect(mountPage(name).children.length).toBeGreaterThan(0);
    });

    test('throws for a template without a page define', () => {
        expect(() => mountPage('missing')).toThrow();
    });
});

// synthetic: page templates read from internal/templates and checked against the settings registry.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {MIGRATION_ROWS, SETTINGS, registryDefault, registryEntry} from './SettingsRegistry.js';
import {mountPage} from '../__fixtures__/pageMarkup.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const PAGES_DIR = join(ROOT, 'internal/templates/pages');
const LAYOUTS_DIR = join(ROOT, 'internal/templates/layouts');

const CONTROL_COUNT_EXCEPTIONS = {settingPlayersDetect: 2, settingUiSidebarCollapsed: 0};

const LABELS = {
    settingRadarZoom: 'Zoom',
    settingRadarSize: 'Max size',
    settingRadarFitToScreen: 'Fit to screen',
    settingRadarIconSize: 'Icon size',
    settingRadarMapBackground: 'Map background',
    settingRadarHudZoneInfo: 'Zone info box',
    settingRadarHudStats: 'Stats box',
    settingRadarPlayersBeside: 'Players beside radar',
    settingRadarResourceCount: 'Resource count',
    settingRadarResourceDistance: 'Resource distance',
    settingRadarResourceTierBadges: 'Resource tier color badges',
    settingRadarResourceClusters: 'Resource clusters',
    settingRadarClusterRadius: 'Cluster radius (m)',
    settingRadarClusterMinSize: 'Min nodes per cluster',
    settingUiRadarSettingsOpen: 'Radar settings',
    settingPlayersDetect: 'Detect players',
    settingPlayersShowHealthBars: 'Show health bars',
    settingEnemiesShowHealthBars: 'Show health bars',
    settingResourcesShowHealthBars: 'Show health bars',
    settingEnemiesChampion: 'Champion',
    settingDebugEnemiesUnidentified: 'Show unidentified enemies',
    settingLogToServer: 'Save browser logs',
    settingDebugWsCoalescing: 'Merge entity updates per frame',
};

const NOT_DETECTED = 'Not detected yet: no mob is classified as this type today.';
const CATEGORY_TIP = 'Keep DEBUG and INFO entries of this area. WARN and above ignore this filter.';

const TOOLTIPS = {
    settingRadarSize: 'Width and height in pixels, shrunk on small windows. Ignored while Fit to screen is on.',
    settingRadarFitToScreen: 'Largest square that fits the window, up to 1200 px, next to the player list when the list sits beside. Overrides Max size.',
    settingRadarHudZoneInfo: 'Top-left box with the zone name, tier and a PvP marker.',
    settingRadarHudStats: 'Top-right box: resource and mob counts, plus player count when detection is on.',
    settingRadarPlayersBeside: 'Shows the player list to the right of the radar when the window is wide enough.',
    settingRadarResourceCount: 'Estimated count from size/tier, bonuses excluded. Fishing shows spawned/total fish.',
    settingRadarResourceDistance: 'Distance in meters: hidden under 2 m, green under 10 m, yellow 10-19 m, orange 20 m+.',
    settingRadarResourceTierBadges: 'Colored squares by type instead of icons, with tier. Living creatures get a gold border.',
    settingRadarClusterRadius: 'Groups same-type, same-tier resources within this range. Default 30 m.',
    settingRadarClusterMinSize: 'Smallest group drawn as a cluster. Default: 2.',
    settingRadarResourceClusters: 'Circles groups of nearby same-type nodes, with count and distance. Only nodes your filters show are grouped.',
    settingPlayersDetect: 'Tracks players in range. Off: no player list, no player counts, no flash, border or sound.',
    settingPlayersHostile: 'Players flagged hostile, meaning everyone in black zones. Does not affect alerts.',
    settingAlertFlash: 'Flashes on threats: hostile players in yellow/red, anyone in black. Ignored names excluded.',
    settingAlertSound: 'Plays the alert sound on the radar PC, same trigger rule as Screen Flash. Ignored names never trigger it.',
    settingAlertBorder: 'Pulses a red border around the radar while a threat is in range. Ignored names do not count.',
    settingAlertSoundCooldown: 'Minimum delay between two alert sounds. At zero, every alert plays.',
    settingEnemiesChampion: 'Champion mobs, and solo mobs in random dungeons.',
    settingEnemiesMinHealthFilter: 'Hides enemies whose max HP is below the minimum, unidentified ones included. Drones, Mists bosses, events and living resources are exempt.',
    settingEnemiesAvalonianDrones: NOT_DETECTED,
    settingEnemiesEvent: NOT_DETECTED,
    settingDebugEnemiesUnidentified: 'Shows enemies missing from mob data, usually new post-update mobs. Type filters skip them.',
    settingDebugResourcesTypeId: 'Draws the internal type ID on resource nodes and living resources (debug).',
    settingDebugResourcesDbName: 'Shows the DB name mapped from the wire type ID (debug, for offset verification).',
    settingDebugWsCoalescing: 'Keeps only the latest move, health and regen update per entity each frame.',
    settingDebugBackendLogs: 'Logs one line per game event to logs/sessions/. Only changeable on the radar PC.',
    settingDebugPcapRecording: 'Records UDP 5056 traffic to logs/captures/, one file per interface. PC-only setting.',
    settingLogToServer: 'Saves filtered entries on the radar PC in logs/debug/. Errors are also copied to logs/errors/.',
    settingLogLevel: 'The lowest level shown, though DEBUG and INFO also need their category on. OFF disables all logging.',
    ...Object.fromEntries(SETTINGS.filter(entry => entry.key.startsWith('settingLogCategory')).map(entry => [entry.key, CATEGORY_TIP])),
};

const NO_TOOLTIP = ['settingPlayersShowEquipment', 'settingPlayersShowSpells', 'settingEnemiesNormal', 'settingEnemiesMiniBoss',
    'settingEnemiesBoss', 'settingEnemiesMistsCrystalSpider', 'settingEnemiesMistsFairyDragon', 'settingEnemiesMistsVeilWeaver',
    'settingEnemiesMistsGriffin', 'settingResourcesFishing', 'settingChestsGreen', 'settingChestsBlue', 'settingChestsPurple',
    'settingChestsYellow', 'settingMistsSolo', 'settingMistsDuo', 'settingMistsWispCages', 'settingMistsWisps',
    'settingMistsKnightfallAbbey', 'settingDungeonsSolo', 'settingDungeonsGroup', 'settingLogToConsole'];

function templateOf(name) {
    return readFileSync(join(PAGES_DIR, `${name}.gohtml`), 'utf8');
}

function pageNames() {
    return readdirSync(PAGES_DIR).filter(file => file.endsWith('.gohtml')).map(file => file.replace('.gohtml', ''));
}

function scriptOf(name) {
    const lines = readFileSync(join(PAGES_DIR, `${name}.gohtml`), 'utf8').split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === `{{define "scripts/${name}"}}`);
    const end = lines.findIndex((line, index) => index > start && line.trim() === '{{end}}');
    return start < 0 ? '' : lines.slice(start + 1, end).join('\n');
}

function loadPages() {
    const pages = pageNames().map(name => ({name, root: mountPage(name).cloneNode(true)}));
    for (const file of readdirSync(LAYOUTS_DIR)) {
        const root = document.createElement('div');
        root.innerHTML = readFileSync(join(LAYOUTS_DIR, file), 'utf8');
        pages.push({name: `layouts/${file}`, root});
    }
    document.body.innerHTML = '';
    return pages;
}

const pages = loadPages();

function all(selector) {
    return pages.flatMap(page => [...page.root.querySelectorAll(selector)].map(el => ({page: page.name, el})));
}

function normalized(el) {
    return el.textContent.replace(/\s+/g, ' ').trim();
}

const controls = all('[data-setting]');

function controlCount(key) {
    return controls.filter(({el}) => el.dataset.setting === key).length;
}

describe('template settings contract', () => {
    test('every data-setting names a registry key', () => {
        const unknown = controls.filter(({el}) => !registryEntry(el.dataset.setting))
            .map(({page, el}) => `${page}: ${el.dataset.setting}`);
        expect(unknown).toEqual([]);
    });

    test('every label element shows the registry label', () => {
        const drift = all('[data-setting-label]').flatMap(({page, el}) => {
            const label = registryEntry(el.dataset.settingLabel)?.label;
            return label && normalized(el) === label ? [] : [`${page}: ${el.dataset.settingLabel} "${normalized(el)}" vs "${label}"`];
        });
        expect(drift).toEqual([]);
    });

    test('every bound control outside a matrix has its label on the same page', () => {
        const missing = controls.filter(({page, el}) => registryEntry(el.dataset.setting)?.shape !== 'matrix'
            && !all(`[data-setting-label="${el.dataset.setting}"]`).some(label => label.page === page))
            .map(({page, el}) => `${page}: ${el.dataset.setting}`);
        expect(missing).toEqual([]);
    });

    test('every tooltip element carries the registry tooltip', () => {
        const drift = all('[data-setting-tip]').flatMap(({page, el}) => {
            const tooltip = registryEntry(el.dataset.settingTip)?.tooltip;
            const ok = tooltip && el.classList.contains('tooltip') && el.dataset.tip === tooltip;
            return ok ? [] : [`${page}: ${el.dataset.settingTip} "${el.dataset.tip}" vs "${tooltip}"`];
        });
        expect(drift).toEqual([]);
    });

    test('every tooltip icon takes keyboard focus and is named by its tip', () => {
        const drift = all('[data-setting-tip]').flatMap(({page, el}) => {
            const focusables = el.querySelectorAll('[tabindex]');
            const target = focusables[0];
            const ok = focusables.length === 1 && target.getAttribute('tabindex') === '0'
                && target.getAttribute('role') === 'img' && target.getAttribute('aria-label') === el.dataset.tip
                && target.querySelector('i') !== null && !el.hasAttribute('tabindex');
            return ok ? [] : [`${page}: ${el.dataset.settingTip}`];
        });
        expect(drift).toEqual([]);
    });

    test('a control whose label holds a tooltip is named by its label text only', () => {
        const drift = pages.flatMap(({name, root}) => [...root.querySelectorAll('label [data-setting]')].flatMap(el => {
            const label = el.closest('label');
            if (!label.querySelector('.tooltip')) return [];
            const text = label.querySelector(`[data-setting-label="${el.dataset.setting}"]`);
            const id = el.getAttribute('aria-labelledby');
            const target = id ? root.querySelector(`[id="${id}"]`) : null;
            const ok = text !== null && (id
                ? target === text && !target.querySelector('.tooltip')
                : el.getAttribute('aria-label') === normalized(text));
            return ok ? [] : [`${name}: ${el.dataset.setting}`];
        }));
        expect(drift).toEqual([]);
    });

    test('every collapse toggle is named by its title', () => {
        const drift = pages.flatMap(({name, root}) => [...root.querySelectorAll('.collapse > input[type="checkbox"]')].flatMap(el => {
            const title = root.querySelector(`[data-setting-label="${el.dataset.setting}"]`);
            const id = el.getAttribute('aria-labelledby');
            const named = id ? root.querySelector(`[id="${id}"]`) === title : el.getAttribute('aria-label') === title?.textContent;
            return title && named ? [] : [`${name}: ${el.dataset.setting}`];
        }));
        expect(drift).toEqual([]);
    });

    test('ids are unique on every page', () => {
        const dupes = pages.flatMap(({name, root}) => {
            const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
            return ids.filter((id, index) => ids.indexOf(id) !== index).map(id => `${name}: ${id}`);
        });
        expect(dupes).toEqual([]);
    });

    test('every bound control with a registry tooltip shows it on the same page', () => {
        const missing = controls.filter(({page, el}) => registryEntry(el.dataset.setting)?.tooltip
            && !all(`[data-setting-tip="${el.dataset.setting}"]`).some(tip => tip.page === page))
            .map(({page, el}) => `${page}: ${el.dataset.setting}`);
        expect(missing).toEqual([]);
    });

    test('number and range controls carry the registry bounds and no placeholder or value', () => {
        const drift = all('input[type="number"][data-setting], input[type="range"][data-setting]').flatMap(({page, el}) => {
            const entry = registryEntry(el.dataset.setting);
            const attrs = ['min', 'max', 'step'].map(name => el.getAttribute(name));
            const ok = attrs.join() === [entry.min, entry.max, entry.step].map(String).join()
                && !el.hasAttribute('placeholder') && !el.hasAttribute('value');
            return ok ? [] : [`${page}: ${entry.key}`];
        });
        expect(drift).toEqual([]);
    });

    test('bound controls carry no default copy', () => {
        const copies = [
            ...all('input[type="range"][data-setting][value]'),
            ...all('input[type="checkbox"][data-setting][checked]'),
            ...all('[data-setting] input[type="radio"][checked]'),
            ...all('select[data-setting] option[selected]'),
            ...all('[data-value-for]').filter(({el}) => el.textContent.trim() !== ''),
        ].map(({page, el}) => `${page}: ${el.outerHTML.slice(0, 80)}`);
        expect(copies).toEqual([]);
    });

    test('each setting key has one control, with the declared exceptions', () => {
        const drift = SETTINGS.filter(entry => ['setting', 'ui', 'backend'].includes(entry.scope))
            .flatMap(({key}) => {
                const count = controlCount(key);
                const expected = CONTROL_COUNT_EXCEPTIONS[key] ?? 1;
                if (count === expected) return [];
                return [`${key}: ${count} controls, expected ${expected}`];
            });
        expect(drift).toEqual([]);
    });

    test('converted pages hold no input or select bound by id alone', () => {
        const unbound = pages.filter(({name}) => !name.startsWith('layouts/'))
            .flatMap(({name, root}) => [...root.querySelectorAll('input[id]:not([data-setting]), select[id]:not([data-setting])')]
                .filter(el => !el.closest('[data-setting]'))
                .map(el => `${name}: ${el.id}`));
        expect(unbound).toEqual([]);
    });

    test('removed keys have no control', () => {
        const left = MIGRATION_ROWS.filter(row => row.migration === 'remove')
            .flatMap(({legacyKey: key}) => pages.filter(({root}) => root.querySelector(`[data-setting="${key}"], [id="${key}"]`))
                .map(({name}) => `${name}: ${key}`));
        expect(left).toEqual([]);
    });

    test('each converted page registers through registerBoundPage', () => {
        const missing = pages.filter(({name}) => !name.startsWith('layouts/'))
            .filter(({name}) => !scriptOf(name).includes(`registerBoundPage('${name}'`))
            .map(({name}) => name);
        expect(missing).toEqual([]);
    });

    test('no template holds the RENDERING token', () => {
        const hits = [...pageNames().map(name => join(PAGES_DIR, `${name}.gohtml`)),
            ...readdirSync(LAYOUTS_DIR).map(file => join(LAYOUTS_DIR, file))]
            .filter(file => readFileSync(file, 'utf8').includes('RENDERING'));
        expect(hits).toEqual([]);
    });

    test('no script under web/scripts holds the RENDERING token', () => {
        const self = fileURLToPath(import.meta.url);
        const hits = readdirSync(join(ROOT, 'web/scripts'), {recursive: true})
            .map(file => join(ROOT, 'web/scripts', file))
            .filter(file => file.endsWith('.js') && file !== self)
            .filter(file => readFileSync(file, 'utf8').includes('RENDERING'));
        expect(hits).toEqual([]);
    });
});

describe('page removals', () => {
    test('resources page holds no radar display control and no stale logging tip', () => {
        const template = templateOf('resources');
        for (const key of ['settingRadarResourceCount', 'settingRadarResourceDistance', 'settingRadarResourceClusters',
            'settingRadarClusterRadius', 'settingRadarClusterMinSize']) {
            expect(template).not.toContain(key);
        }
        expect(template).not.toContain('ResourcesHelper');
    });
});

describe('enemies page', () => {
    const template = templateOf('enemies');
    const root = pages.find(page => page.name === 'enemies').root;

    test('offers only the All and Clear presets, through data-enemy-preset', () => {
        const presets = [...root.querySelectorAll('[data-enemy-preset]')];
        expect(presets.map(el => el.dataset.enemyPreset)).toEqual(['all', 'clear']);
        expect(presets.map(el => el.textContent.trim())).toEqual(['All', 'Clear']);
        expect(template).not.toContain('onclick="applyEnemyPreset');
        expect(template).not.toContain('Mini-Boss+');
        expect(template).not.toMatch(/>\s*Bosses\s*<\/button>/);
    });

    test('holds no All checkbox, no Debug collapse and no stale logging tip', () => {
        expect(template).not.toContain('settingAllEnemies');
        expect(template).not.toContain('collapse-debug');
    });
});

describe('collapsible settings sections', () => {
    const ADVANCED_CLOSED = ['settingUiSettingsLoggingOpen', 'settingUiSettingsDebugOpen', 'settingUiSettingsNetworkOpen'];
    const isHeader = el => el.classList.contains('card') && el.querySelector('h1') !== null;

    test.each(['enemies', 'resources', 'settings', 'players'])('%s: every top-level section is a collapse bound to a settingUi*Open key', name => {
        const root = pages.find(page => page.name === name).root;
        const container = root.querySelector('.space-y-6');
        const sections = [...container.children].filter(el => !isHeader(el) && !el.matches('[role="alert"]'));
        expect(sections.length).toBeGreaterThan(0);
        for (const section of sections) {
            expect(section.classList.contains('collapse'), section.outerHTML.slice(0, 80)).toBe(true);
            const checkbox = section.querySelector(':scope > input[type="checkbox"][data-setting]');
            const key = checkbox?.dataset.setting;
            expect(key, section.outerHTML.slice(0, 80)).toMatch(/^settingUi[A-Z][A-Za-z0-9]*Open$/);
            if (MIGRATION_ROWS.find(row => row.key === key)?.migration === 'new') {
                expect(registryDefault(key), key).toBe(!ADVANCED_CLOSED.includes(key));
            }
        }
    });
});

describe('stale logging links', () => {
    test.each(pageNames())('%s page links to no "Debug & Logging" section, in either spelling', name => {
        expect(templateOf(name)).not.toMatch(/Debug (&|&amp;) Logging/);
    });
});

describe('settings page', () => {
    const template = templateOf('settings');
    const root = pages.find(page => page.name === 'settings').root;
    const DEBUG_GROUPS = ['Enemies', 'Resources', 'Mists', 'Network traffic', 'Backend logs'];

    function keysOf(group) {
        return [...group.querySelectorAll('input')].map(el => el.dataset.setting ?? el.id).sort();
    }

    test('reads as logging, debug, network and reset options', () => {
        expect(normalized(root.querySelector('h1 + p'))).toBe('Logging, debug, network and reset options.');
    });

    test('holds no Display card, no Clear Cache, no throttle and no Rendering category', () => {
        expect(root.querySelector('[data-setting^="settingRadar"], [id^="settingRadar"]')).toBeNull();
        for (const gone of ['clearCache', 'caches.', 'bindNumber', 'Health Throttling', 'settingWsThrottling',
            'categoryRendering', 'Rendering']) {
            expect(template).not.toContain(gone);
        }
    });

    test('holds no inline backend toggle binding', () => {
        expect(template).not.toContain('bindBackendCheckbox');
        expect(template).not.toContain('setBool("settingPcapRecording"');
    });

    test('the Logging banner tells where backend and browser errors are saved', () => {
        const logging = root.querySelector('[data-setting="settingUiSettingsLoggingOpen"]').closest('.collapse');
        const banner = normalized(logging.querySelector('.collapse-content p'));
        expect(banner).toContain('Backend errors are always saved to logs/errors/.');
        expect(banner).toContain('Browser errors are saved only while this browser sends its logs (Settings > Logging > "Save browser logs").');
        expect(template).not.toContain('Errors are always saved on the backend side');
    });

    test('the Logging, Debug, Network and Danger Zone collapses are bound through data-setting', () => {
        const collapses = [...root.querySelectorAll('.collapse > input[type="checkbox"]')].map(el => el.dataset.setting);
        expect(collapses).toEqual(['settingUiSettingsLoggingOpen', 'settingUiSettingsDebugOpen', 'settingUiSettingsNetworkOpen',
            'settingUiSettingsDangerZoneOpen']);
    });

    test('Debug groups Enemies, Resources, Mists, Network traffic and Backend logs, then Export', () => {
        const debug = root.querySelector('[data-setting="settingUiSettingsDebugOpen"]').closest('.collapse')
            .querySelector('.collapse-content');
        const groups = [...debug.querySelectorAll('section')];
        expect(groups.map(group => normalized(group.querySelector('h3')))).toEqual(DEBUG_GROUPS);
        for (const [index, name] of DEBUG_GROUPS.entries()) {
            const expected = SETTINGS.filter(entry => entry.page === 'Settings' && entry.section === `Debug > ${name}`)
                .map(entry => entry.key).sort();
            expect(keysOf(groups[index]), name).toEqual(expected);
        }
        expect(debug.lastElementChild.querySelector('#downloadLogsBtn')).not.toBeNull();
    });
});

describe('registry labels and tooltips', () => {
    test.each(Object.entries(LABELS))('%s is labeled "%s"', (key, label) => {
        expect(registryEntry(key).label).toBe(label);
    });

    test.each(Object.entries(TOOLTIPS))('%s carries its tooltip verbatim', (key, tooltip) => {
        expect(registryEntry(key).tooltip).toBe(tooltip);
    });

    test.each(NO_TOOLTIP)('%s has no tooltip and no info icon', key => {
        expect(registryEntry(key).tooltip).toBe('');
        expect(all(`[data-setting-tip="${key}"]`)).toEqual([]);
    });

    test('every tooltip has at most 2 sentences and 30 words', () => {
        const long = SETTINGS.filter(entry => entry.tooltip).flatMap(({key, tooltip}) => {
            const sentences = tooltip.split(/[.!?](?:\s+|$)/).filter(part => part.trim()).length;
            const words = tooltip.trim().split(/\s+/).length;
            return sentences <= 2 && words <= 30 ? [] : [`${key}: ${sentences} sentences, ${words} words`];
        });
        expect(SETTINGS.filter(entry => entry.tooltip).length).toBeGreaterThan(30);
        expect(long).toEqual([]);
    });
});

describe('settings control tile contract', () => {
    const COLOR_CLASS = /^checkbox-(primary|secondary|accent|info|success|warning|error)$/;
    const ALLOWED_COLORS = {
        settingPlayersPassive: 'checkbox-success',
        settingPlayersFaction: 'checkbox-info',
        settingPlayersHostile: 'checkbox-error',
        settingEnemiesNormal: 'checkbox-info',
        settingEnemiesChampion: 'checkbox-secondary',
        settingEnemiesMiniBoss: 'checkbox-warning',
        settingEnemiesBoss: 'checkbox-error',
    };
    const inputCss = readFileSync(join(ROOT, 'web/styles/input.css'), 'utf8');
    const booleans = all('label > input[type="checkbox"][data-setting]');

    function booleanClassIssue(el) {
        const classes = [...el.classList];
        if (classes.includes('toggle')) {
            return classes.length === 3 && classes.includes('toggle-primary') && classes.includes('toggle-sm')
                ? null : `toggle classes "${classes.join(' ')}"`;
        }
        if (classes.includes('checkbox')) {
            if (!classes.includes('checkbox-xs')) return `missing checkbox-xs in "${classes.join(' ')}"`;
            const colors = classes.filter(name => COLOR_CLASS.test(name));
            if (colors.length !== 1) return `expected one color class, got "${colors.join(',')}"`;
            const expected = ALLOWED_COLORS[el.dataset.setting] ?? 'checkbox-primary';
            return colors[0] === expected ? null : `color "${colors[0]}" expected "${expected}"`;
        }
        return `neither toggle nor checkbox: "${classes.join(' ')}"`;
    }

    function rowShapeIssue(el) {
        const label = el.parentElement;
        if (!label || label.tagName !== 'LABEL') return 'is not a direct child of a label';
        const c = label.classList;
        const neutral = c.contains('rounded-lg') && c.contains('bg-base-300') && c.contains('cursor-pointer') && c.contains('group');
        const alert = (c.contains('bg-error/10') || c.contains('bg-warning/10'))
            && c.contains('border') && c.contains('cursor-pointer') && c.contains('group');
        return neutral || alert ? null : `label classes "${label.className}" are not the neutral tile or the alert card`;
    }

    test('every boolean control is toggle-primary toggle-sm or checkbox checkbox-xs with one color class', () => {
        const drift = booleans.flatMap(({page, el}) => {
            const issue = booleanClassIssue(el);
            return issue ? [`${page}: ${el.dataset.setting} - ${issue}`] : [];
        });
        expect(drift).toEqual([]);
    });

    test('every boolean control sits inside the neutral tile or the alert card', () => {
        const drift = booleans.flatMap(({page, el}) => {
            const issue = rowShapeIssue(el);
            return issue ? [`${page}: ${el.dataset.setting} - ${issue}`] : [];
        });
        expect(drift).toEqual([]);
    });

    test('every data-setting-tip is a div.tooltip with a w-3 h-3 opacity-50 icon', () => {
        const drift = all('[data-setting-tip]').flatMap(({page, el}) => {
            const issues = [];
            if (el.tagName !== 'DIV' || !el.classList.contains('tooltip')) issues.push('is not a div.tooltip');
            const icon = el.querySelector('i');
            if (!icon) issues.push('has no icon');
            else if (!icon.classList.contains('w-3') || !icon.classList.contains('h-3') || !icon.classList.contains('opacity-50')) {
                issues.push(`icon classes "${icon.className}"`);
            }
            return issues.map(issue => `${page}: ${el.dataset.settingTip} - ${issue}`);
        });
        expect(drift).toEqual([]);
    });

    test('every range is range-primary range-xs with a tabular-nums whitespace-nowrap readout', () => {
        const ranges = all('input[type="range"][data-setting]');
        const readouts = all('[data-value-for]');
        const drift = ranges.flatMap(({page, el}) => {
            const issues = [];
            if (!el.classList.contains('range-primary')) issues.push('missing range-primary');
            if (!el.classList.contains('range-xs')) issues.push('missing range-xs');
            const readout = readouts.find(r => r.page === page && r.el.dataset.valueFor === el.dataset.setting);
            if (!readout) {
                issues.push('has no readout');
            } else {
                if (!readout.el.classList.contains('tabular-nums')) issues.push('readout missing tabular-nums');
                if (!readout.el.classList.contains('whitespace-nowrap')) issues.push('readout missing whitespace-nowrap');
            }
            return issues.map(issue => `${page}: ${el.dataset.setting} - ${issue}`);
        });
        expect(drift).toEqual([]);
    });

    test('every range has one minus, one plus and one reset button on its key, named after its label', () => {
        const SHAPES = [['nudge', '-1', 'minus', 'Decrease'], ['nudge', '1', 'plus', 'Increase'], ['reset', null, 'rotate-ccw', 'Reset']];
        const drift = pages.flatMap(({name, root}) => [...root.querySelectorAll('input[type="range"][data-setting]')].flatMap(el => {
            const key = el.dataset.setting;
            const noun = registryEntry(key).label.toLowerCase();
            return SHAPES.flatMap(([kind, dir, icon, verb]) => {
                const selector = dir === null ? `[data-reset="${key}"]` : `[data-nudge="${key}"][data-dir="${dir}"]`;
                const found = [...root.querySelectorAll(selector)];
                if (found.length !== 1) return [`${name}: ${key} has ${found.length} ${icon} buttons`];
                const [button] = found;
                const glyph = button.querySelector('i[data-lucide]');
                const ok = button.tagName === 'BUTTON' && button.type === 'button'
                    && ['btn', 'btn-ghost', 'btn-xs', 'btn-square'].every(c => button.classList.contains(c))
                    && button.getAttribute('aria-label') === `${verb} ${noun}` && button.title === `${verb} ${noun}`
                    && glyph?.dataset.lucide === icon && glyph.classList.contains('w-3') && glyph.classList.contains('h-3')
                    && !button.closest('label') && !button.hasAttribute('tabindex')
                    && button.parentElement === el.parentElement;
                return ok ? [] : [`${name}: ${key} ${kind} ${icon} button shape`];
            });
        }));
        expect(drift).toEqual([]);
    });

    test('nudge and reset buttons only point at a bound range on their page', () => {
        const drift = pages.flatMap(({name, root}) => [...root.querySelectorAll('[data-nudge], [data-reset]')].flatMap(button => {
            const key = button.dataset.nudge ?? button.dataset.reset;
            return root.querySelector(`input[type="range"][data-setting="${key}"]`) ? [] : [`${name}: ${key}`];
        }));
        expect(drift).toEqual([]);
    });

    test('every range sits in a slider row named by its label: icon, label, tip, minus, range, plus, readout, reset', () => {
        const drift = pages.flatMap(({name, root}) => [...root.querySelectorAll('input[type="range"][data-setting]')].flatMap(el => {
            const key = el.dataset.setting;
            const row = el.parentElement;
            const order = [...row.children].map(child => {
                if (child.matches('i[data-lucide]')) return 'icon';
                if (child.matches(`[data-setting-label="${key}"]`)) return 'label';
                if (child.matches(`[data-setting-tip="${key}"]`) || child.matches('span.w-3[aria-hidden="true"]')) return 'tip';
                if (child.matches(`[data-nudge="${key}"][data-dir="-1"]`)) return 'minus';
                if (child === el) return 'range';
                if (child.matches(`[data-nudge="${key}"][data-dir="1"]`)) return 'plus';
                if (child.matches(`[data-value-for="${key}"]`)) return 'readout';
                if (child.matches(`[data-reset="${key}"]`)) return 'reset';
                return child.tagName;
            }).filter(part => part !== 'tip').join(' ');
            const c = row.classList;
            const tile = row.tagName === 'DIV' && ['flex', 'items-center', 'p-2', 'rounded-lg', 'bg-base-300'].every(name => c.contains(name));
            const named = el.getAttribute('aria-labelledby') === `label-${key}` && !el.hasAttribute('aria-label');
            const iconKept = row.firstElementChild.classList.contains('shrink-0');
            return tile && named && iconKept && order === 'icon label minus range plus readout reset' ? [] : [`${name}: ${key} "${order}"`];
        }));
        expect(drift).toEqual([]);
    });

    const LIST_TYPES = {
        items: ['grid', 'grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-3', 'gap-2'],
        pair: ['grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-2'],
        stack: ['grid', 'grid-cols-1', 'gap-2', 'max-w-xl'],
        sliders: ['grid', 'grid-cols-1', 'gap-2', 'max-w-2xl'],
    };
    const LISTS = {
        radar: {settingRadarZoom: 'sliders', settingRadarMapBackground: 'stack', settingRadarResourceCount: 'stack'},
        players: {settingPlayersDetect: 'stack', settingAlertFlash: 'stack', settingAlertSound: 'sliders',
            settingPlayersPassive: 'items', settingPlayersMaxDisplayed: 'stack'},
        enemies: {settingEnemiesNormal: 'items', settingEnemiesMinHealthFilter: 'stack', settingEnemiesMistsCrystalSpider: 'items',
            settingEnemiesAvalonianDrones: 'pair', settingEnemiesShowHealthBars: 'stack'},
        resources: {settingResourcesFishing: 'stack', settingResourcesShowHealthBars: 'stack'},
        chests: {settingChestsGreen: 'items', settingMistsSolo: 'pair', settingMistsEnchant0: 'items', settingMistsWispCages: 'stack',
            settingDungeonsSolo: 'pair', settingDungeonsEnchant0: 'items', settingDungeonsCorrupted: 'pair'},
        settings: {settingLogToConsole: 'stack', settingLogCategorySystem: 'items', settingDebugEnemiesUnidentified: 'stack',
            settingDebugResourcesTypeId: 'stack', settingDebugMistsWispIds: 'stack', settingDebugWsCoalescing: 'stack',
            settingDebugBackendLogs: 'stack'},
    };
    const LAYOUT_CLASS = /^(grid|gap-.*|max-w-.*|(\w+:)?grid-cols-.*)$/;
    const tiles = pages.flatMap(({name, root}) => [...root.querySelectorAll('.flex.items-center.p-2.rounded-lg')]
        .filter(el => el.querySelector('[data-setting]') && !el.closest('h1, h2, h3'))
        .map(el => ({page: name, el})));
    const lists = pages.flatMap(({name, root}) => [...new Set(tiles.filter(tile => tile.page === name).map(tile => tile.el.parentElement))]
        .map(list => ({page: name, list, first: list.querySelector('[data-setting]').dataset.setting, root})));

    function typeOf(list) {
        const layout = [...list.classList].filter(name => LAYOUT_CLASS.test(name)).sort().join(' ');
        return Object.keys(LIST_TYPES).find(type => [...LIST_TYPES[type]].sort().join(' ') === layout) ?? `"${layout}"`;
    }

    test('every tile list is classified and carries the class set of its type', () => {
        const actual = Object.fromEntries(Object.keys(LISTS).map(page => [page,
            Object.fromEntries(lists.filter(entry => entry.page === page).map(({first, list}) => [first, typeOf(list)]))]));
        expect(tiles.length).toBeGreaterThan(80);
        expect(actual).toEqual(LISTS);
    });

    test('a list holding a slider row is the slider column, a list holding a gated sub-row is a single column', () => {
        const drift = lists.flatMap(({page, list, first}) => {
            const type = typeOf(list);
            if (list.querySelector('input[type="range"]') && type !== 'sliders') return [`${page}: ${first} is ${type}`];
            if (list.querySelector('[data-enabled-by]') && type !== 'stack') return [`${page}: ${first} is ${type}`];
            return [];
        });
        expect(drift).toEqual([]);
    });

    test('an item grid never has more columns than tiles', () => {
        const MAX_COLUMNS = {items: 3, pair: 2};
        const drift = lists.flatMap(({page, list, first}) => {
            const columns = MAX_COLUMNS[typeOf(list)];
            const count = [...list.children].filter(child => tiles.some(tile => tile.el === child)).length;
            return columns && count < columns ? [`${page}: ${first} has ${count} tiles in ${columns} columns`] : [];
        });
        expect(drift).toEqual([]);
    });

    test('every div row of a slider list keeps the slider row gap and a fixed leading icon', () => {
        const drift = lists.filter(({list}) => typeOf(list) === 'sliders').flatMap(({page, list}) =>
            [...list.children].filter(row => row.tagName === 'DIV').flatMap(row => {
                const ok = ['gap-1.5', 'sm:gap-2'].every(name => row.classList.contains(name)) && !row.classList.contains('gap-2')
                    && row.firstElementChild.matches('i[data-lucide].shrink-0');
                return ok ? [] : [`${page}: ${row.querySelector('[data-setting]').dataset.setting}`];
            }));
        expect(drift).toEqual([]);
    });

    test('no tile spans columns', () => {
        const drift = tiles.filter(({el}) => [...el.classList].some(name => name.startsWith('col-span')))
            .map(({page, el}) => `${page}: ${el.querySelector('[data-setting]').dataset.setting}`);
        expect(drift).toEqual([]);
    });

    test('no slider row sits in a column split by viewport width', () => {
        const drift = tiles.filter(({el}) => el.querySelector('input[type="range"]')).flatMap(({page, el}) => {
            const split = [];
            for (let node = el.parentElement; node; node = node.parentElement) {
                split.push(...[...node.classList].filter(name => /^(sm|md|lg|xl|2xl):grid-cols-/.test(name)));
            }
            return split.length ? [`${page}: ${el.querySelector('[data-setting]').dataset.setting} under ${split.join(' ')}`] : [];
        });
        expect(drift).toEqual([]);
    });

    test('every slider row has a fixed label column and a tip slot, so the ranges of a column line up', () => {
        const drift = all('input[type="range"][data-setting]').flatMap(({page, el}) => {
            const label = el.parentElement.querySelector(`[data-setting-label="${el.dataset.setting}"]`);
            const slot = label?.nextElementSibling;
            const readout = el.parentElement.querySelector(`[data-value-for="${el.dataset.setting}"]`);
            const ok = ['w-16', 'shrink-0'].every(name => label.classList.contains(name))
                && ['w-14', 'shrink-0'].every(name => readout?.classList.contains(name))
                && (slot?.matches(`[data-setting-tip="${el.dataset.setting}"].shrink-0`)
                    || (slot?.matches('span.w-3.shrink-0[aria-hidden="true"]') && slot.childElementCount === 0));
            return ok ? [] : [`${page}: ${el.dataset.setting}`];
        });
        expect(drift).toEqual([]);
    });

    test('a gated sub-row sits in the single column of its toggle, right under it', () => {
        const drift = all('[data-enabled-by]').flatMap(({page, el}) => {
            const toggle = tiles.find(tile => tile.page === page
                && tile.el.querySelector(`input[type="checkbox"][data-setting="${el.dataset.enabledBy}"]`))?.el;
            let row = el;
            while (row && row.parentElement !== toggle?.parentElement) row = row.parentElement;
            const ok = toggle && row && row.previousElementSibling === toggle && typeOf(row.parentElement) === 'stack'
                && ![...row.classList].some(name => name.startsWith('col-span'));
            return ok ? [] : [`${page}: ${el.dataset.setting}`];
        });
        expect(drift).toEqual([]);
    });

    test('every number input is input-bordered input-sm', () => {
        const drift = all('input[type="number"][data-setting]').flatMap(({page, el}) => {
            const issues = [];
            if (!el.classList.contains('input-bordered')) issues.push('missing input-bordered');
            if (!el.classList.contains('input-sm')) issues.push('missing input-sm');
            return issues.map(issue => `${page}: ${el.dataset.setting} - ${issue}`);
        });
        expect(drift).toEqual([]);
    });

    test('the tooltip bubble caps its width to the viewport minus a gutter', () => {
        expect(inputCss).toMatch(/\.tooltip\[data-tip]::before\s*\{\s*max-width:\s*min\(16rem, calc\(100vw - 2rem\)\);[^}]*}/);
        expect(inputCss.match(/\.tooltip\[data-tip]/g)).toHaveLength(1);
    });

    test('a hidden tooltip bubble and tail take no layout space', () => {
        const hidden = String.raw`\.tooltip:not\(:hover\):not\(:has\(:focus-visible\)\):not\(\.tooltip-open\)`;
        expect(inputCss).toMatch(new RegExp(String.raw`${hidden}::before,\s*${hidden}::after\s*\{\s*display: none;\s*}`));
    });
});

describe('radar settings panel sections', () => {
    const NAV_ICONS = Object.fromEntries([...readFileSync(join(ROOT, 'internal/templates/data.go'), 'utf8')
        .matchAll(/Label: "([^"]+)", Icon: "([^"]+)"/g)].map(([, label, icon]) => [label, icon]));
    const panel = pages.find(page => page.name === 'radar').root.querySelector('#radarSettingsPanel');

    test('a section named like a sidebar entry uses its sidebar icon', () => {
        const drift = [...panel.querySelectorAll('section > h3')].flatMap(h3 => {
            const name = normalized(h3);
            const icon = h3.querySelector('i[data-lucide]').dataset.lucide;
            return NAV_ICONS[name] && NAV_ICONS[name] !== icon ? [`${name}: ${icon} vs ${NAV_ICONS[name]}`] : [];
        });
        expect(Object.keys(NAV_ICONS)).toContain('Resources');
        expect(drift).toEqual([]);
    });
});

describe('settings debug sections', () => {
    const NAV_ICONS = Object.fromEntries([...readFileSync(join(ROOT, 'internal/templates/data.go'), 'utf8')
        .matchAll(/Label: "([^"]+)", Icon: "([^"]+)"/g)].map(([, label, icon]) => [label, icon]));
    const debug = pages.find(page => page.name === 'settings').root
        .querySelector('[data-setting="settingUiSettingsDebugOpen"]').closest('.collapse');

    test('a debug section named like a sidebar entry uses its sidebar icon', () => {
        const named = [...debug.querySelectorAll('section > h3')].filter(h3 => NAV_ICONS[normalized(h3)]);
        const drift = named.flatMap(h3 => {
            const icon = h3.querySelector('i[data-lucide]').dataset.lucide;
            return icon === NAV_ICONS[normalized(h3)] ? [] : [`${normalized(h3)}: ${icon} vs ${NAV_ICONS[normalized(h3)]}`];
        });
        expect(named.map(normalized)).toEqual(['Enemies', 'Resources']);
        expect(drift).toEqual([]);
    });
});

describe('keyboard focus ring', () => {
    const appCss = readFileSync(join(ROOT, 'web/styles/app.css'), 'utf8');

    test('the global focus-visible outline uses a color token the daisyUI 5 theme defines', () => {
        const rule = appCss.match(/^:focus-visible\s*\{([^}]*)}/m)?.[1] ?? '';
        expect(rule).toMatch(/outline:\s*2px solid var\(--color-primary\);/);
        expect(appCss).not.toMatch(/var\(--p\)/);
    });
});

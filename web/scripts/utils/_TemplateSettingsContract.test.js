// synthetic: page templates read from internal/templates and checked against the settings registry.
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {MIGRATION_ROWS, SETTINGS, registryEntry} from './SettingsRegistry.js';
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
const CHEST_TIP = 'Loot chests of this rarity. The rarity is read from the chest name, so some chests are not shown.';
const CATEGORY_TIP = 'Keep DEBUG and INFO entries of this area. WARN and above ignore this filter.';

const TOOLTIPS = {
    settingRadarSize: 'Width and height of the radar in pixels, reduced when the window is too small. Ignored while Fit to screen is on.',
    settingRadarFitToScreen: 'Makes the radar the largest square that fits the window, up to 1200 px. Max size is ignored while this is on.',
    settingRadarHudZoneInfo: 'Top-left box with the zone name, tier and a PvP marker.',
    settingRadarHudStats: 'Top-right box counting the resource nodes and mobs drawn, and the detected players when player detection is on.',
    settingRadarPlayersBeside: 'Shows the player list to the right of the radar when the window is wide enough.',
    settingRadarResourceCount: 'Estimated quantity next to each resource node, from its size and tier, gathering bonuses not included. Fishing spots show spawned/total fish.',
    settingRadarResourceDistance: 'Distance in meters beside each resource: hidden within 2 m, green under 10 m, yellow 10 to 19 m, orange from 20 m.',
    settingRadarResourceTierBadges: 'Replaces resource icons with squares colored by resource type, showing tier and enchantment. Living creatures get a gold border.',
    settingRadarClusterRadius: 'Resources of the same type and tier within this distance of a node are grouped. Default: 30 m.',
    settingRadarClusterMinSize: 'Smallest group drawn as a cluster. Default: 2.',
    settingRadarResourceClusters: 'Rings groups of nearby resource nodes of the same type and tier, with the node count, total quantity and distance. Only nodes your resource filters show are grouped.',
    settingPlayersDetect: 'Tracks players in range. Off: no player list, no player counts, no flash, border or sound.',
    settingPlayersHostile: 'Lists hostile-flagged players. In black zones every player counts as hostile, so this shows or hides all of them. Does not change alerts.',
    settingAlertFlash: 'Flashes the radar page red when a threat appears or turns hostile: a hostile-flagged player in yellow and red zones, any player in black zones, nobody in safe or unknown zones. Ignored names never trigger it.',
    settingAlertSound: 'Plays the selected sound on the PC running the radar when a threat appears or turns hostile, with the same threat rule as the flash. Ignored names never trigger it.',
    settingAlertBorder: 'Pulses a red border around the radar while a threat is in range. Ignored names do not count.',
    settingAlertSoundCooldown: 'Minimum delay between two alert sounds. At zero, every alert plays.',
    settingEnemiesChampion: 'Champion mobs, and solo mobs in random dungeons.',
    settingEnemiesMinHealthFilter: 'Hides Normal to Boss enemies and unidentified enemies whose maximum HP is below the threshold. Drones, Mists bosses, event enemies and living resources are not filtered.',
    settingEnemiesAvalonianDrones: NOT_DETECTED,
    settingEnemiesEvent: NOT_DETECTED,
    settingDebugEnemiesUnidentified: 'Shows enemies whose type is missing from the bundled mob data, usually new mobs after a game update. The Normal to Boss filters do not apply to them.',
    settingResourcesFishing: 'Shows fishing spots on the radar.',
    settingMistsWisps: 'Shows the wisp signs that appear before a Mists portal opens. The Solo/Duo and rarity filters also apply.',
    settingMistsKnightfallAbbey: 'Shows Knightfall Abbey entrances.',
    settingDungeonsGroup: 'Group random dungeon entrances, plus any entrance not recognized as solo, corrupted or hellgate. The E0 to E4 filters also apply.',
    settingChestsGreen: CHEST_TIP,
    settingChestsBlue: CHEST_TIP,
    settingChestsPurple: CHEST_TIP,
    settingChestsYellow: CHEST_TIP,
    settingDebugResourcesTypeId: 'Draws the internal type ID on resource nodes and living resources (debug).',
    settingDebugWsCoalescing: 'Keeps only the latest move, health and regeneration update per entity until the next frame is drawn.',
    settingLogToServer: 'Sends browser log entries that pass the level and category filters to the radar PC, in logs/debug/. ERROR and CRITICAL entries are also copied to logs/errors/.',
    settingLogLevel: 'Lowest level sent to the console and to the server. DEBUG and INFO entries also need their category. OFF drops everything.',
    ...Object.fromEntries(SETTINGS.filter(entry => entry.key.startsWith('settingLogCategory')).map(entry => [entry.key, CATEGORY_TIP])),
};

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

    test('the Logging, Debug and Network collapses are bound through data-setting', () => {
        const collapses = [...root.querySelectorAll('.collapse > input[type="checkbox"]')].map(el => el.dataset.setting);
        expect(collapses).toEqual(['settingUiSettingsLoggingOpen', 'settingUiSettingsDebugOpen', 'settingUiSettingsNetworkOpen']);
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
                if (child.matches(`[data-setting-tip="${key}"]`)) return 'tip';
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

    const TILE_GRID = ['grid', 'grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))]', 'gap-2'];
    const tiles = pages.flatMap(({name, root}) => [...root.querySelectorAll('.flex.items-center.p-2.rounded-lg')]
        .filter(el => el.querySelector('[data-setting]') && !el.closest('h1, h2, h3'))
        .map(el => ({page: name, el})));

    test('every tile list is an equal-width auto-fill grid', () => {
        const drift = tiles.flatMap(({page, el}) => {
            const list = el.parentElement;
            const ok = TILE_GRID.every(name => list.classList.contains(name))
                && [...list.classList].filter(name => name.startsWith('grid-cols-') || /:grid-cols-/.test(name)).length === 1;
            return ok ? [] : [`${page}: ${el.querySelector('[data-setting]').dataset.setting} in "${list.className}"`];
        });
        expect(tiles.length).toBeGreaterThan(80);
        expect(drift).toEqual([]);
    });

    test('every slider row spans the full tile grid', () => {
        const drift = tiles.filter(({el}) => el.querySelector('input[type="range"]') && !el.classList.contains('col-span-full'))
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

    test('a gated sub-row spans the grid right after the tile of its toggle', () => {
        const drift = all('[data-enabled-by]').flatMap(({page, el}) => {
            const row = el.closest('.col-span-full');
            const toggle = row?.previousElementSibling;
            const ok = toggle?.querySelector(`input[type="checkbox"][data-setting="${el.dataset.enabledBy}"]`)
                && tiles.some(tile => tile.el === toggle) && TILE_GRID.every(name => row.parentElement.classList.contains(name));
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

describe('keyboard focus ring', () => {
    const appCss = readFileSync(join(ROOT, 'web/styles/app.css'), 'utf8');

    test('the global focus-visible outline uses a color token the daisyUI 5 theme defines', () => {
        const rule = appCss.match(/^:focus-visible\s*\{([^}]*)}/m)?.[1] ?? '';
        expect(rule).toMatch(/outline:\s*2px solid var\(--color-primary\);/);
        expect(appCss).not.toMatch(/var\(--p\)/);
    });
});

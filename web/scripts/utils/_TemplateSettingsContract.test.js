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

const EXCLUSIONS = [
    {name: 'radar controls row and inline script, until the radar settings panel', page: 'radar',
        region: root => root.querySelector('#canvasContainer').nextElementSibling},
];

const NO_CONTROL_YET = {
    'added by the radar settings panel': ['settingRadarFitToScreen', 'settingRadarRotation', 'settingRadarHudZoneInfo',
        'settingRadarHudStats', 'settingUiRadarSettingsOpen'],
    'moved from the settings Display card to the radar settings panel': ['settingRadarMapBackground',
        'settingRadarResourceTierBadges', 'settingRadarClusterRadius', 'settingRadarClusterMinSize'],
};

const CONTROL_COUNT_EXCEPTIONS = {settingPlayersDetect: 2, settingUiSidebarCollapsed: 0};

const UNBOUND_INPUTS = {
    'backend toggles keep their fetch binding until they move to their own module': ['settingServerLogsEnabled',
        'settingPcapRecording'],
};

const LABELS = {
    settingRadarZoom: 'Zoom',
    settingRadarSize: 'Max size',
    settingRadarFitToScreen: 'Fit to screen',
    settingRadarIconSize: 'Icon size',
    settingRadarRotation: 'Rotation',
    settingRadarMapBackground: 'Map background',
    settingRadarHudZoneInfo: 'Zone info box',
    settingRadarHudStats: 'Stats box',
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
    settingRadarRotation: 'Turns the radar clockwise by quarter turns, for a screen held sideways. The zone and stats boxes and Picture-in-Picture turn with it. The page and this panel stay upright.',
    settingRadarHudZoneInfo: 'Top-left box with the zone name, tier and a PvP marker.',
    settingRadarHudStats: 'Top-right box counting the resource nodes and mobs drawn, and the detected players when player detection is on.',
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
    const pages = [];
    let skipped = '';
    for (const name of pageNames()) {
        const root = mountPage(name).cloneNode(true);
        for (const exclusion of EXCLUSIONS.filter(e => e.page === name)) {
            const region = exclusion.region(root);
            skipped += region.outerHTML;
            if (region === root) root.innerHTML = '';
            else region.remove();
        }
        pages.push({name, root, excluded: EXCLUSIONS.some(e => e.page === name)});
    }
    for (const file of readdirSync(LAYOUTS_DIR)) {
        const root = document.createElement('div');
        root.innerHTML = readFileSync(join(LAYOUTS_DIR, file), 'utf8');
        pages.push({name: `layouts/${file}`, root, excluded: false});
    }
    document.body.innerHTML = '';
    return {pages, skipped};
}

const {pages, skipped} = loadPages();

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

function inSkippedRegion(key) {
    return skipped.includes(`id="${key}"`) || skipped.includes(`data-setting="${key}"`);
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
        const noControlYet = new Set(Object.values(NO_CONTROL_YET).flat());
        const drift = SETTINGS.filter(entry => ['setting', 'ui', 'backend'].includes(entry.scope) && !entry.pendingRemoval)
            .flatMap(({key}) => {
                const count = controlCount(key);
                const expected = CONTROL_COUNT_EXCEPTIONS[key] ?? 1;
                if (count === expected) return [];
                if (count === 0 && (noControlYet.has(key) || inSkippedRegion(key))) return [];
                return [`${key}: ${count} controls, expected ${expected}`];
            });
        expect(drift).toEqual([]);
    });

    test('converted pages hold no input or select bound by id alone', () => {
        const allowed = new Set(Object.values(UNBOUND_INPUTS).flat());
        const unbound = pages.filter(({name, excluded}) => !name.startsWith('layouts/') && !excluded)
            .flatMap(({name, root}) => [...root.querySelectorAll('input[id]:not([data-setting]), select[id]:not([data-setting])')]
                .filter(el => !allowed.has(el.id) && !el.closest('[data-setting]'))
                .map(el => `${name}: ${el.id}`));
        expect(unbound).toEqual([]);
    });

    test('keys listed without a control have none yet', () => {
        const bound = Object.values(NO_CONTROL_YET).flat().filter(key => controlCount(key) > 0);
        expect(bound).toEqual([]);
    });

    test('removed keys have no control', () => {
        const left = MIGRATION_ROWS.filter(row => row.migration === 'remove')
            .flatMap(({legacyKey: key}) => pages.filter(({root}) => root.querySelector(`[data-setting="${key}"], [id="${key}"]`))
                .map(({name}) => `${name}: ${key}`));
        expect(left).toEqual([]);
    });

    test('each converted page registers through registerBoundPage', () => {
        const missing = pages.filter(({name, excluded}) => !name.startsWith('layouts/') && !excluded)
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

// synthetic: translation engine driven by a fake settings store and a hand-built DOM.
import {afterEach, beforeEach, describe, expect, test} from 'vitest';
import {LANGUAGE_KEY, currentLanguage, initI18n, setLanguage, stopI18n, t, translate} from './I18n.js';

function fakeSync(initial = 'en') {
    const listeners = new Map();
    const store = {value: initial};
    return {
        get: key => (key === LANGUAGE_KEY ? store.value : undefined),
        on: (key, fn) => listeners.set(key, [...(listeners.get(key) ?? []), fn]),
        off: (key, fn) => listeners.set(key, (listeners.get(key) ?? []).filter(item => item !== fn)),
        change(value) {
            store.value = value;
            for (const fn of listeners.get(LANGUAGE_KEY) ?? []) fn(LANGUAGE_KEY, value);
        },
    };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    stopI18n();
});

describe('translate', () => {
    test('looks a string up after collapsing whitespace and keeps the surrounding whitespace', () => {
        expect(translate('\n   Show   Equipment \n', 'es')).toBe('\n   Mostrar equipo \n');
    });

    test('leaves unknown text, empty text and unknown languages alone', () => {
        expect(translate('Some player name', 'es')).toBe('Some player name');
        expect(translate('   ', 'es')).toBe('   ');
        expect(translate('Show Equipment', 'fr')).toBe('Show Equipment');
        expect(translate('Show Equipment', 'en')).toBe('Show Equipment');
    });

    test('does not treat dictionary keys as prototype lookups', () => {
        expect(translate('constructor', 'es')).toBe('constructor');
        expect(translate('toString', 'es')).toBe('toString');
    });

    test('applies patterns, translating the captured noun', () => {
        expect(translate('Decrease zoom', 'es')).toBe('Disminuir zoom');
        expect(translate('Reset icon size', 'es')).toBe('Restablecer tamaño de iconos');
        expect(translate('OpenRadar - Players', 'es')).toBe('OpenRadar - Jugadores');
        expect(translate('✓ Capturing on 2 interfaces.', 'es')).toBe('✓ Capturando en 2 interfaces.');
        expect(translate('✓ Capturing on 1 interface.', 'es')).toBe('✓ Capturando en 1 interfaz.');
    });

    test('an exact entry wins over a pattern', () => {
        expect(translate('Reset Settings', 'es')).toBe('Restablecer ajustes');
    });
});

describe('initI18n', () => {
    test('translates text nodes and attributes, and restores English', () => {
        document.body.innerHTML = `<h1>Players</h1><button title="Fullscreen" aria-label="Fullscreen">Fullscreen</button>
            <div class="tooltip" data-tip="Average item power of the gear the player wears."></div>
            <input placeholder="Player, guild or alliance name">`;
        const sync = fakeSync('es');
        initI18n(sync);

        expect(document.querySelector('h1').textContent).toBe('Jugadores');
        const button = document.querySelector('button');
        expect(button.textContent).toBe('Pantalla completa');
        expect(button.title).toBe('Pantalla completa');
        expect(button.getAttribute('aria-label')).toBe('Pantalla completa');
        expect(document.querySelector('.tooltip').dataset.tip).toBe('Poder de objeto medio del equipo que lleva el jugador.');
        expect(document.querySelector('input').placeholder).toBe('Nombre de jugador, gremio o alianza');
        expect(document.documentElement.lang).toBe('es');

        sync.change('en');
        expect(document.querySelector('h1').textContent).toBe('Players');
        expect(button.textContent).toBe('Fullscreen');
        expect(button.title).toBe('Fullscreen');
        expect(document.querySelector('.tooltip').dataset.tip).toBe('Average item power of the gear the player wears.');
        expect(document.querySelector('input').placeholder).toBe('Player, guild or alliance name');
        expect(document.documentElement.lang).toBe('en');
    });

    test('switching language live round-trips', () => {
        document.body.innerHTML = '<p>Danger Zone</p>';
        const sync = fakeSync('en');
        initI18n(sync);
        expect(document.querySelector('p').textContent).toBe('Danger Zone');
        sync.change('es');
        expect(document.querySelector('p').textContent).toBe('Zona de peligro');
        sync.change('en');
        expect(document.querySelector('p').textContent).toBe('Danger Zone');
        sync.change('es');
        expect(document.querySelector('p').textContent).toBe('Zona de peligro');
    });

    test('an unknown stored language falls back to English', () => {
        document.body.innerHTML = '<p>Danger Zone</p>';
        initI18n(fakeSync('xx'));
        expect(currentLanguage()).toBe('en');
        expect(document.querySelector('p').textContent).toBe('Danger Zone');
    });

    test('translates nodes added later and text rewritten by the app', async () => {
        document.body.innerHTML = '<span id="status">Connecting...</span>';
        initI18n(fakeSync('es'));
        expect(document.getElementById('status').textContent).toBe('Conectando...');

        document.getElementById('status').textContent = 'Connected';
        await tick();
        expect(document.getElementById('status').textContent).toBe('Conectado');

        const added = document.createElement('div');
        added.innerHTML = '<b>Cancel</b><i title="Remove"></i>';
        document.body.append(added);
        await tick();
        expect(added.querySelector('b').textContent).toBe('Cancelar');
        expect(added.querySelector('i').title).toBe('Quitar');
    });

    test('a rewritten node is not translated twice or looped on', async () => {
        document.body.innerHTML = '<span id="s">Connected</span>';
        initI18n(fakeSync('es'));
        await tick();
        expect(document.getElementById('s').textContent).toBe('Conectado');
        await tick();
        expect(document.getElementById('s').textContent).toBe('Conectado');
    });

    test('skips scripts, data-no-i18n and ignored player names', () => {
        document.body.innerHTML = `<script>var s = "Players";</script>
            <div data-no-i18n>Players</div><span data-ignore-name>Players</span><p>Players</p>`;
        initI18n(fakeSync('es'));
        expect(document.querySelector('script').textContent).toBe('var s = "Players";');
        expect(document.querySelector('[data-no-i18n]').textContent).toBe('Players');
        expect(document.querySelector('[data-ignore-name]').textContent).toBe('Players');
        expect(document.querySelector('p').textContent).toBe('Jugadores');
    });

    test('keeps a hand-typed player name that happens to match nothing', () => {
        document.body.innerHTML = '<span>Zeldruck</span>';
        initI18n(fakeSync('es'));
        expect(document.querySelector('span').textContent).toBe('Zeldruck');
    });

    test('translates the document title through the OpenRadar prefix pattern', () => {
        document.title = 'OpenRadar - Ignore List';
        initI18n(fakeSync('es'));
        expect(document.title).toBe('OpenRadar - Lista de ignorados');
        setLanguage('en');
        expect(document.title).toBe('OpenRadar - Ignore List');
    });
});

describe('t', () => {
    test('follows the active language', () => {
        initI18n(fakeSync('es'));
        expect(t('players')).toBe('jugadores');
        setLanguage('en');
        expect(t('players')).toBe('players');
    });
});

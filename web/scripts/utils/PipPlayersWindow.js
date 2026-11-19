// PipPlayersWindow.js - Separate always-on-top window listing detected players with their gear.
//
// Uses the Document Picture-in-Picture API (Chromium 116+, Brave included): a real HTML window that
// stays above other windows. Limits of the API, not of this code: the window is opaque (no
// transparency), the page cannot choose its position (the user drags it), and opening it needs a
// click. Some browsers also allow only one PiP window at a time, so the window can show the radar
// map itself ("Map" button) in case the map PiP gets closed.

import {CATEGORIES} from '../constants/LoggerConstants.js';
import {
    COLORS,
    ENCHANT_COLORS,
    FACTION_CITIES,
    TIER_COLORS,
    collectPlayers,
    formatElapsed,
    gearOf,
    readPanelSettings,
    spellsOf,
} from './PipPlayersPanel.js';

const WINDOW_WIDTH = 360;
const WINDOW_HEIGHT = 540;
const TICK_MS = 500;
const EXCLUSIVE_CHECK_MS = 400;

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function healthPercent(player) {
    if (!(player.currentHealth > 0 && player.initialHealth > 0)) return null;
    return clamp(Math.round((player.currentHealth / player.initialHealth) * 100), 0, 100);
}

function gearHtml(player, items, resolveUrl) {
    const tiles = gearOf(player, items);
    if (tiles.length === 0) return '<div class="pp-note">Gear not detected yet</div>';
    const html = tiles.map(tile => {
        const color = ENCHANT_COLORS[tile.enchant] || '';
        const label = `${tile.tier > 0 ? `T${tile.tier}` : ''}${tile.enchant > 0 ? `.${tile.enchant}` : ''}`;
        const labelColor = color || TIER_COLORS[clamp(tile.tier, 0, 8)];
        const style = color ? ` style="border-color:${color}"` : '';
        return `<div class="pp-gear-item"><div class="pp-tile"${style}>`
            + `<img src="${escapeHtml(resolveUrl(tile.url))}" alt="${escapeHtml(tile.tier > 0 ? `T${tile.tier}` : '?')}" width="40" height="40"></div>`
            + `<span class="pp-tier" style="color:${labelColor}">${escapeHtml(label)}</span></div>`;
    }).join('');
    return `<div class="pp-gear">${html}</div>`;
}

function spellsHtml(player, spellsDb, resolveUrl) {
    const spells = spellsOf(player, spellsDb);
    if (spells.length === 0) return '';
    const html = spells.map(spell => `<div class="pp-spell"><img src="${escapeHtml(resolveUrl(spell.url))}" alt="" width="28" height="28"></div>`).join('');
    return `<div class="pp-spells">${html}</div>`;
}

function healthHtml(player) {
    const percent = healthPercent(player);
    const color = percent === null ? COLORS.track : percent > 60 ? COLORS.healthHigh : percent > 30 ? COLORS.healthMid : COLORS.healthLow;
    const fill = percent === null ? '' : `<div class="pp-health-fill" style="width:${percent}%;background:${color}"></div>`;
    return `<div class="pp-health"><div class="pp-health-track">${fill}</div><span>${percent === null ? '--' : `${percent}%`}</span></div>`;
}

function cardHtml({player, type}, opts, deps) {
    const label = type === 'faction' && FACTION_CITIES[player.faction]
        ? `⚔ ${FACTION_CITIES[player.faction]}`
        : type;
    const averagePower = opts.ip ? player.getAverageItemPower?.() : null;

    const meta = [];
    if (opts.guild) {
        meta.push(player.guildName
            ? `<span class="pp-guild">[${escapeHtml(player.guildName)}]</span>`
            : '<span class="pp-faint">No Guild</span>');
        if (player.allianceName) meta.push(`<span class="pp-alliance">&lt;${escapeHtml(player.allianceName)}&gt;</span>`);
    }
    const chips = [];
    if (opts.mounted && player.mounted) chips.push('<span class="pp-chip pp-mount">MOUNT</span>');
    if (averagePower) chips.push(`<span class="pp-chip pp-ip">IP ${escapeHtml(averagePower)}</span>`);
    const detectedAt = player.detectedAt ?? deps.now;
    chips.push(`<span class="pp-elapsed" data-since="${Number(detectedAt)}">${formatElapsed(detectedAt, deps.now)}</span>`);

    return `<article class="pp-card pp-${type}">`
        + `<div class="pp-row"><span class="pp-name">${escapeHtml(player.nickname)}</span>`
        + `<span class="pp-badge">${escapeHtml(label)}</span></div>`
        + `<div class="pp-row pp-meta"><div class="pp-meta-left">${meta.join('')}</div><div class="pp-chips">${chips.join('')}</div></div>`
        + (opts.equipment ? gearHtml(player, deps.items, deps.resolveUrl) : '')
        + (opts.spells ? spellsHtml(player, deps.spells, deps.resolveUrl) : '')
        + (opts.health ? healthHtml(player) : '')
        + '</article>';
}

/**
 * HTML for the list. `model` comes from collectPlayers(), `opts` from readPanelSettings().
 * Pure (no DOM access) so it can be tested directly.
 */
export function renderPlayersHtml(model, opts, deps) {
    if (model.entries.length === 0) {
        return '<div class="pp-idle"><span class="pp-dot"></span>No players detected</div>';
    }
    const {hostile, faction, passive} = model.counts;
    const counts = `<div class="pp-counts"><span class="pp-hostile">${hostile} hostile</span>`
        + `<span class="pp-faction">${faction} faction</span><span class="pp-passive">${passive} passive</span></div>`;
    return counts + model.entries.map(entry => cardHtml(entry, opts, deps)).join('');
}

const STYLES = `
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:#0c1015;color:${COLORS.text};font:13px "Space Grotesk",system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
body.pp-empty{background:#0c1015}
.pp-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid ${COLORS.edge};flex:none}
.pp-title{font-weight:700;letter-spacing:.04em;font-size:11px;text-transform:uppercase;color:${COLORS.dim};flex:1}
.pp-btn{background:${COLORS.tile};border:1px solid ${COLORS.tileEdge};color:${COLORS.text};border-radius:6px;font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
.pp-btn[aria-pressed="true"]{background:#2a3b52;border-color:#38bdf8}
.pp-map{flex:none;padding:8px 8px 0}
.pp-map canvas{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:8px;background:#000}
.pp-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
.pp-counts{display:flex;gap:10px;font:600 10px "JetBrains Mono",ui-monospace,monospace;text-transform:uppercase}
.pp-hostile{color:${COLORS.hostile}}.pp-faction{color:${COLORS.faction}}.pp-passive{color:${COLORS.passive}}
.pp-card{background:linear-gradient(${COLORS.cardTop},${COLORS.cardBottom});border:1px solid ${COLORS.cardEdge};border-left:3px solid var(--accent);border-radius:8px;padding:7px 10px;display:flex;flex-direction:column;gap:6px}
.pp-card.pp-hostile{--accent:${COLORS.hostile}}.pp-card.pp-faction{--accent:${COLORS.faction}}.pp-card.pp-passive{--accent:${COLORS.passive}}
.pp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.pp-name{font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-badge{flex:none;font:700 9px "JetBrains Mono",ui-monospace,monospace;text-transform:uppercase;padding:2px 6px;border-radius:4px;color:var(--accent);background:color-mix(in srgb,var(--accent) 15%,transparent);border:1px solid color-mix(in srgb,var(--accent) 33%,transparent)}
.pp-meta{font:500 10px "JetBrains Mono",ui-monospace,monospace}
.pp-meta-left{display:flex;gap:6px;min-width:0;overflow:hidden;white-space:nowrap}
.pp-chips{display:flex;gap:6px;align-items:center;flex:none}
.pp-guild,.pp-ip{color:${COLORS.ip};font-weight:700}.pp-alliance{color:${COLORS.alliance}}.pp-faint,.pp-elapsed,.pp-note{color:${COLORS.faint}}
.pp-chip{padding:1px 6px;border-radius:4px;font-weight:700}
.pp-ip{background:${COLORS.ip}26;border:1px solid ${COLORS.ip}59}.pp-mount{background:${COLORS.mounted}26;color:${COLORS.mounted}}
.pp-gear{display:flex;gap:4px;flex-wrap:wrap}
.pp-gear-item{display:flex;flex-direction:column;align-items:center;gap:1px}
.pp-tile{width:40px;height:40px;border-radius:6px;background:${COLORS.tile};border:1px solid ${COLORS.tileEdge};overflow:hidden}
.pp-tile img{width:100%;height:100%;display:block;font-size:10px;color:${COLORS.faint}}
.pp-tier{font:700 8px "JetBrains Mono",ui-monospace,monospace}
.pp-spells{display:flex;gap:4px;flex-wrap:wrap}
.pp-spell{width:28px;height:28px;border-radius:5px;background:${COLORS.tile};border:1px solid ${COLORS.tileEdge};overflow:hidden}
.pp-spell img{width:100%;height:100%;display:block}
.pp-health{display:flex;align-items:center;gap:6px;font:600 9px "JetBrains Mono",ui-monospace,monospace;color:${COLORS.faint}}
.pp-health-track{flex:1;height:5px;border-radius:3px;background:${COLORS.track};overflow:hidden}
.pp-health-fill{height:100%;border-radius:3px}
.pp-idle{display:flex;align-items:center;gap:8px;color:${COLORS.faint};font:500 11px "JetBrains Mono",ui-monospace,monospace;padding:4px 2px}
.pp-dot{width:6px;height:6px;border-radius:50%;background:${COLORS.passive};opacity:.6;animation:pp-pulse 2s ease-in-out infinite}
@keyframes pp-pulse{50%{opacity:.15}}
`;

export class PipPlayersWindow {
    /**
     * @param {object} [deps] injectable for tests
     * @param {() => object} [deps.api] returns window.documentPictureInPicture
     * @param {() => object} [deps.settings] settings sync
     * @param {() => object} [deps.handler] players handler
     * @param {() => object} [deps.items] items database
     * @param {() => object} [deps.spells] spells database
     * @param {() => object} [deps.manager] map PiP manager (for the Map toggle)
     * @param {() => number} [deps.now]
     */
    constructor(deps = {}) {
        this.api = deps.api ?? (() => globalThis.window?.documentPictureInPicture);
        this.settings = deps.settings ?? (() => globalThis.window?.settingsSync);
        this.handler = deps.handler ?? (() => globalThis.window?.playersHandler);
        this.items = deps.items ?? (() => globalThis.window?.itemsDatabase);
        this.spells = deps.spells ?? (() => globalThis.window?.spellsDatabase);
        this.manager = deps.manager ?? (() => globalThis.window?.pipManager);
        this.now = deps.now ?? (() => Date.now());

        this.pipWindow = null;
        this.listEl = null;
        this.mapWrap = null;
        this.mapCanvas = null;
        this.mapBtn = null;
        this.showMap = false;
        this.lastSignature = null;
        this.timerId = null;
    }

    isSupported() {
        return typeof this.api() !== 'undefined' && this.api() !== null;
    }

    get isOpen() {
        return this.pipWindow !== null;
    }

    async toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
        return this.isOpen;
    }

    /** Must run from a click (user gesture). Returns true when the window is open. */
    async open() {
        if (this.isOpen) return true;
        const api = this.api();
        if (!api) return false;

        const managerWasActive = this.manager()?.isActive === true;
        try {
            this.pipWindow = await api.requestWindow({width: WINDOW_WIDTH, height: WINDOW_HEIGHT});
        } catch (error) {
            window.logger?.error?.(CATEGORIES.SYSTEM, 'PipPlayersWindow_OpenFailed', {error: error?.message});
            this.pipWindow = null;
            return false;
        }

        this.build();
        this.pipWindow.addEventListener('pagehide', () => this.teardown());
        this.timerId = this.pipWindow.setInterval(() => this.tick(), TICK_MS);
        this.tick();
        this.dispatch(true);

        // Some browsers allow a single PiP window: opening this one closes the map PiP. Then show
        // the map inside this window instead, so the user keeps a radar view.
        if (managerWasActive) {
            this.pipWindow.setTimeout(() => {
                if (this.isOpen && this.manager()?.isActive !== true) this.setMapVisible(true);
            }, EXCLUSIVE_CHECK_MS);
        }
        return true;
    }

    close() {
        const win = this.pipWindow;
        this.teardown();
        try {
            win?.close();
        } catch {
            // already closed
        }
    }

    build() {
        const doc = this.pipWindow.document;
        doc.title = 'OpenRadar players';

        const style = doc.createElement('style');
        style.textContent = STYLES;
        doc.head.appendChild(style);

        const bar = doc.createElement('div');
        bar.className = 'pp-bar';
        bar.innerHTML = '<span class="pp-title">Players</span>';
        this.mapBtn = doc.createElement('button');
        this.mapBtn.className = 'pp-btn';
        this.mapBtn.type = 'button';
        this.mapBtn.textContent = 'Map';
        this.mapBtn.title = 'Show the radar map inside this window';
        this.mapBtn.setAttribute('aria-pressed', 'false');
        this.mapBtn.addEventListener('click', () => this.setMapVisible(!this.showMap));
        bar.appendChild(this.mapBtn);

        this.mapWrap = doc.createElement('div');
        this.mapWrap.className = 'pp-map';
        this.mapWrap.hidden = true;
        this.mapCanvas = doc.createElement('canvas');
        this.mapWrap.appendChild(this.mapCanvas);

        this.listEl = doc.createElement('div');
        this.listEl.className = 'pp-list';

        doc.body.append(bar, this.mapWrap, this.listEl);
    }

    setMapVisible(visible) {
        this.showMap = visible;
        if (!this.mapWrap) return;
        this.mapWrap.hidden = !visible;
        this.mapBtn?.setAttribute('aria-pressed', String(visible));
        if (visible) this.drawMap();
    }

    /** Called on every radar render (and by the timer) while the map is shown. */
    drawMap() {
        const manager = this.manager();
        if (!this.showMap || !this.mapCanvas || !manager?.pipCanvas) return;
        const size = manager.size || 500;
        if (this.mapCanvas.width !== size || this.mapCanvas.height !== size) {
            this.mapCanvas.width = size;
            this.mapCanvas.height = size;
        }
        const ctx = this.mapCanvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        manager.drawRadarLayers?.(ctx);
    }

    tick() {
        if (!this.isOpen || !this.listEl) return;
        const now = this.now();
        const model = collectPlayers(this.handler());
        const {opts} = readPanelSettings(this.settings());
        const resolveUrl = url => new URL(url, globalThis.location?.href ?? 'http://localhost/').href;
        const deps = {items: this.items(), spells: this.spells(), resolveUrl, now};

        const html = renderPlayersHtml(model, opts, deps);
        // elapsed counters change every second; compare without them so the list is not rebuilt
        const signature = html.replace(/<span class="pp-elapsed"[^>]*>[^<]*<\/span>/g, '');
        if (signature !== this.lastSignature) {
            this.listEl.innerHTML = html;
            this.lastSignature = signature;
            this.pipWindow.document.body.classList.toggle('pp-empty', model.entries.length === 0);
        } else {
            for (const el of this.listEl.querySelectorAll('.pp-elapsed')) {
                el.textContent = formatElapsed(Number(el.dataset.since), now);
            }
        }
        this.drawMap();
    }

    teardown() {
        if (this.timerId !== null) {
            try {
                this.pipWindow?.clearInterval(this.timerId);
            } catch {
                // window already gone
            }
            this.timerId = null;
        }
        const wasOpen = this.pipWindow !== null;
        this.pipWindow = null;
        this.listEl = null;
        this.mapWrap = null;
        this.mapCanvas = null;
        this.mapBtn = null;
        this.showMap = false;
        this.lastSignature = null;
        if (wasOpen) this.dispatch(false);
    }

    dispatch(isOpen) {
        document.dispatchEvent(new CustomEvent('pipPlayersWindowChange', {detail: {isOpen}}));
    }

    destroy() {
        this.close();
    }
}

const pipPlayersWindow = new PipPlayersWindow();
export default pipPlayersWindow;

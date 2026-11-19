// PipPlayersPanel.js - Player + gear panel drawn on the Picture-in-Picture canvas.
//
// PiP streams a single canvas, so DOM content (the Players page cards) never reaches the floating
// window. This module redraws the same information on the PiP canvas, beside or under the radar.

export const PIP_PLAYERS_POSITIONS = Object.freeze(['off', 'right', 'bottom']);

const BASE_SIZE = 500;
const PANEL_WIDTH_BESIDE = 310;
const ROWS_UNDER = 2;
const COLS_UNDER = 2;
const MAX_GEAR_TILES = 6;
const PLAYER_TYPES = ['hostile', 'faction', 'passive'];
export const FACTION_CITIES = ['', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford', 'Caerleon'];

const FONT_SANS = '"Space Grotesk", system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export const COLORS = {
    panelTop: '#151a22',
    panelBottom: '#0e1217',
    edge: 'rgba(255, 255, 255, 0.10)',
    cardTop: '#202833',
    cardBottom: '#181e27',
    cardEdge: 'rgba(255, 255, 255, 0.07)',
    text: '#e8ebf0',
    dim: 'rgba(232, 235, 240, 0.58)',
    faint: 'rgba(232, 235, 240, 0.36)',
    tile: 'rgba(255, 255, 255, 0.06)',
    tileEdge: 'rgba(255, 255, 255, 0.13)',
    track: 'rgba(255, 255, 255, 0.10)',
    hostile: '#f87171',
    faction: '#38bdf8',
    passive: '#4ade80',
    ip: '#fbbf24',
    alliance: '#c084fc',
    mounted: '#a78bfa',
    healthHigh: '#4ade80',
    healthMid: '#fbbf24',
    healthLow: '#f87171',
};

export const TIER_COLORS = ['#9ca3af', '#9ca3af', '#a8b0bd', '#93c5fd', '#7dd3fc', '#fca5a5', '#fdba74', '#fde047', '#f8fafc'];
export const ENCHANT_COLORS = ['', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24'];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function metrics(mapSize) {
    const u = clamp(mapSize / BASE_SIZE, 0.8, 2);
    const r = value => Math.round(value * u);
    return {
        u,
        pad: r(10),
        gap: r(8),
        header: r(24),
        radius: r(8),
        cardPadX: r(10),
        cardPadY: r(7),
        accent: r(3),
        line1: r(18),
        line2: r(14),
        lineGap: r(2),
        sectionGap: r(6),
        iconMax: r(30),
        iconMin: r(16),
        iconGap: r(4),
        tierLine: r(11),
        healthH: r(5),
        spellIcon: r(20),
        nameSize: r(13),
        smallSize: r(10),
        tinySize: r(9),
    };
}

/**
 * Reads the PiP panel settings. Reuses the Players page display toggles so the floating panel
 * shows exactly what the page cards show.
 */
export function readPanelSettings(settings) {
    const stored = settings?.get?.('settingRadarPipPlayers');
    const position = PIP_PLAYERS_POSITIONS.includes(stored) ? stored : 'off';
    const flag = key => settings?.getBool?.(key) === true;
    return {
        position,
        opts: {
            equipment: flag('settingPlayersShowEquipment'),
            spells: flag('settingPlayersShowSpells'),
            health: flag('settingPlayersShowHealthBars'),
            guild: flag('settingPlayersShowGuild'),
            ip: flag('settingPlayersShowTotalIp'),
            mounted: flag('settingPlayersShowMounted'),
        },
    };
}

/**
 * Geometry of the PiP canvas and of the panel inside it. Returns null when the panel is off.
 * `right` widens the canvas, `bottom` makes it taller; the map always stays at 0,0.
 */
export function computeLayout(position, mapSize, opts) {
    if (position !== 'right' && position !== 'bottom') return null;

    const m = metrics(mapSize);
    const beside = position === 'right';
    const cols = beside ? 1 : COLS_UNDER;
    const panelW = beside ? Math.round(PANEL_WIDTH_BESIDE * m.u) : mapSize;
    const cardW = Math.floor((panelW - 2 * m.pad - (cols - 1) * m.gap) / cols);

    const tileRoom = cardW - 2 * m.cardPadX - m.accent;
    const icon = clamp(Math.floor((tileRoom - (MAX_GEAR_TILES - 1) * m.iconGap) / MAX_GEAR_TILES), m.iconMin, m.iconMax);

    let cardH = 2 * m.cardPadY + m.line1 + m.lineGap + m.line2;
    if (opts.equipment) cardH += m.sectionGap + icon + m.tierLine;
    if (opts.spells) cardH += m.sectionGap + m.spellIcon;
    if (opts.health) cardH += m.sectionGap + m.healthH;

    const cardsTop = m.pad + m.header + m.gap;
    const rows = beside
        ? Math.max(1, Math.floor((mapSize - cardsTop - m.pad + m.gap) / (cardH + m.gap)))
        : ROWS_UNDER;
    const panelH = beside ? mapSize : cardsTop + rows * (cardH + m.gap) - m.gap + m.pad;

    return {
        position,
        m,
        opts,
        cols,
        rows,
        capacity: cols * rows,
        cardW,
        cardH,
        icon,
        cardsTop,
        width: beside ? mapSize + panelW : mapSize,
        height: beside ? mapSize : mapSize + panelH,
        panel: {x: beside ? mapSize : 0, y: beside ? 0 : mapSize, w: panelW, h: panelH},
    };
}

/**
 * Players to show, hostile first, plus the per-type counts. Same source and filters as the
 * Players page (getPlayersByType), so both views agree.
 */
export function collectPlayers(handler) {
    const counts = {hostile: 0, faction: 0, passive: 0};
    const entries = [];
    const byType = handler?.getPlayersByType?.();
    if (!byType) return {entries, counts};

    for (const type of PLAYER_TYPES) {
        const players = byType[type] ?? [];
        counts[type] = players.length;
        for (const player of players) entries.push({player, type});
    }
    return {entries, counts};
}

/**
 * Gear tiles for a player. Mirrors the Players page: slots 0-4 and 8, in slot order.
 */
export function gearOf(player, itemsDb) {
    if (!itemsDb || !Array.isArray(player?.equipments)) return [];
    const tiles = [];
    player.equipments.forEach((itemId, index) => {
        if (!(index <= 4 || index === 8) || !itemId || itemId <= 0) return;
        const item = itemsDb.getItemById(itemId);
        if (!item) return;
        const baseName = item.name.split('@')[0];
        tiles.push({
            baseName,
            tier: item.tier,
            enchant: item.enchant,
            url: `/images/Items/${baseName}.webp`,
        });
    });
    return tiles.slice(0, MAX_GEAR_TILES);
}

export function spellsOf(player, spellsDb) {
    if (!spellsDb || !Array.isArray(player?.spells)) return [];
    return player.spells
        .filter(id => id && id > 0 && id !== 65535)
        .map(id => spellsDb.getSpellByIndex(id))
        .filter(Boolean)
        .map(spell => ({url: `/images/Spells/${spell.uiSprite || 'SPELL_GENERIC'}.webp`}));
}

function roundRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function fillRound(ctx, x, y, w, h, radius, fill) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
}

function strokeRound(ctx, x, y, w, h, radius, stroke, width = 1) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
}

function setFont(ctx, weight, size, family) {
    ctx.font = `${weight} ${size}px ${family}`;
}

function fitText(ctx, text, maxWidth) {
    if (maxWidth <= 0) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    for (let end = text.length - 1; end > 0; end--) {
        const candidate = `${text.slice(0, end)}…`;
        if (ctx.measureText(candidate).width <= maxWidth) return candidate;
    }
    return '';
}

export function formatElapsed(detectedAt, now) {
    const seconds = Math.max(0, Math.floor((now - detectedAt) / 1000));
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}

function defaultIconLoader() {
    const cache = new Map();
    return url => {
        let record = cache.get(url);
        if (!record) {
            record = {image: null, ready: false};
            if (typeof Image === 'function') {
                const image = new Image();
                image.onload = () => {
                    record.ready = true;
                };
                image.src = url;
                record.image = image;
            }
            cache.set(url, record);
        }
        return record.ready ? record.image : null;
    };
}

export class PipPlayersPanel {
    /**
     * @param {object} [deps] injectable for tests
     * @param {(url: string) => (CanvasImageSource|null)} [deps.loadIcon] returns the image once loaded
     * @param {() => object} [deps.items] items database
     * @param {() => object} [deps.spells] spells database
     */
    constructor({loadIcon, items, spells} = {}) {
        this.loadIcon = loadIcon ?? defaultIconLoader();
        this.items = items ?? (() => globalThis.window?.itemsDatabase);
        this.spells = spells ?? (() => globalThis.window?.spellsDatabase);
    }

    draw(ctx, layout, model, now = Date.now()) {
        const {panel, m} = layout;
        this.drawBackground(ctx, layout);
        this.drawHeader(ctx, layout, model);

        if (model.entries.length === 0) {
            this.drawEmpty(ctx, layout);
            return;
        }

        const shown = model.entries.slice(0, layout.capacity);
        shown.forEach((entry, index) => {
            const col = index % layout.cols;
            const row = Math.floor(index / layout.cols);
            const x = panel.x + m.pad + col * (layout.cardW + m.gap);
            const y = panel.y + layout.cardsTop + row * (layout.cardH + m.gap);
            this.drawCard(ctx, layout, entry, x, y, now);
        });
    }

    drawBackground(ctx, layout) {
        const {panel} = layout;
        const gradient = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
        gradient.addColorStop(0, COLORS.panelTop);
        gradient.addColorStop(1, COLORS.panelBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(panel.x, panel.y, panel.w, panel.h);

        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (layout.position === 'right') {
            ctx.moveTo(panel.x + 0.5, panel.y);
            ctx.lineTo(panel.x + 0.5, panel.y + panel.h);
        } else {
            ctx.moveTo(panel.x, panel.y + 0.5);
            ctx.lineTo(panel.x + panel.w, panel.y + 0.5);
        }
        ctx.stroke();
    }

    drawHeader(ctx, layout, model) {
        const {panel, m} = layout;
        const midY = panel.y + m.pad + m.header / 2;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        setFont(ctx, 700, m.smallSize + 1, FONT_SANS);
        ctx.fillStyle = COLORS.dim;
        ctx.fillText('PLAYERS', panel.x + m.pad, midY);

        let right = panel.x + panel.w - m.pad;
        ctx.textAlign = 'right';
        setFont(ctx, 700, m.smallSize + 1, FONT_MONO);
        for (const type of [...PLAYER_TYPES].reverse()) {
            const count = model.counts[type];
            if (!count) continue;
            const label = String(count);
            ctx.fillStyle = COLORS.text;
            ctx.fillText(label, right, midY);
            right -= ctx.measureText(label).width + m.u * 4;
            ctx.fillStyle = COLORS[type];
            ctx.beginPath();
            ctx.arc(right, midY, m.u * 3, 0, Math.PI * 2);
            ctx.fill();
            right -= m.u * 12;
        }

        const hidden = model.entries.length - layout.capacity;
        if (hidden > 0) {
            setFont(ctx, 600, m.tinySize + 1, FONT_MONO);
            ctx.fillStyle = COLORS.faint;
            ctx.fillText(`+${hidden} more`, right, midY);
        }
        ctx.textAlign = 'left';
    }

    drawEmpty(ctx, layout) {
        const {panel, m} = layout;
        const centerX = panel.x + panel.w / 2;
        const centerY = panel.y + layout.cardsTop + (panel.h - layout.cardsTop - m.pad) / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        setFont(ctx, 600, m.nameSize, FONT_SANS);
        ctx.fillStyle = COLORS.dim;
        ctx.fillText('No players detected', centerX, centerY - m.u * 7);
        setFont(ctx, 500, m.smallSize, FONT_MONO);
        ctx.fillStyle = COLORS.faint;
        ctx.fillText('Scanning...', centerX, centerY + m.u * 9);
        ctx.textAlign = 'left';
    }

    drawCard(ctx, layout, entry, x, y, now) {
        const {m, opts, cardW, cardH} = layout;
        const {player, type} = entry;
        const typeColor = COLORS[type];

        const gradient = ctx.createLinearGradient(x, y, x, y + cardH);
        gradient.addColorStop(0, COLORS.cardTop);
        gradient.addColorStop(1, COLORS.cardBottom);
        fillRound(ctx, x, y, cardW, cardH, m.radius, gradient);
        strokeRound(ctx, x + 0.5, y + 0.5, cardW - 1, cardH - 1, m.radius, COLORS.cardEdge);

        ctx.fillStyle = typeColor;
        ctx.fillRect(x, y + m.radius, m.accent, cardH - 2 * m.radius);

        const left = x + m.accent + m.cardPadX;
        const right = x + cardW - m.cardPadX;
        let cursor = y + m.cardPadY;

        this.drawNameLine(ctx, layout, player, type, left, right, cursor);
        cursor += m.line1 + m.lineGap;
        this.drawMetaLine(ctx, layout, player, left, right, cursor, now);
        cursor += m.line2;

        if (opts.equipment) {
            cursor += m.sectionGap;
            this.drawGear(ctx, layout, player, left, cursor);
            cursor += layout.icon + m.tierLine;
        }
        if (opts.spells) {
            cursor += m.sectionGap;
            this.drawSpells(ctx, layout, player, left, right, cursor);
            cursor += m.spellIcon;
        }
        if (opts.health) {
            cursor += m.sectionGap;
            this.drawHealth(ctx, layout, player, left, right, cursor);
        }
    }

    drawNameLine(ctx, layout, player, type, left, right, top) {
        const {m} = layout;
        const midY = top + m.line1 / 2;

        const label = type === 'faction' && FACTION_CITIES[player.faction]
            ? `⚔ ${FACTION_CITIES[player.faction]}`.toUpperCase()
            : type.toUpperCase();
        setFont(ctx, 700, m.tinySize, FONT_MONO);
        const labelW = Math.ceil(ctx.measureText(label).width) + m.u * 10;
        const labelH = m.line1 - m.u * 4;
        const labelX = right - labelW;
        fillRound(ctx, labelX, midY - labelH / 2, labelW, labelH, m.u * 4, `${COLORS[type]}26`);
        strokeRound(ctx, labelX + 0.5, midY - labelH / 2 + 0.5, labelW - 1, labelH - 1, m.u * 4, `${COLORS[type]}55`);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS[type];
        ctx.fillText(label, labelX + labelW / 2, midY + 0.5);

        ctx.textAlign = 'left';
        setFont(ctx, 700, m.nameSize, FONT_SANS);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(fitText(ctx, String(player.nickname ?? ''), labelX - left - m.u * 6), left, midY);
    }

    drawMetaLine(ctx, layout, player, left, right, top, now) {
        const {m, opts} = layout;
        const midY = top + m.line2 / 2;
        ctx.textBaseline = 'middle';

        let edge = right;
        ctx.textAlign = 'right';
        setFont(ctx, 500, m.tinySize, FONT_MONO);
        ctx.fillStyle = COLORS.faint;
        const elapsed = formatElapsed(player.detectedAt ?? now, now);
        ctx.fillText(elapsed, edge, midY);
        edge -= ctx.measureText(elapsed).width + m.u * 8;

        const averagePower = opts.ip ? player.getAverageItemPower?.() : null;
        if (averagePower) {
            setFont(ctx, 700, m.smallSize, FONT_MONO);
            const text = `IP ${averagePower}`;
            const chipW = Math.ceil(ctx.measureText(text).width) + m.u * 10;
            const chipH = m.line2;
            fillRound(ctx, edge - chipW, midY - chipH / 2, chipW, chipH, m.u * 4, `${COLORS.ip}26`);
            strokeRound(ctx, edge - chipW + 0.5, midY - chipH / 2 + 0.5, chipW - 1, chipH - 1, m.u * 4, `${COLORS.ip}59`);
            ctx.textAlign = 'center';
            ctx.fillStyle = COLORS.ip;
            ctx.fillText(text, edge - chipW / 2, midY + 0.5);
            ctx.textAlign = 'right';
            edge -= chipW + m.u * 6;
        }

        if (opts.mounted && player.mounted) {
            setFont(ctx, 700, m.tinySize - 1, FONT_MONO);
            const text = 'MOUNT';
            const chipW = Math.ceil(ctx.measureText(text).width) + m.u * 8;
            const chipH = m.line2 - m.u * 2;
            fillRound(ctx, edge - chipW, midY - chipH / 2, chipW, chipH, m.u * 4, `${COLORS.mounted}26`);
            ctx.textAlign = 'center';
            ctx.fillStyle = COLORS.mounted;
            ctx.fillText(text, edge - chipW / 2, midY + 0.5);
            ctx.textAlign = 'right';
            edge -= chipW + m.u * 6;
        }

        ctx.textAlign = 'left';
        const room = edge - left;
        let cursor = left;
        if (opts.guild) {
            setFont(ctx, player.guildName ? 600 : 400, m.smallSize, FONT_MONO);
            ctx.fillStyle = player.guildName ? COLORS.ip : COLORS.faint;
            const text = fitText(ctx, player.guildName ? `[${player.guildName}]` : 'No Guild', room);
            ctx.fillText(text, cursor, midY);
            cursor += ctx.measureText(text).width + m.u * 6;
        }
        if (player.allianceName) {
            setFont(ctx, 600, m.smallSize, FONT_MONO);
            ctx.fillStyle = COLORS.alliance;
            ctx.fillText(fitText(ctx, `<${player.allianceName}>`, edge - cursor), cursor, midY);
        }
    }

    drawGear(ctx, layout, player, left, top) {
        const {m, icon} = layout;
        const tiles = gearOf(player, this.items());

        if (tiles.length === 0) {
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            setFont(ctx, 500, m.smallSize, FONT_MONO);
            ctx.fillStyle = COLORS.faint;
            ctx.fillText('Gear not detected yet', left, top + (icon + m.tierLine) / 2);
            return;
        }

        tiles.forEach((tile, index) => {
            const x = left + index * (icon + m.iconGap);
            const enchantColor = ENCHANT_COLORS[tile.enchant] || '';
            const tileRadius = m.u * 5;

            fillRound(ctx, x, top, icon, icon, tileRadius, COLORS.tile);
            const image = this.loadIcon(tile.url);
            if (image) {
                const inset = Math.max(1, Math.round(m.u * 2));
                ctx.drawImage(image, x + inset, top + inset, icon - 2 * inset, icon - 2 * inset);
            } else {
                setFont(ctx, 700, m.smallSize, FONT_MONO);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = COLORS.faint;
                ctx.fillText(tile.tier > 0 ? `T${tile.tier}` : '?', x + icon / 2, top + icon / 2);
            }
            strokeRound(ctx, x + 0.5, top + 0.5, icon - 1, icon - 1, tileRadius, enchantColor || COLORS.tileEdge, enchantColor ? 1.5 : 1);

            const label = `${tile.tier > 0 ? `T${tile.tier}` : ''}${tile.enchant > 0 ? `.${tile.enchant}` : ''}`;
            if (label) {
                setFont(ctx, 700, m.tinySize - 1, FONT_MONO);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = enchantColor || TIER_COLORS[clamp(tile.tier, 0, 8)];
                ctx.fillText(label, x + icon / 2, top + icon + m.tierLine / 2 + 1);
            }
        });
        ctx.textAlign = 'left';
    }

    drawSpells(ctx, layout, player, left, right, top) {
        const {m} = layout;
        const spells = spellsOf(player, this.spells());
        const size = m.spellIcon;
        const fit = Math.max(0, Math.floor((right - left + m.iconGap) / (size + m.iconGap)));

        spells.slice(0, fit).forEach((spell, index) => {
            const x = left + index * (size + m.iconGap);
            fillRound(ctx, x, top, size, size, m.u * 4, COLORS.tile);
            const image = this.loadIcon(spell.url);
            if (image) ctx.drawImage(image, x + 1, top + 1, size - 2, size - 2);
            strokeRound(ctx, x + 0.5, top + 0.5, size - 1, size - 1, m.u * 4, COLORS.tileEdge);
        });
    }

    drawHealth(ctx, layout, player, left, right, top) {
        const {m} = layout;
        const hasHealth = player.currentHealth > 0 && player.initialHealth > 0;
        const percent = hasHealth ? clamp(Math.round((player.currentHealth / player.initialHealth) * 100), 0, 100) : 0;

        setFont(ctx, 600, m.tinySize - 1, FONT_MONO);
        const labelW = Math.ceil(ctx.measureText('100%').width);
        const trackW = right - left - labelW - m.u * 6;

        fillRound(ctx, left, top, trackW, m.healthH, m.healthH / 2, COLORS.track);
        if (hasHealth) {
            const color = percent > 60 ? COLORS.healthHigh : percent > 30 ? COLORS.healthMid : COLORS.healthLow;
            fillRound(ctx, left, top, Math.max(m.healthH, (trackW * percent) / 100), m.healthH, m.healthH / 2, color);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.faint;
        ctx.fillText(hasHealth ? `${percent}%` : '--', right, top + m.healthH / 2 + 0.5);
        ctx.textAlign = 'left';
    }
}

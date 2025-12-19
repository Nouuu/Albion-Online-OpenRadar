// PlayerListRenderer.js - Player list UI rendering
// Extracted from Utils.js during Phase 1B refactor

// Render cache for incremental updates
let lastRenderedPlayerIds = new Map();

// Cached DOM references
let _playerElements = null;
let _lastPlayerCounts = {hostile: -1, faction: -1, passive: -1};

// Faction city names constant
const FACTION_CITIES = ['', 'Martlock', 'Lymhurst', 'Bridgewatch', 'Fort Sterling', 'Thetford', 'Caerleon'];

// Badge rendering helpers (extracted for readability)
function formatElapsedTime(detectedAt) {
    const elapsedSec = Math.floor((Date.now() - detectedAt) / 1000);
    return elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m`;
}

function renderGuildBadge(guildName) {
    return guildName
        ? `<span class="text-[11px] font-mono font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">[${guildName}]</span>`
        : '<span class="text-[10px] text-base-content/30 italic">No Guild</span>';
}

function renderAllianceBadge(allianceName) {
    return allianceName
        ? `<span class="text-[11px] font-mono font-medium text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">&lt;${allianceName}&gt;</span>`
        : '';
}

function renderPlayerTypeBadge(effectiveType, factionCityName) {
    if (effectiveType === 'passive') {
        return {
            badge: `<span class="text-[9px] font-mono font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/25 uppercase tracking-wide">Passive</span>`,
            color: 'success'
        };
    } else if (effectiveType === 'faction') {
        const cityLabel = factionCityName ? `⚔ ${factionCityName}` : 'Faction';
        return {
            badge: `<span class="text-[9px] font-mono font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded border border-info/25 uppercase tracking-wide">${cityLabel}</span>`,
            color: 'info'
        };
    }
    return {
        badge: `<span class="text-[9px] font-mono font-semibold text-error bg-error/10 px-1.5 py-0.5 rounded border border-error/25 uppercase tracking-wide">Hostile</span>`,
        color: 'error'
    };
}

function renderPlayerCard(player, threatType = null) {
    const timeStr = formatElapsedTime(player.detectedAt);
    const guildBadge = renderGuildBadge(player.guildName);
    const allianceBadge = renderAllianceBadge(player.allianceName);

    // Determine player type
    const factionCityName = player.isFactionPlayer?.() ? FACTION_CITIES[player.faction] : null;
    const effectiveType = threatType || (player.isPassive?.() ? 'passive' : player.isFactionPlayer?.() ? 'faction' : 'hostile');
    const {badge: playerTypeBadge, color: playerTypeColor} = renderPlayerTypeBadge(effectiveType, factionCityName);

    // Average IP badge
    const avgItemPower = player.getAverageItemPower?.();
    const ipBadge = avgItemPower
        ? `<span class="text-[11px] font-mono font-bold text-warning bg-gradient-to-br from-warning/15 to-warning/5 px-2 py-0.5 rounded border border-warning/30">IP ${avgItemPower}</span>`
        : '';

    // Mounted badge
    const mountedBadge = player.mounted
        ? `<span class="text-[9px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25 uppercase tracking-wide">Mounted</span>`
        : '';

    // Equipment section
    let equipHtml = '';
    if (window.settingsSync?.getBool('settingItems') && Array.isArray(player.equipments) && player.equipments.length > 0 && window.itemsDatabase) {
        const validEquipments = player.equipments
            .map((itemId, index) => ({itemId, index}))
            .filter(({itemId, index}) => (index <= 4 || index === 8) && itemId && itemId > 0);

        if (validEquipments.length > 0) {
            const items = validEquipments.map(({itemId}) => {
                const item = window.itemsDatabase.getItemById(itemId);
                if (!item) return '';

                const tierStr = item.tier > 0 ? `T${item.tier}` : '';
                const enchantStr = item.enchant > 0 ? `.${item.enchant}` : '';
                const ipStr = item.itempower > 0 ? item.itempower : '';
                const baseName = item.name.split('@')[0];
                const iconPath = `/images/Items/${baseName}.webp`;

                return `<div class="inline-flex items-center gap-1.5 bg-base-100/60 px-2 py-1 rounded hover:bg-base-100/80 transition-colors" title="${baseName} - ${tierStr}${enchantStr} - IP: ${ipStr}"><img src="${iconPath}" alt="${baseName}" class="w-6 h-6 object-contain drop-shadow-sm bg-base-200/50 rounded" loading="lazy"><span class="text-[10px] font-mono font-semibold text-base-content/80">${tierStr}${enchantStr}</span>${ipStr ? `<span class="text-[9px] font-mono font-bold text-warning">${ipStr}</span>` : ''}</div>`;
            }).filter(Boolean).join('');

            if (items) {
                equipHtml = `<div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-base-content/[0.03]">${items}</div>`;
            }
        }
    }

    // Spells section
    let spellsHtml = '';
    if (window.settingsSync?.getBool('settingShowSpells') && Array.isArray(player.spells) && player.spells.length > 0 && window.spellsDatabase) {
        const validSpells = player.spells.filter(id => id && id > 0 && id !== 65535);
        if (validSpells.length > 0) {
            const spells = validSpells.map(spellIndex => {
                const spell = window.spellsDatabase.getSpellByIndex(spellIndex);
                if (!spell) return '';

                const iconPath = `/images/Spells/${spell.uiSprite || 'SPELL_GENERIC'}.webp`;
                return `<div class="flex items-center justify-center bg-primary/10 p-1.5 rounded hover:bg-primary/15 transition-all" title="${spell.uniqueName}"><img src="${iconPath}" alt="${spell.uniqueName}" class="w-5 h-5 object-contain bg-base-200/50 rounded" loading="lazy"></div>`;
            }).filter(Boolean).join('');

            if (spells) {
                spellsHtml = `<div class="flex flex-wrap gap-1.5 mt-3">${spells}</div>`;
            }
        }
    }

    // Health bar
    let healthHtml = '';
    if (window.settingsSync?.getBool('settingShowPlayerHealthBar') && player.currentHealth > 0 && player.initialHealth > 0) {
        const pct = Math.round((player.currentHealth / player.initialHealth) * 100);
        const colorClass = pct > 60 ? 'bg-gradient-to-r from-success to-green-500'
            : pct > 30 ? 'bg-gradient-to-r from-warning to-amber-500'
                : 'bg-gradient-to-r from-error to-red-500 animate-pulse';
        healthHtml = `<div class="flex items-center gap-2 mt-3"><div class="flex-1 h-1.5 bg-base-content/5 rounded-full overflow-hidden"><div data-health-bar class="h-full rounded-full transition-all duration-300 ${colorClass}" style="width: ${pct}%;"></div></div><span class="text-[10px] font-mono text-base-content/50 min-w-[2.5rem] text-right">${pct}%</span></div>`;
    }

    // ID display
    const idStr = `<div class="text-[10px] font-mono text-base-content/25 mt-3 pt-2 border-t border-base-content/[0.03]">ID: ${player.id}</div>`;

    // Build card
    const accentBarClass = `bg-${playerTypeColor}`;

    return `<div class="group relative p-4 pl-5 bg-gradient-to-br from-base-300 to-base-200 rounded-lg transition-all duration-200 hover:from-base-300/90 hover:to-base-200/90 hover:translate-x-0.5" data-player-id="${player.id}"><div class="absolute left-0 top-0 bottom-0 w-[3px] ${accentBarClass} opacity-90 group-hover:opacity-100 group-hover:w-1 transition-all"></div><div class="flex justify-between items-start gap-3"><div class="flex-1 min-w-0"><span class="block text-sm font-semibold text-base-content truncate">${player.nickname}</span><div class="flex flex-wrap items-center gap-1.5 mt-1">${guildBadge}${allianceBadge}</div></div><div class="flex flex-col items-end gap-1 shrink-0">${playerTypeBadge}<span data-time class="text-[10px] font-mono text-base-content/40">${timeStr}</span></div></div><div class="flex flex-wrap items-center gap-1.5 mt-2">${ipBadge}${mountedBadge}</div>${equipHtml}${spellsHtml}${healthHtml}${idStr}</div>`;
}

function updateSectionPlayers(listContainer, players, threatType) {
    const currentIds = new Set(players.map(p => p.id));

    // Remove players no longer in this section
    listContainer.querySelectorAll('[data-player-id]').forEach(card => {
        const id = parseInt(card.dataset.playerId);
        if (!currentIds.has(id)) {
            card.remove();
            lastRenderedPlayerIds.delete(id);
        }
    });

    // Update or add players
    players.forEach(player => {
        const existingCard = listContainer.querySelector(`[data-player-id="${player.id}"]`);
        const lastRender = lastRenderedPlayerIds.get(player.id);

        if (existingCard && lastRender) {
            // Update timestamp
            const timeEl = existingCard.querySelector('[data-time]');
            if (timeEl) {
                const elapsedSec = Math.floor((Date.now() - player.detectedAt) / 1000);
                timeEl.textContent = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m`;
            }
            // Update health bar if changed
            if (player.currentHealth !== lastRender.health) {
                const healthBar = existingCard.querySelector('[data-health-bar]');
                if (healthBar && player.initialHealth > 0) {
                    const pct = Math.round((player.currentHealth / player.initialHealth) * 100);
                    healthBar.style.width = `${pct}%`;
                }
            }
        } else {
            // Create new card
            const template = document.createElement('template');
            template.innerHTML = renderPlayerCard(player, threatType).trim();
            listContainer.appendChild(template.content.firstChild);
        }

        lastRenderedPlayerIds.set(player.id, {health: player.currentHealth});
    });
}

function getPlayerListElements() {
    if (!_playerElements) {
        _playerElements = {
            container: document.getElementById('playersList'),
            playerStats: document.getElementById('playerStats'),
            statHostileContainer: document.getElementById('statHostileContainer'),
            statFactionContainer: document.getElementById('statFactionContainer'),
            statPassiveContainer: document.getElementById('statPassiveContainer'),
            statHostile: document.getElementById('statHostile'),
            statFaction: document.getElementById('statFaction'),
            statPassive: document.getElementById('statPassive'),
            hostileSection: document.getElementById('playersHostile'),
            factionSection: document.getElementById('playersFaction'),
            passiveSection: document.getElementById('playersPassive'),
            emptyState: document.getElementById('playersEmpty'),
            hostileList: document.getElementById('hostileList'),
            factionList: document.getElementById('factionList'),
            passiveList: document.getElementById('passiveList'),
            hostileCount: document.getElementById('hostileCount'),
            factionCount: document.getElementById('factionCount'),
            passiveCount: document.getElementById('passiveCount')
        };
    }
    return _playerElements;
}

export function update(playersHandler) {
    const els = getPlayerListElements();
    if (!els.container) return;

    const playersByType = playersHandler.getPlayersByType();
    const counts = {
        hostile: playersByType.hostile.length,
        faction: playersByType.faction.length,
        passive: playersByType.passive.length
    };
    const total = counts.hostile + counts.faction + counts.passive;

    // Get filter settings
    const showHostile = window.settingsSync?.getBool('settingDangerousPlayers') ?? true;
    const showFaction = window.settingsSync?.getBool('settingFactionPlayers') ?? true;
    const showPassive = window.settingsSync?.getBool('settingPassivePlayers') ?? true;

    // Update stats values
    const countsChanged = counts.hostile !== _lastPlayerCounts.hostile ||
        counts.faction !== _lastPlayerCounts.faction ||
        counts.passive !== _lastPlayerCounts.passive;

    if (countsChanged) {
        _lastPlayerCounts = {...counts};
        if (els.statHostile) els.statHostile.textContent = counts.hostile;
        if (els.statFaction) els.statFaction.textContent = counts.faction;
        if (els.statPassive) els.statPassive.textContent = counts.passive;
    }

    // Show/hide stat containers based on filters
    if (els.statHostileContainer) els.statHostileContainer.classList.toggle('hidden', !showHostile);
    if (els.statFactionContainer) els.statFactionContainer.classList.toggle('hidden', !showFaction);
    if (els.statPassiveContainer) els.statPassiveContainer.classList.toggle('hidden', !showPassive);

    // Show stats container only when there are players
    const hasVisibleStats = (showHostile || showFaction || showPassive) && total > 0;
    if (els.playerStats) {
        els.playerStats.classList.toggle('hidden', !hasVisibleStats);
    }

    // Show/hide empty state
    if (els.emptyState) {
        els.emptyState.classList.toggle('hidden', total > 0);
    }

    // Set data-sections for CSS grid rules
    const visibleSections = (counts.hostile > 0 ? 1 : 0) +
        (counts.faction > 0 ? 1 : 0) +
        (counts.passive > 0 ? 1 : 0);
    els.container.dataset.sections = visibleSections;

    // Helper to update a player section (DRY)
    const updateSection = (section, list, countEl, players, type) => {
        if (!section || !list) return;
        if (players.length > 0) {
            section.classList.remove('hidden');
            if (countEl) countEl.textContent = `(${players.length})`;
            requestAnimationFrame(() => updateSectionPlayers(list, players, type));
        } else {
            section.classList.add('hidden');
            list.innerHTML = '';
        }
    };

    updateSection(els.hostileSection, els.hostileList, els.hostileCount, playersByType.hostile, 'hostile');
    updateSection(els.factionSection, els.factionList, els.factionCount, playersByType.faction, 'faction');
    updateSection(els.passiveSection, els.passiveList, els.passiveCount, playersByType.passive, 'passive');

    // Clear render cache if no players
    if (total === 0 && lastRenderedPlayerIds.size > 0) {
        lastRenderedPlayerIds.clear();
    }
}

export function reset() {
    _playerElements = null;
    _lastPlayerCounts = {hostile: -1, faction: -1, passive: -1};
    lastRenderedPlayerIds.clear();
}

export function cleanupStaleCache(activePlayerIds) {
    let cleaned = 0;
    for (const id of lastRenderedPlayerIds.keys()) {
        if (!activePlayerIds.has(id)) {
            lastRenderedPlayerIds.delete(id);
            cleaned++;
        }
    }
    return cleaned;
}

import {CATEGORIES} from "../constants/LoggerConstants.js";

// UpdateFame (event 82): [0] local player id, [1] total fame, [2] fame gained.
// Both fame values are fixed-point, scaled by 10000 on the wire.
export const FAME_SCALE = 10000;
// UpdateMoney (event 81): [0] local player id, [1] total silver, same x10000 scale.
// Silver gained is the change in [1] between events; [2] is left alone until its meaning is confirmed.
export const SILVER_SCALE = 10000;

// A fame event arriving this soon after a mob death is credited to that kill.
export const KILL_WINDOW_MS = 2000;
// Follow-up fame events for an already credited kill are merged into its popup.
const KILL_MERGE_MS = 500;
export const POPUP_DURATION_MS = 2500;
const MAX_POPUPS = 20;
const SESSION_KEY = 'fameSession';

/**
 * Parse a typed amount: "1000000", "1,000,000", "500k", "1.5m". Returns 0 when invalid.
 */
export function parseFameAmount(text) {
    const match = String(text ?? '').trim().toLowerCase().replace(/[,\s]/g, '').match(/^(\d+(?:\.\d+)?)([km]?)$/);
    if (!match) return 0;
    const multiplier = {k: 1e3, m: 1e6}[match[2]] ?? 1;
    return Math.round(parseFloat(match[1]) * multiplier);
}

function emptySession() {
    return {startedAt: null, fame: 0, killFame: 0, kills: 0, totalFame: null, silver: 0, silverTotal: null};
}

export class FameHandler
{
    constructor()
    {
        this.popups = [];
        this.recentDeaths = [];
        this.lastKill = null;
        this.session = this.loadSession();
    }

    /**
     * Remember a mob death so the next fame event can be credited to it.
     * @param {Object} mob - Mob removed on death (needs posX/posY)
     */
    onMobDied(mob)
    {
        if (!mob) return;
        const now = Date.now();
        this.pruneDeaths(now);
        this.recentDeaths.push({posX: mob.posX, posY: mob.posY, name: mob.name, at: now});
    }

    /**
     * Handle UpdateFame (event 82).
     * @returns {Object|null} - The popup created or updated, null if ignored
     */
    onUpdateFame(Parameters)
    {
        const gained = Number(Parameters[2]) / FAME_SCALE;
        if (!Number.isFinite(gained) || gained <= 0) return null;

        const now = Date.now();
        const total = Number(Parameters[1]) / FAME_SCALE;

        this.startSession(now);
        this.session.fame += gained;
        if (Number.isFinite(total)) this.session.totalFame = total;

        this.pruneDeaths(now);
        const death = this.recentDeaths.shift();
        let popup;

        if (death) {
            this.session.kills++;
            this.session.killFame += gained;
            popup = this.addPopup({amount: gained, posX: death.posX, posY: death.posY, kill: true, name: death.name, at: now});
            this.lastKill = {popup, at: now};
        } else if (this.lastKill && now - this.lastKill.at <= KILL_MERGE_MS) {
            this.session.killFame += gained;
            popup = this.lastKill.popup;
            popup.amount += gained;
            popup.at = now;
        } else {
            popup = this.addPopup({amount: gained, posX: null, posY: null, kill: false, name: null, at: now});
        }

        window.logger?.debug(CATEGORIES.MOBS, 'fame_gained', {
            gained, total, kill: popup.kill, name: popup.name
        });

        this.saveSession();
        return popup;
    }

    /**
     * Handle UpdateMoney (event 81). Only silver increases count as earned;
     * spending (repairs, market) lowers the running total without subtracting.
     * @returns {Object|null} - The silver popup created, null if nothing was earned
     */
    onUpdateMoney(Parameters)
    {
        const total = Number(Parameters[1]) / SILVER_SCALE;
        if (!Number.isFinite(total)) return null;

        const previous = this.session.silverTotal;
        this.session.silverTotal = total;
        const gained = previous === null ? 0 : Math.round(total - previous);

        if (gained <= 0) {
            this.saveSession();
            return null;
        }

        const now = Date.now();
        this.startSession(now);
        this.session.silver += gained;

        window.logger?.debug(CATEGORIES.MOBS, 'silver_gained', {gained, total});

        const popup = this.addPopup({amount: gained, posX: null, posY: null, kill: false, silver: true, name: null, at: now});
        this.saveSession();
        return popup;
    }

    startSession(now)
    {
        if (this.session.startedAt === null) this.session.startedAt = now;
    }

    addPopup(popup)
    {
        this.popups.push(popup);
        if (this.popups.length > MAX_POPUPS) this.popups.shift();
        return popup;
    }

    /**
     * Popups still on screen, oldest first. Expired ones are dropped.
     */
    getActivePopups(now = Date.now())
    {
        this.popups = this.popups.filter(p => now - p.at < POPUP_DURATION_MS);
        return this.popups;
    }

    pruneDeaths(now)
    {
        this.recentDeaths = this.recentDeaths.filter(d => now - d.at <= KILL_WINDOW_MS);
    }

    /**
     * Session fame per hour, null until one minute of data is available.
     */
    getFamePerHour(now = Date.now())
    {
        return this.perHour(this.session.fame, now);
    }

    /**
     * Session silver per hour, null until one minute of data is available.
     */
    getSilverPerHour(now = Date.now())
    {
        return this.perHour(this.session.silver, now);
    }

    perHour(amount, now)
    {
        if (this.session.startedAt === null) return null;
        const elapsed = now - this.session.startedAt;
        if (elapsed < 60000) return null;
        return amount / (elapsed / 3600000);
    }

    /**
     * Progress toward a session fame goal.
     * @param {number} goal - Target session fame (<= 0 means no goal)
     * @returns {{goal, fame, ratio, etaMs}|null} - etaMs null until a rate is known
     */
    getGoalProgress(goal, now = Date.now())
    {
        if (!(goal > 0)) return null;
        const fame = this.session.fame;
        const ratio = Math.min(1, fame / goal);
        const rate = this.getFamePerHour(now);
        let etaMs = null;
        if (ratio >= 1) etaMs = 0;
        else if (rate > 0) etaMs = ((goal - fame) / rate) * 3600000;
        return {goal, fame, ratio, etaMs};
    }

    hasSession()
    {
        return this.session.startedAt !== null;
    }

    resetSession()
    {
        // Keep the silver baseline so the next UpdateMoney still yields a delta
        const silverTotal = this.session.silverTotal;
        this.session = emptySession();
        this.session.silverTotal = silverTotal;
        this.popups = [];
        this.recentDeaths = [];
        this.lastKill = null;
        this.saveSession();
    }

    loadSession()
    {
        try {
            const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
            if (saved && typeof saved.fame === 'number') return {...emptySession(), ...saved};
        } catch {
            // Missing or unreadable storage: start a fresh session
        }
        return emptySession();
    }

    saveSession()
    {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
        } catch (e) {
            window.logger?.warn(CATEGORIES.MOBS, 'FameSessionPersistFailed', {error: e?.message});
        }
    }
}

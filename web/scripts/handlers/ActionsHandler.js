import {CATEGORIES} from '../constants/LoggerConstants.js';

export const ACTION_LIFETIME_MS = 10000;
export const MOUNT_WINDOW_MS = 2000;

const CAST_CASTER = 0;
const CAST_TARGET = 1;
const CAST_POSITION = 2;
const CAST_START_TARGET = 7;
const EVENT_PLAYER = 0;
const EVENT_POSITION = 2;
const FORCED_PATH = 5;
const ATTACK_ATTACKER = 0;
const ATTACK_TARGET = 2;
const HEALTH_TARGET = 0;
const HEALTH_CHANGE = 2;
const HEALTH_CAUSER = 6;

const LOCAL_ID_KEY = 'localPlayerId';

function isPosition(value) {
    return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function savedLocalId() {
    try {
        return JSON.parse(sessionStorage.getItem(LOCAL_ID_KEY));
    } catch (e) {
        window.logger?.warn(CATEGORIES.PLAYERS, 'LocalIdRestoreFailed', {error: e?.message});
        return null;
    }
}

export class ActionsHandler {
    constructor(playersHandler) {
        this.playersHandler = playersHandler;
        this.markerList = [];
        this.localId = savedLocalId();
        this.healedPairs = [];
    }

    onCastSpell(params) {
        this.targetedCast(params[CAST_CASTER], params[CAST_TARGET], params[CAST_POSITION]);
    }

    onCastSpells(params) {
        const targets = params[CAST_TARGET];
        const pairs = params[CAST_POSITION];
        if (!Array.isArray(targets)) return;
        targets.forEach((targetId, i) => {
            this.targetedCast(params[CAST_CASTER], targetId, Array.isArray(pairs) ? pairs.slice(2 * i, 2 * i + 2) : null);
        });
    }

    onCastStart(params) {
        this.targetedCast(params[CAST_CASTER], params[CAST_START_TARGET], params[CAST_POSITION]);
    }

    onForcedMovement(params) {
        this.singlePlayer(params[EVENT_PLAYER], params[FORCED_PATH], 'mobility');
    }

    onTeleport(params) {
        this.singlePlayer(params[EVENT_PLAYER], params[EVENT_POSITION], 'presence');
    }

    onRespawn(params) {
        this.singlePlayer(params[EVENT_PLAYER], params[EVENT_POSITION], 'presence');
    }

    onAttack(params) {
        if (params[ATTACK_TARGET] === this.localId) this.attackTrigger(params[ATTACK_ATTACKER]);
    }

    onHealthUpdate(params) {
        this.healthEntry(params[HEALTH_TARGET], params[HEALTH_CHANGE] ?? 0, params[HEALTH_CAUSER] ?? 0);
    }

    onHealthUpdates(params) {
        const changes = params[HEALTH_CHANGE];
        const causers = params[HEALTH_CAUSER]?.data ?? params[HEALTH_CAUSER];
        if (!Array.isArray(changes)) return;
        changes.forEach((change, i) => this.healthEntry(params[HEALTH_TARGET], change, causers?.[i] ?? 0));
    }

    onMounted(id) {
        const marker = this.markerList.find(m => m.playerId === id);
        if (marker?.family === 'presence' && marker.selfCast && Date.now() - marker.at < MOUNT_WINDOW_MS) {
            marker.family = 'mount';
            marker.lastUpdateTime = Date.now();
        }
        this.playersHandler.noteAction(id);
    }

    targetedCast(casterId, targetId, position) {
        if (casterId === this.localId) return;
        if (targetId === this.localId) {
            this.attackTrigger(casterId);
            return;
        }
        if (targetId === undefined || targetId === null) return this.skip('no_target', casterId, targetId);
        const target = this.playersHandler.getPlayer(targetId);
        if (!target) return this.skip('target_not_listed', casterId, targetId);
        if (!isPosition(position)) return this.skip('invalid_position', casterId, targetId);
        if (casterId === targetId) {
            this.placeMarker(targetId, position, 'presence', true, null);
            return;
        }
        const caster = this.playersHandler.getPlayer(casterId);
        if (!caster) return this.skip('caster_not_listed', casterId, targetId);
        const combat = (this.playersHandler.isDangerous(caster) || this.playersHandler.isDangerous(target))
            && !this.healed(casterId, targetId);
        this.placeMarker(targetId, position, combat ? 'combat' : 'presence', false, casterId);
    }

    healed(a, b) {
        return this.healedPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    }

    healthEntry(targetId, change, causerId) {
        if (change < 0 && targetId === this.localId) this.attackTrigger(causerId);
        if (change > 0 && causerId !== targetId && this.isKnown(causerId) && this.isKnown(targetId)
            && !this.healed(causerId, targetId)) {
            this.healedPairs.push(causerId < targetId ? [causerId, targetId] : [targetId, causerId]);
            if (targetId === this.localId) this.playersHandler.clearAttacker(causerId);
            const marker = this.markerList.find(m => m.playerId === targetId && m.casterId === causerId);
            if (marker?.family === 'combat') marker.family = 'presence';
            window.logger?.debug(CATEGORIES.PLAYERS, 'heal_pair', {causerId, targetId});
        }
    }

    isKnown(id) {
        return id === this.localId || Boolean(this.playersHandler.getPlayer(id));
    }

    attackTrigger(casterId) {
        const caster = this.playersHandler.getPlayer(casterId);
        const reason = this.localId === null ? 'no_local_id'
            : !caster ? 'caster_not_listed'
                : this.healed(casterId, this.localId) ? 'healed'
                    : !this.playersHandler.isDangerous(caster) ? 'not_dangerous' : null;
        if (reason) {
            window.logger?.debug(CATEGORIES.PLAYERS, 'attack_ignored', {casterId, reason});
            return;
        }
        this.playersHandler.flagAttacker(casterId);
        window.logger?.debug(CATEGORIES.PLAYERS, 'attack_flag', {casterId});
    }

    skip(reason, casterId, targetId) {
        window.logger?.debug(CATEGORIES.PLAYERS, 'action_skipped', {reason, casterId, targetId});
    }

    singlePlayer(id, position, family) {
        if (id === this.localId || !isPosition(position) || !this.playersHandler.getPlayer(id)) return;
        this.placeMarker(id, position, family, false, null);
    }

    placeMarker(playerId, position, family, selfCast, casterId) {
        const at = Date.now();
        this.markerList = this.markerList.filter(m => m.playerId !== playerId);
        this.markerList.push({playerId, x: position[0], y: position[1], family, selfCast, at, casterId, lastUpdateTime: at});
        this.playersHandler.noteAction(playerId);
        window.logger?.debug(CATEGORIES.PLAYERS, 'action_marker', {playerId, family, x: position[0], y: position[1], casterId});
    }

    removePlayer(id) {
        this.markerList = this.markerList.filter(m => m.playerId !== id);
    }

    setLocalId(id) {
        this.localId = Number.isInteger(id) ? id : null;
        try {
            sessionStorage.setItem(LOCAL_ID_KEY, JSON.stringify(this.localId));
        } catch (e) {
            window.logger?.warn(CATEGORIES.PLAYERS, 'LocalIdPersistFailed', {error: e?.message});
        }
    }

    onOtherEntity(id) {
        if (id !== this.localId) return;
        this.setLocalId(null);
        window.logger?.debug(CATEGORIES.PLAYERS, 'local_id_dropped', {id});
    }

    getMarkers(now) {
        this.markerList = this.markerList.filter(m => now - m.at < ACTION_LIFETIME_MS);
        return this.markerList;
    }

    clear() {
        this.markerList = [];
        this.healedPairs = [];
    }
}

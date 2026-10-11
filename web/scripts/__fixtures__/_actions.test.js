// pcap-derived: ws/actions/*.json cut with tools/photon-dump -range from the anonymized captures 2026-09-03T21-26-14,
// 2026-05-12T21-44-17, 2026-05-12T22-53-10 and 2026-10-10T18-40-40; synthetic: ws/actions/synthetic-*.json, written from messages of flow 54920.
import {describe, test, expect} from 'vitest';
import {loadFixture, normalizeParams} from './loader.js';
import {EventCodes} from '../utils/EventCodes.js';
import {OperationCodes} from '../utils/OperationCodes.js';

const PCAP_CASES = [
    ['self-cast', 1254636, EventCodes.CastSpell, {0: 1255088, 1: 1255088}, 2, [1255088]],
    ['mount-up', 1254636, EventCodes.Mounted, {0: 1255088, 10: -1}, null, [1255088]],
    ['dismount', 1254636, EventCodes.Mounted, {0: 1254486, 10: 8.283652}, null, [1254486]],
    ['forced-movement', 1254636, EventCodes.ForcedMovement, {0: 1255446}, 5, [1255446]],
    ['leave', 1254636, EventCodes.Leave, {0: 1254726}, null, [1254726]],
    ['local-self-cast', 41475, EventCodes.CastSpell, {0: 41475, 1: 41475}, 2, []],
    ['cast-on-mob', 41475, EventCodes.CastSpell, {0: 41362, 1: 12790}, 2, [41362]],
    ['mob-cast-on-local', 41475, EventCodes.CastStart, {0: 5306, 7: 41475}, 2, []],
    ['mob-attack-on-local', 2598, EventCodes.Attack, {0: 1987, 2: 2598}, null, []],
    ['teleport', 1461083, EventCodes.Teleport, {0: 1448788}, 2, [1448788]],
    ['cast-spells', 1461083, EventCodes.CastSpells, {0: 1453850}, 2, [1453850, 1448788, 1441391]],
    ['cast-between-players', 1461083, EventCodes.CastSpell, {0: 1453850, 1: 1298481}, 2, [1453850, 1298481]],
    ['respawn', 1654777, EventCodes.Respawn, {0: 1655584}, 2, [1655584]],
    ['cast-start-target', 1654777, EventCodes.CastStart, {0: 1659694, 7: 1640953}, 2, [1659694, 1640953]],
    ['attack-between-players', 1654777, EventCodes.Attack, {0: 1656011, 2: 1655584}, null, [1656011, 1655584]],
    ['health-update', 1654777, EventCodes.HealthUpdate, {0: 1655584, 2: -143, 6: 1656011}, null, [1655584, 1656011]],
    ['heal', 1654777, EventCodes.HealthUpdate, {0: 1656044, 2: 276, 6: 1655584}, null, [1655584, 1656044, 1656011]],
    ['health-updates', 1654777, EventCodes.HealthUpdates, {0: 1655584}, null, [1655584, 1656011]],
    ['ground-cast', 1654777, EventCodes.CastSpell, {0: 1656011, 1: undefined, 6: 2}, 2, [1656011]],
    ['attack-on-local', 2944, EventCodes.CastStart, {0: 2757, 7: 2944}, null, [2757]],
];

const SYNTHETIC_CASES = [
    ['synthetic-cast-on-local', 41475, EventCodes.CastSpells, {0: 41362}, 2, [41362]],
    ['synthetic-hit-on-local', 41475, EventCodes.HealthUpdates, {0: 41475}, null, [41362]],
    ['synthetic-party-healer', 41475, EventCodes.HealthUpdate, {0: 41475, 2: 114, 6: 41362}, null, [41362]],
    ['synthetic-mob-cast-on-player', 41475, EventCodes.CastSpell, {0: 12790, 1: 41362}, 2, [41362]],
];

async function messagesOf(scenario) {
    const fx = await loadFixture('actions', scenario);
    return fx.messages.map(m => ({kind: m.kind, p: normalizeParams(m.parameters)}));
}

const isEvent = (m, code) => m.kind === 'event' && m.p[252] === code;
const isJoin = m => m.kind === 'response' && m.p[253] === OperationCodes.Join;
const holds = (m, fields) => Object.entries(fields).every(([k, v]) => m.p[k] === v);
const isPosition = v => Array.isArray(v) && v.length >= 2 && v.every(Number.isFinite);

function expectCase(messages, localId, code, fields, positionIndex, players) {
    const join = messages.findIndex(isJoin);
    const event = messages.findIndex(m => isEvent(m, code) && holds(m, fields));

    expect(join).toBeGreaterThanOrEqual(0);
    expect(messages[join].p[0]).toBe(localId);
    expect(event).toBeGreaterThan(join);
    if (positionIndex !== null) expect(isPosition(messages[event].p[positionIndex])).toBe(true);
    for (const id of players) {
        const spawn = messages.findIndex(m => isEvent(m, EventCodes.NewCharacter) && m.p[0] === id);
        expect(spawn).toBeGreaterThanOrEqual(0);
        expect(spawn).toBeLessThan(event);
    }
}

describe('action fixtures', () => {
    // @verified 2026-09-23: each cut holds the Join response of its flow, the event of its case and the spawn of every player it involves.
    test.each(PCAP_CASES)('pcap-derived %s: Join response, spawns, then the event', async (scenario, ...rest) => {
        expectCase(await messagesOf(scenario), ...rest);
    });

    // @verified 2026-09-23: each hand-written case keeps the Join response and the spawn of its player before the event.
    test.each(SYNTHETIC_CASES)('%s: Join response, spawn, then the event', async (scenario, ...rest) => {
        expectCase(await messagesOf(scenario), ...rest);
    });
});

describe('action fixture indices', () => {
    // @verified 2026-09-23: 234 of 236 CastStart events with a target in the three captures open a CastSpell with the same [0],
    // [1] equal to the CastStart [7] and [6] equal to its [8].
    test.each(['cast-between-players', 'heal', 'cast-start-target', 'cast-on-mob', 'mob-cast-on-local'])(
        'pcap-derived %s: CastStart [0] is the caster of the CastSpell it opens', async scenario => {
            const messages = await messagesOf(scenario);
            const starts = messages.filter(m => isEvent(m, EventCodes.CastStart) && m.p[7] !== undefined);
            expect(starts.length).toBeGreaterThan(0);
            for (const start of starts) {
                const cast = messages.find(m => isEvent(m, EventCodes.CastSpell) && m.p[0] === start.p[0] && m.p[6] === start.p[8]);
                expect(cast?.p[1]).toBe(start.p[7]);
            }
        });

    // @verified 2026-09-23: 149 of 171 Attack events in the three captures are followed within 100 messages by an auto-attack
    // health change (spell -1) with causer [0] on target [2]; 4 show only the reverse pair.
    test('pcap-derived attack-between-players: the hit at Attack [5] comes from Attack [0] and lands on Attack [2]', async () => {
        const messages = await messagesOf('attack-between-players');
        const attack = messages.find(m => isEvent(m, EventCodes.Attack));
        const hit = messages.find(m => isEvent(m, EventCodes.HealthUpdate) && m.p[7] === -1 && m.p[1] >= attack.p[5] && m.p[1] - attack.p[5] <= 1);
        expect(hit.p[6]).toBe(attack.p[0]);
        expect(hit.p[0]).toBe(attack.p[2]);
    });

    // @verified 2026-09-23: the mob Attack of the Mists flow targets the local id of its Join response.
    test('pcap-derived mob-attack-on-local: Attack [2] is the local id', async () => {
        const messages = await messagesOf('mob-attack-on-local');
        expect(messages.find(m => isEvent(m, EventCodes.Attack)).p[2]).toBe(messages.find(isJoin).p[0]);
    });
});

// synthetic: pure function over location-shape input, no network or DOM.
import {describe, test, expect} from 'vitest';
import {buildWsUrl} from './wsUrl.js';

describe('buildWsUrl', () => {
    test('@verified 2026-04-25: localhost http -> ws://localhost:port/ws', () => {
        expect(buildWsUrl({protocol: 'http:', host: 'localhost:5001'})).toBe('ws://localhost:5001/ws');
    });

    test('@verified 2026-04-25: LAN IP http -> ws://ip:port/ws', () => {
        expect(buildWsUrl({protocol: 'http:', host: '192.168.1.42:5001'})).toBe('ws://192.168.1.42:5001/ws');
    });

    test('@verified 2026-04-25: hostname https -> wss://host:port/ws', () => {
        expect(buildWsUrl({protocol: 'https:', host: 'radar.example:5001'})).toBe('wss://radar.example:5001/ws');
    });

    test('@verified 2026-04-25: no port http -> ws://host/ws', () => {
        expect(buildWsUrl({protocol: 'http:', host: 'localhost'})).toBe('ws://localhost/ws');
    });
});

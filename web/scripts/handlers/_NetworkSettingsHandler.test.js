// synthetic: inline mock fetch responses
import {describe, test, expect, beforeEach, vi, afterEach} from 'vitest';

const {NetworkSettingsHandler} = await import('./NetworkSettingsHandler.js');

describe('NetworkSettingsHandler', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="network-section"></div>';
        container = document.getElementById('network-section');
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    test('renders one row per interface with badge and current selection', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([
                    {name: 'a', description: 'Wi-Fi', address: '192.168.1.1', category: 'wifi', isPersisted: true, isAvailable: true},
                    {name: 'b', description: 'TAP-Windows', address: '10.8.0.1', category: 'vpn', isPersisted: false, isAvailable: true},
                ]),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [{name: 'a'}], lanAddresses: ['192.168.1.5'], status: 'running'}),
            });

        const h = new NetworkSettingsHandler(container);
        await h.load();

        const rows = container.querySelectorAll('[data-iface]');
        expect(rows.length).toBe(2);

        const wifiRow = container.querySelector('[data-iface="a"]');
        expect(wifiRow.textContent).toContain('Wi-Fi');
        expect(wifiRow.querySelector('input[type="checkbox"]').checked).toBe(true);

        const vpnRow = container.querySelector('[data-iface="b"]');
        expect(vpnRow.querySelector('input[type="checkbox"]').checked).toBe(false);
    });

    test('apply submits selected names to backend and refetches state', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([
                    {name: 'a', description: 'Wi-Fi', address: '1', category: 'wifi', isPersisted: true, isAvailable: true},
                    {name: 'b', description: 'Eth', address: '2', category: 'ethernet', isPersisted: false, isAvailable: true},
                ]),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [{name: 'a'}], lanAddresses: [], status: 'running'}),
            })
            .mockResolvedValueOnce({ok: true, json: async () => ({status: 'ok'})})
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([
                    {name: 'a', description: 'Wi-Fi', address: '1', category: 'wifi', isPersisted: true, isAvailable: true},
                    {name: 'b', description: 'Eth', address: '2', category: 'ethernet', isPersisted: true, isAvailable: true},
                ]),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [{name: 'a'}, {name: 'b'}], lanAddresses: [], status: 'running'}),
            });

        const h = new NetworkSettingsHandler(container);
        await h.load();

        container.querySelector('[data-iface="b"] input').click();
        await h.apply();

        const post = globalThis.fetch.mock.calls.find(c => c[0] === '/api/network/interfaces' && c[1]?.method === 'POST');
        expect(post).toBeDefined();
        const body = JSON.parse(post[1].body);
        expect(body.names.sort()).toEqual(['a', 'b']);
    });

    test('renders LAN addresses as clickable URLs', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => []})
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [], lanAddresses: ['192.168.1.5', '10.0.0.3'], status: 'awaiting_interfaces'}),
            });

        const h = new NetworkSettingsHandler(container);
        await h.load();

        const links = container.querySelectorAll('[data-lan-url]');
        expect(links.length).toBe(2);
        expect(links[0].href).toContain('192.168.1.5');
        expect(links[1].href).toContain('10.0.0.3');
    });

    test('shows awaiting banner when capture is not running', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => []})
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [], lanAddresses: [], status: 'awaiting_interfaces'}),
            });

        const h = new NetworkSettingsHandler(container);
        await h.load();

        expect(container.textContent).toContain('Capture not running');
    });

    test('shows success banner when capturing on N interfaces', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => []})
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({captureInterfaces: [{name: 'a'}, {name: 'b'}], lanAddresses: [], status: 'running'}),
            });

        const h = new NetworkSettingsHandler(container);
        await h.load();

        expect(container.textContent).toMatch(/Capturing on 2 interface/i);
    });
});

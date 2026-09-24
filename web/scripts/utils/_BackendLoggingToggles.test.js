// synthetic: fetch stubbed, no real backend.
import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest';

const {BackendLoggingToggles} = await import('./BackendLoggingToggles.js');

function buildContainer(isHost = 'true') {
    document.body.innerHTML = `
        <div data-is-host="${isHost}">
            <label>
                <input type="checkbox" id="settingDebugBackendLogs" data-setting="settingDebugBackendLogs">
            </label>
            <label>
                <input type="checkbox" id="settingDebugPcapRecording" data-setting="settingDebugPcapRecording">
            </label>
        </div>`;
    return document.querySelector('[data-is-host]');
}

describe('BackendLoggingToggles', () => {
    let container;

    beforeEach(() => {
        container = buildContainer();
        globalThis.fetch = vi.fn();
        window.toast = {error: vi.fn(), success: vi.fn()};
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        delete window.toast;
        localStorage.clear();
    });

    test('load GETs once and sets both toggles from the response', async () => {
        globalThis.fetch.mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: true, pcapRecording: false})});

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        expect(container.querySelector('#settingDebugBackendLogs').checked).toBe(true);
        expect(container.querySelector('#settingDebugPcapRecording').checked).toBe(false);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith('/api/settings/logging');
    });

    test('a toggle change POSTs the field and applies the response', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: false, pcapRecording: false})})
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: true, pcapRecording: false})});

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        const backend = container.querySelector('#settingDebugBackendLogs');
        backend.checked = true;
        backend.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));

        const post = globalThis.fetch.mock.calls[1];
        expect(post[0]).toBe('/api/settings/logging');
        expect(post[1].method).toBe('POST');
        expect(JSON.parse(post[1].body)).toEqual({serverLogsEnabled: true});
        expect(backend.checked).toBe(true);
    });

    test('a non-2xx POST shows the error body and restores the checked state from a fresh GET', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: false, pcapRecording: false})})
            .mockResolvedValueOnce({ok: false, status: 500, text: async () => 'pcap failed: device busy'})
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: false, pcapRecording: false})});

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        const backend = container.querySelector('#settingDebugBackendLogs');
        backend.checked = true;
        backend.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));

        expect(window.toast.error).toHaveBeenCalledWith('pcap failed: device busy');
        expect(backend.checked).toBe(false);
    });

    test('a GET failure disables both toggles with the unreachable reason', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('connection refused'));

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        expect(container.querySelector('#settingDebugBackendLogs').disabled).toBe(true);
        expect(container.querySelector('#settingDebugPcapRecording').disabled).toBe(true);
        expect(container.textContent).toContain('Radar backend unreachable');
    });

    test('a non-host container stays disabled after a successful GET', async () => {
        container = buildContainer('false');
        globalThis.fetch.mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: true, pcapRecording: true})});

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        expect(container.querySelector('#settingDebugBackendLogs').disabled).toBe(true);
        expect(container.querySelector('#settingDebugPcapRecording').disabled).toBe(true);
    });

    test('never writes to localStorage through settingsSync', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: false, pcapRecording: false})})
            .mockResolvedValueOnce({ok: true, json: async () => ({serverLogsEnabled: true, pcapRecording: false})});

        const toggles = new BackendLoggingToggles(container);
        await toggles.load();

        const backend = container.querySelector('#settingDebugBackendLogs');
        backend.checked = true;
        backend.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));

        expect(localStorage.length).toBe(0);
    });

    test('destroy stops binding after an awaited GET', async () => {
        let resolveGet;
        globalThis.fetch.mockReturnValueOnce(new Promise(resolve => { resolveGet = resolve; }));

        const toggles = new BackendLoggingToggles(container);
        const pending = toggles.load();
        toggles.destroy();
        resolveGet({ok: true, json: async () => ({serverLogsEnabled: true, pcapRecording: true})});
        await pending;

        const backend = container.querySelector('#settingDebugBackendLogs');
        expect(backend.checked).toBe(false);
        expect(backend.disabled).toBe(false);
    });
});

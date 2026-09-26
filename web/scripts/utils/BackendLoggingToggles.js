const ENDPOINT = '/api/settings/logging';
const UNREACHABLE = 'Radar backend unreachable';

export class BackendLoggingToggles {
    constructor(container) {
        this.container = container;
        this.destroyed = false;
        this.backend = container.querySelector('[data-setting="settingDebugBackendLogs"]');
        this.pcap = container.querySelector('[data-setting="settingDebugPcapRecording"]');
        this.onChange = this.onChange.bind(this);
        this.backend?.addEventListener('change', this.onChange);
        this.pcap?.addEventListener('change', this.onChange);
    }

    destroy() {
        this.destroyed = true;
        this.backend?.removeEventListener('change', this.onChange);
        this.pcap?.removeEventListener('change', this.onChange);
    }

    isHost() {
        return this.container.dataset.isHost === 'true';
    }

    setReason(text) {
        for (const input of [this.backend, this.pcap]) {
            const label = input?.closest('label');
            if (!label) continue;
            let reason = label.querySelector('[data-backend-reason]');
            if (!text) {
                reason?.remove();
                continue;
            }
            if (!reason) {
                reason = document.createElement('span');
                reason.dataset.backendReason = '';
                reason.className = 'text-xs text-base-content/50';
                label.append(reason);
            }
            reason.textContent = text;
        }
    }

    applyState({serverLogsEnabled, pcapRecording}) {
        const host = this.isHost();
        if (this.backend) {
            this.backend.checked = serverLogsEnabled;
            this.backend.disabled = !host;
        }
        if (this.pcap) {
            this.pcap.checked = pcapRecording;
            this.pcap.disabled = !host;
        }
        this.setReason(null);
    }

    disableAll() {
        if (this.backend) this.backend.disabled = true;
        if (this.pcap) this.pcap.disabled = true;
        this.setReason(UNREACHABLE);
    }

    async load() {
        let data;
        try {
            const resp = await fetch(ENDPOINT);
            if (this.destroyed) return;
            if (!resp.ok) throw new Error(`status ${resp.status}`);
            data = await resp.json();
            if (this.destroyed) return;
        } catch {
            if (this.destroyed) return;
            this.disableAll();
            return;
        }
        this.applyState(data);
    }

    async onChange(event) {
        if (this.destroyed) return;
        const input = event.target;
        const field = input === this.backend ? 'serverLogsEnabled' : 'pcapRecording';
        try {
            const resp = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({[field]: input.checked}),
            });
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json();
            if (this.destroyed) return;
            this.applyState(data);
        } catch (err) {
            if (this.destroyed) return;
            window.toast?.error?.(err?.message ?? String(err));
            await this.load();
        }
    }
}

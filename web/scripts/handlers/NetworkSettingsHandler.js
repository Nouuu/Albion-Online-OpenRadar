const BADGES = {
    wifi: '🛜', ethernet: '🔌', exitlag: '🚀', vpn: '🔒', virtual: '🧪', other: '•',
};
const BADGE_LABEL = {
    wifi: 'WiFi', ethernet: 'Ethernet', exitlag: 'ExitLag', vpn: 'VPN', virtual: 'Virtual', other: 'Other',
};

export class NetworkSettingsHandler {
    constructor(container) {
        this.container = container;
        this.interfaces = [];
        this.state = null;
    }

    async load() {
        const [ifacesRes, stateRes] = await Promise.all([
            fetch('/api/network/interfaces'),
            fetch('/api/network/state'),
        ]);
        if (!ifacesRes.ok || !stateRes.ok) {
            this.container.innerHTML = `<div class="alert alert-error">Failed to load network configuration.</div>`;
            return;
        }
        this.interfaces = await ifacesRes.json();
        this.state = await stateRes.json();
        this.render();
    }

    render() {
        const activeNames = new Set((this.state?.captureInterfaces ?? []).map(c => c.name));
        const banner = this.renderBanner();
        const rows = this.interfaces.map(i => this.renderRow(i, activeNames.has(i.name))).join('');
        const lan = (this.state?.lanAddresses ?? []).map(a =>
            `<li><a data-lan-url href="http://${a}:5001/" target="_blank" class="link link-primary">http://${a}:5001/</a></li>`
        ).join('');
        this.container.innerHTML = `
            ${banner}
            <h3 class="text-base font-semibold mt-2">Capture interfaces</h3>
            <p class="text-sm opacity-70 mb-2">Captured packets are merged across all checked interfaces. Tick at least one to start capture.</p>
            <div class="flex flex-col gap-1">${rows}</div>
            <div class="flex gap-2 mt-3">
                <button class="btn btn-sm" data-action="refresh">Refresh list</button>
                <button class="btn btn-sm btn-primary" data-action="apply" disabled>Apply changes</button>
            </div>
            <h3 class="text-base font-semibold mt-6">LAN access</h3>
            <p class="text-sm opacity-70">Reachable from devices on the same local network. Independent of the capture interfaces above.</p>
            <ul class="list-disc pl-5">${lan || '<li class="opacity-60">No LAN address detected.</li>'}</ul>
        `;
        this.bindEvents();
    }

    renderBanner() {
        if (this.state?.status === 'awaiting_interfaces') {
            return `<div class="alert alert-warning mb-2">⚠ Capture not running. Pick at least one interface below to start.</div>`;
        }
        const n = (this.state?.captureInterfaces ?? []).length;
        return `<div class="alert alert-success mb-2">✓ Capturing on ${n} interface${n > 1 ? 's' : ''}.</div>`;
    }

    renderRow(iface, checked) {
        const badge = BADGES[iface.category] ?? BADGES.other;
        const label = BADGE_LABEL[iface.category] ?? BADGE_LABEL.other;
        const unavail = iface.isAvailable ? '' : ' <span class="opacity-60">(unavailable)</span>';
        return `
            <label class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-base-300/40" data-iface="${iface.name}">
                <input type="checkbox" class="checkbox checkbox-sm" ${checked ? 'checked' : ''} ${iface.isAvailable ? '' : 'disabled'}>
                <span class="badge badge-outline">${badge} ${label}</span>
                <span class="flex-1">${escapeHTML(iface.description || iface.name)}${unavail}</span>
                <span class="opacity-60 text-sm">${iface.address || ''}</span>
            </label>
        `;
    }

    bindEvents() {
        for (const cb of this.container.querySelectorAll('[data-iface] input')) {
            cb.addEventListener('change', () => this.updateApplyState());
        }
        const applyBtn = this.container.querySelector('[data-action="apply"]');
        applyBtn?.addEventListener('click', () => this.apply());
        const refreshBtn = this.container.querySelector('[data-action="refresh"]');
        refreshBtn?.addEventListener('click', () => this.refresh());
    }

    updateApplyState() {
        const selected = this.selectedNames();
        const current = (this.state?.captureInterfaces ?? []).map(c => c.name).sort();
        const same = JSON.stringify([...selected].sort()) === JSON.stringify(current);
        const btn = this.container.querySelector('[data-action="apply"]');
        if (btn) btn.disabled = same;
    }

    selectedNames() {
        return [...this.container.querySelectorAll('[data-iface] input:checked')]
            .map(cb => cb.closest('[data-iface]').dataset.iface);
    }

    async apply() {
        const names = this.selectedNames();
        const res = await fetch('/api/network/interfaces', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({names}),
        });
        if (!res.ok) {
            const txt = await res.text();
            window.toast?.error?.(`Apply failed: ${txt}`);
            return;
        }
        window.toast?.success?.('Capture interfaces updated.');
        await this.load();
    }

    async refresh() {
        const r = await fetch('/api/network/refresh', {method: 'POST'});
        if (r.ok) {
            this.interfaces = await r.json();
            this.render();
        }
    }
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

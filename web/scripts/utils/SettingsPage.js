import settingsSync from './SettingsSync.js';
import {buildDebugExport, resetAllSettings} from './SettingControls.js';
import {BackendLoggingToggles} from './BackendLoggingToggles.js';
import {NetworkSettingsHandler} from '../handlers/NetworkSettingsHandler.js';

async function downloadDebugExport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugData = await buildDebugExport(settingsSync, fetch);

    const blob = new Blob([JSON.stringify(debugData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openradar-debug-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function initSettingsPage({root, signal}) {
    const byId = id => root.querySelector(`#${id}`);
    const modal = byId('modal-resetSettings');

    byId('downloadLogsBtn')?.addEventListener('click', downloadDebugExport, {signal});
    byId('resetSettingsBtn')?.addEventListener('click', () => modal.showModal(), {signal});
    byId('confirmResetSettings')?.addEventListener('click', () => {
        resetAllSettings(settingsSync);
        modal.close();
        window.toast?.success('Settings reset successfully');
        setTimeout(() => location.reload(), 500);
    }, {signal});

    const hostContainer = root.querySelector('[data-is-host]');
    if (hostContainer) {
        const backendToggles = new BackendLoggingToggles(hostContainer);
        signal.addEventListener('abort', () => backendToggles.destroy(), {once: true});
        await backendToggles.load();
        if (signal.aborted) return;
    }

    const networkContainer = byId('network-section');
    if (!networkContainer) return;
    const networkHandler = new NetworkSettingsHandler(networkContainer);
    networkHandler.load();
    const networkPoll = setInterval(() => {
        if (!document.hidden) networkHandler.load(true);
    }, 5000);
    signal.addEventListener('abort', () => clearInterval(networkPoll), {once: true});
}

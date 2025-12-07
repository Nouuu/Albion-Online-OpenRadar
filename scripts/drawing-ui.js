import settings from "./Utils/Settings.js";
import settingsSync from "./Utils/SettingsSync.js";

export function openOverlayWindow() {
    const features = [
        'width=520',
        'height=520',
        'resizable=no',
        'toolbar=no',
        'menubar=no',
        'location=no',
        'status=no',
        'scrollbars=no',
        'titlebar=no',
        'directories=no',
        'personalbar=no',
        'chrome=no'
    ].join(',');

    window.open('/radar-overlay', 'RadarOverlay', features);
}

// ========== Overlay Controls ==========
export function initOverlayControls() {
    // Get checkbox elements
    const enchantmentCheckbox = document.getElementById('overlayEnchantment');
    const resourceCountCheckbox = document.getElementById('overlayResourceCount');
    const distanceCheckbox = document.getElementById('overlayDistance');
    const clusterCheckbox = document.getElementById('overlayCluster');
    const clusterRadiusInput = document.getElementById('overlayClusterRadius');
    const clusterMinSizeInput = document.getElementById('overlayClusterMinSize');

    // Check if overlay elements exist (only on drawing page)
    if (!enchantmentCheckbox) return;

    // Load initial values
    enchantmentCheckbox.checked = settingsSync.get('settingResourceEnchantOverlay', false);
    resourceCountCheckbox.checked = settingsSync.get('settingResourceCount', false);
    distanceCheckbox.checked = settingsSync.get('settingResourceDistance', false);
    clusterCheckbox.checked = settingsSync.get('settingResourceClusters', false);
    clusterRadiusInput.value = settingsSync.get('settingClusterRadius', 30);
    clusterMinSizeInput.value = settingsSync.get('settingClusterMinSize', 2);

    // Update settings object in real-time when checkboxes change
    // Add event listeners - save to localStorage and update settings
    enchantmentCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceEnchantOverlay', e.target.checked);
        settings.update();
    });

    resourceCountCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceCount', e.target.checked);
        settings.update();
    });

    distanceCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceDistance', e.target.checked);
        settings.update();
    });

    clusterCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceClusters', e.target.checked);
        settings.update();
    });

    clusterRadiusInput.addEventListener('input', (e) => {
        settingsSync.set('settingClusterRadius', parseInt(e.target.value));
        settings.update();
    });

    clusterMinSizeInput.addEventListener('input', (e) => {
        settingsSync.set('settingClusterMinSize', parseInt(e.target.value));
        settings.update();
    });
}

// ========== Initialize on page load ==========
document.addEventListener('DOMContentLoaded', function () {
    // Initialize overlay controls
    initOverlayControls();

    // Setup overlay window button
    const openOverlayBtn = document.getElementById('openOverlay');
    if (openOverlayBtn) {
        openOverlayBtn.addEventListener('click', openOverlayWindow);
    }
});
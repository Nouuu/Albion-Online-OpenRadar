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
    const resourceCountCheckbox = document.getElementById('overlayResourceCount');
    const distanceCheckbox = document.getElementById('overlayDistance');
    const clusterCheckbox = document.getElementById('settingResourceClusters');

    // Check if overlay elements exist (only on drawing page)
    if (!resourceCountCheckbox) return;

    // Load initial values
    resourceCountCheckbox.checked = settingsSync.get('settingResourceCount', false);
    distanceCheckbox.checked = settingsSync.get('settingResourceDistance', false);
    clusterCheckbox.checked = settingsSync.get('settingResourceClusters', false);

    // Update settings object in real-time when checkboxes change
    // Add event listeners - save to localStorage and update settings
    resourceCountCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceCount', e.target.checked);
    });

    distanceCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceDistance', e.target.checked);
    });

    clusterCheckbox.addEventListener('change', (e) => {
        settingsSync.setBool('settingResourceClusters', e.target.checked);
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
import {settings} from "./Utils/Utils.js";

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
    // Helper functions
    const getBool = (key, defaultVal = true) => {
        const val = localStorage.getItem(key);
        return val === null ? defaultVal : val === 'true';
    };
    const setBool = (key, val) => localStorage.setItem(key, val);
    const getNumber = (key, defaultVal) => parseInt(localStorage.getItem(key)) || defaultVal;

    // Get checkbox elements
    const enchantmentCheckbox = document.getElementById('overlayEnchantment');
    const resourceCountCheckbox = document.getElementById('overlayResourceCount');
    const distanceCheckbox = document.getElementById('overlayDistance');
    const clusterCheckbox = document.getElementById('overlayCluster');
    const clusterRadiusInput = document.getElementById('overlayClusterRadius');
    const clusterMinSizeInput = document.getElementById('overlayClusterMinSize');

    // Check if overlay elements exist (only on drawing page)
    if (!enchantmentCheckbox) return;

    // Load initial values (defaults: enchantment=true, count=true, distance=false, cluster=false)
    enchantmentCheckbox.checked = getBool('settingResourceEnchantOverlay', true);
    resourceCountCheckbox.checked = getBool('settingResourceCount', true);
    distanceCheckbox.checked = getBool('settingResourceDistance', false);
    clusterCheckbox.checked = getBool('settingResourceClusters', false);
    clusterRadiusInput.value = getNumber('settingClusterRadius', 30);
    clusterMinSizeInput.value = getNumber('settingClusterMinSize', 2);

    // Update settings object in real-time when checkboxes change
    const updateSettings = () => {
        if (typeof settings !== 'undefined') {
            settings.overlayEnchantment = enchantmentCheckbox.checked;
            settings.overlayResourceCount = resourceCountCheckbox.checked;
            settings.overlayDistance = distanceCheckbox.checked;
            settings.overlayCluster = clusterCheckbox.checked;
            settings.overlayClusterRadius = parseInt(clusterRadiusInput.value);
            settings.overlayClusterMinSize = parseInt(clusterMinSizeInput.value);
            settings.update(); // Reload settings from localStorage
        }
    };

    // Add event listeners - save to localStorage and update settings
    enchantmentCheckbox.addEventListener('change', (e) => {
        setBool('settingResourceEnchantOverlay', e.target.checked);
        updateSettings();
    });

    resourceCountCheckbox.addEventListener('change', (e) => {
        setBool('settingResourceCount', e.target.checked);
        updateSettings();
    });

    distanceCheckbox.addEventListener('change', (e) => {
        setBool('settingResourceDistance', e.target.checked);
        updateSettings();
    });

    clusterCheckbox.addEventListener('change', (e) => {
        setBool('settingResourceClusters', e.target.checked);
        updateSettings();
    });

    clusterRadiusInput.addEventListener('input', (e) => {
        localStorage.setItem('settingClusterRadius', e.target.value);
        updateSettings();
    });

    clusterMinSizeInput.addEventListener('input', (e) => {
        localStorage.setItem('settingClusterMinSize', e.target.value);
        updateSettings();
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
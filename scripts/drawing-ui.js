// ========== Statistics Update ==========
function initStats() {
    // Check if stats elements exist before trying to update them
    const statDuration = document.getElementById('statDuration');
    if (!statDuration) return; // Stats elements don't exist on this page

    setInterval(function () {
        if (typeof harvestablesHandler !== 'undefined') {
            const stats = harvestablesHandler.getStats();

            // Format duration
            const h = Math.floor(stats.sessionDuration / 3600);
            const m = Math.floor((stats.sessionDuration % 3600) / 60);
            const s = stats.sessionDuration % 60;
            const statDurationEl = document.getElementById('statDuration');
            if (statDurationEl) statDurationEl.textContent = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

            // Main counters
            const statDetectedEl = document.getElementById('statDetected');
            const statHarvestedEl = document.getElementById('statHarvested');
            if (statDetectedEl) statDetectedEl.textContent = stats.totalDetected;
            if (statHarvestedEl) statHarvestedEl.textContent = stats.totalHarvested;

            // By type (detected only for compact view)
            const statFiberEl = document.getElementById('statFiber');
            const statHideEl = document.getElementById('statHide');
            const statWoodEl = document.getElementById('statWood');
            const statOreEl = document.getElementById('statOre');
            const statRockEl = document.getElementById('statRock');
            if (statFiberEl) statFiberEl.textContent = stats.byType.Fiber.detected;
            if (statHideEl) statHideEl.textContent = stats.byType.Hide.detected;
            if (statWoodEl) statWoodEl.textContent = stats.byType.Log.detected;
            if (statOreEl) statOreEl.textContent = stats.byType.Ore.detected;
            if (statRockEl) statRockEl.textContent = stats.byType.Rock.detected;

            // By tier (T4-T8 only for compact view)
            const statT4El = document.getElementById('statT4');
            const statT5El = document.getElementById('statT5');
            const statT6El = document.getElementById('statT6');
            const statT7El = document.getElementById('statT7');
            const statT8El = document.getElementById('statT8');
            if (statT4El) statT4El.textContent = stats.byTier[4].detected;
            if (statT5El) statT5El.textContent = stats.byTier[5].detected;
            if (statT6El) statT6El.textContent = stats.byTier[6].detected;
            if (statT7El) statT7El.textContent = stats.byTier[7].detected;
            if (statT8El) statT8El.textContent = stats.byTier[8].detected;

            // Enchantments (harvested resources)
            const statEnchant0El = document.getElementById('statEnchant0');
            const statEnchant1El = document.getElementById('statEnchant1');
            const statEnchant2El = document.getElementById('statEnchant2');
            const statEnchant3El = document.getElementById('statEnchant3');
            const statEnchant4El = document.getElementById('statEnchant4');
            if (statEnchant0El) statEnchant0El.textContent = stats.byEnchantment.harvested[0] || 0;
            if (statEnchant1El) statEnchant1El.textContent = stats.byEnchantment.harvested[1] || 0;
            if (statEnchant2El) statEnchant2El.textContent = stats.byEnchantment.harvested[2] || 0;
            if (statEnchant3El) statEnchant3El.textContent = stats.byEnchantment.harvested[3] || 0;
            if (statEnchant4El) statEnchant4El.textContent = stats.byEnchantment.harvested[4] || 0;
        }
    }, 1000);
}

// ========== Overlay Window ==========
function openOverlayWindow() {
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
function initOverlayControls() {
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
    // Initialize stats update interval
    initStats();

    // Initialize overlay controls
    initOverlayControls();

    // Setup overlay window button
    const openOverlayBtn = document.getElementById('openOverlay');
    if (openOverlayBtn) {
        openOverlayBtn.addEventListener('click', openOverlayWindow);
    }
});
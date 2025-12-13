/**
 * Accordion Manager
 * Handles <details> elements with smooth animations and state persistence
 */

class AccordionManager {
    constructor(pageKey) {
        this.pageKey = `accordion_${pageKey}`;
        this.states = {};
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        if (!window.settingsSync) {
            console.warn('[Accordion] settingsSync not available yet');
            return;
        }

        this.states = window.settingsSync.getJSON(this.pageKey, {});

        document.querySelectorAll('details[data-accordion]').forEach(details => {
            const id = details.dataset.accordion;
            const content = details.querySelector('.accordion-content');
            const summary = details.querySelector('summary');

            // Restore saved state
            if (this.states[id] !== undefined) {
                details.open = this.states[id];
            }

            // Handle click with animation
            summary.addEventListener('click', (e) => {
                e.preventDefault();

                if (details.open) {
                    // Closing: animate then remove open
                    content.style.gridTemplateRows = '0fr';
                    content.addEventListener('transitionend', () => {
                        details.open = false;
                        this.states[id] = false;
                        window.settingsSync.setJSON(this.pageKey, this.states);
                    }, { once: true });
                } else {
                    // Opening: add open then animate
                    details.open = true;
                    // Force reflow
                    content.offsetHeight;
                    content.style.gridTemplateRows = '1fr';
                    this.states[id] = true;
                    window.settingsSync.setJSON(this.pageKey, this.states);
                }
            });

            // Set initial grid state based on open attribute
            if (details.open) {
                content.style.gridTemplateRows = '1fr';
            }
        });

        this.initialized = true;
    }

    setDefaults(defaults) {
        if (!window.settingsSync) return;

        const saved = window.settingsSync.getJSON(this.pageKey, null);
        if (saved === null) {
            this.states = { ...defaults };
            window.settingsSync.setJSON(this.pageKey, this.states);
        }
    }
}

window.createAccordionManager = function(pageKey, defaults = {}) {
    const manager = new AccordionManager(pageKey);

    if (window.settingsSync) {
        manager.setDefaults(defaults);
        manager.init();
    } else {
        window.onGlobalsReady(() => {
            manager.setDefaults(defaults);
            manager.init();
        });
    }

    return manager;
};

// Re-init icons after HTMX swaps
document.addEventListener('htmx:afterSettle', () => {
    if (window.lucide) lucide.createIcons();
});
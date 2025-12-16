class AccordionManager {
    constructor(pageKey) {
        this.pageKey = `accordion_${pageKey}`;
        this.states = {};
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        if (!window.settingsSync) return;

        this.states = window.settingsSync.getJSON(this.pageKey, {});

        document.querySelectorAll('details[data-accordion]').forEach(details => {
            const id = details.dataset.accordion;
            const content = details.querySelector('.accordion-content');
            const summary = details.querySelector('summary');

            if (this.states[id] !== undefined) {
                details.open = this.states[id];
            }

            summary.addEventListener('click', (e) => {
                e.preventDefault();

                if (details.open) {
                    content.style.gridTemplateRows = '0fr';
                    content.addEventListener('transitionend', () => {
                        details.open = false;
                        this.states[id] = false;
                        window.settingsSync.setJSON(this.pageKey, this.states);
                    }, { once: true });
                } else {
                    details.open = true;
                    content.offsetHeight; // Force reflow
                    content.style.gridTemplateRows = '1fr';
                    this.states[id] = true;
                    window.settingsSync.setJSON(this.pageKey, this.states);
                }
            });

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

// Icon creation handled in base.gohtml with proper scoping

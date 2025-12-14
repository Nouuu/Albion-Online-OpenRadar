class ModalManager {
    constructor() {
        this.modals = new Map();
        this.activeModal = null;
        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close(this.activeModal);
            }
        });
    }

    open(id, options = {}) {
        const modal = document.querySelector(`[data-modal="${id}"]`);
        if (!modal) {
            console.warn(`Modal "${id}" not found`);
            return;
        }

        this.modals.set(id, options);
        this.activeModal = id;
        modal.classList.remove('hidden');

        requestAnimationFrame(() => {
            const backdrop = modal.querySelector('[data-modal-backdrop]');
            const panel = modal.querySelector('[data-modal-panel]');

            if (backdrop) {
                backdrop.classList.remove('opacity-0');
                backdrop.classList.add('opacity-100');
            }
            if (panel) {
                panel.classList.remove('scale-95', 'opacity-0');
                panel.classList.add('scale-100', 'opacity-100');
            }
        });

        if (window.lucide) window.lucide.createIcons({ nodes: [modal] });
        document.body.style.overflow = 'hidden';
    }

    close(id) {
        const modal = document.querySelector(`[data-modal="${id}"]`);
        if (!modal) return;

        const options = this.modals.get(id) || {};
        const backdrop = modal.querySelector('[data-modal-backdrop]');
        const panel = modal.querySelector('[data-modal-panel]');

        if (backdrop) {
            backdrop.classList.remove('opacity-100');
            backdrop.classList.add('opacity-0');
        }
        if (panel) {
            panel.classList.remove('scale-100', 'opacity-100');
            panel.classList.add('scale-95', 'opacity-0');
        }

        setTimeout(() => {
            modal.classList.add('hidden');
            this.modals.delete(id);

            if (this.activeModal === id) {
                this.activeModal = null;
                document.body.style.overflow = '';
            }

            if (options.onCancel) options.onCancel();
        }, 200);
    }

    confirm(id) {
        const options = this.modals.get(id) || {};
        if (options.onConfirm) options.onConfirm(options.data);

        const modal = document.querySelector(`[data-modal="${id}"]`);
        if (!modal) return;

        const backdrop = modal.querySelector('[data-modal-backdrop]');
        const panel = modal.querySelector('[data-modal-panel]');

        if (backdrop) {
            backdrop.classList.remove('opacity-100');
            backdrop.classList.add('opacity-0');
        }
        if (panel) {
            panel.classList.remove('scale-100', 'opacity-100');
            panel.classList.add('scale-95', 'opacity-0');
        }

        setTimeout(() => {
            modal.classList.add('hidden');
            this.modals.delete(id);

            if (this.activeModal === id) {
                this.activeModal = null;
                document.body.style.overflow = '';
            }
        }, 200);
    }

    isOpen(id) { return this.activeModal === id; }
}

const modalManager = new ModalManager();
window.modal = modalManager;
export default modalManager;

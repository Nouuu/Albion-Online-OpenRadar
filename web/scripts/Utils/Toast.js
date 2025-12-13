class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.defaultDuration = 3000;
        this.init();
    }

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const toast = document.createElement('div');
        const id = Date.now();
        toast.id = `toast-${id}`;

        const baseClasses = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm transform transition-all duration-200 translate-x-full opacity-0';

        const typeStyles = {
            success: 'bg-success/10 border-success/20 text-success',
            error: 'bg-danger/10 border-danger/20 text-danger',
            warning: 'bg-warning/10 border-warning/20 text-warning',
            info: 'bg-accent/10 border-accent/20 text-accent'
        };

        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info'
        };

        toast.className = `${baseClasses} ${typeStyles[type] || typeStyles.info}`;
        toast.innerHTML = `
            <i data-lucide="${icons[type] || icons.info}" class="w-5 h-5 flex-shrink-0"></i>
            <span class="text-sm font-medium">${this.escapeHtml(message)}</span>
            <button onclick="window.toast.dismiss(${id})" class="ml-2 p-1 rounded hover:bg-white/10 transition-colors">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;

        this.container.appendChild(toast);
        this.toasts.push({ id, element: toast });

        if (window.lucide) window.lucide.createIcons({ nodes: [toast] });

        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        });

        if (duration > 0) setTimeout(() => this.dismiss(id), duration);
        return id;
    }

    dismiss(id) {
        const index = this.toasts.findIndex(t => t.id === id);
        if (index === -1) return;

        const { element } = this.toasts[index];
        element.classList.remove('translate-x-0', 'opacity-100');
        element.classList.add('translate-x-full', 'opacity-0');

        setTimeout(() => {
            element.remove();
            this.toasts.splice(index, 1);
        }, 200);
    }

    dismissAll() {
        [...this.toasts].forEach(t => this.dismiss(t.id));
    }

    success(message, duration) { return this.show(message, 'success', duration); }
    error(message, duration) { return this.show(message, 'error', duration); }
    warning(message, duration) { return this.show(message, 'warning', duration); }
    info(message, duration) { return this.show(message, 'info', duration); }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const toastManager = new ToastManager();
window.toast = toastManager;
export default toastManager;

/**
 * VirtualScroll.js
 * Lightweight virtual scrolling for large lists (100+ items)
 * Only renders visible items to improve performance
 */

export class VirtualScroll {
    constructor(container, options = {}) {
        this.container = container;
        this.itemHeight = options.itemHeight || 180;
        this.overscan = options.overscan || 3;
        this.items = [];
        this.renderItem = options.renderItem || (() => '');

        this.scrollTop = 0;
        this.containerHeight = 0;

        this.init();
    }

    init() {
        // Set container styles for scrolling
        this.container.style.overflowY = 'auto';
        this.container.style.position = 'relative';

        // Create inner container for scroll height
        this.inner = document.createElement('div');
        this.inner.style.position = 'relative';
        this.inner.style.width = '100%';
        this.container.appendChild(this.inner);

        // Create viewport for visible items
        this.viewport = document.createElement('div');
        this.viewport.style.position = 'absolute';
        this.viewport.style.width = '100%';
        this.viewport.style.top = '0';
        this.viewport.style.left = '0';
        this.inner.appendChild(this.viewport);

        // Handle scroll events
        this.handleScroll = this.handleScroll.bind(this);
        this.container.addEventListener('scroll', this.handleScroll, { passive: true });

        // Handle resize
        this.resizeObserver = new ResizeObserver(() => {
            this.containerHeight = this.container.clientHeight;
            this.render();
        });
        this.resizeObserver.observe(this.container);

        // Initial size
        this.containerHeight = this.container.clientHeight;
    }

    handleScroll() {
        const newScrollTop = this.container.scrollTop;
        if (Math.abs(newScrollTop - this.scrollTop) >= this.itemHeight / 2) {
            this.scrollTop = newScrollTop;
            this.render();
        }
    }

    setItems(items) {
        this.items = items;
        this.inner.style.height = `${items.length * this.itemHeight}px`;
        this.render();
    }

    render() {
        if (this.items.length === 0) {
            this.viewport.innerHTML = '';
            return;
        }

        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan);
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + (this.overscan * 2);
        const endIndex = Math.min(this.items.length, startIndex + visibleCount);

        this.viewport.style.transform = `translateY(${startIndex * this.itemHeight}px)`;

        const visibleItems = this.items.slice(startIndex, endIndex);
        this.viewport.innerHTML = visibleItems.map((item, i) =>
            this.renderItem(item, startIndex + i)
        ).join('');
    }

    scrollToIndex(index) {
        const targetScroll = index * this.itemHeight;
        this.container.scrollTop = targetScroll;
    }

    destroy() {
        this.container.removeEventListener('scroll', this.handleScroll);
        this.resizeObserver.disconnect();
        this.container.innerHTML = '';
    }
}

/**
 * Create a virtual scroll instance for a container
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Configuration options
 * @returns {VirtualScroll} Virtual scroll instance
 */
export function createVirtualScroll(container, options) {
    return new VirtualScroll(container, options);
}
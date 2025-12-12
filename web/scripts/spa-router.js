/**
 * SPA Router - Simple HTMX enhancement
 */

// Reinitialize Lucide icons after content swap
document.addEventListener('htmx:afterSwap', () => {
    if (window.lucide) {
        lucide.createIcons();
    }
});

// Handle browser back/forward - just reload the page
window.addEventListener('popstate', () => {
    window.location.reload();
});

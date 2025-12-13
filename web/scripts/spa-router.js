document.addEventListener('htmx:afterSwap', () => {
    if (window.lucide) lucide.createIcons();
});

window.addEventListener('popstate', () => window.location.reload());

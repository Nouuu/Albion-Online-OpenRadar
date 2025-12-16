// Icon creation now handled in base.gohtml with proper scoping
// This file only handles browser back/forward navigation
window.addEventListener('popstate', () => window.location.reload());

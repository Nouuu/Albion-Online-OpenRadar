/**
 * Alpine.js SPA Router for OpenRadar
 * Handles client-side routing and dynamic page loading
 */
function data() {
    function getSidebarCollapsedFromLocalStorage() {
        if (window.localStorage.getItem('sidebarCollapsed')) {
            return JSON.parse(window.localStorage.getItem('sidebarCollapsed'))
        }
        return false
    }

    function setSidebarCollapsedToLocalStorage(value) {
        window.localStorage.setItem('sidebarCollapsed', value)
    }

    // Map routes to page files
    const routeToPage = {
        '/': 'drawing',
        '/home': 'drawing',
        '/players': 'players',
        '/resources': 'resources',
        '/enemies': 'enemies',
        '/chests': 'chests',
        '/map': 'map',
        '/ignorelist': 'ignorelist',
        '/settings': 'settings'
    };

    // Page cache to avoid re-fetching
    const pageCache = {};

    return {
        // Dark mode is always enabled
        dark: true,

        // Loading state
        isLoading: false,

        // Sidebar state
        sidebarCollapsed: getSidebarCollapsedFromLocalStorage(),
        sidebarHoverExpanded: false,
        sidebarHoverTimeout: null,

        toggleSidebar() {
            this.sidebarCollapsed = !this.sidebarCollapsed
            setSidebarCollapsedToLocalStorage(this.sidebarCollapsed)
        },

        onSidebarMouseEnter() {
            if (this.sidebarCollapsed) {
                this.sidebarHoverTimeout = setTimeout(() => {
                    this.sidebarHoverExpanded = true
                }, 1500)
            }
        },

        onSidebarMouseLeave() {
            if (this.sidebarHoverTimeout) {
                clearTimeout(this.sidebarHoverTimeout)
                this.sidebarHoverTimeout = null
            }
            this.sidebarHoverExpanded = false
        },

        // Mobile menu
        isSideMenuOpen: false,
        toggleSideMenu() {
            this.isSideMenuOpen = !this.isSideMenuOpen
        },
        closeSideMenu() {
            this.isSideMenuOpen = false
        },

        // Current path for active menu item
        currentPath: window.location.hash.slice(1) || '/',

        // Menu items configuration with Lucide icons
        menuItems: [
            {path: '/home', label: 'Radar', icon: 'radar'},
            {path: '/players', label: 'PvP & Players', icon: 'home'},
            {path: '/resources', label: 'Resources', icon: 'gem'},
            {path: '/enemies', label: 'Enemies', icon: 'flame'},
            {path: '/chests', label: 'Other', icon: 'package'},
            {path: '/map', label: 'Map', icon: 'map-pin'},
            {path: '/ignorelist', label: 'Ignore List', icon: 'eye-off'},
            {path: '/settings', label: 'Settings', icon: 'settings'}
        ],

        // Navigate to a page
        async navigateTo(path) {
            // Don't reload if already on this page
            const currentPage = routeToPage[this.currentPath] || 'drawing';
            const newPage = routeToPage[path] || 'drawing';
            if (currentPage === newPage) {
                console.log(`[Router] Already on page: ${newPage}, skipping reload`);
                return;
            }

            // Pages with complex handlers need full page reload
            const pagesNeedingReload = ['drawing'];
            if (pagesNeedingReload.includes(newPage)) {
                console.log(`[Router] Page ${newPage} needs full reload for handlers`);
                // Set hash first, then reload after a tick
                window.location.hash = path;
                setTimeout(() => window.location.reload(), 10);
                return;
            }

            this.currentPath = path;
            window.location.hash = path;
            await this.loadPage(path);
        },

        // Load page content
        async loadPage(path) {
            const pageName = routeToPage[path] || 'drawing';
            const pageUrl = `/pages/${pageName}.html`;

            this.isLoading = true;
            const contentContainer = document.getElementById('pageContent');

            try {
                let html;

                // Check cache first
                if (pageCache[pageName]) {
                    html = pageCache[pageName];
                } else {
                    const response = await fetch(pageUrl);
                    if (!response.ok) {
                        throw new Error(`Page not found: ${pageUrl}`);
                    }
                    html = await response.text();
                    pageCache[pageName] = html;
                }

                // Inject content
                contentContainer.innerHTML = html;

                // Execute inline scripts
                const scripts = contentContainer.querySelectorAll('script');
                for (const oldScript of scripts) {
                    const newScript = document.createElement('script');

                    // Copy attributes
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });

                    // For module scripts with src, just copy the src
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                    } else if (oldScript.type === 'module') {
                        // For inline module scripts, we need to create a data URL
                        // that preserves the base URL for imports
                        const code = oldScript.textContent;
                        const blob = new Blob([code], { type: 'application/javascript' });
                        const blobUrl = URL.createObjectURL(blob);
                        newScript.src = blobUrl;
                        newScript.type = 'module';

                        // Clean up blob URL after script loads
                        newScript.onload = () => URL.revokeObjectURL(blobUrl);
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }

                    // Replace in DOM
                    oldScript.parentNode.replaceChild(newScript, oldScript);

                    // Wait for script to load if it has src
                    if (newScript.src) {
                        await new Promise(resolve => {
                            newScript.onload = resolve;
                            newScript.onerror = resolve;
                        });
                    }
                }

                // Re-initialize Lucide icons for new content
                if (window.lucide) {
                    window.lucide.createIcons();
                }

                console.log(`[Router] Loaded page: ${pageName}`);

            } catch (error) {
                console.error(`[Router] Error loading page:`, error);
                contentContainer.innerHTML = `
                    <div class="container px-6 mx-auto py-4">
                        <div class="text-center text-red-400">
                            <h2 class="text-2xl font-bold mb-4">Page Not Found</h2>
                            <p>Could not load: ${pageUrl}</p>
                            <p class="text-sm mt-2">${error.message}</p>
                        </div>
                    </div>
                `;
            } finally {
                this.isLoading = false;
            }
        },

        // Initialize - load initial page
        init() {
            // Handle hash change
            window.addEventListener('hashchange', () => {
                const path = window.location.hash.slice(1) || '/';
                if (path !== this.currentPath) {
                    this.currentPath = path;
                    this.loadPage(path);
                }
            });

            // Load initial page
            const initialPath = window.location.hash.slice(1) || '/';
            this.currentPath = initialPath;
            this.loadPage(initialPath);
        }
    }
}

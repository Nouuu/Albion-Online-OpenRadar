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

    return {
        // Dark mode is always enabled
        dark: true,

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
        currentPath: window.location.pathname,

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
        ]
    }
}

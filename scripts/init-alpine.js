function data() {
  function getThemeFromLocalStorage() {
    // if user already changed the theme, use it
    if (window.localStorage.getItem('dark')) {
      return JSON.parse(window.localStorage.getItem('dark'))
    }

    // else return their preferences
    return (
      !!window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  }

  function setThemeToLocalStorage(value) {
    window.localStorage.setItem('dark', value)
  }

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
    dark: getThemeFromLocalStorage(),
    toggleTheme() {
      this.dark = !this.dark
      setThemeToLocalStorage(this.dark)
    },
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
        }, 500) // 500ms delay
      }
    },
    onSidebarMouseLeave() {
      if (this.sidebarHoverTimeout) {
        clearTimeout(this.sidebarHoverTimeout)
        this.sidebarHoverTimeout = null
      }
      this.sidebarHoverExpanded = false
    },
    isSideMenuOpen: false,
    toggleSideMenu() {
      this.isSideMenuOpen = !this.isSideMenuOpen
    },
    closeSideMenu() {
      this.isSideMenuOpen = false
    },
    // ...existing code...
    isNotificationsMenuOpen: false,
    toggleNotificationsMenu() {
      this.isNotificationsMenuOpen = !this.isNotificationsMenuOpen
    },
    closeNotificationsMenu() {
      this.isNotificationsMenuOpen = false
    },
    isProfileMenuOpen: false,
    toggleProfileMenu() {
      this.isProfileMenuOpen = !this.isProfileMenuOpen
    },
    closeProfileMenu() {
      this.isProfileMenuOpen = false
    },
    isPagesMenuOpen: false,
    togglePagesMenu() {
      this.isPagesMenuOpen = !this.isPagesMenuOpen
    },
    // Modal
    isModalOpen: false,
    trapCleanup: null,
    openModal() {
      this.isModalOpen = true
      this.trapCleanup = focusTrap(document.querySelector('#modal'))
    },
    closeModal() {
      this.isModalOpen = false
      this.trapCleanup()
    },
    currentPath: window.location.pathname,
  }
}

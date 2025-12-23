// PageController - Manages page lifecycle for SPA navigation
// Each page registers init/destroy callbacks called on HTMX navigation

import {CATEGORIES} from '../constants/LoggerConstants.js';

const pageHandlers = new Map();
let currentPage = null;
let isTransitioning = false;
let destroyPromise = null;  // Track ongoing destroy for race condition prevention
let isPageControllerInitialized = false;  // Guard against duplicate initialization

export function registerPage(pageName, handlers) {
    if (pageHandlers.has(pageName)) {
        window.logger?.warn(CATEGORIES.SYSTEM, 'PageController_Overwrite', {pageName});
    }
    pageHandlers.set(pageName, {
        init: handlers.init || (() => {
        }),
        destroy: handlers.destroy || (() => {
        })
    });
    window.logger?.debug(CATEGORIES.SYSTEM, 'PageController_Registered', {pageName});
}

function detectCurrentPage() {
    const pageContent = document.getElementById('page-content');
    return pageContent?.dataset?.page || null;
}

async function destroyCurrentPage() {
    if (!currentPage) return;

    // Wait for any ongoing transition to complete
    if (isTransitioning && destroyPromise) {
        await destroyPromise;
        return;  // Already destroyed by previous call
    }

    isTransitioning = true;
    const pageToDestroy = currentPage;

    destroyPromise = (async () => {
        const handlers = pageHandlers.get(pageToDestroy);
        if (handlers?.destroy) {
            try {
                window.logger?.info(CATEGORIES.SYSTEM, 'PageController_Destroying', {page: pageToDestroy});
                await handlers.destroy();
            } catch (error) {
                window.logger?.error(CATEGORIES.SYSTEM, 'PageController_DestroyError', {
                    page: pageToDestroy,
                    error: error.message
                });
            }
        }
        currentPage = null;
        isTransitioning = false;
        destroyPromise = null;
    })();

    await destroyPromise;
}

async function initCurrentPage() {
    const newPage = detectCurrentPage();
    if (!newPage || newPage === currentPage) return;

    // Wait for any ongoing destroy to complete first
    if (destroyPromise) {
        await destroyPromise;
    }

    // Double-check after waiting - page might have changed
    if (currentPage === newPage) return;

    isTransitioning = true;
    currentPage = newPage;

    const handlers = pageHandlers.get(newPage);
    if (handlers?.init) {
        try {
            window.logger?.info(CATEGORIES.SYSTEM, 'PageController_Initializing', {page: newPage});
            await handlers.init();
        } catch (error) {
            window.logger?.error(CATEGORIES.SYSTEM, 'PageController_InitError', {page: newPage, error: error.message});
            if (window.toast) {
                window.toast.error(`Failed to initialize ${newPage} page`);
            }
        }
    }

    isTransitioning = false;
}

export function initPageController() {
    // Guard against duplicate initialization (prevents listener accumulation)
    if (isPageControllerInitialized) {
        window.logger?.debug(CATEGORIES.SYSTEM, 'PageController_AlreadyInitialized', {});
        return;
    }
    isPageControllerInitialized = true;

    document.body.addEventListener('htmx:beforeSwap', (event) => {
        if (event.detail.target?.id === 'page-content') {
            destroyCurrentPage();
        }
    });

    document.body.addEventListener('htmx:afterSettle', (event) => {
        if (event.detail.target?.id === 'page-content') {
            initCurrentPage();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            // Don't set currentPage here - initCurrentPage handles it
            // Just trigger init, it will detect and init the page
            initCurrentPage();
        }, 0);
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => window.location.reload());

    window.logger?.info(CATEGORIES.SYSTEM, 'PageController_Initialized', {});
}

export function reinitCurrentPage() {
    currentPage = null;
    return initCurrentPage();
}

initPageController();
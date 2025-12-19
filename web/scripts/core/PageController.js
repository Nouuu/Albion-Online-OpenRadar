// PageController - Manages page lifecycle for SPA navigation
// Each page registers init/destroy callbacks called on HTMX navigation

import {CATEGORIES} from '../constants/LoggerConstants.js';

const pageHandlers = new Map();
let currentPage = null;
let isTransitioning = false;

export function registerPage(pageName, handlers) {
    if (pageHandlers.has(pageName)) {
        window.logger?.warn(CATEGORIES.DEBUG, 'PageController_Overwrite', {pageName});
    }
    pageHandlers.set(pageName, {
        init: handlers.init || (() => {
        }),
        destroy: handlers.destroy || (() => {
        })
    });
    window.logger?.debug(CATEGORIES.DEBUG, 'PageController_Registered', {pageName});
}

function detectCurrentPage() {
    const pageContent = document.getElementById('page-content');
    return pageContent?.dataset?.page || null;
}

async function destroyCurrentPage() {
    if (!currentPage || isTransitioning) return;

    const handlers = pageHandlers.get(currentPage);
    if (handlers?.destroy) {
        try {
            window.logger?.info(CATEGORIES.DEBUG, 'PageController_Destroying', {page: currentPage});
            await handlers.destroy();
        } catch (error) {
            window.logger?.error(CATEGORIES.DEBUG, 'PageController_DestroyError', {
                page: currentPage,
                error: error.message
            });
        }
    }
    currentPage = null;
}

async function initCurrentPage() {
    const newPage = detectCurrentPage();
    if (!newPage || newPage === currentPage) return;

    isTransitioning = true;
    currentPage = newPage;

    const handlers = pageHandlers.get(newPage);
    if (handlers?.init) {
        try {
            window.logger?.info(CATEGORIES.DEBUG, 'PageController_Initializing', {page: newPage});
            await handlers.init();
        } catch (error) {
            window.logger?.error(CATEGORIES.DEBUG, 'PageController_InitError', {page: newPage, error: error.message});
            if (window.toast) {
                window.toast.error(`Failed to initialize ${newPage} page`);
            }
        }
    }

    isTransitioning = false;
}

export function initPageController() {
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

    window.logger?.info(CATEGORIES.DEBUG, 'PageController_Initialized', {});
}

export function reinitCurrentPage() {
    const page = currentPage;
    currentPage = null;
    return initCurrentPage();
}

initPageController();
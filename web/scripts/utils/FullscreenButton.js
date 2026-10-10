import {CATEGORIES} from '../constants/LoggerConstants.js';

let initialized = false;

function isRadarPage() {
    return document.getElementById('page-content')?.dataset?.page === 'radar';
}

function updateVisibility(button) {
    button.style.display = (isRadarPage() && document.fullscreenEnabled === true) ? 'flex' : 'none';
}

function render(button) {
    const active = Boolean(document.fullscreenElement);
    const label = button.querySelector('span');
    if (label) label.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
    const icon = button.querySelector('[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', active ? 'minimize' : 'maximize');
    window.lucide?.createIcons({root: button});
}

export function initFullscreenButton(button) {
    if (initialized) return;
    initialized = true;

    button.addEventListener('click', () => {
        const toggle = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        toggle?.catch(error => window.logger?.warn(CATEGORIES.SYSTEM, 'FullscreenToggleFailed', {error: error?.message}));
    });

    document.addEventListener('fullscreenchange', () => render(button));
    document.body.addEventListener('htmx:afterSettle', event => {
        if (event.detail?.target?.id === 'page-content') updateVisibility(button);
    });

    updateVisibility(button);
    render(button);
}

export function exitFullscreenIfActive() {
    if (!document.fullscreenElement) return;
    document.exitFullscreen()?.catch(error => window.logger?.warn(CATEGORIES.SYSTEM, 'FullscreenExitFailed', {error: error?.message}));
}

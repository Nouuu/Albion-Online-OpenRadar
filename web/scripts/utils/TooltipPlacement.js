const MARGIN = 8;

export function placeTooltip(icon, size, clip, margin = MARGIN) {
    const left = icon.left + icon.width / 2 - size.width / 2;
    const fitted = Math.max(Math.min(left, clip.right - margin - size.width), clip.left + margin);
    return {nudge: fitted - left, below: icon.top - margin - size.height < clip.top};
}

function place(target) {
    const tip = target.closest?.('.tooltip[data-tip]');
    const content = document.getElementById('page-content');
    if (!tip || !content) return;
    const bubble = window.getComputedStyle(tip, '::before');
    const size = {width: parseFloat(bubble.width), height: parseFloat(bubble.height)};
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) return;
    const box = content.getBoundingClientRect();
    const left = box.left + (content.clientLeft || 0);
    const clip = {left, right: left + content.clientWidth, top: box.top + (content.clientTop || 0)};
    const {nudge, below} = placeTooltip(tip.getBoundingClientRect(), size, clip);
    tip.style.setProperty('--tt-nudge', `${nudge}px`);
    tip.classList.toggle('tooltip-bottom', below);
}

export function bindTooltipPlacement(root = document, signal) {
    root.addEventListener('mouseover', e => place(e.target), {signal});
    root.addEventListener('focusin', e => place(e.target), {signal});
}

bindTooltipPlacement();

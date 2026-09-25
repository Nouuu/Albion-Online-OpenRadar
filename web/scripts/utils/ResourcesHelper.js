const ENCHANTS = ['e0', 'e1', 'e2', 'e3', 'e4'];

export function renderedEnchants(tier) {
    return tier < 3 ? ['e0'] : ENCHANTS;
}

export function generateResourceGrid(entry) {
    const tierButtons = Array.from({length: 8}, (_, tier) =>
        `<button type="button" data-tier-toggle="${tier}" class="btn btn-primary btn-xs text-[10px] w-full"></button>`
    ).join('');

    const tierHeaders = Array.from({length: 8}, (_, tier) =>
        `<span class="text-base-content/60 text-[10px] text-center block">T${tier + 1}</span>`
    ).join('');

    const enchantRows = ENCHANTS.map(enchant => {
        const cells = Array.from({length: 8}, (_, tier) => {
            if (enchant !== 'e0' && tier < 3) return '<span class="w-4 h-4"></span>';
            return `<input type="checkbox" class="checkbox checkbox-primary checkbox-xs" data-enchant="${enchant}" data-tier="${tier}">`;
        }).join('');
        return `<div class="grid grid-cols-8 gap-1 justify-items-center">${cells}</div>`;
    }).join('');

    return `<div class="bg-base-300 rounded-lg p-3">
        <h4 class="text-sm mb-2 font-medium text-base-content">${entry.label}</h4>
        <div class="grid" style="grid-template-columns: 24px 1fr; gap: 4px;">
            <div class="grid gap-1 items-center">
                <span class="text-[10px] text-base-content/50 h-5"></span>
                <span class="text-[10px] text-base-content/50 h-4"></span>
                <span class="text-[10px] text-base-content/60 h-4 flex items-center">E0</span>
                <span class="text-[10px] text-base-content/60 h-4 flex items-center">E1</span>
                <span class="text-[10px] text-base-content/60 h-4 flex items-center">E2</span>
                <span class="text-[10px] text-base-content/60 h-4 flex items-center">E3</span>
                <span class="text-[10px] text-base-content/60 h-4 flex items-center">E4</span>
            </div>
            <div class="grid gap-1">
                <div class="grid grid-cols-8 gap-1 justify-items-center">${tierButtons}</div>
                <div class="grid grid-cols-8 gap-1 justify-items-center">${tierHeaders}</div>
                ${enchantRows}
            </div>
        </div>
    </div>`;
}

export function tierState(matrix, tier) {
    const values = renderedEnchants(tier).map(enchant => matrix[enchant][tier]);
    if (values.every(Boolean)) return 'all';
    if (values.some(Boolean)) return 'some';
    return 'none';
}

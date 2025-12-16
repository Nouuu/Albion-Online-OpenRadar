export function selectAllTierEnchants(resourcePrefix, tierIndex) {
    const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];
    const checkboxes = [];

    enchantLevels.forEach(enchantLevel => {
        const row = document.getElementById(`${resourcePrefix}-${enchantLevel}`);
        if (row) {
            const element = Array.from(row.children)[tierIndex];
            if (element?.tagName === 'INPUT' && element.type === 'checkbox') {
                checkboxes.push(element);
            }
        }
    });

    const allChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);
    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    updateTierButtonState(resourcePrefix, tierIndex);
}

export function updateTierButtonState(resourcePrefix, tierIndex) {
    const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];
    const checkboxes = [];

    enchantLevels.forEach(enchantLevel => {
        const row = document.getElementById(`${resourcePrefix}-${enchantLevel}`);
        if (row) {
            const element = Array.from(row.children)[tierIndex];
            if (element?.tagName === 'INPUT' && element.type === 'checkbox') {
                checkboxes.push(element);
            }
        }
    });

    const button = document.querySelector(`button[onclick*="selectAllTierEnchants('${resourcePrefix}', ${tierIndex})"]`);
    if (button) {
        const allChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);
        const anyChecked = checkboxes.some(cb => cb.checked);
        const tierNumber = tierIndex + 1;

        button.classList.remove('opacity-50', 'opacity-75');

        if (allChecked) {
            button.textContent = `✓T${tierNumber}`;
        } else if (anyChecked) {
            button.textContent = `◐T${tierNumber}`;
        } else {
            button.textContent = `☐T${tierNumber}`;
            button.classList.add('opacity-50');
        }
    }
}

export function initializeTierButtonStates() {
    const resources = ['fsp', 'hsp', 'wsp', 'osp', 'rsp', 'flp', 'hlp', 'wlp', 'olp', 'rlp'];
    const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];

    // Phase 1: Batch all DOM reads (no reflow)
    const updates = [];
    resources.forEach(prefix => {
        for (let tierIndex = 0; tierIndex < 8; tierIndex++) {
            const states = [];
            enchantLevels.forEach(enchantLevel => {
                const row = document.getElementById(`${prefix}-${enchantLevel}`);
                if (row) {
                    const el = row.children[tierIndex];
                    if (el?.tagName === 'INPUT') states.push(el.checked);
                }
            });

            const button = document.querySelector(`button[onclick*="selectAllTierEnchants('${prefix}', ${tierIndex})"]`);
            if (button && states.length > 0) {
                updates.push({
                    button,
                    tierIndex,
                    allChecked: states.every(c => c),
                    anyChecked: states.some(c => c)
                });
            }
        }
    });

    // Phase 2: Batch all DOM writes (single reflow)
    updates.forEach(({ button, tierIndex, allChecked, anyChecked }) => {
        const t = tierIndex + 1;
        button.className = button.className.replace(/opacity-\d+/g, '').trim();
        if (allChecked) {
            button.textContent = `✓T${t}`;
        } else if (anyChecked) {
            button.textContent = `◐T${t}`;
        } else {
            button.textContent = `☐T${t}`;
            button.classList.add('opacity-50');
        }
    });
}

export function attachCheckboxListeners() {
    const resources = ['fsp', 'hsp', 'wsp', 'osp', 'rsp', 'flp', 'hlp', 'wlp', 'olp', 'rlp'];
    const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];

    resources.forEach(prefix => {
        enchantLevels.forEach(enchantLevel => {
            const row = document.getElementById(`${prefix}-${enchantLevel}`);
            if (!row || row.dataset.listenerAttached) return;
            row.dataset.listenerAttached = 'true';

            row.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') {
                    const checkboxes = Array.from(row.children).filter(child => child.type === 'checkbox');
                    const index = checkboxes.indexOf(e.target);
                    if (index !== -1) setTimeout(() => updateTierButtonState(prefix, index), 10);
                }
            }, true);
        });
    });
}

export function generateResourceGrid(config) {
    const { prefix } = config;
    const isLiving = prefix.endsWith('lp');
    const typeLabel = isLiving ? 'Living' : 'Static';
    const typeIcon = isLiving ? '🌿' : '⛏️';

    const buttons = Array.from({ length: 8 }, (_, i) =>
        `<button onclick="selectAllTierEnchants('${prefix}', ${i})" class="btn btn-primary btn-xs text-[10px] w-full" title="Select all T${i+1}">✓T${i+1}</button>`
    ).join('');

    const tierHeaders = Array.from({ length: 8 }, (_, i) =>
        `<span class="text-base-content/60 text-[10px] text-center block">T${i+1}</span>`
    ).join('');

    const enchantmentRows = ['e0', 'e1', 'e2', 'e3', 'e4'].map(enchantLevel => {
        const isE0 = enchantLevel === 'e0';
        const checkboxClass = 'checkbox checkbox-primary checkbox-xs';

        const cells = Array.from({ length: 8 }, (_, i) => {
            if (!isE0 && i < 3) return '<span class="w-4 h-4"></span>';
            return `<input type="checkbox" class="${checkboxClass}">`;
        }).join('');

        return `<div class="grid grid-cols-8 gap-1 justify-items-center" id="${prefix}-${enchantLevel}">${cells}</div>`;
    }).join('');

    return `<div class="bg-base-300 rounded-lg p-3">
        <h4 class="text-sm mb-2 font-medium text-base-content flex items-center gap-2">
            <span class="text-xs">${typeIcon}</span>
            ${typeLabel}
        </h4>
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
                <div class="grid grid-cols-8 gap-1 justify-items-center">${buttons}</div>
                <div class="grid grid-cols-8 gap-1 justify-items-center">${tierHeaders}</div>
                ${enchantmentRows}
            </div>
        </div>
    </div>`;
}

export function getResourceStorageKey(prefix, type) {
    const resourceName = {
        'fsp': 'Fiber', 'hsp': 'Hide', 'wsp': 'Wood', 'osp': 'Ore', 'rsp': 'Rock',
        'flp': 'Fiber', 'hlp': 'Hide', 'wlp': 'Wood', 'olp': 'Ore', 'rlp': 'Rock'
    }[prefix];
    return `setting${type}${resourceName}Enchants`;
}

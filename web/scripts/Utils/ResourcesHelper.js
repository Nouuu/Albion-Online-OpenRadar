/**
 * ResourcesHelper.js
 * Utility functions for the Resources settings page
 */

/**
 * Toggle all enchantments for a specific Tier (column)
 * @param {string} resourcePrefix - Resource prefix (e.g., 'fsp', 'flp')
 * @param {number} tierIndex - Tier index (0-7 for T1-T8)
 */
export function selectAllTierEnchants(resourcePrefix, tierIndex) {
	// Get all checkboxes for this tier (column)
	const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];
	const checkboxes = [];

	// Collect all checkboxes in this column
	enchantLevels.forEach(enchantLevel => {
		const rowId = `${resourcePrefix}-${enchantLevel}`;
		const row = document.getElementById(rowId);

		if (row) {
			const allChildren = Array.from(row.children);
			if (allChildren[tierIndex]) {
				const element = allChildren[tierIndex];
				if (element.tagName === 'INPUT' && element.type === 'checkbox') {
					checkboxes.push(element);
				}
			}
		}
	});

	// Check if all are currently checked
	const allChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);

	// Toggle: if all checked, uncheck all; otherwise check all
	checkboxes.forEach(checkbox => {
		checkbox.checked = !allChecked;
		checkbox.dispatchEvent(new Event('change', { bubbles: true }));
	});

	// Update button visual state
	updateTierButtonState(resourcePrefix, tierIndex);
}

/**
 * Update the visual state of a tier button
 * @param {string} resourcePrefix - Resource prefix (e.g., 'fsp', 'flp')
 * @param {number} tierIndex - Tier index (0-7 for T1-T8)
 */
export function updateTierButtonState(resourcePrefix, tierIndex) {
	const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];
	const checkboxes = [];

	// Collect all checkboxes in this column
	enchantLevels.forEach(enchantLevel => {
		const rowId = `${resourcePrefix}-${enchantLevel}`;
		const row = document.getElementById(rowId);

		if (row) {
			const allChildren = Array.from(row.children);
			if (allChildren[tierIndex]) {
				const element = allChildren[tierIndex];
				if (element.tagName === 'INPUT' && element.type === 'checkbox') {
					checkboxes.push(element);
				}
			}
		}
	});

	// Find the corresponding button
	const buttonSelector = `button[onclick*="selectAllTierEnchants('${resourcePrefix}', ${tierIndex})"]`;
	const button = document.querySelector(buttonSelector);

	if (button) {
		const allChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);
		const anyChecked = checkboxes.some(cb => cb.checked);
		const tierNumber = tierIndex + 1;

		// Remove all opacity classes first
		button.classList.remove('opacity-50', 'opacity-75');

		if (allChecked) {
			// All checked: checkmark, normal opacity
			button.textContent = `✓T${tierNumber}`;
		} else if (anyChecked) {
			// Partially checked: half-circle, normal opacity
			button.textContent = `◐T${tierNumber}`;
		} else {
			// None checked: empty box, grayed out
			button.textContent = `☐T${tierNumber}`;
			button.classList.add('opacity-50');
		}
	}
}

/**
 * Initialize button states on page load
 */
export function initializeTierButtonStates() {
	const resources = [
		'fsp', 'hsp', 'wsp', 'osp', 'rsp', // Static
		'flp', 'hlp', 'wlp', 'olp', 'rlp'  // Living
	];

	resources.forEach(resourcePrefix => {
		for (let tierIndex = 0; tierIndex < 8; tierIndex++) {
			updateTierButtonState(resourcePrefix, tierIndex);
		}
	});
}

/**
 * Add event listeners to all checkboxes to update button states when changed manually
 */
export function attachCheckboxListeners() {
	const resources = [
		{ prefix: 'fsp' }, { prefix: 'hsp' }, { prefix: 'wsp' },
		{ prefix: 'osp' }, { prefix: 'rsp' }, { prefix: 'flp' },
		{ prefix: 'hlp' }, { prefix: 'wlp' }, { prefix: 'olp' },
		{ prefix: 'rlp' }
	];
	const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];

	resources.forEach(({ prefix }) => {
		enchantLevels.forEach(enchantLevel => {
			const rowId = `${prefix}-${enchantLevel}`;
			const row = document.getElementById(rowId);

			// Skip if already has listener (prevents duplicates on HTMX swaps)
			if (!row || row.dataset.listenerAttached) return;
			row.dataset.listenerAttached = 'true';

			row.addEventListener('click', (e) => {
				if (e.target.type === 'checkbox') {
					const checkboxes = Array.from(row.children).filter(child => child.type === 'checkbox');
					const index = checkboxes.indexOf(e.target);
					if (index !== -1) {
						setTimeout(() => updateTierButtonState(prefix, index), 10);
					}
				}
			}, true);
		});
	});
}

/**
 * Generate HTML for a resource grid
 * @param {Object} config - Configuration object
 * @param {string} config.prefix - Resource prefix (e.g., 'fsp', 'flp')
 * @param {string} config.name - Display name (e.g., 'Fiber', 'Hide')
 * @param {string} config.emoji - Emoji icon (e.g., '🌿', '🦌')
 * @returns {string} HTML string for the resource grid
 */
export function generateResourceGrid(config) {
	const { prefix, name, emoji } = config;

	// Determine if Static or Living based on prefix
	const isLiving = prefix.endsWith('lp');
	const typeLabel = isLiving ? 'Living' : 'Static';
	const typeIcon = isLiving ? '🌿' : '⛏️';

	// Generate quick select buttons (T1-T8) - more compact
	const buttons = Array.from({ length: 8 }, (_, i) => {
		const tierNum = i + 1;
		return `<button onclick="selectAllTierEnchants('${prefix}', ${i})" class="text-[10px] w-full py-0.5 bg-accent/20 text-accent rounded hover:bg-accent hover:text-void transition-colors font-medium text-center" title="Select all T${tierNum}">✓T${tierNum}</button>`;
	}).join('');

	// Generate tier headers (T1-T8) - compact
	const tierHeaders = Array.from({ length: 8 }, (_, i) => {
		const tierNum = i + 1;
		return `<span class="text-gray-400 text-[10px] text-center block">T${tierNum}</span>`;
	}).join('');

	// Generate enchantment rows (e0-e4) - compact, centered
	const enchantmentRows = ['e0', 'e1', 'e2', 'e3', 'e4'].map(enchantLevel => {
		const isE0 = enchantLevel === 'e0';
		const checkboxClass = 'w-4 h-4 rounded border border-white/20 bg-surface checked:bg-accent checked:border-accent cursor-pointer';

		// E0 has all 8 tiers, E1-E4 only have T4-T8 (3 empty spans first)
		const cells = Array.from({ length: 8 }, (_, i) => {
			if (!isE0 && i < 3) {
				return '<span class="w-4 h-4"></span>';
			}
			return `<input type="checkbox" class="${checkboxClass}">`;
		}).join('');

		return `<div class="grid grid-cols-8 gap-1 justify-items-center" id="${prefix}-${enchantLevel}">${cells}</div>`;
	}).join('');

	return `<div class="bg-surface/50 border border-white/5 rounded-lg p-3">
		<h4 class="text-sm mb-2 font-medium text-white flex items-center gap-2">
			<span class="text-xs">${typeIcon}</span>
			${typeLabel}
		</h4>
		<div class="grid" style="grid-template-columns: 24px 1fr; gap: 4px;">
			<div class="grid gap-1 items-center">
				<span class="text-[10px] text-gray-500 h-5"></span>
				<span class="text-[10px] text-gray-500 h-4"></span>
				<span class="text-[10px] text-gray-400 h-4 flex items-center">E0</span>
				<span class="text-[10px] text-gray-400 h-4 flex items-center">E1</span>
				<span class="text-[10px] text-gray-400 h-4 flex items-center">E2</span>
				<span class="text-[10px] text-gray-400 h-4 flex items-center">E3</span>
				<span class="text-[10px] text-gray-400 h-4 flex items-center">E4</span>
			</div>
			<div class="grid gap-1">
				<div class="grid grid-cols-8 gap-1 justify-items-center">${buttons}</div>
				<div class="grid grid-cols-8 gap-1 justify-items-center">${tierHeaders}</div>
				${enchantmentRows}
			</div>
		</div>
	</div>`;
}

export function getResourceStorageKey(prefix, type){
	const resourceName = {
		'fsp': 'Fiber', 'hsp': 'Hide', 'wsp': 'Wood', 'osp': 'Ore', 'rsp': 'Rock',
		'flp': 'Fiber', 'hlp': 'Hide', 'wlp': 'Wood', 'olp': 'Ore', 'rlp': 'Rock'
	}[prefix];
	return `setting${type}${resourceName}Enchants`;
}
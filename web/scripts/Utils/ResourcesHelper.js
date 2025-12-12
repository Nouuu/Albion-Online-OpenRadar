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
		{ prefix: 'fsp', enchants: null }, // Will be set dynamically
		{ prefix: 'hsp', enchants: null },
		{ prefix: 'wsp', enchants: null },
		{ prefix: 'osp', enchants: null },
		{ prefix: 'rsp', enchants: null },
		{ prefix: 'flp', enchants: null },
		{ prefix: 'hlp', enchants: null },
		{ prefix: 'wlp', enchants: null },
		{ prefix: 'olp', enchants: null },
		{ prefix: 'rlp', enchants: null }
	];
	const enchantLevels = ['e0', 'e1', 'e2', 'e3', 'e4'];

	resources.forEach(({ prefix }) => {
		enchantLevels.forEach(enchantLevel => {
			const rowId = `${prefix}-${enchantLevel}`;
			const row = document.getElementById(rowId);

			if (row) {
				// Add a single listener on the row instead of each checkbox
				// This captures all click events on checkboxes via event delegation
				row.addEventListener('click', (e) => {
					if (e.target.type === 'checkbox') {
						// Find the checkbox index
						const checkboxes = Array.from(row.children).filter(child => child.type === 'checkbox');
						const index = checkboxes.indexOf(e.target);

						if (index !== -1) {
							// Small delay to let the localStorage save complete first
							setTimeout(() => {
								updateTierButtonState(prefix, index);
							}, 10);
						}
					}
				}, true); // Use capture phase to ensure we catch the event
			}
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

	// Generate quick select buttons (T1-T8)
	const buttons = Array.from({ length: 8 }, (_, i) => {
		const tierNum = i + 1;
		return `<button onclick="selectAllTierEnchants('${prefix}', ${i})" class="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded hover:bg-accent hover:text-void transition-colors font-medium" title="Select all T${tierNum}">✓T${tierNum}</button>`;
	}).join('\n\t\t\t\t\t\t\t');

	// Generate tier headers (T1-T8)
	const tierHeaders = Array.from({ length: 8 }, (_, i) => {
		const tierNum = i + 1;
		return `<p class="text-gray-400 text-sm" style="width: 20px; height: 20px;">T${tierNum}</p>`;
	}).join('\n\t\t\t\t\t\t\t');

	// Generate enchantment rows (e0-e4)
	const enchantmentRows = ['e0', 'e1', 'e2', 'e3', 'e4'].map(enchantLevel => {
		const isE0 = enchantLevel === 'e0';
		const checkboxClass = 'w-5 h-5 rounded border-2 border-white/20 bg-surface checked:bg-accent checked:border-accent focus:ring-2 focus:ring-accent/30 transition-colors cursor-pointer';

		// E0 has all 8 tiers, E1-E4 only have T4-T8 (3 empty spans first)
		const cells = Array.from({ length: 8 }, (_, i) => {
			if (!isE0 && i < 3) {
				return '<span></span>';
			}
			return `<input type="checkbox" class="${checkboxClass}">`;
		}).join('\n\t\t\t\t\t\t\t');

		return `<div class="grid" id="${prefix}-${enchantLevel}" style="grid-template-columns: repeat(8, 1fr); gap: 10px;">
\t\t\t\t\t\t\t${cells}
\t\t\t\t\t\t</div>`;
	}).join('\n\t\t\t\t\t\t');

	return `<div class="bg-elevated border border-white/5 rounded-xl p-6 hover:border-accent/10 transition-colors">
\t\t<div class="w-full">
\t\t\t<h4 class="text-xl mb-4 font-semibold text-white">
\t\t\t\t${emoji} ${name}
\t\t\t</h4>
\t\t\t<div class="grid" style="grid-template-columns: 1fr 90%; gap: 10px;">
\t\t\t\t<div class="grid" style="gap: 10px;">
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;"></p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E/T</p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E0</p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E1</p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E2</p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E3</p>
\t\t\t\t\t<p class="text-gray-400 text-sm" style="height: 20px;">E4</p>
\t\t\t\t</div>
\t\t\t\t<div class="grid" style="gap: 10px;">
\t\t\t\t\t<!-- Quick Select Buttons -->
\t\t\t\t\t<div class="grid" style="grid-template-columns: repeat(8, 1fr); gap: 10px;">
\t\t\t\t\t\t${buttons}
\t\t\t\t\t</div>
\t\t\t\t\t<!-- Tier Headers -->
\t\t\t\t\t<div class="matrix-upper-texts grid" style="grid-template-columns: repeat(8, 1fr); gap: 10px;">
\t\t\t\t\t\t${tierHeaders}
\t\t\t\t\t</div>
\t\t\t\t\t${enchantmentRows}
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</div>`;
}

export function getResourceStorageKey(prefix, type){
	const resourceName = {
		'fsp': 'Fiber', 'hsp': 'Hide', 'wsp': 'Wood', 'osp': 'Ore', 'rsp': 'Rock',
		'flp': 'Fiber', 'hlp': 'Hide', 'wlp': 'Wood', 'olp': 'Ore', 'rlp': 'Rock'
	}[prefix];
	return `setting${type}${resourceName}Enchants`;
}
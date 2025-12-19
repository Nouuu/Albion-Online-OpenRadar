// DatabaseLoader.js - Coordinated database initialization
// Extracted from Utils.js during Phase 1B refactor

import {ItemsDatabase} from '../Data/ItemsDatabase.js';
import {SpellsDatabase} from '../Data/SpellsDatabase.js';
import {HarvestablesDatabase} from '../Data/HarvestablesDatabase.js';
import {MobsDatabase} from '../Data/MobsDatabase.js';
import zonesDatabase from '../Data/ZonesDatabase.js';
import {CATEGORIES} from '../constants/LoggerConstants.js';

const MAX_RETRIES = 3;

// Global database state tracking
window.databasesReady = false;
window.databaseLoadingProgress = {
    items: false,
    spells: false,
    harvestables: false,
    mobs: false,
    zones: false
};

async function loadDatabaseWithRetry(database, path, name, ...extraArgs) {
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
        try {
            await database.load(path, ...extraArgs);
            window.logger?.debug(CATEGORIES.ITEM_DATABASE, `${name}Loaded`, {});
            return {success: true, database};
        } catch (error) {
            retryCount++;
            const isLastAttempt = retryCount >= MAX_RETRIES;

            window.logger?.error(CATEGORIES.ITEM_DATABASE, `${name}LoadFailed`, {
                error: error.message,
                attempt: retryCount,
                maxRetries: MAX_RETRIES,
                isLastAttempt
            });

            if (isLastAttempt) {
                return {success: false, error, name};
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = 1000 * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function showDatabaseError(databaseName, error) {
    if (window.toast) {
        window.toast.error(`Failed to load ${databaseName} database`);
    }

    // Also create a DOM notification for persistent visibility
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
        <div class="error-content">
            <h3>Database Loading Failed</h3>
            <p>Unable to load <strong>${databaseName}</strong> database.</p>
            <p class="error-details">${error.message}</p>
            <div class="error-actions">
                <button onclick="location.reload()">Reload Page</button>
                <button onclick="this.parentElement.parentElement.parentElement.remove()">
                    Continue Anyway
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
}

export function isLoaded() {
    return window.databasesReady === true;
}

export async function load() {
    // Skip if already loaded (cached from previous radar visit)
    if (window.databasesReady &&
        window.itemsDatabase &&
        window.spellsDatabase &&
        window.harvestablesDatabase &&
        window.mobsDatabase) {
        window.logger?.info(CATEGORIES.DEBUG, 'DatabasesCached', {});
        return;
    }

    window.logger?.info(CATEGORIES.ITEM_DATABASE, 'LoadingStart', {});

    const itemsDatabase = new ItemsDatabase();
    const spellsDatabase = new SpellsDatabase();
    const harvestablesDatabase = new HarvestablesDatabase();
    const mobsDatabase = new MobsDatabase();

    const promises = [
        loadDatabaseWithRetry(itemsDatabase, '/ao-bin-dumps/items.json', 'Items')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.items = true;
                    window.itemsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(spellsDatabase, '/ao-bin-dumps/spells.json', 'Spells')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.spells = true;
                    window.spellsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(harvestablesDatabase, '/ao-bin-dumps/harvestables.json', 'Harvestables')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.harvestables = true;
                    window.harvestablesDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(mobsDatabase, '/ao-bin-dumps/mobs.json', 'Mobs')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.mobs = true;
                    window.mobsDatabase = result.database;
                }
                return result;
            }),

        loadDatabaseWithRetry(zonesDatabase, '/ao-bin-dumps/zones.json', 'Zones')
            .then(result => {
                if (result.success) {
                    window.databaseLoadingProgress.zones = true;
                    window.zonesDatabase = zonesDatabase;
                }
                return result;
            })
    ];

    const results = await Promise.all(promises);

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        failures.forEach(failure => {
            showDatabaseError(failure.name, failure.error);
        });
    }

    // Mark as ready even if some databases failed (graceful degradation)
    window.databasesReady = true;

    const successCount = results.filter(r => r.success).length;
    window.logger?.info(CATEGORIES.ITEM_DATABASE, 'LoadingComplete', {
        success: successCount,
        failed: failures.length
    });

    // Dispatch custom event for components that need to wait for databases
    window.dispatchEvent(new CustomEvent('databasesReady', {
        detail: {
            successCount,
            failures: failures.map(f => f.name)
        }
    }));
}

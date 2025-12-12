/**
 * Localization Database
 * Parses localization.json and provides translated names
 *
 * Structure localization.json:
 * {
 *   "tmx": {
 *     "body": {
 *       "tu": [
 *         {
 *           "@tuid": "@MOB_NAME",
 *           "tuv": [
 *             {
 *               "@xml:lang": "EN-US",
 *               "seg": "Translated Name"
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 * }
 */

import { CATEGORIES } from '../constants/LoggerConstants.js';

export class LocalizationDatabase {
    constructor() {
        /**
         * Map<tuid, translatedText>
         * tuid = "@MOB_NAME", "@ITEM_NAME", etc.
         */
        this.translations = new Map();

        this.isLoaded = false;
        this.stats = {
            totalEntries: 0,
            loadTimeMs: 0
        };
    }

    /**
     * Load and parse localization.json
     * @param {string} jsonPath - Path to localization.json file
     * @param {string} lang - Language code (default: 'EN-US')
     */
    async load(jsonPath, lang = 'EN-US') {
        const startTime = performance.now();

        try {
            window.logger?.info(
                CATEGORIES.ITEM_DATABASE,
                'LocalizationDatabaseLoading',
                { path: jsonPath, lang }
            );

            const response = await fetch(jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch localization.json: ${response.status}`);
            }

            const jsonData = await response.json();

            // Structure: { "tmx": { "body": { "tu": [...] } } }
            const tmx = jsonData['tmx'];
            if (!tmx || !tmx['body'] || !tmx['body']['tu']) {
                throw new Error('Invalid localization.json structure');
            }

            const translationUnits = tmx['body']['tu'];
            if (!Array.isArray(translationUnits)) {
                throw new Error('Translation units is not an array');
            }

            this._parseTranslations(translationUnits, lang);

            this.stats.loadTimeMs = Math.round(performance.now() - startTime);
            this.isLoaded = true;

            window.logger?.info(
                CATEGORIES.ITEM_DATABASE,
                'LocalizationDatabaseLoaded',
                {
                    totalEntries: this.stats.totalEntries,
                    loadTimeMs: this.stats.loadTimeMs,
                    language: lang
                }
            );

        } catch (error) {
            window.logger?.error(
                CATEGORIES.ITEM_DATABASE,
                'LocalizationDatabaseLoadError',
                {
                    error: error.message,
                    stack: error.stack,
                    path: jsonPath
                }
            );
            throw error;
        }
    }

    /**
     * Parse translation units from JSON
     * @private
     * @param {Array} translationUnits - Array of translation unit objects
     * @param {string} lang - Language code to extract
     */
    _parseTranslations(translationUnits, lang) {
        translationUnits.forEach((tu) => {
            const tuid = tu['@tuid'];
            if (!tuid) return;

            const tuv = tu['tuv'];
            if (!Array.isArray(tuv)) return;

            // Find the translation for the requested language
            const translation = tuv.find(t => t['@xml:lang'] === lang);
            if (translation && translation['seg']) {
                this.translations.set(tuid, translation['seg']);
                this.stats.totalEntries++;
            }
        });
    }

    /**
     * Get translated text for a localization tag
     * @param {string} tuid - Translation unit ID (e.g., "@MOB_NAME")
     * @returns {string|null} Translated text or null if not found
     */
    getText(tuid) {
        return this.translations.get(tuid) || null;
    }

    /**
     * Check if a translation exists
     * @param {string} tuid - Translation unit ID
     * @returns {boolean} True if translation exists
     */
    hasTranslation(tuid) {
        return this.translations.has(tuid);
    }

    /**
     * Get translation with fallback to original tag
     * @param {string} tuid - Translation unit ID
     * @returns {string} Translated text or original tuid if not found
     */
    getTextOrFallback(tuid) {
        return this.translations.get(tuid) || tuid;
    }
}
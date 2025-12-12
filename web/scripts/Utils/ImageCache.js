/**
 * ImageCache.js
 *
 * Singleton class for caching images used by the radar.
 * Handles preloading and caching of resource, item, map, and flag images.
 * Prevents duplicate requests and caches 404 errors to avoid retrying.
 */

class ImageCache {
    constructor() {
        this.images = {};        // Resources cache
        this.item_images = {};   // Items cache
        this.map_images = {};    // Maps cache
        this.flag_images = {};   // Flags cache

        // Track loading states to prevent duplicate requests
        this.loading_images = new Set();
        this.loading_item_images = new Set();
        this.loading_map_images = new Set();
        this.loading_flag_images = new Set();
    }

    /**
     * Preload an image and add it to the appropriate cache
     * @param {string} path - Image path/URL
     * @param {string} container - Cache type: "Resources", "Maps", "Items", or "Flags"
     * @returns {Promise} - Resolves when image is loaded, rejects on error
     */
    preloadImageAndAddToList(path, container) {
        return new Promise((resolve, reject) => {
            switch (container) {
                case "Resources":
                    // Already loaded (or already tried and failed - cached as null)
                    if (path in this.images) {
                        if (this.images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                        return;
                    }

                    // Already being loaded, just wait
                    if (this.loading_images.has(path)) {
                        resolve();
                        return;
                    }

                    // Start loading
                    this.loading_images.add(path);
                    const imgResources = new Image();
                    imgResources.onload = () => {
                        this.images[path] = imgResources;
                        this.loading_images.delete(path);
                        resolve();
                    };
                    imgResources.onerror = () => {
                        this.images[path] = null; // Cache the 404 to avoid retrying
                        this.loading_images.delete(path);
                        reject(new Error('Image failed to load (404)'));
                    };
                    imgResources.src = path;
                    break;

                case "Maps":
                    if (path in this.map_images) {
                        if (this.map_images[path] === null) {
                            reject(new Error('Map image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                        return;
                    }

                    if (this.loading_map_images.has(path)) {
                        resolve();
                        return;
                    }

                    this.loading_map_images.add(path);
                    const imgMaps = new Image();
                    imgMaps.onload = () => {
                        this.map_images[path] = imgMaps;
                        this.loading_map_images.delete(path);
                        resolve();
                    };
                    imgMaps.onerror = () => {
                        this.map_images[path] = null;
                        this.loading_map_images.delete(path);
                        reject(new Error('Map image failed to load (404)'));
                    };
                    imgMaps.src = path;
                    break;

                case "Items":
                    if (path in this.item_images) {
                        if (this.item_images[path] === null) {
                            reject(new Error('Item image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                        return;
                    }

                    if (this.loading_item_images.has(path)) {
                        resolve();
                        return;
                    }

                    this.loading_item_images.add(path);
                    const imgItems = new Image();
                    imgItems.onload = () => {
                        this.item_images[path] = imgItems;
                        this.loading_item_images.delete(path);
                        resolve();
                    };
                    imgItems.onerror = () => {
                        this.item_images[path] = null;
                        this.loading_item_images.delete(path);
                        reject(new Error('Item image failed to load (404)'));
                    };
                    imgItems.src = path;
                    break;

                case "Flags":
                    if (path in this.flag_images) {
                        if (this.flag_images[path] === null) {
                            reject(new Error('Flag image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                        return;
                    }

                    if (this.loading_flag_images.has(path)) {
                        resolve();
                        return;
                    }

                    this.loading_flag_images.add(path);
                    const imgFlags = new Image();
                    imgFlags.onload = () => {
                        this.flag_images[path] = imgFlags;
                        this.loading_flag_images.delete(path);
                        resolve();
                    };
                    imgFlags.onerror = () => {
                        this.flag_images[path] = null;
                        this.loading_flag_images.delete(path);
                        reject(new Error('Flag image failed to load (404)'));
                    };
                    imgFlags.src = path;
                    break;

                default:
                    reject(new Error(`Unknown container type: ${container}`));
            }
        });
    }

    /**
     * Get a preloaded image from the cache
     * @param {string} path - Image path/URL
     * @param {string} container - Cache type: "Resources", "Maps", "Items", or "Flags"
     * @returns {HTMLImageElement|null|undefined} - The cached image, null if 404, undefined if not cached
     */
    GetPreloadedImage(path, container) {
        switch (container) {
            case "Resources":
                return this.images[path];
            case "Maps":
                return this.map_images[path];
            case "Items":
                return this.item_images[path];
            case "Flags":
                return this.flag_images[path];
            default:
                return undefined;
        }
    }

    /**
     * Clear all caches (call on map change to free memory)
     */
    clearAll() {
        const counts = {
            resources: Object.keys(this.images).length,
            items: Object.keys(this.item_images).length,
            maps: Object.keys(this.map_images).length,
            flags: Object.keys(this.flag_images).length
        };

        this.images = {};
        this.item_images = {};
        this.map_images = {};
        this.flag_images = {};
        this.loading_images.clear();
        this.loading_item_images.clear();
        this.loading_map_images.clear();
        this.loading_flag_images.clear();

        console.log('[ImageCache] Cleared all caches:', counts);
    }

    /**
     * Get cache statistics
     * @returns {object}
     */
    getStats() {
        return {
            resources: Object.keys(this.images).length,
            items: Object.keys(this.item_images).length,
            maps: Object.keys(this.map_images).length,
            flags: Object.keys(this.flag_images).length,
            loading: {
                resources: this.loading_images.size,
                items: this.loading_item_images.size,
                maps: this.loading_map_images.size,
                flags: this.loading_flag_images.size
            }
        };
    }
}

// Export singleton instance
const imageCache = new ImageCache();
export default imageCache;

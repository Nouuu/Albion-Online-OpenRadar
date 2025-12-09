/**
 * ImageCache.js
 *
 * Centralized image caching system for the radar.
 * Handles preloading and caching of resource, item, map, and flag images.
 * Prevents duplicate requests and caches 404 errors to avoid retrying.
 */

class ImageCache {
    constructor() {
        // Image caches by type
        this.images = {};       // Resource images
        this.item_images = {};  // Item/equipment images
        this.map_images = {};   // Map background images
        this.flag_images = {};  // Faction flag images

        // Track images currently being loaded to prevent duplicate requests
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
                    // Image already loaded (or already tried and failed - cached as null)
                    if (path in this.images) {
                        if (this.images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    // Image already being loaded, wait
                    else if (this.loading_images.has(path)) {
                        resolve();
                    }
                    else {
                        this.loading_images.add(path);
                        const img = new Image();

                        img.onload = () => {
                            this.images[path] = img;
                            this.loading_images.delete(path);
                            resolve();
                        };

                        img.onerror = () => {
                            this.images[path] = null;
                            this.loading_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }
                    break;

                case "Maps":
                    if (path in this.map_images) {
                        if (this.map_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    else if (this.loading_map_images.has(path)) {
                        resolve();
                    }
                    else {
                        this.loading_map_images.add(path);
                        const img = new Image();

                        img.onload = () => {
                            this.map_images[path] = img;
                            this.loading_map_images.delete(path);
                            resolve();
                        };

                        img.onerror = () => {
                            this.map_images[path] = null;
                            this.loading_map_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }
                    break;

                case "Items":
                    if (path in this.item_images) {
                        if (this.item_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    else if (this.loading_item_images.has(path)) {
                        resolve();
                    }
                    else {
                        this.loading_item_images.add(path);
                        const img = new Image();

                        img.onload = () => {
                            this.item_images[path] = img;
                            this.loading_item_images.delete(path);
                            resolve();
                        };

                        img.onerror = () => {
                            this.item_images[path] = null;
                            this.loading_item_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }
                    break;

                case "Flags":
                    if (path in this.flag_images) {
                        if (this.flag_images[path] === null) {
                            reject(new Error('Image previously failed to load (404)'));
                        } else {
                            resolve();
                        }
                    }
                    else if (this.loading_flag_images.has(path)) {
                        resolve();
                    }
                    else {
                        this.loading_flag_images.add(path);
                        const img = new Image();

                        img.onload = () => {
                            this.flag_images[path] = img;
                            this.loading_flag_images.delete(path);
                            resolve();
                        };

                        img.onerror = () => {
                            this.flag_images[path] = null;
                            this.loading_flag_images.delete(path);
                            reject(new Error('Image failed to load (404)'));
                        };

                        img.src = path;
                    }
                    break;

                default:
                    reject(new Error(`Unknown container type: ${container}`));
                    break;
            }
        });
    }

    /**
     * Get a preloaded image from the cache
     * @param {string} path - Image path/URL
     * @param {string} container - Cache type: "Resources", "Maps", "Items", or "Flags"
     * @returns {HTMLImageElement|null} - The cached image or null if not found/failed
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
                return null;
        }
    }
}

// Export singleton instance
const imageCache = new ImageCache();
export default imageCache;
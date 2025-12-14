class ImageCache {
    constructor() {
        this.MAX_RESOURCES = 500;
        this.MAX_ITEMS = 300;
        this.MAX_MAPS = 50;
        this.MAX_FLAGS = 100;

        this.images = new Map();
        this.item_images = new Map();
        this.map_images = new Map();
        this.flag_images = new Map();

        this.loading_images = new Set();
        this.loading_item_images = new Set();
        this.loading_map_images = new Set();
        this.loading_flag_images = new Set();

        this.failedUrls = new Set();
    }

    isKnownFailed(url) {
        return this.failedUrls.has(url);
    }

    markAsFailed(url) {
        this.failedUrls.add(url);
    }

    checkImage(url) {
        if (this.failedUrls.has(url)) return false;
        if (this.item_images.has(url)) return true;
        return null;
    }

    preloadSilent(url) {
        if (this.failedUrls.has(url) || this.item_images.has(url)) return;
        if (this.loading_item_images.has(url)) return;

        this.loading_item_images.add(url);

        const img = new Image();
        img.onload = () => {
            this.item_images.set(url, { image: img, lastAccess: Date.now() });
            this.loading_item_images.delete(url);
            this._evictIfNeeded(this.item_images, this.MAX_ITEMS);
        };
        img.onerror = () => {
            this.failedUrls.add(url);
            this.loading_item_images.delete(url);
        };
        img.src = url;
    }

    _evictIfNeeded(cache, maxSize) {
        if (cache.size <= maxSize) return;

        const entries = [...cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        const toRemove = entries.slice(0, cache.size - maxSize);

        for (const [key] of toRemove) {
            cache.delete(key);
        }
    }

    _getCacheForContainer(container) {
        switch (container) {
            case "Resources":
                return { cache: this.images, loading: this.loading_images, max: this.MAX_RESOURCES };
            case "Maps":
                return { cache: this.map_images, loading: this.loading_map_images, max: this.MAX_MAPS };
            case "Items":
                return { cache: this.item_images, loading: this.loading_item_images, max: this.MAX_ITEMS };
            case "Flags":
                return { cache: this.flag_images, loading: this.loading_flag_images, max: this.MAX_FLAGS };
            default:
                return null;
        }
    }

    preloadImageAndAddToList(path, container) {
        return new Promise((resolve, reject) => {
            const ctx = this._getCacheForContainer(container);
            if (!ctx) {
                reject(new Error(`Unknown container type: ${container}`));
                return;
            }

            const { cache, loading, max } = ctx;

            if (cache.has(path)) {
                const entry = cache.get(path);
                entry.lastAccess = Date.now();
                if (entry.image === null) {
                    reject(new Error('Image previously failed to load (404)'));
                } else {
                    resolve();
                }
                return;
            }

            if (loading.has(path)) {
                resolve();
                return;
            }

            this._evictIfNeeded(cache, max - 1);

            loading.add(path);
            const img = new Image();
            img.onload = () => {
                cache.set(path, { image: img, lastAccess: Date.now() });
                loading.delete(path);
                resolve();
            };
            img.onerror = () => {
                cache.set(path, { image: null, lastAccess: Date.now() });
                loading.delete(path);
                reject(new Error('Image failed to load (404)'));
            };
            img.src = path;
        });
    }

    GetPreloadedImage(path, container) {
        const ctx = this._getCacheForContainer(container);
        if (!ctx) return undefined;

        const entry = ctx.cache.get(path);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.image;
        }
        return undefined;
    }

    clearAll() {
        const counts = {
            resources: this.images.size,
            items: this.item_images.size,
            maps: this.map_images.size,
            flags: this.flag_images.size
        };

        this.images.clear();
        this.item_images.clear();
        this.map_images.clear();
        this.flag_images.clear();
        this.loading_images.clear();
        this.loading_item_images.clear();
        this.loading_map_images.clear();
        this.loading_flag_images.clear();
        this.failedUrls.clear();

        window.logger?.debug(window.CATEGORIES?.CACHE || 'CACHE', 'ImageCacheCleared', counts);
    }

    getStats() {
        return {
            resources: { count: this.images.size, max: this.MAX_RESOURCES },
            items: { count: this.item_images.size, max: this.MAX_ITEMS },
            maps: { count: this.map_images.size, max: this.MAX_MAPS },
            flags: { count: this.flag_images.size, max: this.MAX_FLAGS },
            failed: this.failedUrls.size,
            loading: {
                resources: this.loading_images.size,
                items: this.loading_item_images.size,
                maps: this.loading_map_images.size,
                flags: this.loading_flag_images.size
            }
        };
    }
}

const imageCache = new ImageCache();
window.imageCache = imageCache;
export default imageCache;

/**
 * DOM Cache - Smart caching with mutation observer invalidation
 */

export class DOMCache {
  constructor() {
    // Cache structure: cacheKey -> { snapshot, timestamp, mutationSetup }
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    this.mutationThreshold = 300; // Invalidate after 300 DOM mutations
  }

  /**
   * Get cached snapshot if valid
   */
  async get(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // Check age
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTimeout) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.snapshot;
  }

  /**
   * Store snapshot in cache with mutation observer
   */
  async set(cacheKey, snapshot, page) {
    // Clear any existing cache for this key
    this.cache.delete(cacheKey);

    // Setup mutation observer on the page
    await this.setupMutationObserver(page, cacheKey);

    // Store in cache
    this.cache.set(cacheKey, {
      snapshot,
      timestamp: Date.now(),
      mutationSetup: true
    });
  }

  /**
   * Check if cache is invalid due to mutations
   */
  async isInvalid(page) {
    try {
      const isInvalid = await page.evaluate(() => {
        return window.__dom_cache_invalid === true;
      });
      
      if (isInvalid) {
        // Reset the flag
        await page.evaluate(() => {
          window.__dom_cache_invalid = false;
        });
      }
      
      return isInvalid;
    } catch {
      // If we can't check, assume invalid to be safe
      return true;
    }
  }

  /**
   * Setup mutation observer to track DOM changes
   */
  async setupMutationObserver(page, cacheKey) {
    try {
      await page.evaluate((threshold) => {
        // Only set up once per page
        if (window.__dom_mutation_observer) {
          window.__dom_mutation_observer.disconnect();
        }

        let mutationCount = 0;
        const startTime = Date.now();

        const observer = new MutationObserver((mutations) => {
          mutationCount += mutations.length;
          
          // Check if we've exceeded threshold
          if (mutationCount > threshold) {
            window.__dom_cache_invalid = true;
            observer.disconnect();
          }
        });

        // Observe all DOM changes
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeOldValue: false,
          characterData: true,
          characterDataOldValue: false
        });

        window.__dom_mutation_observer = observer;
        window.__dom_cache_invalid = false;

        // Also invalidate on navigation-like events
        const invalidateCache = () => {
          window.__dom_cache_invalid = true;
          if (window.__dom_mutation_observer) {
            window.__dom_mutation_observer.disconnect();
          }
        };

        // Listen for events that likely mean major page changes
        window.addEventListener('popstate', invalidateCache, { once: true });
        
        // Watch for programmatic navigation
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
          invalidateCache();
          return originalPushState.apply(history, arguments);
        };
        
        history.replaceState = function() {
          invalidateCache();
          return originalReplaceState.apply(history, arguments);
        };

      }, this.mutationThreshold);
    } catch (error) {
      console.warn('[DOMCache] Failed to setup mutation observer:', error);
      // Continue without mutation tracking
    }
  }

  /**
   * Clear specific cache entry
   */
  clear(cacheKey) {
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  clearAll() {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    const stats = {
      entries: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ages: {}
    };

    this.cache.forEach((entry, key) => {
      stats.ages[key] = Date.now() - entry.timestamp;
    });

    return stats;
  }
}
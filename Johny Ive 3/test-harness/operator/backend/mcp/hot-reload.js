import { watch } from 'fs';
import { pathToFileURL } from 'url';

export class HotReloader {
  constructor() {
    this.moduleCache = new Map();
    this.watchers = new Map();
  }

  async watchModule(modulePath, callback) {
    // Clear from Node's require cache
    const clearCache = (path) => {
      delete require.cache[require.resolve(path)];
      // Also clear ES module cache
      const moduleURL = pathToFileURL(path).href;
      if (moduleURL in import.meta.cache) {
        delete import.meta.cache[moduleURL];
      }
    };

    // Watch the file
    const watcher = watch(modulePath, async (eventType) => {
      if (eventType === 'change') {
        console.error(`[HOT-RELOAD] Detected change in ${modulePath}`);
        try {
          clearCache(modulePath);
          const newModule = await import(`${modulePath}?t=${Date.now()}`);
          await callback(newModule);
          console.error(`[HOT-RELOAD] Successfully reloaded ${modulePath}`);
        } catch (error) {
          console.error(`[HOT-RELOAD] Error reloading ${modulePath}:`, error);
        }
      }
    });

    this.watchers.set(modulePath, watcher);
  }

  stop() {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
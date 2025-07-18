/**
 * Snapshot Store - Storage for full DOM snapshots to enable diff functionality
 */

export class SnapshotStore {
  constructor() {
    // Store snapshots by tab ID
    // Structure: tabId -> { snapshot, timestamp, snapshotId }
    this.snapshots = new Map();
    
    // Store snapshot metadata for lookups
    // Structure: snapshotId -> { tabId, timestamp }
    this.snapshotIndex = new Map();
    
    // Maximum age for snapshots (5 minutes)
    this.maxAge = 5 * 60 * 1000;
  }

  /**
   * Store a snapshot for a tab
   */
  store(tabId, snapshot, snapshotId) {
    const timestamp = Date.now();
    
    // Store the snapshot
    this.snapshots.set(tabId, {
      snapshot,
      timestamp,
      snapshotId
    });
    
    // Index for lookups
    this.snapshotIndex.set(snapshotId, {
      tabId,
      timestamp
    });
    
    // Clean up old snapshots
    this.cleanup();
  }

  /**
   * Get the previous snapshot for a tab
   */
  getPreviousForTab(tabId) {
    const stored = this.snapshots.get(tabId);
    if (!stored) return null;
    
    // Check if snapshot is too old
    if (Date.now() - stored.timestamp > this.maxAge) {
      this.snapshots.delete(tabId);
      this.snapshotIndex.delete(stored.snapshotId);
      return null;
    }
    
    return stored;
  }

  /**
   * Get a snapshot by ID
   */
  getBySnapshotId(snapshotId) {
    const meta = this.snapshotIndex.get(snapshotId);
    if (!meta) return null;
    
    return this.snapshots.get(meta.tabId);
  }

  /**
   * Clean up old snapshots
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [tabId, data] of this.snapshots) {
      if (now - data.timestamp > this.maxAge) {
        toDelete.push({ tabId, snapshotId: data.snapshotId });
      }
    }
    
    toDelete.forEach(({ tabId, snapshotId }) => {
      this.snapshots.delete(tabId);
      this.snapshotIndex.delete(snapshotId);
    });
  }

  /**
   * Clear all snapshots
   */
  clear() {
    this.snapshots.clear();
    this.snapshotIndex.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      storedSnapshots: this.snapshots.size,
      indexedSnapshots: this.snapshotIndex.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage (rough)
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [, data] of this.snapshots) {
      // Rough estimate: stringify and get byte length
      totalSize += JSON.stringify(data.snapshot).length;
    }
    return totalSize;
  }
}
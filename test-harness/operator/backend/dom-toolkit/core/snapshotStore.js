/**
 * Snapshot Store - Storage for full DOM snapshots to enable diff functionality
 */

export class SnapshotStore {
  constructor() {
    // Store snapshots by tab ID
    // Structure: tabId -> Array of { snapshot, timestamp, snapshotId }
    this.snapshots = new Map();
    
    // Store snapshot metadata for lookups
    // Structure: snapshotId -> { tabId, timestamp, snapshot }
    this.snapshotIndex = new Map();
    
    // Maximum age for snapshots (5 minutes)
    this.maxAge = 5 * 60 * 1000;
    
    // Maximum snapshots per tab
    this.maxSnapshotsPerTab = 5;
  }

  /**
   * Store a snapshot for a tab
   */
  store(tabId, snapshot, snapshotId) {
    const timestamp = Date.now();
    
    // Get existing snapshots for this tab
    let tabSnapshots = this.snapshots.get(tabId) || [];
    
    // Add new snapshot
    tabSnapshots.push({
      snapshot,
      timestamp,
      snapshotId
    });
    
    // Keep only recent snapshots
    if (tabSnapshots.length > this.maxSnapshotsPerTab) {
      const removed = tabSnapshots.shift();
      this.snapshotIndex.delete(removed.snapshotId);
    }
    
    // Store updated array
    this.snapshots.set(tabId, tabSnapshots);
    
    // Index for lookups
    this.snapshotIndex.set(snapshotId, {
      tabId,
      timestamp,
      snapshot
    });
    
    // Clean up old snapshots
    this.cleanup();
  }

  /**
   * Get the previous snapshot for a tab
   */
  getPreviousForTab(tabId) {
    const tabSnapshots = this.snapshots.get(tabId);
    if (!tabSnapshots || tabSnapshots.length === 0) return null;
    
    // Get the most recent snapshot
    const stored = tabSnapshots[tabSnapshots.length - 1];
    
    // Check if snapshot is too old
    if (Date.now() - stored.timestamp > this.maxAge) {
      // Remove old snapshot
      tabSnapshots.pop();
      this.snapshotIndex.delete(stored.snapshotId);
      
      if (tabSnapshots.length === 0) {
        this.snapshots.delete(tabId);
      }
      
      return null;
    }
    
    return stored;
  }
  
  /**
   * Get all snapshots for a tab
   */
  getAllForTab(tabId) {
    const tabSnapshots = this.snapshots.get(tabId);
    if (!tabSnapshots) return [];
    
    // Filter out old snapshots
    const now = Date.now();
    const validSnapshots = tabSnapshots.filter(s => now - s.timestamp <= this.maxAge);
    
    // Update stored snapshots if any were filtered out
    if (validSnapshots.length < tabSnapshots.length) {
      if (validSnapshots.length === 0) {
        this.snapshots.delete(tabId);
      } else {
        this.snapshots.set(tabId, validSnapshots);
      }
      
      // Clean up index
      tabSnapshots.forEach(s => {
        if (!validSnapshots.includes(s)) {
          this.snapshotIndex.delete(s.snapshotId);
        }
      });
    }
    
    return validSnapshots;
  }

  /**
   * Get a snapshot by ID
   */
  getBySnapshotId(snapshotId) {
    const meta = this.snapshotIndex.get(snapshotId);
    if (!meta) return null;
    
    return meta.snapshot;
  }
  
  /**
   * Get a snapshot by ID (alias for backward compatibility)
   */
  get(snapshotId) {
    return this.getBySnapshotId(snapshotId);
  }

  /**
   * Clean up old snapshots
   */
  cleanup() {
    const now = Date.now();
    
    for (const [tabId, tabSnapshots] of this.snapshots) {
      // Filter out old snapshots
      const validSnapshots = tabSnapshots.filter(s => now - s.timestamp <= this.maxAge);
      
      // Clean up index for removed snapshots
      tabSnapshots.forEach(s => {
        if (!validSnapshots.includes(s)) {
          this.snapshotIndex.delete(s.snapshotId);
        }
      });
      
      // Update or remove tab entry
      if (validSnapshots.length === 0) {
        this.snapshots.delete(tabId);
      } else if (validSnapshots.length < tabSnapshots.length) {
        this.snapshots.set(tabId, validSnapshots);
      }
    }
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
/**
 * DOM Toolkit - Clean, efficient DOM exploration for Director 3.0
 * 
 * Provides token-efficient DOM inspection tools inspired by Unix philosophy:
 * - dom_structure (ls): Show page skeleton
 * - dom_overview (ls + grep): Smart filtered view of actionable elements  
 * - dom_search (grep): Find specific elements
 * - dom_inspect (cat): Deep dive into element details
 */

import { DOMCapture } from './core/domCapture.js';
import { DOMCache } from './core/domCache.js';
import { SnapshotStore } from './core/snapshotStore.js';
import { OutlineFilter } from './filters/outlineFilter.js';
import { InteractivesFilter } from './filters/interactivesFilter.js';
import { HeadingsFilter } from './filters/headingsFilter.js';
import { SearchFilter } from './filters/searchFilter.js';
import { GroupingProcessor } from './processors/groupingProcessor.js';
import { SelectorHints } from './processors/selectorHints.js';
import { ElementInspector } from './processors/elementInspector.js';
import { DiffProcessor } from './processors/diffProcessor.js';
import { TokenFormatter } from './formatters/tokenFormatter.js';

export class DOMToolkit {
  constructor() {
    this.capture = new DOMCapture();
    this.cache = new DOMCache();
    this.snapshotStore = new SnapshotStore();
    this.filters = {
      outline: new OutlineFilter(),
      interactives: new InteractivesFilter(),
      headings: new HeadingsFilter(),
      search: new SearchFilter()
    };
    this.grouping = new GroupingProcessor();
    this.selectors = new SelectorHints();
    this.inspector = new ElementInspector();
    this.diffProcessor = new DiffProcessor();
    this.formatter = new TokenFormatter();
  }

  /**
   * Main entry point for dom_overview tool
   */
  async domOverview(page, options = {}) {
    const {
      tabName = 'main',
      filters = { outline: true, interactives: true, headings: true },
      visible = true,
      viewport = true,
      max_rows = 30,
      diff_from = null,
      include_full = false
    } = options;

    try {
      // Get or create snapshot
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Generate a unique tab ID for snapshot storage
      const tabId = `${page._workflowId}-${tabName}`;

      // Handle diff mode
      if (diff_from) {
        const diffResult = await this.computeDiffOverview(snapshot, tabId, diff_from, {
          filters,
          visible,
          viewport,
          include_full,
          page
        });
        // Store snapshot AFTER diff computation to avoid comparing against itself
        this.snapshotStore.store(tabId, snapshot, snapshot.id);
        return diffResult;
      }

      // Store snapshot for future diffs
      this.snapshotStore.store(tabId, snapshot, snapshot.id);

      // Build full overview
      const overview = await this.buildFullOverview(snapshot, { filters, visible, viewport, max_rows, page });

      // Build response
      return {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        ...overview
      };
    } catch (error) {
      console.error('[DOMToolkit] Error in domOverview:', error);
      return {
        success: false,
        error: error.message,
        tabName
      };
    }
  }

  /**
   * dom_structure - Pure structural view (like ls)
   */
  async domStructure(page, options = {}) {
    const { tabName = 'main', depth = 3 } = options;
    
    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Get pure structure
      const structure = this.filters.outline.getStructure(snapshot, { depth });
      
      return {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        structure,
        summary: {
          total_nodes: snapshot.nodeCount,
          max_depth: snapshot.maxDepth
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName
      };
    }
  }

  /**
   * dom_search - Find elements by criteria (like grep)
   */
  async domSearch(page, options = {}) {
    const {
      tabName = 'main',
      query = {},
      limit = 20,
      context = null,
      visible = true
    } = options;

    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Use search filter
      const searchResult = this.filters.search.search(snapshot, {
        query,
        limit,
        context,
        visible
      });

      // Generate selector hints for each match
      const matches = searchResult.elements.map(element => {
        // Find the full node to generate hints
        const nodeId = parseInt(element.id.replace(/[\[\]]/g, ''));
        const node = snapshot.nodeMap.get(nodeId);
        if (node) {
          element.selector_hints = this.selectors.generate(node, snapshot);
        }
        return element;
      });

      return {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        matches,
        summary: {
          total_searched: searchResult.totalSearched,
          matches_found: searchResult.matchesFound,
          truncated: searchResult.truncated
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName
      };
    }
  }

  /**
   * dom_inspect - Detailed element inspection (like cat/read)
   */
  async domInspect(page, options = {}) {
    const {
      tabName = 'main',
      elementId,
      include = {
        attributes: true,
        computedStyles: false,
        children: true,
        siblings: false,
        parents: true,
        text: true
      }
    } = options;

    if (!elementId) {
      return {
        success: false,
        error: 'elementId is required',
        tabName
      };
    }

    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Use element inspector
      const result = this.inspector.inspect(snapshot, elementId, { include });
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          tabName
        };
      }

      return {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        element: result.element,
        context: result.context
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName
      };
    }
  }

  /**
   * Compute diff between snapshots and return filtered changes
   */
  async computeDiffOverview(currentSnapshot, tabId, diffFrom, options) {
    const { filters, visible, viewport, include_full, page } = options;

    // Get previous snapshot
    let previousSnapshot = null;
    
    // Check if diff_from is 'true' (use last snapshot) or a specific snapshot ID
    if (diffFrom === true || diffFrom === 'true') {
      const stored = this.snapshotStore.getPreviousForTab(tabId);
      if (!stored) {
        // No baseline available - fall back to full overview
        console.log('[DOMToolkit] No previous snapshot available for diff');
        const overview = await this.buildFullOverview(currentSnapshot, { filters, visible, viewport, page });
        return {
          success: true,
          snapshotId: currentSnapshot.id,
          url: await page.url(),
          tabName: tabId.split('-').pop(),
          baselineUnavailable: true,
          ...overview
        };
      }
      previousSnapshot = stored.snapshot;
    } else {
      // Look up specific snapshot by ID
      const stored = this.snapshotStore.getBySnapshotId(diffFrom);
      if (!stored) {
        return {
          success: false,
          error: `Snapshot ${diffFrom} not found or expired`,
          snapshotId: currentSnapshot.id
        };
      }
      previousSnapshot = stored.snapshot;
    }

    // Compute raw diff
    const rawChanges = this.diffProcessor.computeDiff(previousSnapshot, currentSnapshot);
    
    // Filter changes based on overview filters
    const filteredChanges = this.diffProcessor.filterChanges(rawChanges, filters, currentSnapshot);

    // Build diff response
    const diffResponse = {
      success: true,
      snapshotId: currentSnapshot.id,
      url: await page.url(),
      tabName: tabId.split('-').pop(), // Extract tab name from tabId
      diff: {
        added: filteredChanges.added,
        removed: filteredChanges.removed,
        modified: filteredChanges.modified
      },
      summary: {
        baseline: previousSnapshot.id,
        totalChanges: filteredChanges.added.length + 
                     filteredChanges.removed.length + 
                     filteredChanges.modified.length,
        totalRawChanges: rawChanges.added.length + 
                        rawChanges.removed.length + 
                        rawChanges.modified.length,
        filteredOutChanges: (rawChanges.added.length + rawChanges.removed.length + rawChanges.modified.length) -
                           (filteredChanges.added.length + filteredChanges.removed.length + filteredChanges.modified.length)
      }
    };

    // Include full overview if requested
    if (include_full) {
      const fullOverview = await this.buildFullOverview(currentSnapshot, { filters, visible, viewport, page });
      diffResponse.sections = fullOverview.sections;
      diffResponse.summary = { ...diffResponse.summary, ...fullOverview.summary };
    }

    return diffResponse;
  }

  /**
   * Build full overview sections (extracted for reuse)
   */
  async buildFullOverview(snapshot, options) {
    const { filters, visible, viewport, max_rows = 30 } = options;
    const sections = {};
    const truncatedSections = [];

    if (filters.outline) {
      const outlineElements = this.filters.outline.filter(snapshot, { visible, max_rows });
      sections.outline = outlineElements.elements;
      if (outlineElements.truncated) truncatedSections.push('outline');
    }

    if (filters.interactives) {
      const interactiveElements = this.filters.interactives.filter(snapshot, { visible, viewport, max_rows });
      const grouped = this.grouping.process(interactiveElements.elements);
      sections.interactives = grouped.map(elem => ({
        ...elem,
        selector_hints: this.selectors.generate(elem, snapshot)
      }));
      if (interactiveElements.truncated) truncatedSections.push('interactives');
    }

    if (filters.headings) {
      const headingElements = this.filters.headings.filter(snapshot, { visible, viewport, max_rows });
      sections.headings = headingElements.elements;
      if (headingElements.truncated) truncatedSections.push('headings');
    }

    return {
      sections,
      summary: {
        total_elements: snapshot.nodeCount,
        shown: Object.values(sections).reduce((sum, arr) => sum + arr.length, 0),
        truncatedSections,
        viewport_info: {
          width: snapshot.viewport.width,
          height: snapshot.viewport.height,
          scroll_position: snapshot.viewport.scrollY,
          contentHeight: snapshot.viewport.contentHeight
        }
      }
    };
  }
}

// Export singleton instance
export default new DOMToolkit();
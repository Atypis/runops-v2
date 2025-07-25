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
import { PortalFilter } from './filters/portalFilter.js';
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
      search: new SearchFilter(),
      portal: new PortalFilter()
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
      include_full = false,
      autoScroll = false,
      maxScrollDistance = 5000,
      scrollContainer = null
    } = options;
    
    // Safety check: ensure max_rows is reasonable
    const safeMaxRows = Math.min(max_rows, 100);

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
          max_rows: safeMaxRows,
          page
        });
        // Store snapshot AFTER diff computation to avoid comparing against itself
        this.snapshotStore.store(tabId, snapshot, snapshot.id);
        return diffResult;
      }

      // Store snapshot for future diffs
      this.snapshotStore.store(tabId, snapshot, snapshot.id);

      // Handle autoScroll for virtualized content
      let mergedOverview = null;
      if (autoScroll && !diff_from) {
        mergedOverview = await this.captureWithScroll(page, snapshot, {
          filters,
          visible,
          viewport,
          max_rows: safeMaxRows,
          maxScrollDistance,
          scrollContainer
        });
      }

      // Build full overview (or use merged if we scrolled)
      const overview = mergedOverview || await this.buildFullOverview(snapshot, { filters, visible, viewport, max_rows: safeMaxRows, page });

      // Build response
      const response = {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        ...overview
      };
      
      // Safety check: Limit response size
      const MAX_RESPONSE_CHARS = 100000; // ~25k tokens
      const responseStr = JSON.stringify(response);
      if (responseStr.length > MAX_RESPONSE_CHARS) {
        console.error(`[DOMToolkit] Overview response too large: ${responseStr.length} chars`);
        
        return {
          success: false,
          error: `Response too large: ${responseStr.length} chars exceeded ${MAX_RESPONSE_CHARS} limit. Use more specific filters or smaller max_rows.`,
          snapshotId: snapshot.id,
          tabName,
          url: await page.url()
        };
      }
      
      return response;
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
      visible = true,
      autoScroll = false,
      maxScrollDistance = 5000,
      scrollContainer = null
    } = options;

    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Use search filter
      let searchResult = this.filters.search.search(snapshot, {
        query,
        limit,
        context,
        visible
      });

      // If no matches and autoScroll is enabled, try progressive scrolling
      if (autoScroll && searchResult.matchesFound === 0) {
        const scrollResult = await this.searchWithScroll(page, {
          query,
          limit,
          visible,
          maxScrollDistance,
          scrollContainer
        });
        if (scrollResult.success) {
          searchResult = scrollResult.searchResult;
        }
      }

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
          truncated: searchResult.truncated,
          visibilityStats: searchResult.visibilityStats,
          patterns: searchResult.patterns
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

      // Add occlusion detection if element has position
      if (result.element.position) {
        const occlusion = await this.checkOcclusion(page, result.element);
        if (occlusion) {
          result.element.evidence = result.element.evidence || {};
          result.element.evidence.occlusion = occlusion;
        }
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
    const { filters, visible, viewport, include_full, max_rows = 30, page } = options;

    // Get previous snapshot
    let previousSnapshot = null;
    
    // Check if diff_from is 'true' (use last snapshot) or a specific snapshot ID
    if (diffFrom === true || diffFrom === 'true') {
      const stored = this.snapshotStore.getPreviousForTab(tabId);
      if (!stored) {
        // No baseline available - return empty diff
        console.log('[DOMToolkit] No previous snapshot available for diff');
        return {
          success: true,
          snapshotId: currentSnapshot.id,
          url: await page.url(),
          tabName: tabId.split('-').pop(),
          baselineUnavailable: true,
          diff: {
            added: [],
            removed: [],
            modified: []
          },
          summary: {
            baseline: null,
            totalChanges: 0,
            totalRawChanges: 0,
            filteredOutChanges: 0,
            note: 'No baseline snapshot available for comparison. Run dom_overview without diff_from first.'
          }
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
    
    // Filter changes using bi-temporal filtering with the same filters as dom_overview
    const filteredChanges = this.diffProcessor.filterChanges(
      rawChanges, 
      filters, 
      this.filters,  // Pass the actual filter instances
      previousSnapshot, 
      currentSnapshot,
      { visible, viewport }
    );
    
    // Safety limit: cap the number of changes to prevent token explosion
    const maxChanges = max_rows * 3; // Allow 3x max_rows for diffs
    const limitedChanges = {
      added: filteredChanges.added.slice(0, maxChanges),
      removed: filteredChanges.removed.slice(0, maxChanges),
      modified: filteredChanges.modified.slice(0, maxChanges)
    };
    
    const truncated = 
      filteredChanges.added.length > maxChanges ||
      filteredChanges.removed.length > maxChanges ||
      filteredChanges.modified.length > maxChanges;

    // Build diff response
    const diffResponse = {
      success: true,
      snapshotId: currentSnapshot.id,
      url: await page.url(),
      tabName: tabId.split('-').pop(), // Extract tab name from tabId
      diff: {
        added: limitedChanges.added,
        removed: limitedChanges.removed,
        modified: limitedChanges.modified
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
                           (filteredChanges.added.length + filteredChanges.removed.length + filteredChanges.modified.length),
        truncated: truncated,
        maxChangesPerType: maxChanges
      }
    };

    // Include full overview if requested
    if (include_full) {
      // Log warning about token usage
      console.warn('[DOMToolkit] Warning: include_full=true doubles response size and token usage');
      
      const fullOverview = await this.buildFullOverview(currentSnapshot, { filters, visible, viewport, max_rows, page });
      diffResponse.sections = fullOverview.sections;
      diffResponse.summary = { ...diffResponse.summary, ...fullOverview.summary };
      
      // Add warning to response
      diffResponse.summary.warning = 'include_full=true significantly increases token usage. Consider using diff_from without include_full for efficiency.';
    }

    // Safety check: Limit response size to prevent token explosion
    const MAX_RESPONSE_CHARS = 100000; // ~25k tokens
    const responseStr = JSON.stringify(diffResponse);
    if (responseStr.length > MAX_RESPONSE_CHARS) {
      console.error(`[DOMToolkit] Response too large: ${responseStr.length} chars. Truncating sections.`);
      
      // Return minimal diff without sections
      return {
        success: true,
        snapshotId: currentSnapshot.id,
        url: await page.url(),
        tabName: tabId.split('-').pop(),
        diff: diffResponse.diff,
        summary: {
          ...diffResponse.summary,
          error: `Response truncated: ${responseStr.length} chars exceeded ${MAX_RESPONSE_CHARS} limit. Use more specific filters or smaller max_rows.`
        }
      };
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

    // Always check for portal roots at body level
    const portalElements = this.filters.portal.findPortalRoots(snapshot, { includeHidden: true });
    if (portalElements.portals.length > 0) {
      sections.portals = portalElements.portals;
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

  /**
   * Capture DOM overview with progressive scrolling for virtualized content
   */
  async captureWithScroll(page, initialSnapshot, options) {
    const {
      filters,
      visible,
      viewport,
      max_rows,
      maxScrollDistance,
      scrollContainer  // NEW: Support for nested scroll containers
    } = options;

    console.log('[DOMToolkit] Starting auto-scroll capture', scrollContainer ? `in container: ${scrollContainer}` : 'in viewport');
    
    // Build initial overview
    let mergedOverview = await this.buildFullOverview(initialSnapshot, { 
      filters, visible, viewport, max_rows, page 
    });
    
    // Track unique elements to avoid duplicates
    const seenElements = new Set();
    
    // Add initial elements to seen set
    ['outline', 'interactives', 'headings'].forEach(category => {
      if (mergedOverview.sections && mergedOverview.sections[category]) {
        mergedOverview.sections[category].forEach(el => {
          const key = `${el.tag}-${el.text || ''}-${el.attributes?.href || ''}`;
          seenElements.add(key);
        });
      }
    });
    
    // Get initial scroll position
    const startScrollPos = await page.evaluate((containerSel) => {
      if (containerSel) {
        const container = document.querySelector(containerSel);
        return container ? container.scrollTop : 0;
      }
      return window.scrollY;
    }, scrollContainer);
    
    // Progressive scrolling
    let scrolled = 0;
    const scrollStep = 500;
    let previousElementCount = 0;
    
    while (scrolled < maxScrollDistance) {
      // Scroll down
      if (scrollContainer) {
        // Verify container exists
        const containerExists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, scrollContainer);
        
        if (!containerExists) {
          console.error(`[DOMToolkit] Scroll container "${scrollContainer}" not found`);
          break;
        }
        
        // Scroll the container
        await page.evaluate((params) => {
          const { sel, step } = params;
          const container = document.querySelector(sel);
          if (container) {
            container.scrollTop += step;
          }
        }, { sel: scrollContainer, step: scrollStep });
      } else {
        // Scroll viewport
        await page.evaluate(step => window.scrollBy(0, step), scrollStep);
      }
      
      scrolled += scrollStep;
      
      // Wait for DOM updates - increased for virtualized grids
      await page.waitForTimeout(300);
      
      // Additional wait if content is still rendering
      const currentElementCount = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? container.querySelectorAll('*').length : 0;
        }
        return document.body.querySelectorAll('*').length;
      }, scrollContainer);
      
      if (currentElementCount > previousElementCount) {
        await page.waitForTimeout(200);
        previousElementCount = currentElementCount;
      }
      
      // Capture new snapshot
      const newSnapshot = await this.capture.captureSnapshot(page);
      const newOverview = await this.buildFullOverview(newSnapshot, {
        filters, visible: true, viewport: true, max_rows, page
      });
      
      // Merge unique elements
      ['outline', 'interactives', 'headings'].forEach(category => {
        if (newOverview.sections && newOverview.sections[category] && 
            mergedOverview.sections && mergedOverview.sections[category]) {
          newOverview.sections[category].forEach(el => {
            const key = `${el.tag}-${el.text || ''}-${el.attributes?.href || ''}`;
            if (!seenElements.has(key)) {
              seenElements.add(key);
              mergedOverview.sections[category].push(el);
            }
          });
        }
      });
      
      // Check if we've reached the bottom
      const atBottom = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? 
            container.scrollTop + container.clientHeight >= container.scrollHeight - 10 : 
            true;
        }
        return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
      }, scrollContainer);
      
      if (atBottom) {
        console.log('[DOMToolkit] Reached bottom of', scrollContainer || 'page');
        break;
      }
    }
    
    // Restore original scroll position
    if (scrollContainer) {
      await page.evaluate((params) => {
        const { sel, scrollPos } = params;
        const container = document.querySelector(sel);
        if (container) {
          container.scrollTop = scrollPos;
        }
      }, { sel: scrollContainer, scrollPos: startScrollPos });
    } else {
      await page.evaluate(scrollY => window.scrollTo(0, scrollY), startScrollPos);
    }
    
    // Apply max_rows limits to merged results
    if (mergedOverview.sections) {
      ['outline', 'interactives', 'headings'].forEach(category => {
        if (mergedOverview.sections[category] && mergedOverview.sections[category].length > max_rows) {
          mergedOverview.sections[category] = mergedOverview.sections[category].slice(0, max_rows);
        }
      });
    }
    
    console.log(`[DOMToolkit] Auto-scroll complete. Scrolled ${scrolled}px in ${scrollContainer || 'viewport'}`);
    return mergedOverview;
  }

  /**
   * dom_check_portals - Find new portals/overlays after interaction
   */
  async domCheckPortals(page, options = {}) {
    const {
      tabName = 'main',
      sinceSnapshotId = null,
      includeAll = false
    } = options;

    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      
      // Get current snapshot
      const currentSnapshot = await this.capture.captureSnapshot(page);
      
      // Get baseline snapshot for comparison
      let baselineSnapshot = null;
      if (sinceSnapshotId) {
        // Use specific snapshot
        baselineSnapshot = this.snapshotStore.get(sinceSnapshotId);
        if (!baselineSnapshot) {
          return {
            success: false,
            error: `Baseline snapshot ${sinceSnapshotId} not found`
          };
        }
      } else {
        // Use most recent snapshot for this tab
        const tabId = `${page._workflowId}-${tabName}`;
        const snapshots = this.snapshotStore.getAllForTab(tabId);
        if (snapshots.length > 0) {
          // Get the most recent snapshot (before the current capture)
          const mostRecentSnapshot = snapshots[snapshots.length - 1];
          baselineSnapshot = mostRecentSnapshot.snapshot;
        }
      }

      // If no baseline, just return current portals
      if (!baselineSnapshot) {
        const portalElements = this.filters.portal.findPortalRoots(currentSnapshot, { includeHidden: true });
        
        // Generate selector hints for each portal
        const portalsWithSelectors = portalElements.portals.map(portal => {
          const nodeId = parseInt(portal.id.replace(/[\[\]]/g, ''));
          const node = currentSnapshot.nodeMap.get(nodeId);
          if (node) {
            portal.selector_hints = this.selectors.generate(node, currentSnapshot);
          }
          return portal;
        });
        
        return {
          success: true,
          newPortals: portalsWithSelectors,
          baseline: null,
          message: 'No baseline snapshot available, showing all current portals'
        };
      }

      // Find elements that are new at body level
      const bodyNode = currentSnapshot.nodes.find(node => node.tag === 'body');
      if (!bodyNode) {
        return {
          success: false,
          error: 'Could not find body element in snapshot'
        };
      }

      // Get body-level elements from both snapshots
      const currentBodyChildren = currentSnapshot.nodes.filter(node => 
        node.parentId === bodyNode.id && node.type === 1
      );
      
      const baselineBodyNode = baselineSnapshot.nodes.find(node => node.tag === 'body');
      const baselineBodyChildren = baselineBodyNode ? 
        baselineSnapshot.nodes.filter(node => node.parentId === baselineBodyNode.id && node.type === 1) :
        [];

      // Find new elements (in current but not in baseline)
      const baselineIds = new Set(baselineBodyChildren.map(n => `${n.tag}-${n.attributes.class || ''}-${n.attributes.id || ''}`));
      const newElements = currentBodyChildren.filter(node => {
        const nodeKey = `${node.tag}-${node.attributes.class || ''}-${node.attributes.id || ''}`;
        return !baselineIds.has(nodeKey);
      });

      // Filter to portal-like elements unless includeAll
      let portals = [];
      if (includeAll) {
        // Include all new body-level elements
        portals = newElements.map(node => this.filters.portal.formatPortalElement(node, currentSnapshot));
      } else {
        // Only include elements that look like portals
        portals = newElements
          .filter(node => this.filters.portal.isPortalRoot(node))
          .map(node => this.filters.portal.formatPortalElement(node, currentSnapshot));
      }

      // Generate selector hints for each portal
      const portalsWithSelectors = portals.map(portal => {
        const nodeId = parseInt(portal.id.replace(/[\[\]]/g, ''));
        const node = currentSnapshot.nodeMap.get(nodeId);
        if (node) {
          portal.selector_hints = this.selectors.generate(node, currentSnapshot);
        }
        return portal;
      });

      // Store current snapshot for future comparisons
      this.snapshotStore.store(`${page._workflowId}-${tabName}`, currentSnapshot, currentSnapshot.id);

      return {
        success: true,
        newPortals: portalsWithSelectors,
        baseline: baselineSnapshot.id,
        currentSnapshot: currentSnapshot.id
      };
    } catch (error) {
      console.error('[DOMToolkit] Error in domCheckPortals:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search with progressive scrolling for virtualized content
   */
  async searchWithScroll(page, options) {
    const {
      query,
      limit,
      visible,
      maxScrollDistance,
      scrollContainer
    } = options;

    console.log('[DOMToolkit] Starting scroll search for:', query);
    console.log(`[DOMToolkit] Max scroll distance: ${maxScrollDistance}px, container: ${scrollContainer || 'viewport'}`);
    
    let scrolled = 0;
    const scrollStep = 500;
    const maxAttempts = Math.ceil(maxScrollDistance / scrollStep);
    let attempt = 0;
    let previousElementCount = 0;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      // For each scroll attempt, capture snapshot and search
      const snapshot = await this.capture.captureSnapshot(page);
      const searchResult = this.filters.search.search(snapshot, {
        query,
        limit,
        context: null,
        visible
      });
      
      if (searchResult.matchesFound > 0) {
        console.log(`[DOMToolkit] Found element after ${attempt} scroll attempts`);
        return {
          success: true,
          searchResult
        };
      }
      
      // Get scroll position before
      const scrollBefore = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? container.scrollTop : 0;
        }
        return window.scrollY;
      }, scrollContainer);
      
      // Scroll container or viewport
      if (scrollContainer) {
        const containerExists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, scrollContainer);
        
        if (!containerExists) {
          console.error(`[DOMToolkit] Scroll container "${scrollContainer}" not found`);
          break;
        }
        
        await page.evaluate((params) => {
          const { sel, step } = params;
          const container = document.querySelector(sel);
          if (container) {
            container.scrollTop += step;
          }
        }, { sel: scrollContainer, step: scrollStep });
      } else {
        await page.evaluate(step => window.scrollBy(0, step), scrollStep);
      }
      
      // Get scroll position after
      const scrollAfter = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? container.scrollTop : 0;
        }
        return window.scrollY;
      }, scrollContainer);
      
      // Track actual movement
      const actualMovement = Math.abs(scrollAfter - scrollBefore);
      scrolled += actualMovement;
      
      // Check if we're truly stuck (no movement AND at bottom)
      if (actualMovement < 1) {
        // Double-check if we're at the bottom before giving up
        const isAtBottom = await page.evaluate((containerSel) => {
          if (containerSel) {
            const container = document.querySelector(containerSel);
            return container ? 
              container.scrollTop + container.clientHeight >= container.scrollHeight - 5 : 
              true;
          }
          return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5;
        }, scrollContainer);
        
        if (isAtBottom) {
          console.log(`[DOMToolkit] Scroll search stopped - reached bottom at position ${scrollAfter}`);
          break;
        } else {
          console.log(`[DOMToolkit] Small movement (${actualMovement}px) but not at bottom, continuing...`);
        }
      }
      
      // Wait for DOM updates and check if new content rendered
      await page.waitForTimeout(300);
      
      // Additional wait if content is still rendering (virtualized grids)
      const currentElementCount = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? container.querySelectorAll('*').length : 0;
        }
        return document.body.querySelectorAll('*').length;
      }, scrollContainer);
      
      // If element count changed, wait a bit more for render to complete
      if (currentElementCount > previousElementCount) {
        console.log(`[DOMToolkit] New elements rendered, waiting for completion...`);
        await page.waitForTimeout(200);
        previousElementCount = currentElementCount;
      }
      
      // Check if we've reached the bottom
      const atBottom = await page.evaluate((containerSel) => {
        if (containerSel) {
          const container = document.querySelector(containerSel);
          return container ? 
            container.scrollTop + container.clientHeight >= container.scrollHeight - 10 : 
            true;
        }
        return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
      }, scrollContainer);
      
      if (atBottom) {
        console.log('[DOMToolkit] Reached bottom of scrollable area, element not found');
        break;
      }
    }
    
    console.log(`[DOMToolkit] Scroll search completed:`, {
      attempts: attempt,
      totalScrolled: scrolled,
      maxScrollDistance,
      reachedMax: scrolled >= maxScrollDistance,
      query
    });
    
    return {
      success: false,
      searchResult: {
        elements: [],
        matchesFound: 0,
        totalSearched: 0,
        truncated: false
      },
      diagnostics: {
        attempts: attempt,
        totalScrolled: scrolled,
        maxScrollDistance,
        reason: scrolled >= maxScrollDistance ? 'max-distance-reached' : 'element-not-found'
      }
    };
  }

  /**
   * Check if element is occluded by other elements
   */
  async checkOcclusion(page, element) {
    try {
      // Get element's position
      const pos = element.position;
      if (!pos) return null;

      // Sample points to check
      const points = [
        [pos.x + pos.width / 2, pos.y + pos.height / 2], // center
        [pos.x + 5, pos.y + 5],                           // top-left
        [pos.x + pos.width - 5, pos.y + pos.height - 5], // bottom-right
      ];

      const occlusion = await page.evaluate((elementId, points) => {
        // Extract numeric ID from format like "[123]"
        const id = elementId.match(/\[(\d+)\]/)?.[1];
        if (!id) return null;

        // Try to find element by various means
        let targetElement = null;
        
        // Try by ID attribute
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.id === `:${id}` || el.getAttribute('id') === `:${id}`) {
            targetElement = el;
            break;
          }
        }

        const results = points.map(([x, y]) => {
          const topEl = document.elementFromPoint(x, y);
          
          return {
            point: [x, y],
            topElement: topEl ? {
              tag: topEl.tagName.toLowerCase(),
              id: topEl.id,
              class: topEl.className,
              selector: topEl.id ? `#${topEl.id}` : 
                       topEl.className ? `.${topEl.className.split(' ')[0]}` : 
                       topEl.tagName.toLowerCase()
            } : null,
            isTarget: topEl === targetElement
          };
        });

        // Check if any point is blocked
        const blocked = results.filter(r => !r.isTarget && r.topElement);
        
        return {
          samples: results,
          isOccluded: blocked.length > 0,
          occludedBy: blocked.length > 0 ? blocked[0].topElement : null
        };
      }, element.id, points);

      return occlusion;
    } catch (error) {
      console.error('[DOMToolkit] Occlusion check failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export default new DOMToolkit();
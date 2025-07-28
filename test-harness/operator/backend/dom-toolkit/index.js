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
import { ActionableFilter } from './filters/actionableFilter.js';
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
      portal: new PortalFilter(),
      actionable: new ActionableFilter()
    };
    this.grouping = new GroupingProcessor();
    this.selectors = new SelectorHints();
    this.inspector = new ElementInspector();
    this.diffProcessor = new DiffProcessor();
    this.formatter = new TokenFormatter();
    
    // Element cache for new element detection (Browser-Use parity)
    this.previousElementCache = new Map(); // Format: { tabId: Set<elementSignatures> }
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
   * dom_actionable - Get aggressively filtered actionable elements
   */
  async domActionable(page, options = {}) {
    const {
      tabName = 'main',
      includeScreenshotUrl = false,
      maxElements = 50,
      includeBoxes = false
    } = options;
    
    try {
      const cacheKey = `${page._workflowId}-${tabName}`;
      let snapshot = await this.cache.get(cacheKey);
      
      if (!snapshot || await this.cache.isInvalid(page)) {
        snapshot = await this.capture.captureSnapshot(page);
        await this.cache.set(cacheKey, snapshot, page);
      }

      // Use browser-context actionable filtering for full Browser-Use parity
      const actionableResult = await page.evaluate((config) => {
        // Import the ActionableFilter from the external file into browser context
        const ActionableFilter = class {
          constructor() {
            this.interactiveTags = new Set([
              'a', 'button', 'input', 'select', 'textarea', 'label', 
              'details', 'summary', 'option', 'menuitem'
            ]);
            
            this.interactiveRoles = new Set([
              'button', 'link', 'menuitem', 'menuitemradio', 'menuitemcheckbox',
              'radio', 'checkbox', 'tab', 'switch', 'slider', 'spinbutton',
              'combobox', 'searchbox', 'textbox', 'listbox', 'option', 'scrollbar'
            ]);
            
            this.ariaStateAttrs = ['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked'];
            this.frameworkAttrs = ['ng-click', '@click', 'v-on:click', 'onclick'];
            
            this.clickableClasses = [
              'clickable', 'selectable', 'interactive', 'actionable',
              'rowSelectionEnabled', 'rowExpansionEnabled', 'cellClickable', 'hoverable',
              'data-row', 'table-row', 'list-item', 'card', 'dataRow',
              // Airtable-specific patterns
              'cell', 'header-cell', 'row-cell', 'data-cell', 'field-cell', 'record-cell',
              'table-cell', 'grid-cell', 'toolbar', 'button__primary', 'menu-item',
              // Common SaaS patterns
              'nav-item', 'tab-item', 'dropdown-item', 'action-button'
            ];
            
            this.clickableTestIds = [
              'data-row', 'data-cell', 'clickable', 'selectable',
              'list-item', 'card', 'tile', 'row',
              // Airtable-specific test IDs
              'field', 'record', 'cell', 'header', 'button', 'menu', 'toolbar'
            ];
          }
          
          filterWithLiveTraversal(options = {}) {
            const { visible = true, viewport = true, max_rows = 50 } = options;
            const candidateElements = [];  // First collect ALL candidates
            const processedElements = new Set();
            
            const inViewport = (rect, vw = window.innerWidth, vh = window.innerHeight) => {
              return rect.bottom > 0 && rect.right > 0 && 
                     rect.top < vh && rect.left < vw;
            };
            
            // Phase 1: Collect all potentially actionable elements
            const traverse = (node, offset = {x: 0, y: 0}) => {
              if (!node) return;
              
              if (node.nodeType === Node.ELEMENT_NODE) {
                const elementKey = this.getElementKey(node);
                if (!processedElements.has(elementKey)) {
                  processedElements.add(elementKey);
                  
                  if (this.isActionableElementLive(node, offset) && 
                      this.isElementSignificantLive(node) &&
                      (!visible || this.isElementVisibleLive(node))) {
                    
                    if (viewport) {
                      const rect = node.getBoundingClientRect();
                      if (!inViewport(rect)) {
                        // Still traverse children even if parent is out of viewport
                        for (const child of node.childNodes) {
                          traverse(child, offset);
                        }
                        return;
                      }
                    }
                    
                    // Store candidate with DOM reference for hierarchy checking
                    candidateElements.push({
                      domElement: node,
                      tag: node.tagName.toLowerCase(),
                      text: this.extractTextLive(node).substring(0, 50) || '',
                      type: this.getElementTypeLive(node),
                      rect: node.getBoundingClientRect()
                    });
                  }
                }
              }
              
              for (const child of node.childNodes) {
                traverse(child, offset);
              }

              if (node.shadowRoot && node.shadowRoot.mode === 'open') {
                traverse(node.shadowRoot, offset);
              }
            };

            traverse(document.body);

            for (const iframe of document.querySelectorAll('iframe')) {
              try {
                if (iframe.contentDocument && iframe.contentDocument.body) {
                  const rect = iframe.getBoundingClientRect();
                  const offset = { x: rect.left, y: rect.top };
                  traverse(iframe.contentDocument.body, offset);
                }
              } catch (e) {
                console.debug('[ActionableFilter] Skipping cross-origin iframe:', iframe.src);
              }
            }
            
            // Phase 2: Simple hierarchical filtering - remove children of actionable parents
            // But be smart about containers vs meaningful interactive elements
            const filteredElements = [];
            
            for (const candidate of candidateElements) {
              let shouldKeep = true;
              
              // Check if any other candidate is a meaningful parent that should replace this element
              for (const otherCandidate of candidateElements) {
                if (otherCandidate === candidate) continue;
                
                try {
                  if (otherCandidate.domElement.contains(candidate.domElement)) {
                    // Found a parent - decide if parent should replace child
                    const parentTag = otherCandidate.domElement.tagName.toLowerCase();
                    const childTag = candidate.domElement.tagName.toLowerCase();
                    
                    // Keep child if it's a meaningful interactive element inside a generic container
                    if (['input', 'button', 'select', 'textarea'].includes(childTag) && 
                        ['div', 'span', 'section'].includes(parentTag)) {
                      continue; // Keep the child
                    }
                    
                    // Use scoring to decide parent vs child (Fix #2)
                    const parentScore = this.scoreElement(otherCandidate.domElement);
                    const childScore = this.scoreElement(candidate.domElement);
                    
                    // Keep child if it scores significantly higher than parent
                    if (childScore > parentScore + 5) {
                      continue; // Keep the child
                    }
                    
                    // Otherwise, parent should replace child
                    shouldKeep = false;
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (shouldKeep) {
                filteredElements.push(candidate);
              }
            }
            
            // Phase 3: Convert to final format and apply limits
            const elements = [];
            let elementIndex = 1;
            
            for (const candidate of filteredElements.slice(0, max_rows > 0 ? max_rows : filteredElements.length)) {
              const element = {
                id: '[' + elementIndex + ']',
                tag: candidate.tag,
                text: candidate.text,
                type: candidate.type,
                _domElement: candidate.domElement
              };
              
              if (config.includeBoxes) {
                element.bounds = [
                  Math.round(candidate.rect.x),
                  Math.round(candidate.rect.y),
                  Math.round(candidate.rect.width), 
                  Math.round(candidate.rect.height)
                ];
              }
              
              elements.push(element);
              elementIndex++;
            }
            
            return {
              elements,
              total: elements.length,
              truncated: (max_rows > 0 && filteredElements.length > max_rows) ? 1 : 0
            };
          }
          
          // ... rest of methods from ActionableFilter class
          getElementKey(element) {
            const rect = element.getBoundingClientRect();
            return element.tagName + '-' + rect.x + '-' + rect.y + '-' + rect.width + '-' + rect.height + '-' + (element.textContent?.substring(0, 20) || '');
          }

          isActionableElementLive(element, offset = {x: 0, y: 0}) {
            const tagName = element.tagName.toLowerCase();
            
            if (this.interactiveTags.has(tagName)) {
              if (this.isElementDisabledLive(element)) return false;
              return true;
            }
            
            const role = element.getAttribute('role');
            if (role && this.interactiveRoles.has(role)) return true;
            
            // Fix #3: Interactive role fallback - check computed roles and additional patterns
            const ariaRoleDescription = element.ariaRoleDescription;
            if (ariaRoleDescription && this.interactiveRoles.has(ariaRoleDescription)) return true;
            
            // Grid cell patterns (common in data tables)
            if (role === 'gridcell' || role === 'rowheader' || role === 'columnheader') return true;
            
            // Check for inert/aria-hidden (disabled equivalents)
            if (element.inert || element.getAttribute('aria-hidden') === 'true') return false;
            
            if (element.tabIndex >= 0) return true;
            
            if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
              return true;
            }
            
            if (this.hasClickHandlersLive(element)) return true;
            
            if (this.ariaStateAttrs.some(attr => element.hasAttribute(attr))) return true;
            
            if (element.draggable) return true;
            
            const className = (element.className || '').toString();
            if (this.clickableClasses.some(cls => className.includes(cls))) {
              return true;
            }
            
            if (this.hasClickableParent(element)) {
              return true;
            }
            
            // Event delegation detection (Fix #1)
            if (this.hasEventDelegation(element)) {
              return true;
            }
            
            const testId = element.getAttribute('data-testid') || '';
            if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
              return true;
            }
            
            const style = window.getComputedStyle(element);
            if (style.cursor === 'pointer') return true;
            
            // Fix #4: Check ancestor pointer-events, not just element itself
            if (this.hasPointerEventsNone(element)) return false;
            
            return false;
          }

          hasClickableParent(element, maxDepth = 5) {
            let current = element.parentElement;
            let depth = 0;
            
            while (current && depth < maxDepth) {
              const className = (current.className || '').toString();
              
              if (this.clickableClasses.some(cls => className.includes(cls))) {
                return true;
              }
              
              if (className.includes('rowSelectionEnabled') || 
                  className.includes('rowExpansionEnabled') ||
                  className.includes('dataRow')) {
                return true;
              }
              
              const testId = current.getAttribute('data-testid') || '';
              if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
                return true;
              }
              
              current = current.parentElement;
              depth++;
            }
            
            return false;
          }

          // Fix #2: Scoring function for hierarchical filtering
          scoreElement(element) {
            let score = 0;
            
            // Tag-based scoring
            const tagScores = {
              'button': 20,
              'input': 18,
              'select': 18,
              'textarea': 18,
              'a': 15,
              'label': 10,
              'div': 2,
              'span': 1,
              'svg': 1,
              'use': 0
            };
            
            const tag = element.tagName.toLowerCase();
            score += tagScores[tag] || 0;
            
            // Role-based scoring
            const role = element.getAttribute('role');
            if (role) {
              const roleScores = {
                'button': 20,
                'link': 15,
                'textbox': 18,
                'combobox': 18,
                'gridcell': 12,
                'menuitem': 10,
                'tab': 10
              };
              score += roleScores[role] || 5;
            }
            
            // Event handler bonus
            if (element.onclick || element.hasAttribute('onclick')) {
              score += 15;
            }
            
            // Framework handlers
            if (this.frameworkAttrs.some(attr => element.hasAttribute(attr))) {
              score += 12;
            }
            
            // Interactive attributes
            if (element.tabIndex >= 0) score += 8;
            if (element.draggable) score += 5;
            if (element.isContentEditable) score += 10;
            
            // ARIA states
            if (this.ariaStateAttrs.some(attr => element.hasAttribute(attr))) {
              score += 8;
            }
            
            // Text content (capped to prevent inflation)
            const textLength = (element.textContent || '').trim().length;
            score += Math.min(textLength, 50) * 0.1;
            
            // Semantic classes
            const className = (element.className || '').toString();
            if (this.clickableClasses.some(cls => className.includes(cls))) {
              score += 10;
            }
            
            // Penalty for likely decorative elements
            if (['svg', 'use', 'path', 'g'].includes(tag)) {
              score -= 5;
            }
            
            return Math.max(0, score);
          }

          // Fix #1: Event delegation detection
          hasEventDelegation(element) {
            let current = element.parentElement;
            let depth = 0;
            
            // Climb 5 ancestors looking for event delegation patterns
            while (current && depth < 5) {
              // Direct event handlers
              if (current.onclick) {
                return true;
              }
              
              // Common delegation attributes
              if (current.hasAttribute('data-action') || 
                  current.hasAttribute('data-click') ||
                  current.hasAttribute('data-handler')) {
                return true;
              }
              
              // ARIA popup indicators
              if (current.getAttribute('aria-haspopup')) {
                return true;
              }
              
              // React/Vue delegation patterns
              const className = (current.className || '').toString();
              if (className.includes('event-container') || 
                  className.includes('delegate') ||
                  className.includes('toolbar') ||
                  className.includes('menu') ||
                  className.includes('nav')) {
                return true;
              }
              
              // Table/grid delegation (common pattern)
              if (['table', 'tbody', 'thead', 'tr'].includes(current.tagName.toLowerCase()) ||
                  ['grid', 'list', 'table'].some(pattern => className.includes(pattern))) {
                return true;
              }
              
              current = current.parentElement;
              depth++;
            }
            
            return false;
          }

          // Fix #4: Check element and ancestors for pointer-events: none
          hasPointerEventsNone(element) {
            let current = element;
            let depth = 0;
            
            // Check element and up to 3 ancestors for pointer-events blocking
            while (current && depth < 4) {
              const style = window.getComputedStyle(current);
              if (style.pointerEvents === 'none') {
                return true;
              }
              
              current = current.parentElement;
              depth++;
            }
            
            return false;
          }

          isElementDisabledLive(element) {
            if (element.disabled) return true;
            if (element.getAttribute('disabled') !== null) return true;
            if (element.getAttribute('aria-disabled') === 'true') return true;
            if (element.readOnly) return true;
            if (element.inert) return true;
            
            const style = window.getComputedStyle(element);
            if (style.cursor === 'not-allowed' || style.cursor === 'disabled') return true;
            
            return false;
          }

          hasClickHandlersLive(element) {
            if (element.onclick || element.getAttribute('onclick')) return true;
            
            if (this.frameworkAttrs.some(attr => element.hasAttribute(attr))) return true;
            
            try {
              if (typeof getEventListeners === 'function') {
                const listeners = getEventListeners(element);
                const mouseEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
                return mouseEvents.some(event => listeners[event] && listeners[event].length > 0);
              }
            } catch (e) {
              const eventProps = ['onclick', 'onmousedown', 'onmouseup'];
              return eventProps.some(prop => typeof element[prop] === 'function');
            }
            
            return false;
          }

          isElementVisibleLive(element) {
            if (element.offsetWidth === 0 || element.offsetHeight === 0) return false;
            
            const style = window.getComputedStyle(element);
            if (style.display === 'none') return false;
            if (style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) === 0) return false;
            
            try {
              return element.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true
              });
            } catch (e) {
              return true;
            }
          }

          isElementSignificantLive(element) {
            const rect = element.getBoundingClientRect();
            const area = rect.width * rect.height;
            
            const alwaysInclude = ['button', 'input', 'select', 'textarea', 'a'];
            if (alwaysInclude.includes(element.tagName.toLowerCase())) {
              return true;
            }
            
            const testId = element.getAttribute('data-testid') || '';
            const className = (element.className || '').toString();
            if (testId === 'data-row' || className.includes('rowSelectionEnabled')) {
              return true;
            }
            
            return area >= 144;
          }

          extractTextLive(element) {
            if (element.textContent && element.textContent.trim()) {
              return element.textContent.trim();
            }
            
            return element.placeholder || element.title || element.alt || element.value || '';
          }

          getElementTypeLive(element) {
            const tag = element.tagName.toLowerCase();
            const type = element.getAttribute('type');
            const role = element.getAttribute('role');
            
            if (tag === 'button' || role === 'button') return 'button';
            if (tag === 'a') return 'link'; 
            if (tag === 'input') return type || 'input';
            if (tag === 'select') return 'select';
            if (tag === 'textarea') return 'textarea';
            if (element.isContentEditable) return 'contenteditable';
            
            return tag;
          }

          // Helper method to determine what action an element performs
          getElementAction(element) {
            // Check for specific action indicators
            const className = (element.className || '').toString().toLowerCase();
            const textContent = (element.textContent || '').trim().toLowerCase();
            const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
            const title = (element.getAttribute('title') || '').toLowerCase();
            
            // Button with specific text/action
            if (textContent) {
              if (textContent.includes('save')) return 'save';
              if (textContent.includes('cancel')) return 'cancel';
              if (textContent.includes('delete')) return 'delete';
              if (textContent.includes('edit')) return 'edit';
              if (textContent.includes('create')) return 'create';
              if (textContent.includes('add')) return 'add';
              if (textContent.includes('filter')) return 'filter';
              if (textContent.includes('sort')) return 'sort';
              if (textContent.includes('group')) return 'group';
              if (textContent.includes('color')) return 'color';
              if (textContent.includes('share')) return 'share';
              if (textContent.includes('view')) return 'view';
            }
            
            // Class-based actions
            if (className.includes('save')) return 'save';
            if (className.includes('cancel')) return 'cancel';
            if (className.includes('delete')) return 'delete';
            if (className.includes('edit')) return 'edit';
            
            // ARIA label actions
            if (ariaLabel.includes('save')) return 'save';
            if (ariaLabel.includes('cancel')) return 'cancel';
            
            // Form elements
            const tag = element.tagName.toLowerCase();
            if (tag === 'input') return 'input';
            if (tag === 'select') return 'select';
            if (tag === 'textarea') return 'textarea';
            
            // Links
            if (tag === 'a') return 'navigate';
            
            // Table cells and data elements (Airtable specific)
            if (className.includes('cell') || element.getAttribute('data-testid') === 'data-row') {
              return 'data-interaction';
            }
            
            return 'generic';
          }

          // Helper method to determine if child is more specific than parent
          isMoreSpecificThan(child, parent) {
            const childAction = this.getElementAction(child);
            const parentAction = this.getElementAction(parent);
            
            // Child with specific action is more specific than generic parent
            if (childAction !== 'generic' && parentAction === 'generic') {
              return true;
            }
            
            // Form elements are more specific than their containers
            const childTag = child.tagName.toLowerCase();
            const parentTag = parent.tagName.toLowerCase();
            
            if (['input', 'select', 'textarea', 'button'].includes(childTag) && 
                ['div', 'span', 'section', 'form'].includes(parentTag)) {
              return true;
            }
            
            // Elements with specific roles are more specific
            const childRole = child.getAttribute('role');
            const parentRole = parent.getAttribute('role');
            
            if (childRole && ['button', 'link', 'textbox'].includes(childRole) && 
                (!parentRole || parentRole === 'generic')) {
              return true;
            }
            
            return false;
          }
        };
        
        const filter = new ActionableFilter();
        return filter.filterWithLiveTraversal({
          visible: true,
          viewport: true,
          max_rows: config.maxElements > 0 ? config.maxElements : 200
        });
        
      }, { maxElements, includeBoxes: includeBoxes || includeScreenshotUrl });

      // Add new element detection (Browser-Use parity)
      const tabId = `${page._workflowId}-${tabName}`;
      const previousElements = this.previousElementCache.get(tabId) || new Set();
      const currentElements = new Set();
      
      // Enhance elements with optional data and new element detection
      const enhancedElements = actionableResult.elements.map(element => {
        const enhanced = { ...element };
        
        // Create element signature for new element detection
        const elementSignature = `${element.tag}-${element.type}-${element.text}`;
        currentElements.add(elementSignature);
        
        // Check if this is a new element (Browser-Use parity)
        if (!previousElements.has(elementSignature)) {
          enhanced.isNew = true;
        }
        
        // Bounds are now handled in browser context if includeBoxes was requested
        return enhanced;
      });
      
      // Update the cache for next time
      this.previousElementCache.set(tabId, currentElements);

      // Handle screenshot URL if requested (deprecated - use includeBoxes instead)
      let screenshotUrl = null;
      if (includeScreenshotUrl) {
        // Generate a temp file path for the screenshot
        const tempFileName = `dom_actionable_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
        const tempPath = `/tmp/${tempFileName}`;
        
        try {
          const screenshot = await this.captureScreenshotWithHighlights(page, actionableResult.elements, snapshot);
          // In a production system, you would upload this to S3/CDN and return the URL
          // For now, we'll save to temp and provide a file path
          const fs = await import('fs');
          await fs.promises.writeFile(tempPath, screenshot);
          screenshotUrl = `file://${tempPath}`;
          
          // Clean up after 5 minutes
          setTimeout(() => {
            fs.promises.unlink(tempPath).catch(() => {});
          }, 5 * 60 * 1000);
        } catch (error) {
          console.warn('[DOMToolkit] Screenshot capture failed:', error.message);
        }
      }

      return {
        success: true,
        snapshotId: snapshot.id,
        tabName,
        url: await page.url(),
        elements: enhancedElements,
        total: actionableResult.total,
        truncated: actionableResult.truncated,
        screenshot_url: screenshotUrl
      };
    } catch (error) {
      console.error('[DOMToolkit] Error in domActionable:', error);
      return {
        success: false,
        error: error.message,
        tabName
      };
    }
  }


  /**
   * Capture screenshot with numbered highlights for actionable elements
   */
  async captureScreenshotWithHighlights(page, elements, snapshot) {
    try {
      // Inject highlight overlays using bounds data (more reliable than DOM matching)
      const debugResults = await page.evaluate((elementsData) => {
        console.log('[DEBUG] Elements data received:', elementsData);
        
        // Remove any existing highlights
        const existingContainer = document.getElementById('director-highlight-container');
        if (existingContainer) existingContainer.remove();
        
        const container = document.createElement('div');
        container.id = 'director-highlight-container';
        container.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 2147483647; background: transparent;
        `;
        
        const colors = [
          '#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080',
          '#008080', '#FF69B4', '#4B0082', '#FF4500', '#2E8B57'
        ];
        
        const debugInfo = {
          elementsReceived: elementsData.length,
          overlaysCreated: 0,
          elementsWithoutBounds: 0
        };
        
        elementsData.forEach((element, index) => {
          console.log(`[DEBUG] Processing element ${index}:`, element);
          
          // Use bounds if available, otherwise try to calculate
          let rect;
          if (element.bounds) {
            // Use pre-calculated bounds [x, y, width, height]
            rect = {
              left: element.bounds[0],
              top: element.bounds[1], 
              width: element.bounds[2],
              height: element.bounds[3]
            };
            console.log(`[DEBUG] Using pre-calculated bounds for element ${index}:`, rect);
          } else {
            // Fallback: try to find element by tag and text matching
            console.log(`[DEBUG] No bounds for element ${index}, trying DOM matching`);
            const candidates = document.querySelectorAll(element.tag);
            let targetElement = null;
            
            for (const el of candidates) {
              const elText = (el.textContent || '').trim().substring(0, 50);
              if (elText === element.text || (!element.text && el.tagName.toLowerCase() === element.tag)) {
                targetElement = el;
                break;
              }
            }
            
            if (!targetElement) {
              console.log(`[DEBUG] Element ${index} not found in DOM`);
              debugInfo.elementsWithoutBounds++;
              return;
            }
            
            const domRect = targetElement.getBoundingClientRect();
            rect = {
              left: domRect.left,
              top: domRect.top,
              width: domRect.width,
              height: domRect.height
            };
          }
          
          if (rect.width === 0 || rect.height === 0) {
            console.log(`[DEBUG] Element ${index} has zero size`);
            return;
          }
          
          const color = colors[index % colors.length];
          
          // Create overlay
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: fixed; border: 3px solid ${color}; background: ${color}33;
            box-sizing: border-box; top: ${rect.top}px; left: ${rect.left}px;
            width: ${rect.width}px; height: ${rect.height}px;
          `;
          
          // Create label  
          const label = document.createElement('div');
          label.style.cssText = `
            position: fixed; background: ${color}; color: white;
            padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;
            top: ${rect.top - 20}px; left: ${rect.left}px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            min-width: 20px; text-align: center;
          `;
          label.textContent = element.id.replace(/[\[\]]/g, ''); // Remove brackets from [1], [2], etc.
          
          container.appendChild(overlay);
          container.appendChild(label);
          debugInfo.overlaysCreated++;
          
          console.log(`[DEBUG] Created overlay ${index} for element:`, {
            id: element.id,
            tag: element.tag,
            text: element.text,
            rect: rect,
            color: color
          });
        });
        
        document.body.appendChild(container);
        console.log('[DEBUG] Final debug info:', debugInfo);
        return debugInfo;
      }, elements);
      
      console.log('[DOM Toolkit] Screenshot debug results:', debugResults);
      
      // Wait a moment for rendering
      await page.waitForTimeout(100);
      
      // Capture screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false // Viewport only for performance
      });
      
      // Clean up highlights
      await page.evaluate(() => {
        const container = document.getElementById('director-highlight-container');
        if (container) container.remove();
      });
      
      return screenshot;
    } catch (error) {
      console.error('[DOMToolkit] Screenshot capture failed:', error);
      // Clean up on error
      try {
        await page.evaluate(() => {
          const container = document.getElementById('director-highlight-container');
          if (container) container.remove();
        });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      return null;
    }
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
# DOM Toolkit Implementation Plan

## Integration Strategy

### 1. Directory Structure
Create a clean, separate module under `backend/dom-toolkit/`:

```
backend/
├── dom-toolkit/                       # NEW: Our clean DOM exploration toolkit
│   ├── index.js                      # Main exports and API
│   ├── core/
│   │   ├── domCapture.js            # CDP snapshot capture logic
│   │   ├── domCache.js              # Caching with mutation observer
│   │   └── domSnapshot.js           # Snapshot data structure
│   ├── filters/
│   │   ├── outlineFilter.js         # Structure extraction (depth ≤ 2)
│   │   ├── interactivesFilter.js    # Clickable/typeable elements
│   │   ├── headingsFilter.js        # Text content extraction
│   │   └── filterUtils.js           # Shared filtering logic
│   ├── processors/
│   │   ├── groupingProcessor.js     # "N similar" element detection
│   │   ├── selectorHints.js         # Generate selector suggestions
│   │   └── attributeCompressor.js   # Truncate long attributes
│   └── formatters/
│       ├── tokenFormatter.js         # Token-efficient output
│       └── responseBuilder.js        # Build final response
├── tools/
│   └── domExplorationTools.js        # NEW: Tool definitions for Director
└── services/
    └── domToolkitService.js          # NEW: Service wrapper for integration

```

### 2. Integration Points

#### A. Tool Registration
Add new tools to Director without modifying existing inspect_tab:
```javascript
// In toolDefinitions.js
import { createDOMExplorationTools } from './domExplorationTools.js';

// Add to existing tools array
...existingTools,
...createDOMExplorationTools()
```

#### B. Browser Access
Reuse existing browser management:
```javascript
// In domToolkitService.js
import BrowserStateService from './browserStateService.js';

class DOMToolkitService {
  constructor() {
    this.browserStateService = new BrowserStateService();
    this.domCapture = new DOMCapture();
  }
  
  async getPageForTab(workflowId, tabName) {
    // Leverage existing browser state management
    const state = await this.browserStateService.getBrowserState(workflowId);
    // ... get page instance
  }
}
```

#### C. Keep Separate from Existing
- Don't modify `tabInspectionService.js` 
- Don't touch existing DOM snapshot functionality
- Create parallel, optimized implementation

### 3. Implementation Order

#### Phase 1: Core Infrastructure (High Priority)
1. **Create directory structure** ✓
2. **Implement domCapture.js** - CDP snapshot with single call
3. **Implement domCache.js** - 30s cache with mutation observer
4. **Create basic filters** - Get outline working first

#### Phase 2: Filtering & Processing 
5. **Build interactivesFilter.js** - With ARIA role support
6. **Implement groupingProcessor.js** - "N similar" detection
7. **Add selectorHints.js** - Multiple selector generation
8. **Create attributeCompressor.js** - Truncation logic

#### Phase 3: Integration
9. **Build domToolkitService.js** - Service wrapper
10. **Create domExplorationTools.js** - Tool definitions
11. **Wire into toolDefinitions.js** - Make available to Director

#### Phase 4: Polish & Test
12. **Add comprehensive error handling**
13. **Test with various page types**
14. **Performance optimization**

### 4. Key Implementation Details

#### DOM Capture (domCapture.js)
```javascript
class DOMCapture {
  async captureSnapshot(page) {
    const client = await page.context().newCDPSession(page);
    
    // Single CDP call for efficiency
    const snapshot = await client.send('DOMSnapshot.captureSnapshot', {
      computedStyles: ['visibility', 'display', 'opacity'],
      includePaintOrder: true,
      includeDOMRects: true,
      includeTextColorOpacities: false,
      includeBlendedBackgroundColors: false
    });
    
    return this.processSnapshot(snapshot);
  }
}
```

#### Cache Management (domCache.js)
```javascript
class DOMCache {
  constructor() {
    this.cache = new Map(); // workflowId-tabName -> snapshot
    this.mutationThreshold = 300;
  }
  
  setupMutationObserver(page, cacheKey) {
    await page.evaluateOnNewDocument((threshold) => {
      let mutationCount = 0;
      const observer = new MutationObserver((mutations) => {
        mutationCount += mutations.length;
        if (mutationCount > threshold) {
          window.__dom_cache_invalid = true;
        }
      });
      observer.observe(document, { 
        childList: true, 
        subtree: true,
        attributes: true 
      });
    }, this.mutationThreshold);
  }
}
```

#### Grouping Algorithm (groupingProcessor.js)
```javascript
function detectSimilarElements(elements) {
  const groups = new Map();
  
  elements.forEach((elem, idx) => {
    if (elem.grouped) return;
    
    const key = generateGroupKey(elem);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ elem, idx });
  });
  
  // Convert groups to "N similar" format
  return processGroups(groups);
}

function generateGroupKey(elem) {
  // Group by: parent + tag + sorted selector hints
  return `${elem.parentId}:${elem.tag}:${elem.selectorHints.sort().join('|')}`;
}
```

### 5. Migration Path

1. **Phase 1**: Build alongside existing system
2. **Phase 2**: Director starts using new tools
3. **Phase 3**: Deprecate old inspect_tab for DOM exploration
4. **Phase 4**: Keep both systems until fully validated

### 6. Success Metrics

- [ ] dom_overview returns in <100ms
- [ ] Response under 300 tokens for typical pages
- [ ] Handles Gmail, Airtable, GitHub without issues
- [ ] Director successfully builds workflows using element IDs
- [ ] No interference with existing functionality

### 7. Next Steps

1. Create the directory structure
2. Start with domCapture.js implementation
3. Build filters incrementally
4. Test with Director on simple pages first
# Smart Waits Implementation Plan for Director 2.0

## Executive Summary

This document outlines the implementation plan for integrating intelligent wait mechanisms into the Director 2.0 system, eliminating brittle hardcoded delays in favor of deterministic, condition-based synchronization.

**Goal**: Enable the Director to build workflows that wait exactly as long as necessary - no more, no less - by detecting and responding to actual page states rather than arbitrary timeouts.

## Current State Analysis

### Existing Implementation
- **Wait Support**: Only `wait` action with hardcoded `duration` in milliseconds
- **Playwright Integration**: Full Playwright API available but underutilized
- **Node Execution**: Clear action handlers in `nodeExecutor.js`
- **Validation**: Robust validation system but no wait integration
- **Scout**: No timing or wait pattern detection capabilities

### Pain Points
- Workflows fail due to timing variations
- Hardcoded waits either too short (failures) or too long (slow execution)
- No visibility into why waits are needed
- Director lacks guidance on optimal wait strategies

## Implementation Strategy

### Core Approach: Three-Pronged Integration

1. **Embedded Wait Options** - Add `waitAfter` to existing browser actions
2. **Enhanced Wait Action** - Upgrade standalone wait with smart capabilities  
3. **Scout Intelligence** - Detect and report wait requirements during reconnaissance

### Design Philosophy
- **Deterministic by Default**: Prefer element-based waits over time-based
- **Progressive Enhancement**: Don't break existing workflows
- **Explicit Intent**: Make wait reasons self-documenting
- **Fail Fast**: Clear timeout errors instead of silent failures

## Detailed Implementation

### 1. Enhanced Browser Action Schema

Add `waitAfter` configuration to all browser_action nodes:

```javascript
{
  type: "browser_action",
  config: {
    action: "click",
    selector: "#submit",
    waitAfter: {
      for: "network_idle",    // Wait strategy
      timeout: 15000,         // Override default timeout
      description: "Wait for form submission API call"
    }
  }
}
```

#### Wait Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `load` | Wait for page load event | Navigation, page refreshes |
| `network_idle` | Wait for network to settle | API calls, AJAX updates |
| `selector` | Wait for element to appear/disappear | Dynamic content |
| `function` | Wait for custom JS condition | Complex state checks |
| `response` | Wait for specific network response | API-driven updates |
| `stability` | Wait for element to stop moving | Animations, transitions |

### 2. Code Implementation

#### A. Smart Wait Execution Method (nodeExecutor.js)

```javascript
async executeSmartWait(page, waitConfig) {
  const startTime = Date.now();
  const { 
    for: waitFor, 
    selector, 
    timeout = 10000, 
    state = 'visible',
    description = `Waiting for ${waitFor}`
  } = waitConfig;
  
  console.log(`[SMART_WAIT] ${description}`);
  
  try {
    switch (waitFor) {
      case 'load':
        await page.waitForLoadState('load', { timeout });
        break;
        
      case 'network_idle':
        // Wait for no network activity for 500ms
        await page.waitForLoadState('networkidle', { timeout });
        break;
        
      case 'selector':
        if (!selector) throw new Error('selector wait requires selector parameter');
        await page.waitForSelector(selector, { state, timeout });
        break;
        
      case 'function':
        if (!waitConfig.script) throw new Error('function wait requires script parameter');
        await page.waitForFunction(waitConfig.script, { timeout });
        break;
        
      case 'response':
        if (!waitConfig.urlPattern) throw new Error('response wait requires urlPattern parameter');
        await page.waitForResponse(
          response => {
            const matchesUrl = response.url().match(new RegExp(waitConfig.urlPattern));
            const matchesStatus = response.status() === (waitConfig.status || 200);
            return matchesUrl && matchesStatus;
          },
          { timeout }
        );
        break;
        
      case 'stability':
        // Custom implementation - wait for element to stop moving
        if (!selector) throw new Error('stability wait requires selector parameter');
        await this.waitForElementStability(page, selector, timeout);
        break;
        
      default:
        throw new Error(`Unknown wait strategy: ${waitFor}`);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[SMART_WAIT] Completed in ${elapsed}ms: ${description}`);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[SMART_WAIT] Failed after ${elapsed}ms: ${description}`);
    throw new Error(`Wait timeout: ${description} - ${error.message}`);
  }
}

async waitForElementStability(page, selector, timeout) {
  // Wait for element to exist first
  await page.waitForSelector(selector, { timeout: timeout / 2 });
  
  // Then wait for it to stop moving
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      
      let previousPos = element.getBoundingClientRect();
      
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          const currentPos = element.getBoundingClientRect();
          const moved = 
            Math.abs(currentPos.top - previousPos.top) > 1 ||
            Math.abs(currentPos.left - previousPos.left) > 1;
          
          if (!moved) {
            clearInterval(checkInterval);
            resolve(true);
          }
          previousPos = currentPos;
        }, 100);
      });
    },
    selector,
    { timeout: timeout / 2 }
  );
}
```

#### B. Integration with Existing Actions

```javascript
case 'navigate':
  const navigatePage = await getActiveStagehandPage();
  await navigatePage.goto(config.url);
  
  // Apply default or custom wait
  const defaultNavigateWait = { for: 'load', description: 'Wait for page load' };
  await this.executeSmartWait(navigatePage, config.waitAfter || defaultNavigateWait);
  
  await this.updateBrowserStateInDB();
  return { navigated: config.url };

case 'click':
  // ... existing click logic ...
  
  if (clicked && config.waitAfter) {
    await this.executeSmartWait(activePage, config.waitAfter);
  }
  
  return { clicked: config.selector };

case 'type':
  // ... existing type logic ...
  
  if (typed && config.waitAfter) {
    await this.executeSmartWait(activePage, config.waitAfter);
  }
  
  return { typed: textToType };

case 'wait':
  const waitPage = await getActiveStagehandPage();
  
  // Support legacy duration-based wait
  if (config.duration) {
    await waitPage.waitForTimeout(config.duration);
    return { waited: `${config.duration}ms` };
  }
  
  // New smart wait
  await this.executeSmartWait(waitPage, config);
  return { 
    waited: config.description || `${config.for} strategy` 
  };
```

### 3. Scout Enhancement

Update Scout to detect and report wait requirements:

```javascript
// Add to Scout system prompt
TIMING & WAIT PATTERN DETECTION:

When exploring pages, actively identify:
1. Loading indicators (spinners, progress bars, "Loading..." text)
2. Dynamic content areas that populate after initial load
3. API-driven updates (watch for XHR/fetch in Network tab)
4. Animation or transition timings
5. Multi-step loading sequences

For each interaction, note:
- What changes immediately vs. what loads asynchronously
- Specific selectors for "ready" states
- Network patterns that indicate completion
- Recommended wait strategies with rationale

Example findings:
"After clicking #searchButton:
- Spinner appears at .loading-overlay (immediate)
- Results populate in .search-results after 1-2 seconds
- Network: POST to /api/search returns before UI updates
- Recommended: waitAfter: {for: 'selector', selector: '.search-results', state: 'visible'}"
```

### 4. Director Prompt Enhancement

Add comprehensive smart wait documentation to the Director's system prompt:

```javascript
## Smart Wait Strategies

Replace brittle time-based waits with intelligent condition-based synchronization.

### Configuration Schema
Every browser_action can include waitAfter:

{
  waitAfter: {
    for: "load" | "network_idle" | "selector" | "function" | "response" | "stability",
    selector?: string,      // Required for 'selector' and 'stability'
    state?: "visible" | "attached" | "hidden" | "detached",  // Default: "visible"
    timeout?: number,       // Milliseconds, default: 10000
    urlPattern?: string,    // Required for 'response' (regex pattern)
    status?: number,        // HTTP status for 'response', default: 200
    script?: string,        // JavaScript for 'function' wait
    description?: string    // Human-readable explanation
  }
}

### Default Behaviors
- navigate: Automatically applies {for: "load"} unless overridden
- click: No default wait (add explicitly for dynamic content)
- type: No default wait (add for validation messages)

### Common Patterns

1. **Wait for Dynamic Content**
{
  action: "click",
  selector: "#loadMore",
  waitAfter: {
    for: "selector",
    selector: ".new-content",
    description: "Wait for additional items to load"
  }
}

2. **Wait for API Response**
{
  action: "click", 
  selector: "#searchButton",
  waitAfter: {
    for: "response",
    urlPattern: ".*/api/search.*",
    status: 200,
    description: "Wait for search API to return results"
  }
}

3. **Wait for Animation**
{
  action: "click",
  selector: "#expandPanel",
  waitAfter: {
    for: "stability",
    selector: ".panel-content",
    description: "Wait for panel expansion animation"
  }
}

4. **Complex State Check**
{
  action: "type",
  selector: "#username",
  text: "{{credentials.username}}",
  waitAfter: {
    for: "function",
    script: "document.querySelector('.validation-message')?.innerText.includes('Available')",
    timeout: 5000,
    description: "Wait for username availability check"
  }
}

### Best Practices
1. Use Scout to identify wait requirements before building
2. Prefer deterministic waits (selector, response) over time-based
3. Add descriptions to document why each wait exists
4. Set reasonable timeouts - not too short (flaky) or long (slow)
5. Chain waits when dealing with multi-step loading
```

## Outstanding Design Decisions

### 1. Composite Group Implementation

**Question**: Should we create pre-built groups with optimal wait strategies?

**Options**:
- **Option A**: Create standard groups (`smart_login`, `smart_form_submit`)
- **Option B**: Let patterns emerge organically from usage
- **Option C**: Hybrid - start simple, formalize common patterns later

**Recommendation**: Option C - Start with basic smart waits, then identify and package common patterns after real-world usage.

**Example Future Group**:
```javascript
{
  type: "group",
  config: {
    id: "smart_form_submit",
    params: {
      submitSelector: "#submit",
      successSelector: ".success-message",
      errorSelector: ".error-message"
    }
  }
}
// Would expand to: click → wait for response → wait for success/error selector
```

### 2. Validation Integration

**Question**: Should validation nodes automatically wait before checking?

**Options**:
- **Option A**: Add optional `waitBefore` to validation nodes
- **Option B**: Require explicit wait nodes before validation
- **Option C**: Smart default based on validation type

**Recommendation**: Option A - Add optional `waitBefore` with same schema as `waitAfter`. This maintains explicit control while reducing node count.

```javascript
{
  type: "browser_query",
  config: {
    method: "validate",
    waitBefore: {
      for: "network_idle",
      description: "Let page settle before validation"
    },
    rules: [...]
  }
}
```

### 3. Error Handling & Reporting

**Question**: How should we surface wait timeouts vs. selector failures?

**Proposal**:
- Create distinct error types: `WaitTimeoutError` vs `SelectorNotFoundError`
- Include wait strategy and elapsed time in error messages
- Log wait attempts at INFO level, failures at ERROR
- Surface common timeout patterns to Director for learning

**Error Message Format**:
```
WaitTimeoutError: Wait for network_idle exceeded 15000ms timeout
- Context: After clicking #submit
- Description: Wait for form submission API call
- Suggestion: Consider increasing timeout or checking if action actually triggered
```

### 4. Performance Metrics

**Question**: Should we track wait times for optimization?

**Proposal**: Yes, implement lightweight tracking:
- Store wait durations in workflow execution metadata
- Track which wait strategies are used most
- Identify consistently slow operations
- Surface insights to Director: "This wait averages 8s, consider optimization"

**Implementation**:
```javascript
// In executeSmartWait
const waitMetrics = {
  strategy: waitFor,
  duration: elapsed,
  success: true,
  selector: selector || null,
  description: description
};

// Store with node execution result
await this.storeWaitMetrics(nodeId, workflowId, waitMetrics);
```

## Implementation Timeline

### Phase 1: Core Infrastructure (Day 1)
- [ ] Implement `executeSmartWait` method with all strategies
- [ ] Add `waitForElementStability` helper
- [ ] Update `wait` action to support smart waits
- [ ] Comprehensive error handling

### Phase 2: Action Integration (Day 2)
- [ ] Add `waitAfter` to navigate, click, type actions
- [ ] Implement default wait behaviors
- [ ] Ensure backward compatibility
- [ ] Update node execution logging

### Phase 3: Scout Enhancement (Day 3)
- [ ] Update Scout system prompt with timing detection
- [ ] Add wait recommendation logic
- [ ] Test Scout's ability to identify wait patterns
- [ ] Create Scout reporting format for wait requirements

### Phase 4: Director Training (Day 4)
- [ ] Update Director system prompt with smart wait documentation
- [ ] Create comprehensive examples
- [ ] Add best practices guide
- [ ] Test Director's usage of smart waits

### Phase 5: Advanced Features (Day 5)
- [ ] Implement validation `waitBefore`
- [ ] Add performance metrics collection
- [ ] Create wait timeout error differentiation
- [ ] Initial composite group designs

## Success Metrics

1. **Reliability**: 90%+ reduction in timing-related failures
2. **Performance**: Average 30% faster execution (no excessive waits)
3. **Clarity**: 100% of waits have clear descriptions
4. **Adoption**: Director uses smart waits in 80%+ of new workflows

## Risk Mitigation

1. **Backward Compatibility**: All changes are additive, existing workflows continue to function
2. **Timeout Tuning**: Start with generous defaults (10s), optimize based on metrics
3. **Debugging**: Enhanced logging makes wait behavior transparent
4. **Rollback Plan**: Feature flag to disable smart waits if issues arise

## Conclusion

Smart waits represent a fundamental improvement in workflow reliability. By replacing brittle time-based delays with intelligent condition-based synchronization, we enable the Director to build automations that are both faster and more reliable. The phased implementation ensures we can deliver value incrementally while maintaining system stability.

Next steps: Begin Phase 1 implementation with core infrastructure.
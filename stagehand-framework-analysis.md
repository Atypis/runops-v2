# Stagehand Framework Analysis

## Executive Summary

Stagehand is an AI-powered browser automation framework developed by Browserbase that takes a fundamentally different approach from Browser-Use. While Browser-Use focuses on autonomous AI agents for browser control, Stagehand emphasizes **deterministic workflows with strategic AI infusion** - allowing developers to choose when to use code vs. natural language.

## 1. Core Architecture & Philosophy

### 1.1 Hybrid Approach: Code + AI
Stagehand's key innovation is letting developers seamlessly mix Playwright code with AI-powered actions:

```typescript
// Use Playwright functions directly
await page.goto("https://github.com/browserbase");

// Use AI when dealing with dynamic/unfamiliar content
await page.act("click on the stagehand repo");

// Back to deterministic code
const url = page.url();
```

This contrasts with Browser-Use's agent-first approach where AI drives the entire interaction flow.

### 1.2 Deterministic Workflows with AI Infusion
Stagehand treats AI as a tool for specific challenges rather than the primary driver:
- **Deterministic by default**: Use Playwright for predictable actions
- **AI for flexibility**: Handle dynamic content, changing UIs, or natural language instructions
- **Caching & replay**: AI actions can be cached and replayed deterministically

## 2. DOM Processing: Accessibility Tree vs. Visual Elements

### 2.1 Stagehand's Accessibility Tree Approach

Stagehand primarily uses Chrome's **Accessibility Tree** for DOM representation:

```typescript
// From a11y/utils.ts
export async function getAccessibilityTree(page: StagehandPage): Promise<TreeResult> {
  const { nodes } = await page.sendCDP("Accessibility.getFullAXTree");
  
  // Build hierarchical tree from flat accessibility nodes
  const hierarchicalTree = await buildHierarchicalTree(nodes);
  
  return {
    tree: finalTree,
    simplified: simplifiedFormat,  // Text representation for LLM
    idToUrl: idToUrl,
    xpathMap: xpathMap
  };
}
```

**Key characteristics:**
- Uses Chrome DevTools Protocol (CDP) for accessibility data
- Builds a semantic hierarchy from flat nodes
- Filters out generic/structural nodes
- Maps accessibility nodes to DOM elements via `backendNodeId`

**Example output format:**
```
[100] button: Submit Form
  [101] StaticText: Submit
[102] link: View Documentation
  [103] StaticText: Docs
[104] textbox: Enter your name
```

### 2.2 Browser-Use's Visual Element Detection

Browser-Use uses a **visual element detection** approach:

```javascript
// From buildDomTree.js
function buildDomTree(node, parentIframe = null, isParentHighlighted = false) {
  // Check visibility using getBoundingClientRect
  const rect = getCachedBoundingRect(node);
  
  // Check if element is interactive based on:
  // - Tag name (button, input, etc.)
  // - Cursor style (pointer, etc.)
  // - Event listeners
  // - ARIA attributes
  
  // Build visual highlight overlays
  if (doHighlightElements) {
    highlightElement(node, index, parentIframe);
  }
}
```

**Key characteristics:**
- Direct DOM traversal with visual checks
- Creates visual highlight overlays for each interactive element
- Uses `getBoundingClientRect()` and `getClientRects()` for positioning
- Checks cursor styles and event listeners for interactivity

### 2.3 Key Differences in DOM Processing

| Aspect | Stagehand | Browser-Use |
|--------|-----------|-------------|
| **Primary Source** | Accessibility Tree (CDP) | DOM Tree |
| **Node Identification** | Backend node IDs + XPath | Visual indexes + XPath |
| **Representation** | Semantic roles (button, link) | HTML elements with highlights |
| **Viewport Handling** | Processes full tree | Chunks by viewport |
| **Text Extraction** | From accessibility names | From DOM text nodes |
| **Performance** | Single CDP call | Recursive DOM traversal |

## 3. Agent Architecture: Operators vs. Autonomous Agents

### 3.1 Stagehand's Operator Pattern

Stagehand implements "Open Operator" - a sequential tool-calling approach:

```typescript
// From operatorHandler.ts
class StagehandOperatorHandler {
  async execute(options: AgentExecuteOptions): Promise<AgentResult> {
    while (!completed && currentStep < maxSteps) {
      // 1. Take screenshot
      const screenshot = await page.screenshot();
      
      // 2. Send to LLM with current state
      const result = await this.getNextStep(currentStep);
      
      // 3. Execute action
      if (result.method === "act") {
        const [action] = await page.observe(result.parameters);
        await page.act(action);
      }
      
      // 4. Check if task is complete
      if (result.taskComplete) completed = true;
    }
  }
}
```

**Operator flow:**
1. Examine current page state (screenshot + URL)
2. Decide next action using LLM
3. Execute single atomic action
4. Repeat until goal achieved

### 3.2 Browser-Use's Autonomous Agent

Browser-Use implements a more autonomous agent with memory and state management:

```python
# Browser-Use agent pattern
class Agent:
    def __init__(self, task, llm, browser):
        self.memory = MemoryService()
        self.message_manager = MessageManager()
        
    async def run(self):
        while not self.done:
            # Get current state
            state = await self.browser.get_state()
            
            # Add to message history
            self.message_manager.add_state_message(state)
            
            # Get LLM decision with full context
            action = await self.llm.get_next_action(
                self.message_manager.get_messages()
            )
            
            # Execute and update state
            await self.controller.execute_action(action)
```

### 3.3 Key Agent Differences

| Feature | Stagehand Operator | Browser-Use Agent |
|---------|-------------------|-------------------|
| **Decision Making** | Step-by-step with screenshots | Full conversation history |
| **Action Granularity** | Single atomic actions | Complex multi-step actions |
| **State Management** | Minimal (action history) | Full memory service |
| **LLM Integration** | Structured tool calls | Conversational messages |
| **Replay Support** | Built-in action caching | Through message history |

## 4. Computer Use Model Integration

Stagehand provides first-class support for computer use models:

```typescript
// One-line integration
const agent = stagehand.agent({
  provider: "openai",
  model: "computer-use-preview"
});

await agent.execute("Extract the top contributor's username");
```

This abstracts away the complexity of:
- Screenshot capture and encoding
- Coordinate system translation
- Action execution from model outputs

## 5. Action Execution & Caching

### 5.1 Three-Stage Action Pattern

Stagehand's unique `observe` → `act` pattern:

```typescript
// 1. Observe: Get action details without executing
const [action] = await page.observe("click the submit button");
// Returns: { selector: "//button[@id='submit']", method: "click", args: [] }

// 2. Cache/validate the action
cache.set("submit_action", action);

// 3. Act: Execute the cached action
await page.act(action);
```

### 5.2 Self-Healing Capabilities

When cached actions fail, Stagehand can fall back to AI:
```typescript
try {
  await page.act(cachedAction); // Try Playwright selector first
} catch {
  await page.act("click the submit button"); // Fall back to AI
}
```

## 6. Practical Implementation Differences

### 6.1 Task Complexity

**Stagehand excels at:**
- Workflows with known structure
- Mixing deterministic and dynamic steps
- Caching and replaying actions
- Single-page focused tasks

**Browser-Use excels at:**
- Fully autonomous exploration
- Complex multi-page workflows
- Tasks requiring memory/context
- Adaptive behavior based on history

### 6.2 Development Experience

**Stagehand:**
```typescript
// Clear separation of concerns
await page.goto("https://example.com");     // Deterministic
await page.act("accept cookies");            // AI-powered
await page.fill("#email", "test@test.com"); // Deterministic
await page.act("submit the form");           // AI-powered
```

**Browser-Use:**
```python
# Fully autonomous
agent = Agent("Book a flight to Paris next week")
await agent.run()  # Handles entire workflow
```

## 7. Performance Considerations

### Stagehand Optimizations:
- Single CDP call for accessibility tree
- Built-in action caching
- Minimal LLM calls through `observe` pattern
- XPath selector generation for reliability

### Browser-Use Optimizations:
- DOM caching with WeakMaps
- Viewport-based chunking
- Visual highlight reuse
- Performance metrics in debug mode

## 8. Key Takeaways

1. **Philosophy**: Stagehand = "Deterministic with AI superpowers", Browser-Use = "AI-first autonomous agents"

2. **DOM Processing**: Stagehand uses semantic accessibility tree, Browser-Use uses visual DOM detection

3. **Agent Pattern**: Stagehand uses sequential operators, Browser-Use uses conversational agents

4. **Developer Control**: Stagehand offers fine-grained control, Browser-Use offers high-level automation

5. **Use Cases**: 
   - Choose Stagehand for production workflows needing reliability
   - Choose Browser-Use for exploratory automation and complex autonomous tasks

## 9. Open Operator Reference

The test harness references Open Operator extensively. This is Stagehand's approach to browser automation that:
- Takes screenshots at each step
- Uses structured LLM responses for actions
- Executes one action at a time
- Maintains minimal state between steps

This pattern enables reliable, debuggable browser automation while leveraging AI only where needed.
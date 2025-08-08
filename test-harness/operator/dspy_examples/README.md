# DSPy Scout Implementation Examples

This directory contains practical examples showing how to implement Scout functionality using DSPy for the Director 2.0 system.

## Overview

Scout is a lightweight reconnaissance agent that explores web pages efficiently using tool calls within reasoning chains. These examples demonstrate how to:

1. Set up DSPy with Claude/Anthropic (matching Director's configuration)
2. Create a Scout module with proper signatures
3. Integrate with browser exploration tasks
4. Show the node creation workflow

## Files

### 1. `scout_implementation.py`
Basic Scout implementation showing:
- DSPy configuration with Claude
- Tool function definitions (inspect_tab, expand_dom_selector, etc.)
- Scout agent using DSPy's ReAct pattern
- Node generation from Scout findings
- Optimization example with DSPy's BootstrapFewShot

### 2. `advanced_scout_browser.py`
Advanced implementation with browser integration:
- Async Scout with actual browser controller mock
- Complete tool implementations with caching
- Director integration example
- Full workflow from reconnaissance to node generation

## Key Concepts

### 1. DSPy Configuration
```python
claude_lm = dspy.LM(
    model="claude-3-5-sonnet-20241022",  # Same as Director
    api_key="YOUR_ANTHROPIC_API_KEY",
    temperature=0.7
)
dspy.configure(lm=claude_lm)
```

### 2. Scout Agent Architecture
Scout uses DSPy's ReAct pattern for tool-using agents:
```python
self.react = dspy.ReAct(
    signature=scout_signature,
    tools=self.tools,
    max_iters=self.max_steps
)
```

### 3. Tool Integration
Tools are defined as functions that Scout can call:
- `inspect_tab`: Get DOM snapshot
- `expand_dom_selector`: Get detailed selector info
- `debug_navigate`: Navigate to URLs
- `debug_click`: Click elements

### 4. Node Generation
Scout's findings are translated into actionable nodes:
```python
SuggestedNode(
    type=NodeType.FORM_INTERACTION,
    description="Enter email in login form",
    selectors=["#email-input", "input[name='email']"],
    parameters={"text": "user@example.com"},
    confidence=0.9
)
```

## Running the Examples

### Basic Example
```bash
python scout_implementation.py
```

This will:
1. Deploy Scout on a reconnaissance mission
2. Show findings and suggested nodes
3. Demonstrate optimization workflow

### Advanced Example
```bash
python advanced_scout_browser.py
```

This will:
1. Create a mock browser environment
2. Execute a full Director workflow with Scout
3. Generate executable nodes from findings

## Integration with Director

Scout integrates with Director in several ways:

1. **Token Efficiency**: Scout operates in isolated context, Director only sees findings
2. **Tool Parity**: Scout has access to all Director's debug tools
3. **Browser Awareness**: Scout receives current browser state on deployment
4. **Node Suggestions**: Scout can suggest specific nodes for Director to create

## Optimization

DSPy allows you to optimize Scout's performance:

```python
# Define metric
def scout_metric(example, pred, trace=None):
    return pred.findings.get("success", False)

# Optimize
optimizer = BootstrapFewShot(metric=scout_metric)
optimized_scout = optimizer.compile(scout, trainset=trainset)
```

## Production Considerations

1. **API Keys**: Replace placeholder API keys with actual credentials
2. **Browser Integration**: Replace mock browser with actual Playwright/Puppeteer
3. **Error Handling**: Add robust error handling for production use
4. **Caching**: Implement proper caching for DOM snapshots
5. **Token Management**: Monitor token usage to stay within limits

## Benefits of DSPy Approach

1. **Declarative**: Define what Scout should do, not how
2. **Optimizable**: Automatically improve prompts and examples
3. **Modular**: Easy to extend with new tools and capabilities
4. **Type-Safe**: Use Python type hints for better development experience
5. **Testable**: Easy to unit test individual components

## Next Steps

1. Integrate with actual browser automation (Playwright)
2. Connect to Director's node execution system
3. Add more sophisticated tool implementations
4. Create domain-specific Scout variants (e.g., FormScout, NavigationScout)
5. Implement production logging and monitoring

## References

- [DSPy Documentation](https://dspy-docs.vercel.app/)
- [Director 2.0 Scout Implementation](../Working%20Docs/Director%202.0/scout-implementation.md)
- [Tool Definitions](../backend/tools/toolDefinitionsV2.js)
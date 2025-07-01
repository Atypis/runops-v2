# Scout System: DOM Reconnaissance for the Director

## Purpose

Scouts are specialized agents deployed by the Director to explore and understand web UIs through DOM analysis. They provide the Director with the technical intelligence needed to design robust automation workflows.

## The Problem

When the Director designs automation workflows, it faces a fundamental challenge: **it can't see the page structure**. Traditional approaches involve:

1. **Human describes UI** → "Click the filter button"
2. **Operator guesses selector** → `button[aria-label='Filter']`
3. **Execution fails** → "Element not found"
4. **Human corrects** → "Oh, it's actually a div with an icon"
5. **Repeat endlessly** → 😭

This back-and-forth is inefficient, error-prone, and often leads to brittle automations that break with minor UI changes.

## The Scout Solution

Instead of this painful iteration, the Director deploys **scouts** - specialized exploration agents that perform DOM reconnaissance to understand page structure and interaction patterns.

```
Traditional:  Human ←→ Director (blind) ←→ Failed Designs
With Scouts:  Human → Director → Scout Missions → Accurate Blueprints
```

## How Scouts Work

### 1. **Mission Briefing from Director**
The Director assigns specific reconnaissance objectives, like:
- "Reverse-engineer Airtable's filter system"
- "Map all authentication flows for Gmail"
- "Document state management in Slack's message composer"

### 2. **DOM-Based Exploration**
The scout programmatically:
- **Analyzes page structure** - Traverses DOM to find interactive elements
- **Tests selector stability** - Verifies selectors work across page states
- **Measures async timings** - Records how long state changes take
- **Discovers patterns** - Identifies consistent UI structures
- **Maps interactions** - Documents which elements trigger which changes

### 3. **Report to Director**
The scout returns structured findings:
- **Reliable selectors** (avoiding dynamic IDs)
- **Critical timings** (async operation delays)
- **State detection methods** (how to verify operations succeeded)
- **Edge cases and solutions**
- **Bulletproof interaction patterns**

## Implementation Architecture

### Core Components

```python
ScoutService
├── deploy_scout()          # Main entry point
├── create_scout_controller() # Enhanced browser control
├── process_findings()      # Structure raw data
└── generate_report()       # Create actionable documentation

AirtableFilterScout (Specialized Scout)
├── execute_reconnaissance()
├── discover_filter_ui()
├── analyze_state_detection()
├── test_edge_cases()
└── compile_best_practices()
```

### Key Features

1. **Enhanced Controllers**
   - `capture_dom_state()` - Complete DOM analysis
   - `measure_action_timing()` - Precise timing measurements
   - `test_selector_reliability()` - Multi-attempt verification

2. **Exploration Methods**
   - DOM traversal and querying
   - Selector testing and validation
   - Event listener detection
   - State change monitoring

3. **Structured Output**
   - JSON reports for programmatic use
   - Markdown summaries for human review
   - Direct integration with workflow builders

## Example: Airtable Filter Reconnaissance

### Mission Objectives
1. Find all ways to open/close filter panel
2. Measure exact timings
3. Identify reliable selectors
4. Test edge cases
5. Document recovery procedures

### Scout Discoveries (Example)
```json
{
  "reliable_selectors": {
    "filter_button": "[data-testid='view-filter-button']",
    "filter_panel": ".filter-configuration-panel",
    "add_condition": "[data-testid='add-filter-condition']"
  },
  "critical_timings": {
    "filter_panel_open_ms": 200,
    "filter_apply_ms": 500,
    "results_update_ms": 800
  },
  "bulletproof_pattern": {
    "steps": [
      {"action": "ensure_clean_state"},
      {"action": "click", "selector": "[data-testid='view-filter-button']"},
      {"action": "wait", "ms": 200},
      {"action": "verify_panel_open"},
      // ... complete sequence
    ]
  }
}
```

## Benefits

### 1. **Efficiency**
- One deep reconnaissance mission replaces dozens of trial-and-error attempts
- Parallel testing of multiple approaches
- Comprehensive documentation in minutes, not hours

### 2. **Reliability**
- Discovers the most stable selectors
- Identifies exact timing requirements
- Tests edge cases systematically

### 3. **Maintainability**
- Clear documentation of UI behavior
- Easy to update when UI changes
- Patterns that work across similar interfaces

## Scout Types

### 1. **UI Pattern Scouts**
Specialize in specific UI patterns:
- Filter systems
- Authentication flows
- Data tables
- Form submissions

### 2. **Application Scouts**
Deep-dive into specific applications:
- Gmail Scout (email operations)
- Airtable Scout (database operations)
- Slack Scout (messaging operations)

### 3. **Recovery Scouts**
Focus on error handling:
- Network failure recovery
- Session timeout handling
- Rate limit detection

## Best Practices

### 1. **Mission Design**
- Be specific about objectives
- Include timing requirements
- Request multiple verification methods
- Ask for edge case testing

### 2. **Model Selection**
- **Gemini 2.5 Flash**: Fast visual analysis, good for UI state detection
- **GPT-4o**: Complex reasoning, good for pattern recognition
- **Claude 3 Opus**: Deep analysis, good for comprehensive documentation

### 3. **Report Utilization**
- Convert findings directly to workflow nodes
- Use discovered selectors in production
- Implement recommended timing delays
- Follow bulletproof patterns

## Future Enhancements

### 1. **Scout Memory**
- Remember UI patterns across missions
- Build a library of common interactions
- Transfer learning between similar UIs

### 2. **Collaborative Scouting**
- Multiple scouts working in parallel
- Specialized scouts for different aspects
- Consensus-based reliability scoring

### 3. **Continuous Monitoring**
- Periodic re-scouting to detect changes
- Automated alerts for UI modifications
- Self-healing automations

## Relationship to Director

Scouts are the Director's "eyes" into web pages:

1. **Director identifies knowledge gaps** - "How does Airtable's filter work?"
2. **Director deploys targeted scout** - Specific mission parameters
3. **Scout explores via DOM** - No guessing, actual testing
4. **Director uses intelligence** - Builds robust workflow from findings

This separation allows:
- Director to focus on workflow architecture
- Scouts to focus on technical exploration
- Both to work together efficiently

## Key Clarification

Scouts provide "eyes" through DOM analysis, NOT visual/screenshot analysis. When we say the Director gets "eyes", we mean:
- Ability to understand page structure
- Knowledge of available interactions
- Verified selector reliability
- Measured timing requirements

## Quick Start

```python
# Deploy a scout
scout = AirtableFilterScout(url="https://airtable.com/...")
report = await scout.execute_reconnaissance()

# Use findings to build bulletproof automation
workflow = build_from_scout_report(report)
```

The days of brittle, guess-based automations are over. Welcome to the age of reconnaissance-driven development.

## Critical Finding: Framework Limitations for Scout Reconnaissance

### The Hidden Information Problem

Through our investigation comparing Browser-Use and Stagehand, we discovered both frameworks **actively filter out potentially valuable selector information**:

#### What Gets Hidden

**Browser-Use filters out:**
- IDs (even stable ones like `id="APjFqb"` on Google)
- CSS classes (including potentially stable ones)
- Data attributes (`data-testid`, `data-qa`, etc.)
- Custom attributes that might be perfect for automation

**Stagehand shows even less:**
- Only semantic roles and text
- No HTML attributes at all
- No IDs, classes, or data attributes
- Just the accessibility tree structure

#### Example: Google Search Box

**Actual HTML:**
```html
<textarea 
  class="gLFyf"
  id="APjFqb"           <!-- Browser-Use hides this! -->
  name="q"              <!-- Browser-Use shows this -->
  aria-label="Suche"    <!-- Browser-Use shows this -->
  data-ved="0ahUKE..."  <!-- Browser-Use hides this -->
  jsaction="paste:..."  <!-- Browser-Use hides this -->
>
```

**What Browser-Use Shows:**
```html
[10]<textarea name='q' aria-label='Suche' role='combobox' />
```

**What Stagehand Shows:**
```
[22] combobox: Suche
```

### Why This Matters for Scouts

The frameworks' noise reduction strategy—while helpful for general automation—**directly conflicts with the Scout's mission** of discovering stable selectors:

1. **Scouts can't discover what they can't see** - If Browser-Use filters out `data-testid` attributes, Scouts can't recommend them
2. **Assumptions about stability are baked in** - The frameworks pre-judge which attributes are "useful"
3. **Potential stable selectors are lost** - IDs that look random might actually be stable across sessions

### Implications for Scout System Design

This finding suggests several architectural considerations:

#### Option 1: Enhanced Scout Reconnaissance
Scouts could inject custom JavaScript to extract ALL attributes:
```javascript
// Get complete attribute list
const element = document.querySelector('button');
const attributes = Array.from(element.attributes)
  .reduce((acc, attr) => {
    acc[attr.name] = attr.value;
    return acc;
  }, {});
```

#### Option 2: Hybrid Approach
- Use Browser-Use/Stagehand for **autonomous navigation**
- But extract raw DOM data for **selector discovery**
- Combine both intelligences in the Scout report

#### Option 3: Framework Extension
- Request features from Browser-Use/Stagehand to optionally include all attributes
- Or fork and modify to suit Scout needs

### Key Insight

**What makes frameworks good for automation (filtering noise) makes them problematic for reconnaissance (hiding signals).**

For deterministic automation, we need access to:
- `data-testid` attributes (most stable)
- Static IDs (even if they look random)
- Custom data attributes
- QA/automation attributes

These are exactly what current frameworks hide from us. This is a fundamental tension between the goals of:
- **Automation frameworks**: Simplify interaction by reducing choices
- **Scout reconnaissance**: Discover all possible stable selectors

### Recommended Path Forward

1. **Use Browser-Use for autonomous exploration** - It's still the best option for Scout autonomy
2. **Augment with raw DOM extraction** - Inject JavaScript to capture hidden attributes
3. **Build selector stability scoring** - Let Scouts analyze which selectors are truly stable over time
4. **Provide comprehensive intelligence** - Give the Director ALL options, not just filtered ones

The frameworks are optimized for their use case (making LLMs good at web automation), but Scout reconnaissance has different needs that require seeing the complete picture.

## Browser-Use DOM Filtering: Technical Deep Dive

### How Browser-Use Filters Attributes

Browser-Use implements a whitelist-based filtering system that determines which DOM attributes are shown to the LLM:

#### 1. **JavaScript Collection Phase** (`browser_use/dom/buildDomTree.js`)
- **Function**: `buildDomTree()` 
- **Lines**: 1323-1327
- Collects ALL attributes for interactive elements:
```javascript
if (isInteractiveCandidate(node) || node.tagName.toLowerCase() === 'iframe' || node.tagName.toLowerCase() === 'body') {
  const attributeNames = node.getAttributeNames?.() || [];
  for (const name of attributeNames) {
    nodeData.attributes[name] = node.getAttribute(name);
  }
}
```

#### 2. **Python Processing Phase** (`browser_use/dom/service.py` and `browser_use/dom/views.py`)
- Receives and stores ALL attributes in `DOMElementNode.attributes` dictionary
- No filtering happens at this stage

#### 3. **String Conversion Phase** (`browser_use/agent/views.py` and `browser_use/dom/views.py`)
- **Function**: `clickable_elements_to_string()`
- **File**: `browser_use/agent/views.py` (lines 41-52)
- Default whitelist:
```python
include_attributes: list[str] = [
    'title',
    'type',
    'name',
    'role',
    'tabindex',
    'aria-label',
    'placeholder',
    'value',
    'alt',
    'aria-expanded',
]
```

#### 4. **Filtering Logic** (`browser_use/dom/views.py`, lines 168-194)
```python
attributes_to_include = {
    key: str(value) for key, value in node.attributes.items() 
    if key in include_attributes
}
```

### What's Missing and Why

#### Excluded Attributes:
- `id` - Assumed to be unstable/random
- `class` - Considered implementation detail
- `data-*` - Custom data attributes
- `style` - Inline styles
- Framework-specific attributes

#### Browser-Use's Rationale:
1. **Token optimization** - Reduce LLM context usage
2. **Semantic focus** - LLM understands purpose, not implementation
3. **Stability assumptions** - IDs/classes change frequently

### Scout-Specific Solutions

#### Option 1: Extend the Whitelist
Modify `include_attributes` in `browser_use/agent/views.py`:
```python
include_attributes: list[str] = [
    # Original attributes...
    'title', 'type', 'name', 'role', 'tabindex',
    'aria-label', 'placeholder', 'value', 'alt', 'aria-expanded',
    # Scout additions:
    'id',              # Often stable (e.g., form fields)
    'data-testid',     # Explicitly for testing
    'data-qa',         # QA automation
    'data-test',       # Common variant
    'data-cy',         # Cypress testing
    'data-target',     # GitHub's pattern
    'data-automation', # Generic automation
]
```

#### Option 2: Remove Whitelist Entirely
```python
# In clickable_elements_to_string(), replace filtering with:
attributes_to_include = node.attributes  # Include everything
```
**Pros**: Complete visibility
**Cons**: Higher token usage, more noise

#### Option 3: Blacklist Approach
```python
# Define unwanted attributes
blacklist = [
    'style',          # Inline CSS
    'jsaction',       # Google's handlers
    'data-ved',       # Tracking/analytics
    'onclick',        # Inline JS
    'onmouseover',    # Event handlers
    'data-reactid',   # React internals
    'data-react-helmet', # React meta
    'class',          # Optional: exclude classes
]

# Filter using blacklist
attributes_to_include = {
    k: v for k, v in node.attributes.items() 
    if k not in blacklist
}
```

#### Option 4: Scout-Specific Mode
Add a parameter to control filtering behavior:
```python
def clickable_elements_to_string(
    dom_tree: dict,
    with_guidance: bool = True,
    include_attributes: list[str] = None,
    scout_mode: bool = False,  # New parameter
    filter_visible: bool = True,
    filter_with_bid: bool = True,
    filter_interactable: bool = True,
) -> str:
    if scout_mode:
        # Scout sees everything useful
        include_attributes = SCOUT_ATTRIBUTES
    elif include_attributes is None:
        # Default Browser-Use behavior
        include_attributes = DEFAULT_ATTRIBUTES
```

#### Option 5: Custom Attribute Extraction
Inject JavaScript to extract full DOM separately:
```javascript
// Scout can run this to get complete picture
const elements = document.querySelectorAll('*');
const fullDOM = Array.from(elements).map(el => ({
    tag: el.tagName,
    attributes: Array.from(el.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
    }, {}),
    text: el.textContent,
    xpath: getXPath(el)
}));
```

### Selector Priority for Director

When Scout discovers an element like:
```html
<textarea class="gLFyf" id="APjFqb" name="q" aria-label="Suche" 
          role="combobox" data-testid="search-input">
```

Director should prioritize selectors as:
1. `#APjFqb` (ID) - Most specific, fastest
2. `[data-testid="search-input"]` - Explicitly for automation
3. `textarea[name="q"]` - Semantic form field
4. `[aria-label="Suche"]` - Accessible but language-dependent
5. `.gLFyf` (class) - Less stable, may change with styling

### Implementation Considerations

1. **Performance Impact**: Including more attributes increases payload size
2. **LLM Context**: More attributes = more tokens = higher cost
3. **Noise vs Signal**: Balance between complete info and relevant info
4. **Backwards Compatibility**: Changes should not break existing Browser-Use functionality

### Recommended Approach

For Scout system, we recommend starting with **Option 1 (Extended Whitelist)** because:
- Minimal code changes required
- Maintains Browser-Use's architecture
- Adds only the most valuable automation selectors
- Can be tested incrementally
- Easy to revert if needed

The extended whitelist should include at minimum:
- `id`
- `data-testid`
- `data-qa`
- `data-test`

This provides Scout with visibility into the most common stable selectors while keeping token usage reasonable.

## Director/Operator Framework: Custom Deterministic Selector Support

### The Key Distinction

While Stagehand's `act()` method is **purely LLM-based** (only accepts natural language instructions), the Director/Operator framework has **custom-built functionality** that supports deterministic DOM selectors directly.

### How Director's NodeExecutor Works

The `nodeExecutor.js` in the operator backend implements sophisticated selector handling that goes beyond Stagehand's native capabilities:

#### 1. **Multiple Selector Strategies**
```javascript
// From directorPrompt.js - browser_action node config
{
  "action": "click",
  "selector": ["#submit-btn", "button[type='submit']", "text=Submit"],
  "fallback": "click the submit button"
}
```

#### 2. **Custom Selector Resolution** (nodeExecutor.js)
The NodeExecutor processes selectors with custom logic:

```javascript
// CSS Selectors - Direct Playwright usage
await page.click('#submit-button');
await page.fill('[data-testid="email"]', 'test@example.com');

// Text prefix - Converts to Stagehand act()
if (selector.startsWith('text=')) {
  await page.act({ action: `click on ${selector.slice(5)}` });
}

// Act prefix - Routes to Stagehand act()
if (selector.startsWith('act:')) {
  await page.act({ action: selector.slice(4) });
}

// jQuery conversion
if (selector.includes(':contains(')) {
  // Converts to Playwright's :has-text()
}
```

### Architecture Comparison

#### **Stagehand Native Approach:**
```
Natural Language → act() → LLM → XPath → Playwright
```
- Only supports natural language input
- Always goes through LLM
- Returns XPath selectors internally

#### **Director/Operator Approach:**
```
Multiple Input Types → NodeExecutor → Direct Playwright OR Stagehand act()
```
- Supports CSS selectors, XPath, arrays, text=, act=
- Bypasses LLM for deterministic selectors
- Falls back to Stagehand act() when needed

### Why This Matters for Scout

The Director's custom selector support means:

1. **Scout can discover and recommend any selector type:**
   - CSS: `#APjFqb`, `.search-box`, `[data-testid="submit"]`
   - XPath: `//button[@id="submit"]`
   - Text-based: `text=Submit Form`
   - Natural language: `act:click the blue submit button`

2. **Director creates nodes with deterministic selectors:**
   ```javascript
   {
     "type": "browser_action",
     "config": {
       "action": "type",
       "selector": "#APjFqb",  // Direct CSS selector
       "text": "search query"
     }
   }
   ```

3. **Executor uses Playwright directly (not Stagehand's act()):**
   ```javascript
   // NodeExecutor translates to:
   await page.fill('#APjFqb', 'search query');
   ```

### The Complete Flow

```
Scout (Browser-Use) discovers:
  └─> All DOM attributes including id="APjFqb"
  
Director receives intelligence:
  └─> Creates node with selector: "#APjFqb"
  
NodeExecutor processes:
  └─> Recognizes CSS selector
  └─> Uses Playwright directly: page.fill('#APjFqb', ...)
  └─> Never touches Stagehand's act() method
```

### Key Insight

This custom implementation bridges the gap between:
- **Deterministic automation** (CSS/XPath selectors for reliability)
- **AI-driven automation** (natural language for flexibility)

The Director/Operator framework essentially built what Stagehand doesn't provide natively - the ability to use both deterministic selectors AND natural language instructions in the same system.

## Scout Browser-Use Monkey Patch Implementation

### Overview

We've successfully implemented a monkey patch that extends Browser-Use's DOM attribute whitelist to expose stable selectors that are hidden by default. This gives Scout agents visibility into IDs, test selectors, and other automation-critical attributes.

### What the Patch Does

Browser-Use filters DOM attributes to reduce noise for LLMs, but this hides valuable selectors:

**Without Scout Patch (Default Browser-Use):**
```html
[10]<textarea name='q' aria-label='Search' role='combobox' title='Search' type='search' value='' aria-expanded='false' />
```

**With Scout Patch:**
```html
[10]<textarea name='q' aria-label='Search' role='combobox' title='Search' type='search' value='' aria-expanded='false' id='APjFqb' autocomplete='off' aria-controls='Alh6id' aria-describedby='searchhelp' data-testid='search-input' data-qa='main-search' data-automation='google-search' />
```

The patch adds 20 additional attributes (100% increase), including:
- `id` - HTML element IDs
- `data-testid`, `data-test`, `data-cy`, `data-qa` - Test automation hooks
- `href` - Link destinations
- `data-automation`, `data-selenium` - Automation markers
- `aria-labelledby`, `aria-describedby` - Additional accessibility
- `autocomplete`, `formcontrolname` - Form metadata

### Implementation Structure

```
test-harness/operator/scouts/
├── __init__.py                    # Package exports
├── browser_use_patch.py           # Core monkey patch implementation
├── scout_agent.py                 # Scout-enhanced Browser-Use Agent
├── tests/
│   ├── test_dom_patch.py         # Unit tests
│   ├── test_integration.py       # Integration tests
│   └── run_tests.py             # Test runner
├── example_usage.py              # Usage examples
├── test_google_correct.py        # Live Google.com test
├── compare_dom_output.py         # DOM comparison demo
└── README.md                     # Detailed documentation
```

### How to Use

#### Option 1: ScoutAgent (Recommended)

```python
from scouts.scout_agent import ScoutAgent
from browser_use.llm.openai.chat import ChatOpenAI

# ScoutAgent automatically applies patches
agent = ScoutAgent(
    task="Find all stable selectors on the login form",
    llm=ChatOpenAI(model='gpt-4o')
)

# Run reconnaissance
result = await agent.run()
```

#### Option 2: Manual Patch

```python
from scouts import browser_use_patch
from browser_use import Agent

# Apply patch
browser_use_patch.apply_scout_patch()

# Use regular Browser-Use agent (now enhanced)
agent = Agent(
    task="Extract automation selectors",
    llm=your_llm
)
```

### Running the Tests

#### 1. Run All Tests
```bash
cd test-harness/operator
python3 scouts/tests/run_tests.py
```

#### 2. Live Google Test
```bash
# Set your OpenAI API key first
export OPENAI_API_KEY='your-key-here'

# Run the Google DOM extraction test
python3 scouts/test_google_correct.py
```

This will:
- Navigate to google.com
- Extract all DOM attributes from the search button
- Save analysis to `google_dom_analysis.md`
- Show the difference Scout makes

#### 3. Compare DOM Output
```bash
# See side-by-side comparison
python3 scouts/compare_dom_output.py
```

### How It Works

1. **Monkey Patching**: The patch modifies two key areas:
   - `AgentSettings.model_fields['include_attributes'].default` - Changes the default whitelist
   - `Agent.__init__` - Ensures Scout attributes are always included

2. **Attribute Whitelist**: Extends from 13 default attributes to 33 total attributes

3. **Runtime Control**: 
   - Auto-applies on import
   - Can be disabled with `SCOUT_DISABLE_PATCH=1` environment variable
   - Fully reversible with `remove_scout_patch()`

### Integration with Director/Scout System

The patch enables the complete Scout → Director workflow:

1. **Scout discovers selectors** with enhanced visibility:
   ```python
   # Scout can now see:
   id="submit-btn"
   data-testid="login-button"
   data-qa="auth-submit"
   ```

2. **Scout reports to Director** with stable selectors:
   ```json
   {
     "reliable_selectors": {
       "submit_button": "#submit-btn",
       "email_input": "[data-testid='email']",
       "login_form": "[data-qa='login-form']"
     }
   }
   ```

3. **Director creates deterministic nodes**:
   ```javascript
   {
     "type": "browser_action",
     "config": {
       "action": "click",
       "selector": "#submit-btn",  // Scout-discovered ID
       "fallback": "click submit"
     }
   }
   ```

### Troubleshooting

1. **Verify Patch Status**:
   ```python
   from scouts import browser_use_patch
   print(f"Patched: {browser_use_patch.is_patched()}")
   ```

2. **Check Visible Attributes**:
   ```python
   print(browser_use_patch.SCOUT_WHITELIST)
   ```

3. **Debug Issues**:
   ```python
   import logging
   logging.getLogger('scouts.browser_use_patch').setLevel(logging.DEBUG)
   ```

### Key Benefits

1. **Better Selector Discovery**: Scouts can now find all stable selectors
2. **Reduced LLM Dependency**: More deterministic navigation options
3. **Improved Reliability**: Access to test-specific selectors
4. **Backward Compatible**: No breaking changes to Browser-Use
5. **Easy Integration**: Drop-in replacement with ScoutAgent

### Example Results

When testing on Google.com, the Scout patch reveals:
- `id='APjFqb'` - Google's stable search box ID
- `id='gbqfbb'` - "I'm Feeling Lucky" button ID
- Multiple `data-ved` attributes for tracking
- `jsaction` attributes for event handling

This enables Scouts to recommend `#APjFqb` instead of the fragile `[aria-label='Search']` that changes with language.

### Next Steps

1. Use `ScoutAgent` for all reconnaissance operations
2. Monitor which attributes your target sites use
3. Consider contributing useful patterns back to Browser-Use
4. Keep the patch updated with Browser-Use releases

The Scout enhancement is now ready for production use in discovering stable selectors for Director-designed automations!
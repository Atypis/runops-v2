# Tab Inspection Tools: Director 2.0 Site Analysis

## 1. What Are We Trying to Do?

Director 2.0 needs **site inspection capabilities** to understand page state, verify navigation success, and scout for reliable selectors. This is a critical missing piece for the Director's ability to build robust workflows.

**Core Requirements:**
- **Page State Analysis**: "Are we on the login page or 2FA page?"
- **Element Discovery**: "What stable selectors are available for this form?"
- **Workflow Validation**: "Did the navigation succeed? Are expected elements present?"
- **Debugging Support**: "Why did the selector fail? What's actually on the page?"

**Current Gap:**
The Director can navigate and interact with pages but is essentially **blind** to page content. It builds workflows based on assumptions without being able to verify page state or discover reliable selectors.

## 2. Possible Technical Approaches

### **Input Methods**
We have two primary ways to analyze website state:

**A. DOM Snapshots**
- Complete HTML structure with all elements and attributes
- Includes invisible elements, metadata, and technical attributes
- Rich semantic information (IDs, classes, data attributes)
- Can be large and noisy

**B. Screenshots**
- Visual representation of the page as users see it
- Shows actual layout, styling, and visual state
- Limited semantic information
- Good for visual verification

**C. Hybrid Approach**
- DOM snapshot for structure and selectors
- Screenshot for visual context and validation
- Bounding boxes mapping visual elements to DOM nodes

### **Processing Strategies**

**Raw Data Approach:**
- Pass complete DOM snapshot and/or screenshot to LLM
- Let AI parse and understand everything
- Maximum information, but token-heavy and potentially noisy

**Filtered/Preprocessed Approach:**
- Apply filtering rules to reduce noise
- Focus on visible and interactable elements
- Pre-process for specific use cases
- More efficient, but might miss important details

**Tiered Approach:**
- **Lightweight**: Quick filtered analysis for common scenarios
- **Deep**: Full DOM snapshot when detailed analysis needed
- **Visual**: Screenshot analysis for complex visual layouts

## 3. The Action vs RPA Optimization Challenge

**Existing frameworks like Browser-Use and Stagehand are optimized for immediate action:**
- Filter for "actionable" elements (buttons, inputs, links)
- Exclude "technical noise" like IDs, data attributes
- Focus on natural language descriptions (aria-labels, visible text)
- Goal: Help LLM click/type the right element **right now**

**Director's RPA needs are fundamentally different:**
- Prioritize **stable selectors** (`id`, `data-*`, stable classes)
- Include technical attributes that provide workflow reliability
- Build selectors that work consistently across sessions
- Goal: Create **deterministic workflows** that work repeatedly

**Example Conflict:**
```html
<button id="submit-btn" class="primary-button" aria-label="Submit form">
  Sign In
</button>
```

**Browser-Use approach:** "Sign In button with aria-label 'Submit form'"
**Director needs:** "Element with stable selector `#submit-btn` or `[aria-label='Submit form']`"

The Director follows a **deterministic hierarchy**:
1. ID selectors (`#submit-btn`)
2. Data attributes (`[data-testid="login"]`)
3. Stable classes (`.primary-button`)
4. ARIA labels (`[aria-label="Submit"]`)
5. **Fallback only**: Natural language (`text:"Sign In"`)

## 4. Codebase Compatibility Considerations

**Language Integration Factor:**
- **Stagehand**: TypeScript/JavaScript - direct integration with our Node.js backend
- **Browser-Use**: Python - requires API bridge or subprocess communication
- **Custom Solution**: Full control but significant development time

**Integration Complexity:**
- Same-language frameworks can be imported and used directly
- Cross-language solutions require additional infrastructure and error handling
- Deployment complexity increases with multiple runtime environments

This compatibility factor influences both **implementation speed** and **long-term maintenance complexity**.

## Next Steps

1. **Deep research** into existing framework filtering approaches
2. **Prototype** with most compatible framework for quick wins
3. **Evaluate** if existing filtering meets Director's RPA needs
4. **Extend or replace** filtering logic as needed for deterministic navigation

The goal is to give Director both the **eyes to see** (inspection) and **brain to understand** (analysis) web pages for building reliable workflows.
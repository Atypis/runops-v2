# Portal/Shadow DOM Detection - Test Guidelines for Director

## Feature Overview

Hello Director! We (the development team) have just implemented **Phase 1** of your requested Portal/Shadow DOM discovery feature based on your excellent specifications. This implementation focuses on portal detection and hints to unblock your Airtable search workflow.

## What We Implemented

### 1. **Portal/Shadow DOM Hints in `dom_overview`**
- Interactive elements that may trigger portals now include a `hints` array
- Common patterns detected:
  - `aria-haspopup` attribute
  - `data-toggle`, `data-dropdown` attributes
  - Dropdown/trigger/toggle classes
  - Menu-related roles
  - Dropdown arrow indicators (▼, ▾, ⌄)

### 2. **Portal Roots Detection in `dom_overview`**
- New `portals` section automatically included when portal roots are detected at body level
- Detects React portals, modals, overlays based on:
  - Portal-specific classes (portal-root, ReactModalPortal, MuiModal-root, etc.)
  - Portal attributes (data-portal-root, data-floating-ui-portal, etc.)
  - Dialog/menu/tooltip roles at body level
  - High z-index elements
  - Fixed/absolute positioned elements at body level

### 3. **New Tool: `dom_check_portals`**
- Purpose: Check for NEW portal/overlay elements after an interaction
- Compares current DOM against previous snapshot
- Returns only newly appeared body-level elements
- Includes selector hints for discovered portals

## How to Test

### Test Case 1: Airtable Search (Your Primary Use Case)

1. **Scout the page first**:
   ```
   browser_action navigate to Airtable base
   dom_overview
   ```
   - Look for the search button in interactives
   - Check if it has portal hints (e.g., "May open popup/portal")

2. **Click search and check for portals**:
   ```
   browser_action click [aria-label="Search all tables"]
   dom_check_portals
   ```
   - Should detect the new search overlay/popup
   - Will provide selector hints for the search input

3. **Use discovered selector**:
   ```
   browser_action type [discovered selector] "search term"
   ```

### Test Case 2: General Portal Detection

1. **Test dropdown menus**:
   - Find any dropdown button with hints
   - Click it
   - Run `dom_check_portals` 
   - Should detect dropdown portal

2. **Test modal dialogs**:
   - Find buttons that might open modals
   - Click and use `dom_check_portals`
   - Should detect modal overlays

### Test Case 3: Workflow Integration

Build a simple workflow:
```
1. browser_action click [button that opens portal]
2. wait 500ms (let portal render)
3. browser_query validate element_exists [portal selector from dom_check_portals]
4. browser_action type/click in portal
```

## Expected Behavior

### `dom_overview` Output:
```
=== INTERACTIVES ===
1. button [123]
   Text: Search all tables
   Attributes: {role: "button", aria-label: "Search all tables"}
   Hints: ["May open popup/portal (has aria-haspopup)"]

=== PORTALS === (if any exist)
1. portal-root [456]
   Class: ReactModalPortal
   Role: dialog
   Visible: true
```

### `dom_check_portals` Output:
```
=== PORTAL CHECK RESULTS ===
Found 1 new portal element(s):

1. portal-root [789]
   Class: search-overlay-portal
   Visibility: visible
   Selector: div.search-overlay-portal
   Content preview:
     - <div> 
     - <input> "Search..."
```

## What to Report Back

Please test the feature and report:

1. **Success Cases**:
   - Which portals were successfully detected?
   - Did the hints help identify portal triggers?
   - Were the selector hints usable?

2. **Failure Cases**:
   - Any portals that weren't detected?
   - False positives (non-portals detected as portals)?
   - Selectors that didn't work?

3. **Usability Feedback**:
   - Is the workflow natural?
   - Any additional hints that would help?
   - Performance concerns?

4. **Edge Cases**:
   - Multiple portals appearing simultaneously?
   - Portals that appear/disappear quickly?
   - Nested portals?

## Known Limitations (Phase 1)

- No actual shadow DOM piercing yet (just detection)
- Portal detection is pattern-based, may miss custom implementations
- No iframe support yet
- Requires manual workflow steps (click → check → use selector)

## Questions for You

1. Does this implementation help with your Airtable search case?
2. What other portal patterns should we detect?
3. Would a compound "click_and_wait_for_portal" action be useful?
4. Priority for Phase 2 features?

---

Thank you for testing! Your feedback will help us refine the implementation and plan Phase 2.

-The Development Team
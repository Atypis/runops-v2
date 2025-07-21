## Variable Rules & Edge Cases

This section contains important rules, patterns, and edge cases that haven't been formally categorized yet but are critical for correct workflow operation.

### Variable Debugging Patterns

When variables aren't behaving as expected:
- Use `get_workflow_variables({ variableName: "all" })` to dump entire state
- Test edge cases with `set_variable` to inject specific values
- Common issues:
  - Accessing `{{result.property}}` when result is a string (needs schema)
  - Iterator variables only exist within iteration scope
  - Context variables are stored flat: `{{email}}` not `{{context.email}}`

### Hidden Auto-Validation Behavior

Browser navigation automatically validates the target page loaded:
- `browser_action` with `navigate` waits for page load
- No need for explicit validation after navigation
- Failed navigation stops execution (counts toward 3-attempt rule)
- Use explicit `browser_query` only for mid-page state checks

### Complex Route Expressions

Route conditions support full JavaScript expressions:
```
// Regex matching
condition: "{{email}}.match(/.*@gmail\\.com$/)"

// Ternary operators  
condition: "{{items.length}} > 0 ? {{items[0].priority}} === 'high' : false"

// Null-safe navigation
condition: "{{user?.profile?.isActive}} === true"

// Complex boolean logic
condition: "({{status}} === 'pending' || {{status}} === 'processing') && {{retryCount}} < 3"
```

### Profile Operation Subtleties

- `loadProfile` checks local first, then cloud (automatic fallback)
- `snapshotProfile` during exploration saves to cloud for the project
- Profile names must match pattern: `^[a-z0-9-]+$` (lowercase, numbers, hyphens)
- Profiles are project-specific, not user-specific
- Empty profile name or `null` means "no profile" (fresh browser)

### Variable Reference Priority

When same variable name exists in multiple scopes:
1. Iterator variables (highest priority)
2. Node results with `store_variable: true`
3. Context variables
4. Environment variables with `env:` prefix

Example: `{{email}}` will use iterator's email over context's email

### Snake_Case Enforcement

**CRITICAL**: All aliases must be snake_case:
- ✅ `extract_user_data`
- ✅ `validate_form_2`
- ❌ `extractUserData` 
- ❌ `validate-form`
- ❌ `ValidateForm`

Pattern: `^[a-z][a-z0-9_]*$` (start with lowercase letter)

### Browser State Gotchas

- First tab is always named "main" (created automatically)
- Closing "main" tab creates undefined behavior - avoid
- Duplicate tab names auto-suffix: "gmail" → "gmail_2" → "gmail_3"
- Active tab context persists across nodes unless explicitly switched
- Pop-ups may steal active tab focus - always verify active tab

### Iterator Edge Cases

- Empty arrays: Iterator body never executes, no error
- Single item: `${var}Index` is 0, `${var}Total` is 1
- Nested iterators: Inner iterator variables shadow outer ones
- Break/continue not supported - use `continueOnError: false` to stop early
- Iterator results capture both successes and failures separately

### Schema Type Coercion

Cognition/AI nodes may return strings even with schema:
- Always validate critical boolean/number values
- Use explicit type checking in route conditions
- Common pattern: `condition: "{{result.isValid}} === true"` not just `{{result.isValid}}`

### Timing Sensitivities

- Default timeout: 10000ms (10 seconds) for element appearance
- `wait` with `type: "time"` blocks entire execution
- Navigation timeouts cascade - page load + element wait
- Stale element references after DOM updates - re-query if needed

### Error Message Patterns

When reporting failures (3-attempt rule):
```
Attempted: browser_action click on selector "button.submit"
Error: Element not found after 10000ms timeout
Hypothesis: Button may require prior interaction to enable
Next steps: 
1. Check if button has disabled state
2. Verify all form fields are filled
3. Look for JavaScript validation errors
```

### Selector Fallback Patterns

Union selectors for resilience:
```
// Try multiple patterns (first match wins)
selector: "button[data-testid='submit'], button:contains('Submit'), form button[type='submit']"

// Parent-child fallback
selector: "#loginForm button, .login-container button, main button.primary"
```

### Variable Persistence Hierarchy

1. **Workflow variables**: Persist across all nodes
2. **Iterator variables**: Only during iteration
3. **Node results**: Only if `store_variable: true`
4. **Temporary computations**: Use cognition nodes
5. **Cross-workflow data**: Not supported (use context node)

### Common Anti-Patterns to Avoid

- Don't use `browser_ai_action` when selector is stable
- Don't skip `dom_overview` before building
- Don't chain more than 3 nodes without testing
- Don't assume element positions (nth-child) remain stable
- Don't store large data in variables (performance impact)
- Don't use route without default `condition: "true"` branch

### Migration Gotchas V3→V4

- `create_node` → `add_or_replace_nodes` with `target: "end"`
- `update_node` → `add_or_replace_nodes` with `target: <alias>`
- Position numbers changed: V3 used 0-based, V4 uses 1-based
- Browser_query now requires rules array, not single selector
- Click/type moved from browser_ai_action back to browser_action

### Undocumented Features

- `dom_overview` supports `diff_from: true` for change detection
- `execute_nodes` mode "flow" respects route decisions
- `get_workflow_variables` bypasses chunking (full content)
- Browser profiles can be pre-populated via cloud UI
- Transform/handle nodes accept arbitrary config (use carefully)
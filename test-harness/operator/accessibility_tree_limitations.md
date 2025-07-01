# What's Missing from the Accessibility Tree for Web Automation

## Critical Information That's Trimmed Out

### 1. **Unique Identifiers**
```html
<!-- Original HTML -->
<button id="submit-btn" data-testid="form-submit" class="btn-primary">Submit</button>

<!-- Accessibility Tree shows -->
[123] button: Submit
```
**Missing**: `id`, `data-testid`, `class` - the most stable selectors!

### 2. **Form Input Names**
```html
<!-- Original HTML -->
<input type="email" name="user-email" placeholder="Enter email" />

<!-- Accessibility Tree shows -->
[45] textbox: Enter email
```
**Missing**: `name` attribute - critical for form automation

### 3. **Link Destinations**
```html
<!-- Original HTML -->
<a href="/dashboard/settings">Settings</a>

<!-- Accessibility Tree shows -->
[67] link: Settings
```
**Missing**: `href` - can't distinguish between different links with same text

### 4. **Input Values and States**
```html
<!-- Original HTML -->
<input type="checkbox" checked value="subscribe" />
<select>
  <option value="us">United States</option>
  <option value="uk" selected>United Kingdom</option>
</select>

<!-- Accessibility Tree shows -->
[89] checkbox: 
[90] combobox: United Kingdom
```
**Missing**: Current values, which option is selected, checkbox states

### 5. **Custom Attributes**
```html
<!-- Original HTML -->
<div data-product-id="12345" data-price="99.99" data-action="add-to-cart">
  <button>Add to Cart</button>
</div>

<!-- Accessibility Tree shows -->
[101] button: Add to Cart
```
**Missing**: All the contextual data attributes

### 6. **CSS Classes for State**
```html
<!-- Original HTML -->
<button class="btn btn-primary is-loading disabled" disabled>Submit</button>

<!-- Accessibility Tree shows -->
[78] button: Submit
```
**Missing**: Loading states, disabled states (unless in accessible name)

## Playwright/Stagehand Selector Strategies

### 1. **Text-based** (Works with accessibility tree)
```javascript
// Playwright
await page.click('text=Submit');
await page.click('"Exact Text"');

// Stagehand
await page.act({ action: "click on Submit button" });
await page.act({ action: "click the text that says Submit" });
```

### 2. **Role-based** (Works with accessibility tree)
```javascript
// Playwright
await page.click('role=button[name="Submit"]');
await page.getByRole('button', { name: 'Submit' }).click();

// Stagehand observe can find by role
const [element] = await page.observe({ 
  instruction: "find the submit button" 
});
```

### 3. **CSS Selectors** (NOT in accessibility tree!)
```javascript
// These require the actual DOM attributes
await page.click('#submit-btn');
await page.click('[data-testid="form-submit"]');
await page.click('button.btn-primary');
await page.click('[name="user-email"]');
```

### 4. **XPath** (Limited use with accessibility tree)
```javascript
// Position-based (fragile)
await page.click('//button[1]');

// Text-based (works)
await page.click('//button[text()="Submit"]');

// Attribute-based (NOT available)
await page.click('//button[@data-testid="submit"]');
```

## What This Means for Web Automation

### ✅ **Can Do with Accessibility Tree Alone**
1. Click buttons/links by their visible text
2. Fill inputs if they have labels or placeholders
3. Navigate by semantic roles
4. Interact with standard form elements
5. Basic page navigation

### ❌ **Cannot Do Reliably**
1. Distinguish between multiple similar elements without unique text
2. Access elements by stable IDs or test IDs
3. Read current form values
4. Access data attributes for context
5. Determine element states beyond basic visibility

## Best Practices for Stagehand/Playwright

### 1. **Hardcoded Selectors** (When You Have Them)
```javascript
// Most stable to least stable
const selectors = [
  '[data-testid="submit-form"]',     // Best
  '#submit-button',                   // Good if not dynamic
  '[aria-label="Submit form"]',       // Good
  'button[name="submit"]',            // OK for forms
  'button.submit-btn',                // OK if classes are stable
  'text=Submit',                      // Last resort
];

// Playwright - try multiple
for (const selector of selectors) {
  try {
    await page.click(selector);
    break;
  } catch (e) {
    continue;
  }
}
```

### 2. **LLM-Based Selection** (When You Don't Have Selectors)
```javascript
// Stagehand
await page.act({ 
  action: "click the blue submit button at the bottom of the form" 
});

// With observe first
const [submitButton] = await page.observe({ 
  instruction: "find the form submit button" 
});
await page.act(submitButton);
```

### 3. **Hybrid Approach** (Best of Both)
```javascript
// Try stable selector first, fall back to LLM
try {
  await page.click('[data-testid="submit"]');
} catch (e) {
  await page.act({ action: "click the submit button" });
}
```

## For Your Scout System

The Scout should extract MORE than what the accessibility tree provides:

```javascript
{
  "element": "Submit Button",
  "accessibilityInfo": {
    "role": "button",
    "name": "Submit",
    "stagehand_id": 123
  },
  "domInfo": {
    "tag": "button",
    "id": "submit-btn",
    "classes": ["btn", "btn-primary"],
    "attributes": {
      "data-testid": "form-submit",
      "type": "submit",
      "name": "submitForm"
    },
    "xpath": "//form[@id='login']/button",
    "cssPath": "#login > button"
  },
  "selectors": {
    "stable": [
      "[data-testid='form-submit']",
      "#submit-btn"
    ],
    "moderate": [
      "button[name='submitForm']",
      "[type='submit']"
    ],
    "fallback": [
      "text=Submit",
      "role=button[name='Submit']"
    ]
  }
}
```

This gives the Director everything needed for robust automation!
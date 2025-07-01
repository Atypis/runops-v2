# DOM Selectors Guide for Web Automation

## Types of Selectors

### 1. **CSS Selectors** (Most Common)
```javascript
// By ID (most stable if IDs are static)
'#submit-button'

// By Class
'.btn-primary'

// By Tag
'button'

// By Attribute
'[aria-label="Submit"]'
'[data-testid="submit-btn"]'  // Best practice!
'[name="email"]'
'[type="submit"]'

// Combinations
'button.btn-primary'
'form#login input[name="email"]'

// Pseudo-selectors
'button:nth-of-type(2)'
'li:first-child'
```

### 2. **XPath Selectors**
```javascript
// Absolute path (fragile - avoid!)
'/html/body/div[1]/button'

// Relative path with attributes
'//button[@aria-label="Submit"]'
'//input[@name="email"]'

// Text content
'//button[text()="Submit"]'
'//a[contains(text(), "Sign in")]'

// Following/preceding
'//label[text()="Email"]/following-sibling::input'
```

### 3. **Text Selectors** (Playwright/Stagehand specific)
```javascript
'text=Submit'          // Exact text
'text=/submit/i'       // Regex
'"Submit Form"'        // Exact quoted text
```

### 4. **Role Selectors** (Accessibility-based)
```javascript
'role=button[name="Submit"]'
'role=textbox[name="Email"]'
'role=link[name="Sign in"]'
```

## Selector Stability Ranking (Best to Worst)

### 🥇 **Most Stable**
1. **data-testid attributes**
   ```html
   <button data-testid="submit-form">Submit</button>
   ```
   Selector: `[data-testid="submit-form"]`
   Why: Specifically added for testing, unlikely to change

2. **Unique IDs** (if not dynamic)
   ```html
   <input id="email-input">
   ```
   Selector: `#email-input`
   Why: Should be unique, but beware of dynamic IDs like `#:r1:` (React) or `#abc123` (generated)

3. **ARIA labels**
   ```html
   <button aria-label="Submit form">Submit</button>
   ```
   Selector: `[aria-label="Submit form"]`
   Why: Important for accessibility, less likely to change

### 🥈 **Moderately Stable**
4. **Name attributes** (for forms)
   ```html
   <input name="email" type="email">
   ```
   Selector: `[name="email"]`
   Why: Forms need these for submission

5. **Role + accessible name**
   ```javascript
   'role=button[name="Submit"]'
   ```
   Why: Semantic and accessibility-focused

6. **Text content** (for buttons/links)
   ```javascript
   'text=Submit'
   ```
   Why: User-facing text changes less than structure

### 🥉 **Less Stable**
7. **Classes**
   ```html
   <button class="btn btn-primary submit-btn">
   ```
   Selector: `.submit-btn`
   Why: Can change with styling updates

8. **Tag + attributes**
   ```javascript
   'button[type="submit"]'
   ```
   Why: Multiple elements might match

### ❌ **Avoid**
9. **Absolute XPath**
   ```javascript
   '/html/body/div[2]/form/button[1]'
   ```
   Why: Breaks with any DOM structure change

10. **Dynamic IDs/Classes**
    ```javascript
    '#:r5:'  // React generated
    '.css-1x2y3z'  // CSS-in-JS generated
    ```
    Why: Changes on every build/render

## Why Stagehand's Format is Actually Powerful

While Stagehand shows less attribute info to the LLM, it actually provides:

### 1. **Semantic Understanding**
```
[73] link: Gmail
[345] button: Google Search
[22] combobox: Suche
```
This tells you WHAT the element IS, not just how it looks in HTML.

### 2. **Behind the Scenes Access**
When you call `observe()`, Stagehand returns full selectors:
```javascript
{
  "description": "Gmail",
  "selector": "xpath=/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/header[1]/div[1]/div[1]/a[1]"
}
```

### 3. **Smart Selector Generation**
Stagehand can use the element ID to generate multiple selector strategies internally.

## Best Practices for Stable Selectors

### 1. **Use Multiple Strategies**
```javascript
// Director should try these in order:
selectors: [
  '[data-testid="submit-btn"]',     // Best if available
  '[aria-label="Submit form"]',     // Good fallback
  'button:has-text("Submit")',      // Text-based
  'form button[type="submit"]'      // Structural fallback
]
```

### 2. **Prefer Semantic Selectors**
```javascript
// Good - based on meaning
'[aria-label="Search"]'
'role=search input'

// Bad - based on appearance
'.rounded-input'
'.mt-4.px-2'
```

### 3. **Test-Specific Attributes**
Encourage adding:
```html
<button 
  data-testid="filter-apply"
  data-automation="apply-filters"
  data-qa="filter-submit"
>
  Apply Filters
</button>
```

## Browser-Use vs Stagehand Selector Extraction

### Browser-Use Shows You:
```html
[10]<textarea title='Suche' value='' aria-label='Suche' 
     placeholder='' aria-expanded='false' name='q' role='combobox' />
```

**You can extract:**
- `textarea[name="q"]`
- `[aria-label="Suche"]`
- `[role="combobox"]`
- `textarea[title="Suche"]`

### Stagehand Shows You:
```
[22] combobox: Suche
```

**But can provide (via observe):**
- `xpath=/html/body/.../textarea`
- Can be asked to find element by text/role
- Returns actionable selectors

## For Your Scout System

The Scout should extract and provide:

```javascript
{
  "element": "Search box",
  "selectors": {
    "preferred": "[name='q']",  // Most stable
    "alternatives": [
      "[aria-label='Search']",
      "textarea[role='combobox']",
      "[title='Search']",
      "text=Search"  // For Playwright
    ],
    "xpath": "//textarea[@name='q']",
    "stagehand_id": 22,  // If using Stagehand
    "browser_use_index": 10  // If using Browser-Use
  },
  "attributes": {
    "name": "q",
    "role": "combobox",
    "aria-label": "Search",
    "type": "textarea"
  },
  "stability_score": 0.9  // High because 'name' is stable for forms
}
```

## The Real Power: Combining Both Approaches

1. **Browser-Use** gives you the raw HTML attributes to build stable selectors
2. **Stagehand** gives you semantic understanding and can generate selectors
3. **Together** they provide comprehensive intelligence for robust automation

The key insight: Stagehand's "limited" view is actually a **feature** - it forces focus on semantic, accessible elements that are more likely to have stable selectors!
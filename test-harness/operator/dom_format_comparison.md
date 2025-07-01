# DOM/Accessibility Tree Format Comparison: Browser-Use vs Stagehand

## Browser-Use DOM Format

### What the LLM Sees:

```
<browser_state>
Current tab: [0]
Available tabs:
Tab 0: https://www.google.com - Google

Interactive elements from top layer of the current page inside the viewport:
[Start of page]
[0]<a>About Google />
[1]<a>Store />
[2]<a>Gmail />
[3]<a aria-label='Search for images'>Images />
[4]<a aria-label='Google apps'>Google Apps />
[5]<a>Sign in />
[6]<img alt='Google' />
[7]<textarea title='Search' aria-label='Search' name='q' role='combobox' />
[8]<div aria-label='Search by voice' role='button' />
[9]<div aria-label='Search by image' role='button' />
[10]<input value='Google Search' aria-label='Google Search' name='btnK' role='button' type='submit' />
[11]<input value='I\'m Feeling Lucky' aria-label='I\'m Feeling Lucky' name='btnI' type='submit' />
Google offered in: English
[12]<a>English />
[13]<a>Advertising />
[14]<a>Business />
[15]<a>How Search works />
[16]<a>Privacy />
[17]<a>Terms />
[18]<button aria-label='Settings' role='button'>Settings />
[End of page]
</browser_state>
```

### Key Characteristics:
- **Sparse indexing**: Only interactive elements get `[index]`
- **HTML-like syntax**: `<tag attributes>text />`
- **Self-closing format**: All elements use ` />` 
- **Filtered view**: Only shows clickable/interactive elements
- **Flat structure**: Minimal hierarchy shown
- **Text nodes**: Included as plain text between elements
- **New elements**: Marked with `*[index]*` when they appear

## Stagehand Accessibility Tree Format

### What the LLM Sees:

```
Accessibility Tree: 
[8] RootWebArea: Google
  [24] scrollable
    [52] body
      [57] div
        [60] navigation
          [63] link: About Google
          [65] link: Store
          [68] div
            [70] div
              [72] link: Gmail
              [75] link: Images
                [76] StaticText: Images
            [79] button: Google Apps
              [81] image
            [85] link: Sign in
        [97] image
        [19] search
          [141] div
            [145] div
              [151] image
              [20] combobox: Search
              [160] div
                [175] button: Search by voice
                  [176] image
                [180] button: Search by image
                  [181] image
            [343] center
              [344] button: Google Search
              [347] button: I'm Feeling Lucky
        [398] div
          [399] StaticText: Google offered in:
          [400] link: English
        [406] contentinfo
          [410] StaticText: United States
          [411] div
            [412] div
              [413] link: Advertising
              [415] link: Business
              [417] link: How Search works
            [423] div
              [424] link: Privacy
              [426] link: Terms
              [435] button: Settings
```

### Key Characteristics:
- **Dense indexing**: ALL elements get `[index]` numbers
- **Role-based format**: `[index] role: text`
- **Hierarchical structure**: Full tree with indentation
- **Complete view**: Shows all elements including containers
- **Text nodes**: Explicitly marked as `StaticText`
- **Semantic roles**: Uses accessibility roles (link, button, combobox)
- **Chrome CDP source**: Direct from Chrome's Accessibility API

## Key Differences

| Aspect | Browser-Use | Stagehand |
|--------|-------------|-----------|
| **Indexing** | Sparse (interactive only) | Dense (all elements) |
| **Format** | HTML-like `<tag>` | Role-based `role: text` |
| **Structure** | Flattened | Full hierarchy |
| **Text Nodes** | Inline plain text | Explicit `StaticText` |
| **Source** | DOM traversal + filtering | Chrome Accessibility Tree |
| **Token Efficiency** | High (minimal elements) | Low (all elements) |
| **Element Reference** | By index `[0]` | By index `[63]` |
| **Attributes** | Selected HTML attributes | Minimal (role + text) |

## Example: Same Button in Both Formats

**Browser-Use:**
```
[10]<input value='Google Search' aria-label='Google Search' name='btnK' role='button' type='submit' />
```

**Stagehand:**
```
[344] button: Google Search
```

## For Scout System Integration

The Scout would need to understand these format differences and provide the Director with:

1. **Multiple selector strategies** that work in both systems:
   ```javascript
   {
     "browserUseIndex": "[10]",
     "stagehandIndex": "[344]",
     "cssSelectors": ["input[name='btnK']", "[aria-label='Google Search']"],
     "xpath": "/html/body/div[1]/div[3]/form/div[1]/div[1]/div[3]/center/input[1]",
     "textSelector": "text:Google Search",
     "attributes": {
       "name": "btnK",
       "type": "submit",
       "value": "Google Search"
     }
   }
   ```

2. **Format-agnostic patterns** for the Director to use
3. **Timing and behavior information** that applies regardless of format
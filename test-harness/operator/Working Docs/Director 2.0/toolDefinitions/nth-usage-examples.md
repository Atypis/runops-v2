# Nth Element Selection - Usage Examples

## Overview

The `nth` parameter enables Directors to programmatically select specific elements from lists during workflow execution. This document provides practical examples of how to use this feature.

## Basic Usage

### Static Index Selection

```javascript
// Click the third email in the list (0-indexed)
create_node({
  type: "browser_action",
  config: {
    action: "click",
    selector: "tr.zA",
    nth: 2
  },
  alias: "click_third_email"
})

// Click the last button
create_node({
  type: "browser_action", 
  config: {
    action: "click",
    selector: "button.submit",
    nth: -1
  },
  alias: "click_last_button"
})

// Use keyword for first element
create_node({
  type: "browser_action",
  config: {
    action: "click", 
    selector: ".tab",
    nth: "first"
  },
  alias: "click_first_tab"
})
```

## Dynamic Usage with Iteration

### Processing a List of Emails

```javascript
// 1. First count the emails
create_node({
  type: "browser_query",
  config: {
    method: "count",
    selector: "tr.zA",
    store_variable: true
  },
  alias: "count_emails"
})

// 2. Create an array to iterate over
create_node({
  type: "transform",
  config: {
    operation: "code",
    code: "return Array.from({length: input.count}, (_, i) => i);",
    inputSource: "{{count_emails}}"
  },
  alias: "email_indices"
})

// 3. Iterate through each email
create_node({
  type: "iterate",
  config: {
    over: "{{email_indices}}",
    variable: "emailIndex",
    body: [
      {
        type: "browser_action",
        config: {
          action: "click",
          selector: "tr.zA",
          nth: "{{emailIndex}}"
        },
        alias: "click_email"
      },
      {
        type: "browser_action",
        config: {
          action: "wait",
          type: "time",
          value: "1000"
        },
        alias: "wait_for_email_load"
      },
      {
        type: "browser_ai_query",
        config: {
          method: "extract",
          instruction: "Extract the email sender, subject, and date",
          store_variable: true
        },
        alias: "extract_email_details"
      },
      {
        type: "browser_action",
        config: {
          action: "back"
        },
        alias: "go_back_to_list"
      }
    ]
  },
  alias: "process_all_emails"
})
```

## Advanced Patterns

### Skip Pattern - Process Every Other Item

```javascript
create_node({
  type: "iterate",
  config: {
    over: "{{Array(10).keys()}}",
    variable: "i",
    body: [
      {
        type: "browser_action",
        config: {
          action: "click",
          selector: ".item",
          nth: "{{i * 2}}"  // Click every other item: 0, 2, 4, 6, 8
        },
        alias: "click_even_items"
      }
    ]
  },
  alias: "process_even_items"
})
```

### Reverse Processing - Start from End

```javascript
// Process items from last to first
create_node({
  type: "iterate",
  config: {
    over: "{{Array(itemCount).keys()}}",
    variable: "i",
    body: [
      {
        type: "browser_action",
        config: {
          action: "click",
          selector: ".item",
          nth: "{{-1 - i}}"  // -1, -2, -3, etc.
        },
        alias: "click_from_end"
      }
    ]
  },
  alias: "process_reverse"
})
```

### Batch Processing with Offset

```javascript
// Process items 5-10
create_node({
  type: "iterate",
  config: {
    over: "{{[5, 6, 7, 8, 9]}}",
    variable: "index",
    body: [
      {
        type: "browser_action",
        config: {
          action: "click",
          selector: ".search-result",
          nth: "{{index}}"
        },
        alias: "click_result"
      }
    ]
  },
  alias: "process_batch"
})
```

## Error Handling

### Graceful Degradation

```javascript
// Try to click an element, continue if it doesn't exist
create_node({
  type: "handle",
  config: {
    errorPattern: "No element at index",
    body: [
      {
        type: "browser_action",
        config: {
          action: "click",
          selector: ".optional-element",
          nth: 5
        },
        alias: "try_click_sixth"
      }
    ],
    errorBody: [
      {
        type: "transform",
        config: {
          operation: "code",
          code: "console.log('Element not found, continuing...');"
        },
        alias: "log_not_found"
      }
    ]
  },
  alias: "safe_click"
})
```

## Common Use Cases

### 1. Gmail Email Processing
```javascript
// Click specific email by position
nth: "{{emailPosition}}"
```

### 2. Table Row Selection
```javascript
// Select specific row in data table
selector: "table.data-table > tbody > tr"
nth: "{{rowIndex}}"
```

### 3. Dropdown Option Selection
```javascript
// Select specific option from dropdown
selector: "select.country-list > option"
nth: "{{countryIndex}}"
```

### 4. Pagination - Click Page Numbers
```javascript
// Click specific page number
selector: "ul.pagination > li > a"
nth: "{{pageNumber - 1}}"  // Convert 1-based to 0-based
```

### 5. Tab Navigation
```javascript
// Switch between tabs by index
selector: "div.tab-container > button.tab"
nth: "{{tabIndex}}"
```

## Best Practices

1. **Always verify element count first** when iterating through unknown lists
2. **Use negative indices** for accessing elements from the end
3. **Handle errors gracefully** when element might not exist
4. **Use keywords** ("first", "last") for better readability when appropriate
5. **Remember zero-based indexing** - the first element is at index 0

## Debugging Tips

1. Use `count` method first to see how many elements match:
```javascript
{
  type: "browser_query",
  config: {
    method: "count",
    selector: "your-selector"
  }
}
```

2. Use `inspect_tab` to verify selectors before using nth:
```javascript
inspect_tab({
  tabName: "main",
  inspectionType: "dom_snapshot"
})
```

3. Start with static indices during development, then make dynamic:
```javascript
// Development: nth: 0
// Production: nth: "{{index}}"
```
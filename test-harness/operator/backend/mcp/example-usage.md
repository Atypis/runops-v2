# MCP Server Example Usage

Once you have the MCP server configured in Claude Code, here's how to use it:

## 1. Set Workflow Context

First, set the workflow you want to work on:

```javascript
// Create a new workflow
mcp_set_workflow_context({
  workflow_id: "test-workflow-1",
  create_if_missing: true
})

// Or use an existing workflow
mcp_list_workflows({ limit: 5 })
mcp_set_workflow_context({ workflow_id: "existing-workflow-id" })
```

## 2. Explore a Web Page

```javascript
// Navigate to a page
browser_action({
  action: "navigate",
  config: { url: "https://example.com" },
  reason: "Starting exploration"
})

// Get page overview
dom_overview({
  filters: {
    interactives: true,
    headings: true
  }
})

// Search for specific elements
dom_search({
  query: {
    text: "Sign in"
  }
})

// Inspect an element (use ID from search results)
dom_inspect({
  elementId: "[123]"
})
```

## 3. Build Workflow Nodes

```javascript
// Add a navigation node
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_action",
    config: {
      action: "navigate",
      url: "https://example.com"
    },
    alias: "go_to_example",
    description: "Navigate to example.com"
  }]
})

// Add a click action
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_action",
    config: {
      action: "click",
      selector: "button[aria-label='Sign in']"
    },
    alias: "click_sign_in",
    description: "Click the sign in button"
  }]
})

// Add data extraction
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_query",
    config: {
      method: "deterministic_extract",
      selector: ".user-info",
      fields: {
        name: ".name",
        email: ".email"
      }
    },
    alias: "extract_user_info",
    description: "Extract user information"
  }]
})
```

## 4. Execute and Test

```javascript
// Execute all nodes
execute_nodes({
  nodeSelection: "all",
  mode: "flow"
})

// Execute specific nodes
execute_nodes({
  nodeSelection: "1-3",
  mode: "isolated"
})

// Check variables
get_workflow_variables({ variableName: "all" })
```

## 5. Document Your Workflow

```javascript
// Update workflow description
update_workflow_description({
  description: {
    workflow_name: "Example Login Flow",
    goal: "Automate login to example.com",
    trigger: "Manual",
    actors: ["Example.com account"],
    happy_path_steps: [
      "Navigate to example.com",
      "Click sign in button",
      "Enter credentials",
      "Submit form",
      "Verify login success"
    ],
    success_criteria: [
      "User is logged in",
      "Dashboard is visible"
    ]
  },
  reason: "Initial workflow documentation"
})

// Create a plan
update_plan({
  plan: {
    overall_goal: "Automate login process",
    current_phase: "Setup",
    phases: [{
      phase_name: "Setup",
      status: "completed",
      tasks: [{
        task_id: 1,
        description: "Navigate to login page",
        status: "completed"
      }]
    }]
  },
  reason: "Starting implementation"
})
```

## 6. MCP-Specific Utilities

```javascript
// Get full context
mcp_get_current_context()

// Take a screenshot
mcp_browser_screenshot({
  fullPage: true,
  format: "png"
})

// See tool usage
mcp_get_tool_usage_stats()
```

## Common Patterns

### Loop Over Items
```javascript
// Extract list of items
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_query",
    config: {
      method: "deterministic_extract",
      selector: ".item",
      fields: {
        title: ".title",
        link: "@href"
      },
      store_variable: true
    },
    alias: "extract_items"
  }]
})

// Iterate over items
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "iterate",
    config: {
      over: "{{extract_items}}",
      variable: "item",
      body: [/* node positions to execute */]
    },
    alias: "process_items"
  }]
})
```

### Conditional Logic
```javascript
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "route",
    config: [{
      name: "has_results",
      condition: "{{items.length}} > 0",
      branch: [/* nodes if true */]
    }, {
      name: "default",
      condition: "true",
      branch: [/* nodes if false */]
    }]
  }]
})
```
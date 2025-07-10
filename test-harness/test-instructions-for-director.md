# Test Instructions for Director - New Reference System

## Quick Test Script

Tell the Director exactly this:

---

**"Hey Director, let's test the new stable reference system. Please do the following:"**

### 1. Create a Simple Workflow
"Create a workflow that:
1. Navigates to Google
2. Extracts the page title
3. Logs the result"

### 2. Test Insert Functionality
"Now insert a wait node at position 2 (between navigation and extraction)"

### 3. Add Another Node That References Earlier Results
"Add a cognition node at the end that references the extracted title using the new alias syntax"

### 4. Execute and Verify
"Execute nodes 1-4 and show me:
- The position of each node
- The alias of each node
- That the references still work after insertion"

---

## Expected Behavior

The Director should:

1. **Create initial nodes** with auto-generated aliases like:
   - Position 1: `navigate_to_google` 
   - Position 2: `extract_the_page_title`
   - Position 3: `log_the_result`

2. **Insert at position 2**, causing:
   - Old position 2 → becomes position 3
   - Old position 3 → becomes position 4
   - New node at position 2

3. **Use alias references** like:
   ```javascript
   // Instead of {{node2.result}}
   {{extract_the_page_title.pageTitle}}
   
   // Or with namespace
   {{n:extract_the_page_title.pageTitle}}
   ```

4. **Show that references work** even after positions changed

## Specific Things to Watch For

1. **Alias Generation**: Check that descriptions become snake_case aliases
2. **Position Shifting**: Verify nodes shift correctly on insert
3. **Reference Stability**: Confirm that `{{extract_the_page_title.result}}` works regardless of position
4. **Environment Variables**: Test `{{env:GMAIL_EMAIL}}` format if needed

## Sample Director Commands

```
# Initial creation
create_node({type: "browser_action", config: {action: "navigate", url: "https://google.com"}, description: "Navigate to Google"})
create_node({type: "browser_query", config: {method: "extract", instruction: "Get page title", schema: {pageTitle: "string"}}, description: "Extract the page title"})

# Test insertion
insert_node_at({position: 2, node: {type: "browser_action", config: {action: "wait", duration: 2000}, description: "Wait for page load"}})

# Add reference test
create_node({type: "cognition", config: {prompt: "The page title is: {{extract_the_page_title.pageTitle}}"}, description: "Process the title"})

# Execute all
execute_nodes({nodeSelection: "1-4"})
```

## What Success Looks Like

- Nodes have both positions AND aliases
- Insert shifts positions but aliases stay the same
- References using aliases work after reorganization
- The workflow executes successfully with the new reference format
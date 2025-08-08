# browser_ai_query Simplification

## Date: 2025-07-16

### Problem
The original `browser_ai_query` had 3 methods (extract, observe, assess) that were artificially different:
- `extract` - Get structured data with schema
- `observe` - Get text description (no schema)
- `assess` - Check condition (no schema)

This was confusing because they all fundamentally do the same thing: "use AI to get content from the page"

### Solution
Simplified to a single approach:
- Removed the `method` field entirely
- Made `schema` required for ALL uses
- Everything now uses StageHand's `extract()` method

### Benefits
1. **Consistency** - Always returns structured data
2. **No more Zod errors** - Schema is always present
3. **Simpler mental model** - Just one way to query the page with AI
4. **Better for Director** - Forces explicit thinking about data structure

### Examples

**Text extraction (formerly "observe"):**
```json
{
  "type": "browser_ai_query",
  "config": {
    "instruction": "Describe what you see on the page",
    "schema": {"description": "string"}
  },
  "alias": "page_description"
}
```

**Boolean check (formerly "assess"):**
```json
{
  "type": "browser_ai_query", 
  "config": {
    "instruction": "Check if the login button is visible",
    "schema": {"isVisible": "boolean", "reason": "string"}
  },
  "alias": "login_check"
}
```

**Structured data (formerly "extract"):**
```json
{
  "type": "browser_ai_query",
  "config": {
    "instruction": "Get product details",
    "schema": {"name": "string", "price": "number", "inStock": "boolean"}
  },
  "alias": "product_info"
}
```

### Implementation Details
- Updated `toolDefinitionsV2.js` to have single schema with required `instruction` and `schema`
- Updated `nodeExecutor.js` to remove method switching and always use extract
- Better error messages guide users to provide proper schemas
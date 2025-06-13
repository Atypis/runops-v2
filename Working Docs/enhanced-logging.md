# Enhanced AEF Logging Implementation Ticket

## 🎯 **PRIORITY 1 - IMMEDIATE IMPLEMENTATION**

### 1. **Raw Stagehand Commands** ⭐ HIGHLY RECOMMENDED
**Current Status**: 🔶 BASIC - Only showing action type  
**Target**: Log exact Stagehand API calls with full context

**Implementation Details**:
- Capture `page.act()`, `page.extract()`, `page.observe()` calls before execution
- Log the exact method name and all parameters
- Include timing for each individual Stagehand command
- Show retry attempts if commands fail

**Example Log Entry**:
```json
{
  "type": "stagehand_command",
  "title": "Stagehand Command: page.act()",
  "content": "await page.act({\n  action: \"Click the login button\",\n  timeoutMs: 8000,\n  domSettleTimeoutMs: 2000\n})",
  "metadata": {
    "command": "act",
    "parameters": {
      "action": "Click the login button",
      "timeoutMs": 8000,
      "domSettleTimeoutMs": 2000
    },
    "startTime": "2025-01-15T10:30:00.000Z"
  }
}
```

### 2. **Command Parameters** ⭐ MUST HAVE
**Current Status**: 🔶 BASIC - Missing detailed parameters  
**Target**: Full instruction text, selectors, schemas, and all configuration

**Implementation Details**:
- Log complete instruction text for `act()` commands
- Capture full Zod schemas for `extract()` commands
- Include selectors, timeouts, and all optional parameters
- Show variable substitutions that occurred

**Example Log Entry**:
```json
{
  "type": "command_parameters",
  "title": "Extract Command Parameters",
  "content": "Instruction: \"Extract all email threads from the inbox\"\nSchema: {\n  \"threads\": {\n    \"type\": \"array\",\n    \"items\": {\n      \"sender\": {\"type\": \"string\"},\n      \"subject\": {\"type\": \"string\"},\n      \"date\": {\"type\": \"string\"}\n    }\n  }\n}",
  "metadata": {
    "instruction": "Extract all email threads from the inbox",
    "schema": {...},
    "timeout": 10000,
    "variablesUsed": ["user_email"]
  }
}
```

### 3. **Full LLM Prompts & Responses** ⭐ CRITICAL FIX
**Current Status**: ❌ MISSING - Only showing node labels, not actual LLM interactions  
**Target**: Complete prompts sent to Claude/GPT and their full responses

**Current Problem**: 
- We see: "Node Started: Enter Password"
- We should see: The actual 2000+ character prompt sent to the LLM

**Implementation Details**:
- Intercept all LLM API calls in Stagehand
- Log the complete system prompt + user prompt
- Capture the full LLM response before parsing
- Include conversation context if multi-turn

**Example Log Entry**:
```json
{
  "type": "llm_prompt",
  "title": "LLM Prompt Generated",
  "content": "You are an AI assistant helping with browser automation...\n\nCurrent page context:\n- URL: https://accounts.google.com\n- Page title: Sign in - Google Accounts\n- Viewport: 1920x1080\n\nYour task: Click the login button\n\nAccessibility tree:\n<main role=\"main\">\n  <div class=\"signin-card\">\n    <button id=\"identifierNext\" class=\"VfPpkd-LgbsSe\">Next</button>\n  </div>\n</main>\n\nPlease analyze the page and determine the best action.",
  "metadata": {
    "model": "claude-3-5-sonnet-20241022",
    "promptLength": 2847,
    "contextTokens": 1200
  }
}
```

### 4. **Model Information** ⭐ RECOMMENDED
**Current Status**: ❌ MISSING  
**Target**: Track which model, temperature, token usage, and costs

**Implementation Details**:
- Capture model name and version for each LLM call
- Log temperature, max_tokens, and other parameters
- Track input/output token counts
- Calculate estimated costs per call

**Example Log Entry**:
```json
{
  "type": "llm_response",
  "title": "LLM Response Received",
  "content": "I can see the Google sign-in page. I need to click the \"Next\" button to proceed with login. The button has id=\"identifierNext\" and is clearly visible.",
  "metadata": {
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.1,
    "inputTokens": 1200,
    "outputTokens": 45,
    "estimatedCost": 0.0024,
    "duration": 890
  }
}
```

### 5. **Accessibility Trees** ⭐ CHEF'S SPECIAL
**Current Status**: ❌ MISSING  
**Target**: Full DOM trees given to LLM (expandable/collapsible in UI)

**Implementation Details**:
- Capture the complete accessibility tree sent to LLM
- Make it expandable/collapsible in the frontend by default
- Show tree size and complexity metrics
- Highlight the specific elements the LLM focused on

**Example Log Entry**:
```json
{
  "type": "accessibility_tree",
  "title": "Accessibility Tree Extracted",
  "content": "<main role=\"main\" aria-label=\"Google Sign-in\">\n  <div class=\"signin-card\">\n    <h1>Sign in</h1>\n    <input type=\"email\" id=\"identifierInput\" aria-label=\"Email\">\n    <button id=\"identifierNext\" class=\"VfPpkd-LgbsSe\" aria-label=\"Next\">Next</button>\n  </div>\n</main>",
  "metadata": {
    "url": "https://accounts.google.com",
    "treeSize": 2847,
    "elementCount": 23,
    "interactiveElements": 5,
    "extractionTime": 120
  }
}
```

---

## 🔮 **FUTURE ENHANCEMENTS - RECOMMENDED FOR LATER**

### **Visual Evidence & Screenshots**
- **Element Highlighting Screenshots**: Screenshots with target elements highlighted
- **Before/After Visual Comparison**: Side-by-side screenshots showing changes
- **Video Session Recording**: Full session recording for complex workflows

### **Performance & Optimization**
- **Command Timing Breakdown**: Individual command performance vs total node time
- **Page Performance Metrics**: Load times, resource sizes, network requests
- **Resource Usage Monitoring**: Memory, CPU usage during execution

### **Error Handling & Debugging**
- **Error Context Capture**: Page state when errors occurred
- **Recovery Attempts Logging**: What the system tried when things failed
- **Timeout Analysis**: Detailed timeout reasons and page state

### **Advanced Analytics**
- **Success/Failure Rate Tracking**: Historical reliability metrics per node
- **Cost Analytics Dashboard**: LLM API costs and usage patterns
- **Variable Context Logging**: Variable values at each execution step

### **Network & Browser Deep Dive**
- **Network Request Monitoring**: HTTP requests made during actions
- **Console Log Capture**: Browser console messages and errors
- **Page Load Event Tracking**: DOMContentLoaded, load, network idle events

---

## 📋 **IMPLEMENTATION PLAN**

### **Phase 1**: Core LLM & Command Logging
1. Fix LLM prompt/response capture in NodeLogger
2. Add Stagehand command interception
3. Enhance command parameter logging
4. Add model information tracking

### **Phase 2**: Visual & Context Enhancement  
1. Implement accessibility tree capture
2. Add expandable/collapsible UI components
3. Enhance screenshot capture with metadata

### **Phase 3**: Performance & Analytics
1. Add detailed timing breakdowns
2. Implement cost tracking
3. Add performance metrics

---

## 🔧 **TECHNICAL IMPLEMENTATION NOTES**

### **Where to Add Logging**:
- **ExecutionEngine**: Already has basic node lifecycle
- **HybridBrowserManager**: Needs Stagehand command interception
- **NodeLogger**: Needs new methods for LLM and command logging
- **Frontend**: Needs expandable log components

### **Database Schema Updates**:
- Current `aef_node_logs` table supports all needed fields
- `metadata` JSONB field can store complex command parameters
- Consider adding `log_size` field for large accessibility trees

### **Frontend Enhancements**:
- Add syntax highlighting for code blocks
- Implement expandable/collapsible sections
- Add filtering by log type
- Show token counts and costs in summary

---

## ✅ **SUCCESS CRITERIA**

After implementation, users should see:
1. **Complete LLM conversations** - Full prompts and responses
2. **Exact Stagehand commands** - Copy-pasteable code with parameters
3. **Rich context** - Accessibility trees, model info, timing
4. **Visual evidence** - Screenshots with highlighted elements
5. **Performance insights** - Token usage, costs, timing breakdowns

This will transform the logging from basic lifecycle events to a comprehensive execution audit trail that enables deep debugging and optimization. 
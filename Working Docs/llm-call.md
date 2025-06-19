# LLM Call Node ( `llm_call` ) – Implementation Plan

> Version 0.1 — 2025-05-29

---

## 1  Why we need it
Stagehand-powered nodes are great for browser interaction but heavyweight for plain language or JSON processing. A lightweight `llm_call` node lets authors invoke an LLM directly (OpenAI, Anthropic, Groq, etc.) for classification, transformation, or generation **without** booting a browser container.

## 2  High-level design
• **Node type**: `llm_call`  
• **Executor**: `executeLLMCallNode` inside `execution_engine/engine.ts`  
• **Client**: thin `LLMClient` abstraction wrapping OpenAI SDK (existing in `stagehand/lib/llm/*`)

## 3  Minimal JSON shape
```jsonc
{
  "id": "summarise_thread",
  "type": "llm_call",
  "label": "Summarise Thread",
  "intent": "Summarise the email thread for CRM notes",
  "inputKey": "currentThread",           // dot-notation OK; default = whole state
  "outputKey": "threadSummary",          // where to write parsed result
  "model": "o4-mini",                    // optional; falls back to env default
  "promptTemplate": "{{input}}\n\nSummarise in 50 words.",
  "outputSchema": { "type": "string" }, // optional JSONSchema for validation
  "settings": {
    "temperature": 0.3,
    "maxTokens": 200
  }
}
```

## 4  Execution algorithm (pseudo)
1. `input = state.resolve(inputKey)` (if missing → `{}`)
2. Render `prompt = Mustache.render(promptTemplate, { input })`
3. `response = llmClient.call({ model, prompt, settings })`
4. `parsed = tryParseJSON(response) || response`  
   – If `outputSchema` provided → validate with Zod/Ajv; throw on mismatch
5. `state.set(outputKey, parsed)` and log latency/cost

## 5  Engine changes
1. Add `case 'llm_call': await this.executeLLMCallNode(node);` in master switch.
2. Implement `private async executeLLMCallNode(node)` (≈ 60 LoC):
   • Resolve inputs  
   • Build prompt  
   • Call `LLMClient`  
   • Validate & store  
   • Emit log lines similar to other nodes.

## 6  Schema updates
* `workflows/schemas/workflow-schema.json` → add `'llm_call'` to `enum` for `node.type`.
* Document optional `outputSchema`, `settings`.

## 7  Supporting code
• **LLMClient.ts** (if not yet): wrapper with retry/back-off, cost tracking.  
• Global rate-limit guard (`process.env.LLM_RATE_LIMIT_TOKENS_PER_MIN`).

## 8  Unit tests
1. Happy-path: mock OpenAI → returns JSON, validated & stored.
2. Validation failure retries once → then error.
3. Dot-notation input resolution.

## 9  Roll-out plan
| Phase | Task | Owner | ETA |
|-------|------|-------|-----|
| 0 | Merge schema + engine support behind feature flag | | |
| 1 | Convert **filter_list** to use `executeLLMCallNode` internally | | |
| 2 | Author two demo workflows in `examples/` | | |
| 3 | Update docs & diagrams | | |

## 10  Future extensions
• Support **streaming** responses for long generation tasks.  
• Allow multiple prompts/batch execution to amortise token overhead.  
• Plug-in compliance hooks (PII redaction, moderation).

---
**Decision log:** created after discussion on 2025-05-29 to decouple LLM calls from Stagehand containers. 
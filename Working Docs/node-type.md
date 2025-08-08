# AEF Node Type Reference

> **Version:** June 2025 · covers both **Stagehand-native** primitives and **AEF-specific** orchestration nodes.

---

## 1 · Stagehand-native primitives  
These are the low-level building blocks provided directly by the Stagehand SDK.

| Node type | Purpose | Key fields | Minimal example |
|-----------|---------|-----------|-----------------|
| `act` | Perform an explicit browser action described in natural language | `action`, `variables?`, `timeoutMs?`, `domSettleTimeoutMs?` | ```js
await page.act({
  action: "Click the 'Add to cart' button",
  timeoutMs: 8_000
});
``` |
| `extract` | Extract structured data from the DOM using an LLM + Zod schema | `instruction`, `schema`, `selector?`, `timeoutMs?` | ```js
const price = await page.extract({
  instruction: "extract the price of the item",
  schema: z.object({ price: z.number() })
});
``` |
| `observe` | Return candidate DOM elements and optional suggested action | `instruction?`, `returnAction?`, `timeoutMs?` | ```js
const observations = await page.observe({
  instruction: "Find the buttons on this page"
});
``` |
| `agent` | Launch an autonomous agent that can plan / act / extract iteratively | `provider`, `model`, `instructions?`, `maxSteps?` | ```js
const agent = stagehand.agent({ model: "computer-use-preview" });
await agent.execute("Sign me up for a library card");
``` |

---

## 2 · AEF orchestration node types  
These wrap one-or-many Stagehand calls and add execution logic (branching, retries, credential injection, etc.).

### Quick cheat-sheet

| Node type | One-line purpose |
|-----------|------------------|
| `atomic_task` | Smallest executable unit – runs one or more Stagehand actions sequentially |
| `compound_task` | Parent node grouping children; can set `canExecuteAsGroup` to **true** |
| `iterative_loop` | Repeat its children until an exit condition is met |
| `decision` | Branch execution based on runtime data (`outboundEdges` map) |
| `assert` | Validate state (URL match, text present, etc.) and fail fast on error |
| `error_handler` | Local rescue block that can pause, retry or escalate to human |
| `data_transform` | Pure server-side function that mutates / enriches data |
| `generator` | Call an LLM/VLM to generate new content (summaries, text, code) |
| `explore` | Open-ended AI step for discovery / troubleshooting (GPT-4-o tooling) |

---

### 2.1 `atomic_task`
Minimal, self-contained step.

```json
{
  "id": "navigate_to_gmail",
  "type": "atomic_task",
  "label": "Navigate to Gmail Login",
  "actions": [
    {
      "type": "navigate",
      "instruction": "Navigate to Gmail login page",
      "target": { "url": "https://accounts.google.com/signin/v2/identifier?service=mail" },
      "timeout": 10000
    }
  ]
}
```

---

### 2.2 `compound_task`
Orchestrates a set of child nodes.

```json
{
  "id": "gmail_auth_flow",
  "type": "compound_task",
  "label": "Gmail Authentication Flow",
  "children": [
    "navigate_to_gmail",
    "enter_email",
    "enter_password",
    "verify_login_success"
  ],
  "canExecuteAsGroup": true,
  "actions": []
}
```

---

### 2.3 `iterative_loop`
Executes its children repeatedly until an exit `decision` node returns **N**.

```json
{
  "id": "email_processing_loop",
  "type": "iterative_loop",
  "label": "Process Each Investor Email",
  "children": [
    "select_email",
    "extract_investor_info",
    "open_airtable",
    "decide_more_emails"
  ],
  "retryPolicy": {
    "max": 5,
    "backoffMs": [0, 2000, 5000],
    "circuitBreaker": true
  }
}
```

---

### 2.4 `decision`
Branches based on extracted data.

```json
{
  "id": "check_2fa",
  "type": "decision",
  "label": "Check 2FA Required",
  "conditionSchema": {
    "type": "object",
    "properties": { "twoFactorRequired": { "type": "boolean" } }
  },
  "outboundEdges": { "Y": "handle_2fa", "N": "enter_password" },
  "actions": [
    {
      "type": "extract",
      "instruction": "Check if 2FA verification is required",
      "schema": { "twoFactorRequired": "boolean" }
    }
  ]
}
```

---

### 2.5 `assert`
Halts the run if the condition fails.

```json
{
  "id": "verify_login_success",
  "type": "assert",
  "label": "Verify Login Success",
  "assertConditions": [
    { "type": "urlMatch", "value": "mail.google.com/mail" }
  ],
  "actions": [
    {
      "type": "wait_for_navigation",
      "instruction": "Wait for Gmail inbox to load",
      "target": { "url_contains": "mail.google.com/mail" },
      "timeout": 15000
    }
  ]
}
```

---

### 2.6 `error_handler`
Local rescue / human-in-the-loop.

```json
{
  "id": "handle_2fa",
  "type": "error_handler",
  "label": "Handle 2FA Verification",
  "humanEscalate": true,
  "fallbackAction": "pause_for_human_2fa",
  "actions": [
    {
      "type": "act",
      "instruction": "Wait for human to complete 2FA or handle automatically",
      "timeout": 60000
    }
  ]
}
```

---

### 2.7 `data_transform`
Pure JavaScript executed server-side.

```json
{
  "id": "data_transform_normalize",
  "type": "data_transform",
  "label": "Normalize Investor Data",
  "transformFunction": "data => ({ ...data, email: data.email?.toLowerCase() })",
  "actions": []
}
```

---

### 2.8 `generator`
LLM-powered content generation.

```json
{
  "id": "generate_thread_summary",
  "type": "generator",
  "label": "Generate Thread Summary",
  "actions": [
    {
      "type": "extract",
      "instruction": "Generate a concise 2-line summary of the email thread",
      "schema": { "threadSummary": "string" }
    }
  ]
}
```

---

### 2.9 `explore`  *(not used in v2 workflow yet)*
Free-form AI exploration.

```json
{
  "id": "explore_unknown_state",
  "type": "explore",
  "label": "Explore Page State",
  "actions": [
    {
      "type": "act",
      "instruction": "Describe what you see on the page and suggest next steps"
    }
  ]
}
```

---

## 3 · Source of truth

* Stagehand primitives are defined in `stagehand/types/stagehand.ts` and documented under `stagehand/docs/reference/*`.
* AEF orchestration nodes are validated by `app_frontend/aef/workflows/schemas/workflow-schema.json` and explained in `Working Docs/AEF-Doc.md`.

> Keep this file updated whenever new node types or fields are added. 
# Gmail → Airtable Investor CRM SOP Overhaul

## 0  Purpose
Design an execution playbook that reaches **≥ 90 % real-world reliability** (stretch goal ≈ 100 %) when processing daily investor emails in Gmail and updating the Airtable CRM. The document consolidates gap analysis, new node architecture, control-flow redesign, Stagehand usage guidelines, and an implementation roadmap.

---

## 1  Guiding Principles
1. **Deterministic first, AI second** – rely on mechanical selectors & Playwright loops where possible; use Stagehand LLM only for brittle interactions.
2. **Fail fast, retry cheap** – guard with `assert` nodes, localised retries, and circuit-breakers.
3. **Stateless loops** – clear Stagehand conversation memory after each item; queue email/thread IDs outside the prompt.
4. **Idempotency** – mark every processed artefact (Gmail label, Airtable hash) so reruns never duplicate work.
5. **Observability** – detailed log per compound task & metrics for success, retries, and latency.

---

## 2  Gap Analysis (Summary)
| Area | Weakness │ Break Risk |
|------|----------|------------|
| Authentication | No 2FA branch, multi-account chooser, token expiry | Login dead-ends |
| DOM drift | Hard CSS selectors, little vision usage | Click/Type misses |
| Loop exit | Implicit "more_emails_to_process" string | Infinite loop |
| Decision branches | Investor? Record exists? not serialised | Non-replayable |
| Memory | Prompt grows with each extract | LLM degradation |
| Error handling | Single global retry | Unrecoverable failure |
| Idempotency | Email not labelled, record duplication | Double-processing |

---

## 3  Node & Schema Extensions
1. **decision** – outbound edges `Y` / `N`, stores chosen path.
2. **assert** – pre-condition guard (`selectorVisible`, `urlMatch`).
3. **error_handler** – `retryPolicy`, `fallbackAction`, `humanEscalate`.
4. **data_transform** – pure JS for post-extraction clean-ups.
5. **generator** – LLM summariser (`Thread Summary / Notes`).
6. **explore** – bounded `observe` loop (`maxActions`).

Schema stubs added to `definitions` in `workflow-schema.json`.

---

## 4  Workflow Redesign (High-level)
### 4.1  Authentication Compound
1. `gmail_login_flow`
   - `decision` → account chooser present?
   - `decision` → 2FA triggered?
   - `error_handler` wrapping retries & human OTP.
2. `airtable_auth_flow`
   - Refresh PAT on 401.

### 4.2  Email Candidate Harvest
1. `gmail_search_today` *(Playwright)* – type `after:YYYY/MM/DD before:YYYY/MM/DD+1`.  
2. `paginate_extract`
   - While `Older` enabled **AND** oldest ≥ today:  
     a. `extract_visible_threads` → JSON array.  
     b. Click Older.
3. Result: queue of thread IDs in engine memory.

### 4.3  Iterative Loop per Investor Email
1. `select_email` – click thread ID (cached selector).
2. `extract_investor_info` *(useVision:fallback)*.
3. `data_transform_normalise` – phone, hash.
4. `open_airtable` (navigate/switch-tab).
5. `decision` → `record_exists?` using Airtable search.
6. Branch Y: `update_record_sequence` (compound).  
   Branch N: `create_record_sequence`.
7. `label_email_processed` – add Gmail label **AEF-Processed**.
8. `assert` – processed label present.
9. `clearMemory` – Stagehand reset.

### 4.4  Loop Exit
`decision` → more candidates? if **N** → end; else iterate.

---

## 5  Stagehand Usage Matrix
| Task                               | API      | useVision | Memo/Cache |
|------------------------------------|----------|-----------|------------|
| Gmail search input                 | Playwright type | n/a | — |
| Click Older/Newer                  | `act`    | fallback  | cache selector |
| Extract thread list                | `extract`| false     | per-page |
| Click inside email                 | `act`    | fallback  | cache per session |
| Scroll inside Airtable modal       | Playwright wheel | n/a | — |
| Any unknown modal                  | `explore` (observe) | fallback | bounded 6 actions |

---

## 6  Error & Retry Strategy
* `retryPolicy` fields: `{ max:3, backoffMs:[0,1000,3000] }` default.  
* `error_handler` around network/nav nodes; on max retries → escalate.
* Circuit-break outer loop after 5 consecutive failures.

---

## 7  Memory Hygiene
* Call `page.clearMemory()` after each email loop.  
* Use `extract` minimal schema; heavy notes handled by downstream `generator` summariser.  
* Maximum `maxActions` in `explore` ≤ 6.

---

## 8  Idempotency Rules
1. **Gmail** – label `AEF-Processed`. Assert before processing that label absent.  
2. **Airtable** – hash `(investorName+email)`; if exists, update not insert.  
3. **Run-level** – UUID executionId per day; duplicate prevents rerun.

---

## 9  Observability & Metrics
* Log each node's `{start,end,duration,success,retries}` to `/agents/execution_logs`.  
* Emit Prometheus counters: `aef_node_failure_total`, `aef_email_processed_total`, `aef_retry_total`.

---

## 10  Testing & Validation
1. **Unit** – mock Gmail DOM snapshots + Airtable API; verify decision branches.
2. **Integration** – sandbox inbox with 100 mixed mails; expect 0 duplicates, 0 misses.
3. **Chaos** – randomly mutate CSS class names; vision fallback success ≥ 95 %.

---

## 11  Implementation Roadmap
| Phase | Deliverable | Owner | Status |
|-------|-------------|-------|--------|
| 1 | Schema updates + new node types | Backend | ✅ **COMPLETE** |
| 2 | Bulletproof workflow JSON v2.0 | Backend | ✅ **COMPLETE** |
| 3 | Engine logic for `decision`, `assert`, `error_handler` | Backend | 🔄 **IN PROGRESS** |
| 4 | Gmail pagination extractor | Frontend/Playwright | 📋 **PLANNED** |
| 5 | Airtable idempotent upsert + labelling | Frontend | 📋 **PLANNED** |
| 6 | End-to-end test harness & chaos scripts | QA | 📋 **PLANNED** |
| 7 | Roll-out + SRE monitors | DevOps | 📋 **PLANNED** |

---

## 12  Change Management
* Semantic version bump in workflow JSON (`version: 2.0.0`).  
* Migrations: auto-convert old runs → new schema via script.  
* Downtime window: none (canary branch & merge).

---

## 13  Open Questions
1. What is the definitive "Investor-related" heuristic list? Regex vs ML?  
2. Policy for Gmail CAPTCHA / account lock – human escalation SLA.  
3. Airtable rate limits under high volume – need back-pressure?

---

## 14  Implementation Status

### ✅ **COMPLETED DELIVERABLES**

1. **Extended Workflow Schema** (`workflow-schema.json`)
   - Added 6 new node types: `decision`, `assert`, `error_handler`, `data_transform`, `generator`, `explore`
   - Added 5 new action types: `observe`, `clear_memory`, `label_email`, `search_airtable`, `paginate_extract`
   - Added `retryPolicy`, `useVision`, and node-specific properties
   - Full validation schema for bulletproof workflows

2. **Bulletproof Workflow v2.0** (`gmail-investor-crm-v2.json`)
   - **810 lines** of comprehensive workflow definition
   - **35+ nodes** with full error handling and decision branching
   - **Authentication Flow**: Account chooser detection, 2FA handling, human escalation
   - **Email Processing**: Deterministic pagination, investor filtering, idempotency checks
   - **CRM Integration**: Record existence detection, update vs create branching
   - **Memory Management**: Clear Stagehand memory after each email iteration
   - **Circuit Breakers**: Prevent infinite loops and cascading failures
   - **Observability**: Assert nodes for verification at each critical step

### 🔄 **NEXT IMPLEMENTATION STEPS**

1. **ExecutionEngine Updates** - Implement new node type handlers
2. **HybridActionMapper** - Add support for new action types
3. **Frontend Integration** - Update AEFControlCenter to load v2.0 workflow
4. **Testing Framework** - Chaos testing with DOM mutations

### 📊 **RELIABILITY IMPROVEMENTS**

| Area | v1.0 Approach | v2.0 Bulletproof Approach |
|------|---------------|----------------------------|
| **Authentication** | Single path, no 2FA | Decision branches, 2FA handling, human escalation |
| **Email Selection** | Visual scan only | Deterministic search + pagination + filtering |
| **Loop Management** | Implicit string condition | Explicit decision nodes + circuit breakers |
| **Error Handling** | Global retry only | Per-node retry policies + error handlers |
| **Idempotency** | None | Gmail labeling + Airtable hash deduplication |
| **Memory** | Unbounded growth | Clear after each iteration |
| **Observability** | Basic logging | Assert nodes + structured metrics |

**Expected Reliability**: **90-95%** (up from ~60-70% with v1.0)

---

**End of Document** 
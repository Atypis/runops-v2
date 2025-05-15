# SOP Ontology v0.3 

> **Purpose of this file** – A shared vocabulary for describing any recorded workflow so that:
>
> 1. humans can read it,
> 2. React‑Flow can render it,
> 3. a RunOps agent can execute or re‑plan it.
>
> Every bullet now carries a **why‑does‑this-exist?** note so we remember the design intent.

---

## 1 Workflow‑level meta

| Field                            | What it captures                                                                                                              | Why we need it                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **workflow\_id**                 | Stable, generated slug                                                                                                        | Cross‑links artefacts & versions                                                                                       |
| **title**                        | Human‑friendly name                                                                                                           | Shown in dashboards / search                                                                                           |
| **version**                      | SemVer (`1.2.0`)                                                                                                              | Track breaking vs. non‑breaking schema edits                                                                           |
| **goal**                         | Concrete end‑state (*WHAT*)                                                                                                   | Lets runner verify success automatically                                                                               |
| **purpose**                      | Business value / KPI (*WHY*)                                                                                                  | Helps agent pick trade‑offs (speed vs. cost)                                                                           |
| **owner\[]**                     | Person(s) accountable for the whole workflow                                                                                  | Classic RACI – who fixes it when it breaks                                                                             |
| **actors\[]**                    | Entities that perform steps (humans *or* bots)                                                                                | Models hybrid processes; default is owner                                                                              |
| **trigger\[]**                   | How a run starts. `type:` **cron · manual · webhook · workflow · event** `config:` free text (`RRULE`, button id, event name) | Covers: • time‑based • user‑clicked • HTTP webhook • another workflow’s `on_success` • external events (new Slack msg) |
| **required\_apps\[]**            | Each external service + `auth_type` (OAuth, PAT, cookie)                                                                      | Pre‑flight check before execution                                                                                      |
| **global\_variables**            | Params visible everywhere (e.g. `date_range`, `run_id`)                                                                       | Avoids hard‑coding dates, ids in steps                                                                                 |
| **success\_criteria**            | Boolean expression or diff rule                                                                                               | Runner marks ✅/❌ without human                                                                                         |
| **stop\_criteria**               | Abort rules (max retries, low confidence)                                                                                     | Prevents infinite loops / bad writes                                                                                   |
| **metrics\_spec**                | List of counters gauges the runner must emit (`emails_scanned`, `investors_updated`)                                          | Enables health dashboards & SLA alerts                                                                                 |
| **user\_narration** *(optional)* | Raw transcript for LLM context                                                                                                | Keeping it optional avoids duplicate "intent" fields                                                                   |

> **Why no separate *****intent***** field?** – The narrator’s spoken intent lives in **user\_narration**; the *system’s* understanding is expressed via `goal` + `purpose`. One source of truth each.

---

## 2 Abstraction hierarchy — structure & trade‑offs

```
Workflow               ← whole JSON
 ├─ Stage (optional)   ← logical phase (e.g. "Email prep")
 │     pro: tidy for long flows; con: extra nesting for simple ones
 │
 ├─ Step (plan node)   ← what React‑Flow shows by default
 │     type: task | decision | loop | trigger | end
 │     pro: readable graph; con: hides click‑level detail
 │
 └─ AtomicEvent        ← captured click / key / API call
       pro: perfect replay & skill mining; con: very noisy
```

**Binder options**:

1. **Three‑layer (default)** – stage → step → atomic event.  Scales for big, still OK for small.
2. **Two‑layer** – drop *stage*; good for short demos.
3. **Flat** – treat every captured click as a *step*; simplest DSL, ugly diagrams.

*Recommendation:* keep stages optional; parser decides based on step count.

---

## 3 Step schema & enrichments (shown as React‑Flow node)

| Field                       | Rationale                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`                      | Drives node colour / icon and execution logic.                                                                                                                                       |
| `intent`                    | 1‑sentence narration snippet helps humans and AIs understand.                                                                                                                        |
| `condition / iterator`      | Code‑like string for decisions & loops (e.g. `email.isInvestor`).                                                                                                                    |
| `vars_in / vars_out`        | Makes data‑flow explicit; used for LLM planning.                                                                                                                                     |
| `skill_refs.primary`        | How demo did it (UI or API).                                                                                                                                                         |
| `skill_refs.alternatives[]` | Faster / cheaper paths the parser suggests.                                                                                                                                          |
| `dynamic_field_mapping`     | **Explainer**: Spreadsheet UIs rename columns often.  Mapping stores regex like `/(Last )?Contact(ed)?/ → var last_contacted`.  At run‑time the agent fuzzy‑matches visible headers. |
| `credentials_required[]`    | Name of secret in vault (never the secret).                                                                                                                                          |
| `human_intervention`        | If `true`, runner pauses and asks owner.                                                                                                                                             |
| `confidence`                | 0‑1 score on LLM‑generated parts; < 0.8 triggers review.                                                                                                                             |
| `artifacts[]`               | id links to screenshots, DOM, audio.                                                                                                                                                 |
| `error_policy`              | retry & fallback rules local to this node.                                                                                                                                           |

---

## 4 Skill definition (low‑level reusable capability)

| Field                   | What it is                        | Design note                                  |
| ----------------------- | --------------------------------- | -------------------------------------------- |
| **skill\_id**           | `airtable-api-upsert`             | kebab‑case for easy import                   |
| **app**                 | Airtable                          | One skill per target app variant             |
| **method\_type**        | `ui` · `api` · `mcp`              | Drives executor choice                       |
| **viewport**            | `1440×900`                        | UI skills only; selector coords depend on it |
| **steps\[]**            | Ordered **AtomicEvents**          | Allows replay / fine‑grained diff            |
| **variables\_in / out** | Contract with caller step         | Enables re‑use across workflows              |
| **performance\_hint**   | e.g. `batch-safe`, `rate-limited` | Runner can optimise batching                 |

*Why skills?* They keep the run‑time engine simple: each step calls a skill, skills know the gritty selectors or API paths.  Re‑use > copy‑paste.

---

## 5 Cross‑cutting artefact registry

| Field         | Use case                         |
| ------------- | -------------------------------- |
| `artifact_id` | SHA‑256 or UUID so dedup is easy |
| `type`        | `screenshot` · `dom` · `audio`   |
| `url`         | Supabase Storage (pre‑signed)    |
| `timestamp`   | Original capture time for audit  |

---

## 6 Error & compliance block

* **fallback\_order** – Ordered `skill_id[]` to try if primary fails.
* **compliance\_rules** – E.g. *“no PII leaves EU”* Validator reads this.
* **escalation** – Contact to page if auto‑repair fails.

---

## 7 Metrics spec – why bother?

> Runner emits Prom‑style counters so we can graph throughput & failure rates.
> *Examples*

```yaml
emails_scanned:   description: "Total mails examined"   unit: count
investors_updated: description: "CRM rows written"       unit: count
human_interventions: description: "Manual approvals"    unit: count
```

---

## 8 Optimisation hints

Free‑text “advisor” notes dropped by the parser (e.g. *“Consider batching Airtable writes via bulk API – would cut cost \~90 %.”*)

---

### Outstanding design questions (v0.3)

1. **Credentials scope** – per skill vs. per workflow?  Leaning *per skill* (least privilege).
2. **Stage layer worth it?** – Keep optional until a real demo passes 30 steps.
3. **Variable auto‑inventing by parser** – allow but require a human‑approved name before prod.

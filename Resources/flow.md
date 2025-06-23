# Investor-Email → Airtable CRM Workflow (Detailed, Context-Rich)

Legend  
• **NAVIGATION / EXECUTION** – purely mechanical UI or API interaction (click, type, read, copy-paste, open tab, etc.).  
• **THINKING** – reasoning, interpretation, synthesis, decision-making.  
• **CONTEXT** – additional background information or working memory required for the THINKING step.  
• **EXTRACTION / CONTEXT CAPTURE** – reading on-screen or API data and writing structured values into an internal context bucket for later steps.  
• Loops and branches are spelled out explicitly.  
• Variables appear as *italic-snake-case* and are produced/consumed across steps.

---

## 0. Preparation

1. **NAVIGATION / EXECUTION** Launch default browser.  
2. **NAVIGATION / EXECUTION** Open Gmail and authenticate (if needed).  
3. **NAVIGATION / EXECUTION** Apply Gmail search filter `after:2025/06/02 before:2025/06/03` (or use the date picker) so the Inbox shows only emails from **2 June 2025**. The *processing_window* is fixed by design.  
4. **CONTEXT (Design-time)** This flow uses a **per-email update strategy**—each investor-related email is handled and Airtable is updated immediately before moving to the next email. This is preset and must not change at run-time.
5. **NAVIGATION / EXECUTION** Sort Inbox so newest items inside *processing_window* are on top.

---

## LOOP A – For each email inside *processing_window*

> The loop continues until no more candidate emails remain.

A-1. **NAVIGATION / EXECUTION** Open the next email thread.

A-2. **THINKING** Determine if the thread is investor-related.  
   *CONTEXT* – Indicators include sender domain list (`vc`, `capital`, personal known investors), keywords ("investment", "fund", "diligence", etc.), previous correspondence labels, plus an exclusion list (HR, newsletters, billing).  
   • *IF* not investor-related → mark as read → return to Inbox → **continue LOOP A**.

A-3. **EXTRACTION / CONTEXT CAPTURE** Create *email_context* bucket by parsing the open email:  
   • *investor_name* (fund), *contact_person*, *contact_email*  
   • *interaction_date* (email timestamp)  
   • *message_gist* (one-sentence summary)  
   • *action_flags* (needs follow-up? meeting? materials?)  
   *CONTEXT* – Natural-language understanding; company style for summaries (concise, bullet, no emojis).

A-4. **NAVIGATION / EXECUTION** Open Airtable CRM base in a new tab (authenticate if needed).

A-5. **NAVIGATION / EXECUTION** Search grid for *investor_name*.

A-6. **THINKING** Does a matching record exist?  
   *CONTEXT* – Airtable schema primer:  
   • Important fields: `Investor Name`, `Contact Person`, `Email`, `Stage` (7 options: *Not Contacted, Contacted, Interested, In Diligence, Awaiting Reply, Signed, Lost*), `Last Interaction`, `Thread Summary / Notes`, `Follow-up Needed`, `Next Step / Action`.  
   • Sample record (style):  _Investor Name:_ **Beta Capital** | _Stage:_ **In Diligence** | _Thread Summary:_ "IC invited to partner call; numbers strong." | _Next Step:_ "Prepare deck deep-dive for 25 Apr."
   
   • *IF* record exists → go to **EXISTING_RECORD**.  
   • *ELSE* → go to **NEW_RECORD**.

### EXISTING_RECORD branch

EX-1. **NAVIGATION / EXECUTION** Open the existing record modal.

EX-2. **THINKING** Read current field values to form *current_context* (notes from calls, previous asks, open action items). Decide updates:  
   • Refresh `Last Interaction` if older than *interaction_date*.  
   • Append to `Thread Summary / Notes`: combine *current_context* with *message_gist* into a coherent chronicle.  
   • Evaluate stage advancement (e.g. from *Interested* → *In Diligence* if due-diligence requested).  
   • Set/clear `Follow-up Needed`; craft `Next Step / Action`.  
   *CONTEXT* – Writing tone: past-tense summaries, 1-2 sentences each bullet; stage definitions cheat-sheet; avoid overwriting prior history.

EX-3. **NAVIGATION / EXECUTION** Apply the edits decided in EX-2.  
EX-4. **NAVIGATION / EXECUTION** Save/close modal.

### NEW_RECORD branch

NR-1. **NAVIGATION / EXECUTION** Add new row (+) to open blank modal.

NR-2. **THINKING** Decide default `Stage` based on email tone: *Interested* if explicit interest, *Contacted* otherwise. Compose `Next Step / Action`.  
   *CONTEXT* – Same stage cheat-sheet; template for next-steps ("Reply with…", "Schedule call on…").

NR-3. **NAVIGATION / EXECUTION** Populate fields:  
   `Investor Name` = *investor_name*  
   `Contact Person` = *contact_person*  
   `Email` = *contact_email*  
   `Stage` = chosen stage  
   `Last Interaction` = *interaction_date*  
   `Thread Summary / Notes` = *message_gist*  
   `Follow-up Needed` = from *action_flags*  
   `Next Step / Action` = composed step.

NR-4. **NAVIGATION / EXECUTION** Save/close modal.

### Common continuation

A-7. **NAVIGATION / EXECUTION** Switch back to Gmail.  
A-8. **NAVIGATION / EXECUTION** Label or mark thread as "CRM-logged"; return to Inbox.
A-9. **THINKING** Are more candidate emails left? If yes → **continue LOOP A**.

---

## 3. Post-processing & Wrap-up

1. **THINKING** Scan Airtable grid for any rows with `Follow-up Needed` but empty `Next Step / Action`; create a small list *dangling_followups*.  
   *CONTEXT* – Sort filter instructions in Airtable; internal SLA that every follow-up must have owner and deadline.
2. **NAVIGATION / EXECUTION** For each item in *dangling_followups*, open modal and add missing info (repeat until none).
3. **THINKING** Generate *daily_summary*:  
   • Count of investor emails processed  
   • New investors added  
   • Follow-ups scheduled  
   • Meetings / deadlines  
   *CONTEXT* – Email template for daily digest; preferred KPIs.
4. **NAVIGATION / EXECUTION** Compose and send summary email to self or team with *daily_summary*.
5. **NAVIGATION / EXECUTION** Close Airtable tab, close Gmail, quit browser.

---

_End of flow._ 
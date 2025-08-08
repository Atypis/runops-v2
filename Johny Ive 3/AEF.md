# Agentic Execution Framework – Product Requirements Document

## Introduction & Purpose

Runops's Agentic Execution Framework is the second stage of our MVP, aimed at **automating user workflows with fine-grained control and transparency**. In stage 1, we captured workflows as screen recordings and parsed them into structured SOPs (Standard Operating Procedures) – essentially a JSON "blueprint" of the workflow. Stage 2 (Agentic Execution) uses that SOP as the basis for **fully or partially automating the workflow**. The goal is to let users **execute their recorded procedures autonomously** while maintaining **user trust** through clear visibility and control.

By implementing Agentic Execution, Runops will support multiple levels of autonomy ("agentic" behavior) in carrying out tasks. **Five execution modes** are envisioned, ranging from strict deterministic playback to AI-driven content generation and exploration:

1. **Deterministic Execution (Playwright)** – Follow the SOP exactly as recorded, step by step.
2. **Light Exploratory Execution (Menu-Style DOM Selection)** – Allow limited flexibility by choosing from multiple UI options when an exact match isn't certain.
3. **Decision-Point Execution (LLM-based Classification)** – Insert "decision" steps where a language model decides the next branch based on context (simulating simple conditional logic).
4. **Complex Exploratory Execution (Multi-step UI Crawling)** – Enable an autonomous agent to **iteratively explore** the UI for achieving a goal when the next step isn't explicitly defined.

This document outlines the **core features** needed to support these execution types, how we will **leverage existing components** (like the SOP parser and execution harness already in the `Agentic-Execution` branch), and the plan to **extend the frontend** for live monitoring (currently a basic hard-coded SOP playback with VNC). We also highlight outstanding **design decisions** (SOP schema, error handling, memory, retries, UX signals, etc.), discussing trade-offs and proposing MVP choices that prioritize a **coherent foundation, user trust, and transparency**.

*(Throughout this document, "SOP" refers to the structured JSON representation of the workflow. "Agentic execution" refers to the system executing that SOP with varying autonomy.)*

## **DEVELOPMENT STRATEGY: Hardcoded SOP Iteration Approach**

**We are taking a focused, iterative approach to development:**

1. **Start with ONE hardcoded SOP**: Focus exclusively on the Gmail→Airtable investor CRM workflow currently hardcoded in `app_frontend/components/aef/AEFControlCenter.tsx` (HARDCODED_TEST_WORKFLOW)
2. **Iterate for reliability**: Systematically improve this specific SOP and the AEF execution harness until it achieves high-reliability execution  
3. **Reverse engineer general system**: ONLY after achieving reliable execution with the hardcoded SOP will we reverse engineer a system prompt and framework that can generate similar SOPs for any workflow

**This approach enables:**
- **Faster iteration cycles** on concrete, testable workflows
- **Real feedback** from actual execution attempts 
- **Proven patterns** before attempting generalization
- **Concrete reliability metrics** from a known-good workflow

**Current Hardcoded SOP**: 8-step Gmail→Airtable investor email processing workflow with:
- Navigation actions with specific URLs
- Visual scanning instructions  
- Iterative loop handling
- Selector-based DOM interactions
- Context-aware data extraction

## Goals and Non-Goals

**Goals:**

* **Accurate Workflow Automation:** Reproduce user workflows in software with high fidelity, initially focusing on web-browser tasks via Playwright (for deterministic steps).
* **Graduated Autonomy Levels:** Support the five execution modes (Deterministic, Light Exploratory, Decision-Point, Content Generation, Complex Exploratory) to handle increasing uncertainty or complexity in workflows.
* **User Control & Transparency:** Ensure the user can monitor each step of execution (via live UI feed and status updates) and intervene or adjust if needed. The system should clearly signal what it's doing or if it needs guidance.
* **Leverage Existing Architecture:** Utilize the current SOP format and parsing logic, and the basic execution harness in the branch, to expedite development. Extend rather than reinvent wherever possible.
* **Scalable Foundation:** Design the execution framework in a modular way, so future enhancements (more complex agents, multi-app workflows, learning capabilities) can be built on the MVP foundation without large refactors.

**Non-Goals (MVP):**

* **General AI Agents:** We are not building an unconstrained AI agent that can handle arbitrary goals beyond the recorded SOP's scope. The agent will stay within the bounds of the given workflow (no random internet browsing or unrelated actions).
* **Fully Error-Proof Autonomy:** In this MVP, if the workflow deviates too far from the SOP or encounters unknown scenarios, the focus is on failing safely or asking for help, not magically solving every problem. Complex self-healing beyond basic retries/exploration is future work.
* **Optimized Performance at Scale:** We prioritize correctness and clarity over performance for now. Running one workflow at a time in a controlled environment is the target; scaling to many concurrent executions or heavy optimization of execution speed can be addressed later.

## Execution Modes & Core Features

To support the five levels of execution autonomy, the framework will introduce specific features for each mode. Under the hood, all modes share a common execution harness that interprets the SOP's steps and interacts with the target application (typically a web app) via Playwright. The **SOP JSON** already defines a directed graph of steps (nodes) with types like "task" (an action) or "decision" (a branch point), along with edges that define the workflow sequence or branches. Building on this, we will implement the following:

### 1. Deterministic Execution (Playwright-based)

This is the simplest mode – the agent acts as a **"replayer"** of the recorded workflow, with no divergence or AI decisions. It will:

* **Execute SOP Tasks Sequentially:** For each **task node** in the SOP (e.g. "Click the Submit button", "Enter text into X field"), the harness performs the action in a browser using Playwright. The actions will be derived from the SOP's **`Skill`** and **`StepExec`** definitions (which pair each step with a method of execution). For MVP, we focus on **UI method** skills (method_type: "ui"), using Playwright to simulate user interactions (clicks, keystrokes, navigation) exactly as recorded.

* **Playback Environment:** The execution will run in an **isolated browser environment** (likely a headless browser or a containerized browser with a VNC server for visualization). The current branch already supports launching a VNC-visible session for a fixed SOP, which we will generalize. Users will see a **live feed of the browser** as the agent steps through the SOP, replicating what they did in the recording. This leverages the *"hardcoded SOP + VNC live display"* already in place, but we'll make it dynamic (run any chosen SOP) and integrated into the UI.

* **Element Targeting:** We will use robust selectors for elements (ideally text-based or semantic selectors rather than brittle X/Y coordinates). The SOP parser output may include element identifiers or textual cues (e.g., a button's label in `label` or `intent` fields). The execution engine must translate those into Playwright actions. *Example:* if SOP step says *"Click 'Submit' button", the harness might use `page.click('button:has-text("Submit")')` or a similar heuristic to find it. This deterministic mode assumes the UI hasn't changed; if elements aren't found, that's handled via fallback (discussed later).

* **Frontend Indication:** As each step executes, the system will highlight the corresponding step in the SOP diagram (the ReactFlow UI) and/or list. This gives the user a **real-time visual cue** of progress (e.g., a glow around the current node). A textual log could also append messages like "✅ Step 3: Clicked Submit button". These signals reinforce trust – the user sees that the agent is doing exactly what was expected.

* **Completion and Results:** On finishing, the agent will mark the run as complete. In the future we might capture output artifacts or data, but for MVP the main "result" is that the workflow has been executed. We will, however, log any notable events (e.g., if a step failed or was retried) for user review.

*(By leveraging Playwright's reliability and our structured SOP, deterministic mode should cover the core happy path automation.)*

### 2. Light Exploratory Execution (Menu-Style DOM Selection)

Light Exploratory mode introduces a small degree of autonomy to handle **minor variances in the UI** or uncertainty in identifying elements. Instead of failing or requiring code changes when an element's identifier changes or multiple similar elements exist, the agent will intelligently choose from a set of options:

* **Multiple Candidate Elements:** If a SOP step's target element is ambiguous or not an exact match, the execution harness will **gather a list of potential matches** from the DOM. For example, if the SOP says "Click the **Submit** button" but the page has two "Submit" buttons (or perhaps "Submit Order" vs "Submit Form"), the agent can identify both candidates. It might use criteria like element text, context (`intent` or `context` fields in SOP), or DOM hierarchy to filter likely targets.

* **Menu-Style Selection:** Rather than blindly picking one, the agent can either **decide based on simple rules** or present a "menu" to the user:

  * **Automated simple choice:** We can encode a default rule (e.g., choose the first visible match, or the one in a region of the screen expected from the recording). This keeps automation seamless if confidence is high.
  * **User confirmation (optional in MVP):** If confidence is low (say 2-3 equally likely buttons), the system could pause and display a prompt in the UI listing the candidates (perhaps highlighting them on the VNC view) for the user to select. This gives fine-grained control when the agent isn't sure. *For MVP,* we might opt for a simpler approach (pick the best guess and log a warning) to avoid halting execution – but designing the UI for a confirmation dialog is a consideration for building trust.

* **Use of SOP Data:** The SOP's structured data may help disambiguate. If the parser recorded a unique `label` or additional context ("the Submit in the payment form"), we will use that. This underscores the need to formalize the SOP schema to include identifiers or attributes for key elements when possible (discussed later under **SOP Schema Formalization**).

* **Minimal Deviation:** Importantly, light exploratory does **not** perform extra steps outside the SOP flow. It only affects *how a given step is executed*, not which step comes next. This keeps it "lightweight" – the workflow order remains deterministic. We simply make the agent a bit smarter at carrying out each step reliably.

* **Frontend UX:** If a user is watching, we will indicate when the agent had to make a choice. For instance, "⚠️ Multiple targets for 'Submit' found, choosing the first match." could be shown in the log, or an on-screen highlight of the chosen element. This transparency helps the user trust the automation: they know when the agent deviated slightly and how. In interactive mode, if implemented, a dialog would pop up like "Multiple 'Submit' buttons found – please select the correct one." (The presence of such a dialog in MVP is TBD based on complexity, but the system will be architected to allow such user input when needed).

### 3. Decision-Point Execution (LLM Classification for Branching)

Decision-point execution allows the workflow to branch dynamically based on conditions evaluated at runtime, using AI (LLM) for understanding context. The SOP format already supports **"decision" nodes with yes/no edges** for branching logic. In MVP, we implement these decision points as follows:

* **Defining Decision Criteria:** Each decision node in the SOP should come with a description of the condition (often phrased as an "if...then..." in the original narration, which the parser would have translated into a decision node). For example, a decision might be "If login was successful" with a Yes branch leading to the next step and a No branch leading to an error handling step. The **SOP parser** may have stored clues for this in the node's `label` or `context` (e.g., context might say "check if error message is present"). For MVP, we may formalize a simple way to represent what the decision is checking – e.g., a particular UI element's text or existence.

* **LLM-Based Classification:** At runtime, when a decision node is reached, the execution harness will **gather the relevant context from the application UI** and feed it into a **language model** prompt to classify which branch to take. In practice, this could be:

  * Reading the page for certain keywords (e.g., after login, is there a text "Welcome" vs an error message). We might not even need a full LLM call if it's straightforward (simple contains check). However, for flexibility, using an LLM can help interpret more complex signals (or multiple pieces of info).
  * For instance, take a screenshot or DOM text of a status message and ask the LLM: *"Based on the page message, did the login succeed? Answer YES or NO only."* The LLM's answer would determine the path (yes → proceed, no → go to alternate steps).

* **Integration:** We will integrate with an LLM API (likely OpenAI GPT-4 or similar, unless an internal model is available). The prompt will be crafted carefully to ensure a **deterministic output format** (e.g., just a keyword or JSON boolean) so the agent can parse it reliably (this principle was applied in SOP parsing as well). We must also guard against latency – perhaps by using a smaller model for classification if possible, since these decision prompts are narrow.

* **Fallbacks for Uncertainty:** If the LLM returns an uncertain answer or something unusable (which we will mitigate by prompt design, but still), the system should have a fallback:

  * A conservative fallback is to **pause and ask the user**: e.g., show the relevant info ("Login result message: 'Incorrect password.'") and ask which branch to take. This ensures no wrong branch is taken without approval.
  * Alternatively, default to a safe branch – typically the "No/failure" branch to avoid falsely continuing on a success path. This default approach could be appropriate if user input isn't available. For MVP, we propose defaulting to the negative/else branch on LLM confusion, and logging a warning. This errs on the side of caution, building user trust that the system won't barrel ahead on possibly wrong assumptions.

* **User Feedback:** When a decision is made (especially via LLM), we will surface that to the user. For example: "🤖 Decision Point: Classified outcome as **YES (success)** based on page text." Providing the evidence (maybe the snippet of text that led to that) would further increase transparency. If the user disagrees, they ideally should have a chance to override (though override could be complex to implement live – at minimum they can stop the run). Logging the decision rationale is important for after-the-fact review too.

* **Scope of Decisions:** MVP will support binary decisions (Yes/No branches as per current SOP structure). Multi-branch decisions (choosing between more than 2 paths) are rarer and can be treated as a chain of binary decisions or left for future scope. Loops are handled separately (next mode). Each decision node will likely correspond to one LLM call or check.

By introducing decision points, **the workflows become adaptive** – they can handle different outcomes observed at runtime. This is crucial for real-world reliability (e.g., handling both success and error cases). The use of LLMs for interpretation allows flexibility (no need to hard-code all possible messages), while our cautious approach (confirmation and transparency) ensures the user remains in control of the logic.

### 4. Content Generation Execution (LLM-driven Synthesis)

Content Generation execution represents a fundamentally different type of autonomy where the agent must **create new content** rather than simply navigate UI or make binary decisions. This mode handles workflows that require synthesizing information from multiple sources and generating formatted output, such as reports, summaries, emails, or other documents.

* **Dynamic Content Creation:** Unlike the previous modes that work with existing UI elements and predetermined paths, content generation requires the agent to create new text, data, or documents based on information gathered during the workflow execution. For example, in a shareholder update workflow, the agent might need to:

  * Gather quarterly metrics from multiple dashboards or data sources
  * Extract key performance indicators and notable events 
  * Synthesize this information into a structured report following a specific template or format
  * Generate executive summaries that highlight the most important trends and insights

* **Information Synthesis Pipeline:** The content generation process follows a structured approach:

  1. **Data Gathering:** The agent collects information from various sources during the workflow (this leverages the other execution modes for navigation and data extraction)
  2. **Context Assembly:** Relevant data points, metrics, and contextual information are organized and prepared for synthesis
  3. **LLM-driven Generation:** A language model is provided with the gathered data, the target format/template, and specific instructions to generate the required content
  4. **Output Integration:** The generated content is inserted into the appropriate forms, documents, or systems as part of the workflow

* **Template and Format Awareness:** The SOP can include format specifications, templates, or examples of the desired output. This might be stored in the SOP's `context` field or as part of a specialized "content_generation" skill. The agent will use these specifications to ensure the generated content matches the expected structure, tone, and requirements.

* **Quality Control and Validation:** Given the creative nature of content generation, additional safeguards are important:

  * **Preview and Confirmation:** For MVP, when content is generated, the system could pause and show the user a preview before inserting it into the final destination. This allows for review and editing if needed.
  * **Factual Consistency:** The agent will be instructed to base generated content strictly on the gathered data rather than hallucinating information. Prompts will emphasize accuracy and clearly mark any gaps in available data.
  * **Length and Format Constraints:** The generation prompts will include specific constraints about length, format, and style to ensure consistency with expectations.

* **Use Cases in Workflows:** Content generation execution is valuable for workflows involving:

  * **Reporting:** Creating periodic reports by gathering data from multiple systems and formatting it consistently
  * **Communications:** Drafting emails, announcements, or updates based on collected information
  * **Documentation:** Generating summaries, meeting notes, or status updates from various data sources
  * **Data Analysis:** Creating insights or recommendations based on gathered metrics and trends

* **Integration with Other Modes:** Content generation often works in conjunction with other execution modes:

  * **Deterministic execution** to navigate to specific data sources
  * **Decision-point execution** to handle different data availability scenarios
  * **Light exploratory execution** to adapt to UI changes while gathering information
  * The generated content then becomes input for subsequent deterministic steps (like pasting into a form or email)

* **Technical Implementation:** Content generation nodes in the SOP will trigger specialized LLM calls that:

  * Receive all relevant data collected during the workflow (stored in the execution context)
  * Follow detailed prompts that specify the output format, style, and requirements
  * Generate content that can be immediately used in subsequent workflow steps
  * Provide logging and transparency about what content was generated and why

* **MVP Scope:** For the initial implementation, content generation will focus on text-based outputs (reports, emails, summaries) rather than complex formatting or multimedia content. The system will support basic templates and formatting requirements but won't handle complex document layouts or graphics generation.

By adding content generation execution, the framework becomes capable of handling workflows that require **creative synthesis** rather than just navigation and decision-making. This significantly expands the types of business processes that can be automated, particularly those involving regular reporting, communication, or documentation tasks where human-like content creation is valuable.

### 5. Complex Exploratory Execution (Multi-Step UI Crawling)

Complex Exploratory mode is the most **"agentic"** capability in this framework – the agent can perform a **goal-directed exploration of the UI** that goes beyond the recorded linear path. This is useful if the workflow needs to handle new scenarios or if a step in the SOP cannot be executed exactly (e.g., an element is missing or the UI flow changed). Key features of this mode:

* **Goal-Oriented Subtasks:** The agent will be able to pursue a sub-goal in the workflow by itself, which might require multiple steps. For instance, *"navigate to the reports page"* could be a sub-goal that normally was one click in the original SOP, but if the button moved, the agent might try other ways (search for "Reports" link, use a menu, etc.). In an error scenario, the sub-goal might be *"find a way to recover or inform the user"*.

* **LLM-driven Planning Loop:** We plan to implement a simplified version of the classic **"Plan-Act-Observe" loop**:

  1. **Observe:** The agent captures the current state of the UI (DOM structure, visible text, available interactive elements).
  2. **Plan (LLM Reasoning):** Provide the LLM with the goal (from the SOP context or the failure it encountered) and the observed state. The prompt might be: *"The next intended step is to X, but that element isn't found. Here are things on the screen: \[list of buttons/links]. What should the agent do?"* The LLM can propose an action: e.g., "Click the 'Menu' then 'Reports'."
  3. **Act:** The agent executes the suggested action (e.g., clicks a certain link or button).
  4. **Observe again:** After the action, get the new state and check if the goal is reached or if further steps are needed. Repeat the cycle until goal is achieved or a certain number of iterations pass.

* **Scope Limitations:** For MVP, this exploratory loop will be **tightly constrained**:

  * The actions allowed could be limited to read-only or navigation actions (clicking links, buttons, typing in search fields), avoiding anything destructive.
  * The agent will operate only within the context of the current application – it won't, say, open new programs or websites that weren't part of the original workflow (unless explicitly the goal).
  * If the agent cannot find the solution within the limit, it will fail gracefully (e.g., stop and alert the user that it couldn't proceed further) rather than doing something unpredictable.

* **Use Cases in MVP:** The complex exploration might be triggered in two situations:

  1. **Explicit Complex Step:** The SOP might designate a node as "exploratory" (though our current SOP schema doesn't explicitly mark such – we might infer it if a step was ambiguous or marked with a clarification). For example, if the parser wasn't sure how a user found something, it might leave a note that could trigger the agent to do a mini-search.
  2. **Failure Recovery:** If deterministic mode fails to find an element or encounters an unexpected page, the agent can enter an exploratory mode to try to recover. This turns errors into opportunities for the agent to adapt. For instance, if a button isn't found, the agent could search the page for the intended keyword or try accessing the site's search function.

* **Transparency & Control:** Because this mode is the most complex and potentially unpredictable, **user transparency is critical**:

  * As the agent explores, we will log each action and perhaps even display them in a special "agent thinking" panel. For example: "🤖 Attempt 1: Tried clicking 'Reports' menu... \[failed to find page]. Attempt 2: Searched for 'Reports'...".
  * The VNC live display will show these actions as they happen, so the user can visually follow along.
  * We will also provide a **"Abort Exploration"** button – allowing the user to stop the autonomous loop if they see it going astray or taking too long. At that point, control can return to the user (maybe they'll handle it manually or adjust the SOP for next time).
  * If the agent succeeds in finding an alternate path, we could even suggest updating the SOP (future feature: learning from exploratory successes). However, for MVP we will simply complete the execution and note what path was taken.

* **Technical Implementation:** On the backend, this requires the harness to support iterative loops and additional LLM calls. It's an extension of the decision-point idea but with actions. We'll likely reuse the SOP's structure to some extent – for example, we could create a temporary sub-graph of steps during exploration (not persisted, but for internal tracking). **State memory** (discussed later) will be crucial here to remember what actions have been tried in the loop, so the agent doesn't repeat itself.

Complex exploratory execution is basically a rudimentary AI agent within the confines of the user's workflow. It represents the cutting edge of what we plan to deliver, but it also carries the most uncertainty. Therefore, we will implement it in a **minimal and safe form** for MVP: enough to handle simple cases and demonstrate the concept, but not aiming for full general problem-solving. By doing this, we lay the groundwork for more advanced autonomy in future versions while ensuring the user always feels in control during MVP.

## Leveraging Existing Components

One advantage we have is that much of the groundwork for Agentic Execution is already present (at least in prototype form) in the `Agentic-Execution` branch. We will build on these rather than starting from scratch:

* **SOP JSON Schema & Parser:** The Stage 1 parser already produces a structured SOP JSON, including tasks, decisions, loops, triggers, and more. This schema (influenced by OpenAPI-like structure) is our starting point for execution. We will **formalize and, if needed, extend this schema** to ensure it has all information required for execution (see **Design Decisions – SOP Schema Formalization**). For instance, the `public.nodes` and `edges` define the workflow logic, and the `private.skills` and `steps` likely map each step to an actionable "skill" (like a UI interaction). We will use those mappings to drive the Playwright actions. The fact that the SOP is in JSON and saved in our database (`sops` table) means we can retrieve it easily via the SOP API (already implemented) when the user wants to run it.

* **Basic Execution Harness:** The branch has an initial execution harness – likely a backend service or script that can read an SOP and execute it. This might be written as a Node.js service using Playwright. We will confirm its architecture, but presumably:

  * It can take a **SOP ID or JSON**, launch a browser (perhaps in a Docker container with a virtual display), and then sequentially execute the steps.
  * It currently might be rigged to a specific SOP for demo purposes (the "hardcoded SOP"). We will generalize it to handle any SOP ID by pulling from the DB via the API.
  * It may also handle the VNC stream setup (launching a VNC server or similar in the container) that the frontend can connect to. If so, we'll keep that approach for now (perhaps using a noVNC client in frontend to show it).
  * We might need to adapt the harness to incorporate the new features: e.g., inserting LLM calls for decisions, looping for exploratory, etc. This should be done in a modular way (maybe as plugins or extending a step-execution loop in code).

* **Current Frontend (Execution UI):** At present, the frontend has minimal support for execution – presumably a route that opens a VNC viewer showing the live automation. It might also display the SOP diagram or a list, but currently user interaction is limited. We plan to **extend the frontend significantly**:

  * **Select & Start Execution:** The user should be able to pick which SOP (from their saved SOP list) to run. For example, on the SOP detail page (where the ReactFlow diagram is shown and editing is possible), we add a "Run Workflow" button.
  * **Live Run View:** Upon starting, the UI should switch to an "execution mode" view. This could be the same page with additional panels, or a dedicated view. Key elements:

    * *Live VNC Display:* Show the remote browser performing the actions. Ideally, embed it responsively so the user can watch in real-time.
    * *Step Indicator:* Highlight the current step in the SOP graph or list. Possibly scroll the list to follow along. The ReactFlow library might allow us to programmatically flash the active node.
    * *Logs/Status:* A text area or sidebar listing actions as they happen (e.g., "Step 1: Opening URL...","Step 2: Logging in... success"). Also include warnings or errors here.
    * *Controls:* Provide a Stop button at minimum. Pause/Resume would be nice – Pause could mean finish current step then halt. We could also offer a "Step-through mode" where the agent waits for user confirmation before each step (very useful for debugging or trust-building). This might be advanced for MVP, but we should design the system to allow it later. At least a Stop is essential for safety.
    * *Optional Input Modals:* In cases like the menu-style selection or decision override, the frontend may need to pop up a modal for the user to choose an option or confirm something. The design should accommodate this kind of interaction during the run (and the backend/harness should be able to wait/pause until it gets user input via perhaps a WebSocket or API call).
  * **Post-Run Summary:** After execution, show a summary: e.g., "Workflow completed successfully in X minutes. 3/15 steps used AI decisions. 1 step required user input." Or if failed: "Workflow stopped at Step 7 due to \[reason]." This helps the user understand how it went. The user could then adjust the SOP or give feedback.

* **Backend Architecture:** Likely, the execution will be initiated via an API call or WebSocket event. We might design a simple **Execution API**: e.g., `POST /api/execute` with an SOP ID and execution mode parameters. The server (Next.js API route or a separate worker) would start the process and immediately return a session ID. The frontend could then connect via WebSocket or polling to get status updates and frames for the VNC. Since we already have a polling mechanism for video processing status, we might do similar for execution status, though WebSocket (or webRTC for VNC) is more real-time for UI streaming. For MVP, we can use an existing solution (perhaps the VNC viewer directly connects to the container, and a simple polling for step updates). Ensuring the **frontend and backend are synchronized** (for highlighting steps, etc.) is an implementation detail to plan carefully.

* **Security & Isolation:** Running user-defined workflows means potentially executing untrusted sequences of actions. For MVP (likely internal testing), this is fine, but eventually we must run these in isolated sandboxes (which a container for the browser provides). The current harness likely already runs in a container or VM for VNC; we'll continue with that approach to isolate each execution (especially since users might navigate to sensitive sites with credentials – we should not mix sessions). We will also ensure the user's Supabase JWT (auth) is checked before allowing an execution to start, and that they only can run their own SOPs (similar to how SOP retrieval API is secured).

In summary, **the existing SOP data model and prototype execution engine give us a strong starting point**. Our work will involve **wiring up new capabilities (LLM decisions, etc.) into that engine**, and **building out the user-facing parts** (controls, indicators) to make the experience smooth and trustworthy. We will also need to refactor any one-off/hardcoded aspects of the current branch code to be general-purpose, but that's an expected part of moving from prototype to product.

## Outstanding Design Decisions & Trade-offs

As we implement the Agentic Execution Framework, several design decisions need to be made. Below we outline each major decision area, discuss options and trade-offs, and recommend a default approach that best fits our MVP goals of reliability, user trust, and building a scalable foundation.

### **1. SOP Schema Formalization**

**Decision Area:** How to formalize and possibly extend the SOP JSON schema to fully support execution (especially the new agentic features) in a consistent, validated way.

**Context & Options:** Our current SOP schema (v0.7) was primarily designed to capture the workflow from the parsing step. It includes the structure of nodes (tasks, decisions, loops, etc.) and some notion of "skills" for execution. However, as we move to execution, we might find gaps. For example:

* Are there explicit selectors or identifiers for UI elements in the SOP? If not, should we add them (perhaps as part of the `Skill` or in `variables`)?
* How are decision conditions represented? We might need a field in the decision node like `criteria` (e.g., "text_contains='Welcome' for YES branch"). Currently the parser might only provide a description in `label` or `context`.
* The SOP has a `clarification_requests` array which the parser uses to flag uncertainties. We need to decide how to handle those in execution (e.g., require user input before running, or let the agent try something).
* We should ensure the schema is well-defined (perhaps via a JSON Schema or TypeScript interface) so that both the front-end and back-end "know" what to expect. This will prevent misinterpretation of SOP data during execution.

**Trade-offs:**

* *Option 1: Minimal Changes:* Keep the schema largely as is for MVP, and handle any missing pieces with ad-hoc solutions. For example, if an element selector isn't in the SOP, the execution code itself can infer one (like using the label text). This avoids needing a new parsing pipeline, but it might lead to brittle logic scattered in the execution engine.
* *Option 2: Enrich the SOP Schema now:* Add fields for key execution info (like `selector` or `targetText` for tasks, `conditionCheck` for decisions, etc.) and adjust the parser to populate them (or allow manual annotation by user). This makes execution more straightforward and explicit, but would require updating the prompt or post-processing the SOP – more upfront work and possibly complex for the parser LLM.
* *Option 3: Schema Versioning & Validation:* We formalize schema v1.0 for execution, which might be slightly different from what the parser currently outputs (v0.7). We then write a translator or enforce the parser to produce 1.0 directly. This ensures long-term consistency (and we can validate SOPs on input to execution). However, it introduces short-term overhead and potential reprocessing of existing SOPs.

**Recommendation (MVP Default):** Start with **Option 1 (Minimal Changes)** while laying groundwork for Option 3. Concretely: We will define a *JSON Schema document* that represents the current SOP format (making explicit whatever the parser currently gives, e.g., Node types, edges, skills, etc.). We'll use this to validate SOPs at runtime (to catch any inconsistencies). For any execution-critical info not present, we will initially compute it on the fly in the execution harness:

* E.g., if no CSS selector is provided for a click step, the harness will derive one using the `label` or other context.
* If a decision node lacks a formal condition, we'll bake the logic into the LLM prompt (e.g., "decide yes/no based on whether text X is present").

Meanwhile, we will **plan a schema update** in the background (for a future version) to formally include these execution aids. This balanced approach avoids blocking MVP on retooling the parser, but keeps the door open to improving the SOP spec. It also builds trust: by validating the SOP input before execution, we reduce chances of runtime misinterpretation (if something is off, we can warn the user or refuse to run an invalid SOP, rather than doing something wrong).

### **2. Fallback Behavior & Error Handling**

**Decision Area:** How the agent should react when things don't go as expected – missing elements, failed LLM calls, unexpected pages, etc. Fallback behavior determines whether the execution stops, retries, or tries an alternative strategy.

**Context & Challenges:** No matter how well we plan, in real-world executions errors will occur. Examples:

* A button that was present in the recording is not found now (maybe the user's permissions changed, or the app updated its UI).
* The LLM at a decision point returns a non-confident answer (e.g., "I'm not sure" – if our prompt wasn't tight enough).
* A network glitch causes a page load to hang, or the browser to crash mid-run.
* The agent's exploratory attempt might lead to a wrong page or dead-end.

We need to decide on consistent fallback behaviors for these. Key options:

* **Stop and Notify:** The simplest – if any critical error happens, stop the execution and alert the user (with a meaningful message). This maximizes safety (no unintended actions) but interrupts automation, requiring user intervention.
* **Retry Automatically:** For certain transient issues, automatically retry a step a limited number of times (e.g., try clicking again if it didn't work, refresh the page, or re-send an LLM request if it timed out). We already do something similar in SOP generation (up to 3 retries). Retries can overcome flakiness but must be used carefully to avoid loops or duplicated actions (e.g., submitting a form twice).
* **Alternate Path / Graceful Degradation:** If a step fails, sometimes an alternate action can achieve the goal (this blends into the "Complex Exploratory" mode). For instance, if clicking "Submit" doesn't work, maybe try pressing Enter key as a fallback. Or if the primary skill fails, check if an `alt_skill` was provided in the SOP (the SOP format seems to allow alternate methods, like an API call, if UI fails). Using alt skills could be powerful, but implementing them might be beyond MVP unless the SOP already includes some API alternatives.
* **Ask the User:** Pause and seek guidance. For example, "I expected to find X but it's not there – what should I do?" This could be done via a UI prompt letting the user manually intervene (maybe click the correct element themselves through the VNC or provide instructions). This ensures correctness but breaks the flow and might frustrate users if overused.

**Trade-offs:**

* Stopping early preserves correctness and is simpler to implement, but undermines the "automation" value if it happens frequently – users might lose trust if the agent gives up too readily.
* Aggressive retries or alternate actions might keep things going but could lead to unintended consequences (e.g., repeating an operation that actually succeeded server-side but the confirmation didn't show due to a glitch – you don't want to double-purchase an item by retrying a "Buy" click). It might also confuse users if the agent silently deviates too much.
* User prompts for every issue would make the automation feel very "high maintenance". However, for an MVP focusing on trust, leaning on the user for critical decisions is not a bad idea – it's like having training wheels. Over time, as confidence in the agent grows, we can automate more of these.

**Recommendation (MVP Default):** Employ a **tiered fallback strategy**:

* For **minor transient errors**, do a **limited retry** automatically. E.g., if an element that should be there isn't found, wait a couple seconds and try again (maybe the page was still loading). One retry is often sufficient; we can default to up to 2 attempts for things like element not found or timeouts. We will log the retry ("Retrying click on 'Submit' (attempt 2)...") so the user is aware.
* If the retry fails or it's a **major error** (e.g., navigation went to a wrong page, or an LLM returned gibberish), then **stop and prompt the user**. The agent will not forge ahead blindly. It will cancel the run (or pause it) and display an error message with context: e.g., "❗Step 5 failed: 'Submit' button not found. Execution paused." The user can then decide to abort or maybe manually complete that step and then potentially resume (resume functionality is advanced; likely MVP will just abort, but we can allow them to re-run from scratch after adjusting something).
* The exception is if **Complex Exploratory mode** is enabled for that scenario – then instead of immediately stopping, the agent could invoke the exploratory subroutine as a fallback. For MVP, we will use exploration only in known, safe contexts (perhaps when explicitly configured or for read-only searches). If exploration is attempted but fails, then we definitely stop and notify the user.
* For **LLM decision uncertainties**, we won't retry the LLM too many times (wastes time and money). If the response is unusable, we may do *one* re-prompt with a simpler question or format. If still unclear, default to the safe branch (as discussed) and inform the user ("Proceeding with 'No' branch due to uncertain decision."). This way, the workflow continues in a safe manner rather than stopping, because a decision point failure is not as dangerous as a lost element – going down the failure path might just lead to a graceful termination of the workflow, which is acceptable.
* We will not attempt any **alt_skill API calls** in MVP unless trivial, as that requires integration with external APIs or systems. However, our design will keep the concept in mind (since the SOP format has a placeholder for them), so in the future if a UI action fails, the agent could automatically invoke an API alternative (with user permission).

Overall, our default stance is **"fail safely, not silently."** We prefer to halt or take a conservative path rather than guess and possibly do something incorrect. All fallback actions (retry, branch choice, or giving up) will be communicated to the user via the UI logs and status, so they understand what happened. This approach builds trust: the user sees that the agent won't wreck things in chaos – it either succeeds or stops and asks for help in a transparent way.

### **3. State & Memory Management**

**Decision Area:** How the agent stores and recalls state during execution. "State" here includes both **transient UI state** (data captured during steps) and any **memory of past actions** (for use in loops or reasoning).

**Context:** In a static recorded workflow, state was implicit – the user's actions naturally carried forward any needed info (e.g., they copy a value from one page and paste in another). For the agent to do the same, it must sometimes **remember** things:

* Values from the UI (e.g., if a step says "Copy order ID from confirmation page for later use", the agent should capture that text and store it in a variable).
* The SOP format anticipates this with `public.variables` and the concept of `variables_in`/`variables_out` for skills. We need to implement support for these: if a step produces an output, store it; if a later step needs it, retrieve it and input it.
* In loops, the agent needs to know the loop iterator state (the SOP likely describes the loop's logic). For example, if looping through a list of items, the agent should track which item it's on, etc. The `LoopNode` in SOP has an `iterator` and children and an exit condition – the execution engine must use those to manage loop state (e.g., break when no more items). Possibly the SOP doesn't give the actual list of items (because that comes from data at runtime), so the agent might need to collect that list from the UI in the first iteration.
* During Complex Exploratory mode, memory of what actions have been tried in the current exploratory sequence is crucial. We should avoid repeating the same failed action. This means the agent's reasoning (LLM prompt) should be provided with a history of attempts. Also, if a future step triggers another exploratory session, it should not confuse it with the past one (so separate memory per session).

**Trade-offs:**

* *Stateless vs Stateful Design:* We could design the execution harness to be mostly stateless between steps (treat each step independently, maybe just passing necessary data along through function calls). This is simpler but risks losing context. Conversely, a more stateful design (maintaining an object with the current context, variable map, etc.) is needed for loops and decisions. We likely need stateful.
* *In-Memory vs Persisted:* Should the agent's state (like variables captured) be saved to the database or just kept in memory during execution? For MVP, in-memory is fine (execution is short-lived). Persisting could allow resume or later review, but that's probably overkill now. We will log relevant outputs but not formally save all state.
* *Memory Scope:* We will implement **ephemeral memory** within a single execution run. Long-term learning (like remembering outcomes across runs or improving the SOP next time) is out of scope for MVP. But our design can leave hooks for future "learning" modules (e.g., the agent could output an updated SOP or a feedback log that could later be processed).

**Recommendation (MVP Default):** Implement a **central "Execution Context"** object in the harness that holds:

* The current position in the SOP (node ID).
* A map of **variables** (key-value) that have been collected or set. Initially, this can be populated from `public.variables` in the SOP (if any predefined ones exist), and then updated as steps execute. For example, if step 8's skill says it outputs `order_id`, after executing step 8, we add `order_id: <value>` to the context. Step 12 might have that in its `variables_in`, and the harness will substitute the actual value when executing (e.g., fill a form field with the `order_id`).
* **Loop stack/iterators:** if we are in a loop, store the list of items (if known) or at least the current iteration index. If the loop is data-driven (e.g., "for each file in a list"), the agent might have to dynamically fetch that list from the UI or an API. For MVP, we might restrict loops to those that the SOP could outline clearly (or simply treat a repeated sequence as a loop where it just repeats until a condition fails). The context will track when to exit the loop (e.g., after going through all children nodes once if `exit_condition` met).
* **Exploration history:** if an exploratory subtask is running, we maintain a list of tried actions or visited states. This will be appended to the LLM prompt to avoid repetition ("We already tried clicking X and Y."). This history can be reset or cleared once the exploratory task ends.

By concentrating state in one place, we make the system easier to extend (adding new types of memory later) and debug (we can dump the context state in logs for transparency).

For MVP, we won't persist this context beyond the execution. However, we will consider exporting some data to the user: e.g., if the workflow ends with some result (like "The generated report ID is 12345"), perhaps we show that in the summary, or allow copying it. The SOP's goal field or context might tell us what the final important output is. We want the user to not only trust the execution but also **get the key information** they wanted from running the workflow.

In terms of implementation, this execution context can be a singleton per run (if our execution is single-threaded per session, which it likely is). If we use something like a state machine or workflow engine pattern, each state transition (step) updates the context.

### **4. Retry Logic & Timeouts**

**Decision Area:** Specific policies for retrying actions and overall timeouts for steps or the entire workflow.

**Context:** This overlaps with fallback, but here we define the concrete numbers and mechanisms:

* How many times do we try a Playwright action before calling it failed? For instance, if a click doesn't find an element, do we try again after waiting? Or if a page doesn't load, how long do we wait?
* LLM calls – if one fails due to network error or rate limit, do we immediately retry, and how many times?
* If a whole workflow is taking too long (maybe stuck in a loop or waiting for a human input that never came), do we have a max execution time to auto-cancel? (This is more for safety; e.g., we might say any run will auto-stop after, say, 5 or 10 minutes to avoid runaway processes or cost.)

**Trade-offs:**

* Too aggressive retries can cause delays and duplicate operations; too few retries can make the system brittle to temporary issues.
* We have to avoid infinite loops – e.g., a page might genuinely not have the expected element; retrying 10 times won't help if it's not there. So we should couple retries with either a state change or a stop condition (like only retry if the page is still loading, etc.).
* Timeout values need to balance being short enough to not keep users waiting indefinitely, but long enough to account for real delays (some pages might take many seconds to load; some LLM calls might take e.g. 15 seconds).

**Recommendation (MVP Default):** Establish **sane defaults** and allow configuration in code (not necessarily exposed to user yet, but easy to tweak):

* **Playwright actions:** Use Playwright's built-in waiting mechanisms (it has defaults like 30s timeout for navigation, etc.). For clicking elements, if an element is not found immediately, we could wait a short period (e.g. 2-5 seconds) for it to appear (in case of dynamic content). Playwright can auto-wait for elements that are expected to appear. We will set an upper bound (maybe 5s for an element to appear before giving up). Only one retry beyond that if we suspect a momentary glitch. So roughly: *find element (5s wait); if not found, maybe refresh or ensure we are on correct page and try 1 more time.*
* **Navigation/Load:** If a page navigation is part of the step, we allow a longer timeout (maybe 15-30 seconds for a full page load, or we continue after DOM ready instead of full load if not necessary). If it times out, we retry the navigation once.
* **LLM calls:** If an API call fails (network error), do an immediate retry once. If it times out or is extremely slow (>10s for classification, >60s for more complex reasoning), we consider re-trying with maybe a simpler prompt or just fail with a message. We'll also guard prompts to ensure they're concise for fast responses (especially classification).
* **Overall execution timeout:** For MVP, we might set something like 5 minutes as a default max run time. Most captured workflows are under 10 minutes manually, and automated should be faster, but in case something goes wrong, we don't want it running forever (also considering cloud costs for the container). We will communicate this limit to the user (e.g., if triggered, "Execution timed out after 5 minutes."). In future, we can make this user-adjustable or smarter.

These numbers (5s, 30s, 5min, etc.) will be tuned during testing. The key is we will build the retry/timeout logic into the harness in a clear manner:

* Possibly use a library or pattern (like Promise retry wrappers, or a state machine that counts attempts).
* Ensure that if a retry succeeds, we break out cleanly and don't later mis-handle it as a failure.
* All retries and waits should be logged for transparency ("Waiting for page...","Timeout reached, retrying...").

By preemptively designing these limits, we make the system robust and avoid it appearing "hung" to users. A stuck agent with no feedback is a trust killer – we will avoid that by either succeeding, failing visibly, or retrying with feedback.

### **5. User Experience: Signals, Controls, and Transparency**

**Decision Area:** How to communicate the agent's actions, status, and needs to the user through the UI, and what controls the user has during execution.

**Context:** The user experience will determine whether users embrace this feature. Key UX considerations:

* **Real-time feedback:** The user should *always know what the agent is doing or waiting for.* This includes which step is active, what action it's taking, and any AI "thinking" moments.
* **Confidence & Safety signals:** How do we convey confidence or uncertainty? E.g., if the agent is about to click something that wasn't in the original plan (like in exploratory mode), how do we signal that? Perhaps a different color highlight or an "Agent is attempting an alternate action" message. This ties to user trust – transparency about uncertainty can actually increase trust, because the system is being honest.
* **Controls:** At minimum, a **Stop** button to abort. Possibly a **Pause** as discussed. Maybe a **Skip step** if something is taking too long (advanced, could be similar to stop then mark step complete – tricky to implement generally). Also, if a decision or selection prompt appears, the user needs to interact with that (so highlighting the needed input and not letting the run continue until resolved).
* **Visibility of AI decisions:** When an LLM is used, some users might want to know more details (like "why did it choose that?"). We could in future show the LLM's rationale or allow expanding a "decision details" view. For MVP, we might just log the outcome, but we might include a debug mode that logs the prompt and response (at least in console or hidden, for dev/testing).
* **Integration with SOP diagram:** The ReactFlow diagram is a great visual aid. We will integrate the execution experience with it: highlight nodes as said, maybe animate the path being taken (especially for branches – highlight the edge taken in a decision). If the agent skips some nodes due to a branch, those might be greyed out to show they were not executed. This makes the agent's path traceable.
* **Post-run info:** As noted, summarizing the run is useful. We might also consider allowing the user to download a log or save the run's result if needed (not MVP-critical, but at least having the data in memory means we could display it nicely).

**Trade-offs:**

* A very verbose UI (showing too much technical detail, like every DOM selector or full AI prompts) could overwhelm or confuse non-technical users. We need to **strike a balance**: enough info for trust, not so much that it's noise. We might hide advanced details behind an expandable panel.
* Too many user prompts will reduce automation value. We should only ask when absolutely necessary (or maybe have an "interactive mode" vs "auto mode" toggle). MVP likely leans toward auto with stop-on-error rather than asking frequently.
* Controls like pause/step-through add complexity in the backend (maintaining state while paused). If time is short, we might implement only Stop for MVP. But we can design the UI with pause button that's initially disabled, indicating future capability.

**Recommendation (MVP Default):** Design the UI/UX such that **the user feels in control and informed at all times**:

* **Live Status Panel:** Implement a status log on the execution view (as described) that appends human-friendly messages for each step/action. Use simple language (non-technical where possible): e.g., "🔎 Opening the Reports page...","✅ Reports page opened.","🤔 Deciding next step based on results...","❌ Couldn't find 'Submit' button, stopping." etc. This keeps both tech and non-tech users in the loop. (Technical details can be in a hidden debug console for us or advanced users.)
* **Highlighting & Visual Cues:** Continuously highlight the current SOP node. Use color codes for state: e.g., blue for in-progress, green for success, red for failed step, yellow for a warning or manual intervention. Possibly draw arrows along edges as branches occur. This visual storytelling helps users follow complex flows.
* **User Controls:** Provide a **Stop** button prominently with a clear icon (⏹️). Confirm action (to avoid accidental stop?), maybe not needed if we can restart easily. A **Pause** button can be shown but if not implemented, we might hide or disable it to avoid confusion. If implemented, Pause would freeze after completing the ongoing step (we'll need to handle that in code).
* **Modal Prompts:** If the agent needs user input (selection or decision override), we'll use a modal dialog that darkens the VNC view to get attention. The modal will clearly state the issue and options. For example: "Multiple options detected for 'Delete'. Please choose the correct button:" and list them. Or "Agent is unsure how to proceed. Choose branch: (A) Continue to dashboard, (B) Go to support page." The user's choice would then feed back into the harness (likely via an API call or WebSocket message).
* **Security Warning:** If the agent is about to do something potentially sensitive (not likely in MVP since it only does what user recorded, but say it was going to delete something), we might want to warn/confirm. However, since it's based on the user's own recorded actions, presumably they intended those. We'll skip this for MVP unless an obvious case appears.
* **End of Run Summary:** After completion or stop, replace or overlay the live view with a summary: big green checkmark "Workflow Completed" or a red symbol "Stopped at Step X". Provide basic stats (# of steps executed, time taken, any errors or manual inputs). This helps the user gauge success and perhaps trust the system more next time (especially if it says "Completed without issues.").

Finally, we will gather user feedback during any beta period to refine this UX. Transparency is a core value here – by **designing every part of the execution to be observable** (either visually or through logs), we ensure the user doesn't feel like the agent is a "black box". Instead, it should feel like a **copilot** carrying out the steps while the user watches. This psychological assurance is key to adoption.

---

## Conclusion

The Agentic Execution Framework will transform Runops from a passive recorder into an **interactive automation agent**, allowing users to **not just document, but actually execute** their workflows. By supporting execution modes from strict replay to AI-driven exploration, we cater to a range of use cases and comfort levels:

* New users can start with deterministic, low-risk automation and gradually let the agent handle more complex decisions as trust grows.
* Advanced users can benefit from the agent's ability to adapt (via LLM decisions and exploratory actions) when faced with variability in their workflows.

Throughout the design, our focus is on maintaining **user trust, transparency, and control**. The system will always strive to do the right thing, but when in doubt, it will show the user what's happening or defer to them. By clearly surfacing the agent's actions and reasoning, we make the "magic" feel explainable and reliable.

From an architecture standpoint, this MVP balances near-term pragmatism with a clear **upgrade path**:

* We leverage what's already built (SOP schema, basic harness, front-end components) to deliver quickly.
* Each feature is scoped to MVP needs but designed with extension in mind: e.g., a structured SOP schema ready for future expansion, a modular execution engine that could later incorporate learning or more tools, and a UI that can accommodate richer interactions down the road.

In summary, the Agentic Execution Framework MVP will deliver a **coherent, scalable foundation for agentic automation** in Runops. It empowers users with fine-grained control over automated workflows and sets the stage for even smarter autonomous agents in future versions – all while ensuring the user remains confident and informed. By the end of this implementation, users should be able to **"press play" on any recorded workflow and watch it unfold automatically**, intervening only when necessary, much like overseeing a diligent assistant. This capability not only saves time but also builds a unique value proposition for Runops in the burgeoning field of AI-driven workflow automation.

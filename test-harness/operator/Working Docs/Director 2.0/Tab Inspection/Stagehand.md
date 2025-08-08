# Input Gathering Mechanisms

## DOM Snapshot Collection

Stagehand primarily uses the page’s DOM to gather information. Under the hood, it retrieves the HTML content of the page (essentially a DOM snapshot) and relevant metadata, then feeds this to an AI model. In practice, Stagehand likely calls Playwright’s APIs (e.g. `page.content()` or evaluating `document.documentElement.outerHTML`) to get the full HTML. It captures important DOM properties such as element tag names, text content, and key attributes (like `id`, `name`, `class`, `aria-*`, `data-*` attributes) that would help identify elements. Non-essential elements (scripts, style tags, etc.) are not used for AI reasoning – the focus is on the structure and content a user would see. Invisible or off-screen elements are generally ignored or filtered out during capture. For example, Stagehand is moving toward using the accessibility tree to represent the page, which inherently filters out non-visible elements and focuses on meaningful content/controls. This means that elements with `display:none` or not in the viewport likely won’t appear in the context given to the AI. The resulting DOM snapshot is typically text-based (not a binary format) – essentially the HTML or a serialized representation of the page’s structure. In early versions, this could be quite large for complex pages, but Stagehand includes strategies (like using the accessibility tree and trimming less useful parts of the DOM) to keep the snapshot relevant and concise. The goal is to capture a *meaningful* snapshot of the page state so the AI can reason about what’s currently on screen.

**Captured Properties:** Stagehand’s DOM capture emphasizes actionable content. It records element text (innerText), relevant attributes (especially those that make an element unique or identifiable), and perhaps element hierarchy. For instance, a `<button id="submit" class="btn primary">Submit</button>` might be represented by its tag (`BUTTON`), text (“Submit”), and attributes (`id="submit"`, classes, etc.). This gives the AI enough context to decide that this is a “Submit” button and how to refer to it. Styles or exact coordinates are typically not included (those are more relevant for visual analysis), but accessibility labels or roles *are* included to enrich the description of elements (e.g. knowing a `<div>` is actually a dialog or a menu via ARIA role). By focusing on these properties, Stagehand builds a page representation that’s similar to what a user mentally perceives – a structured outline of interactive and informational elements.

**Invisible Elements:** Stagehand avoids including truly invisible elements in its snapshot. Elements styled as hidden (CSS `display:none` or `visibility:hidden`), or that exist in the DOM but not rendered (like template scripts, or off-canvas elements without visibility) are filtered out. This is both to reduce noise and to ensure the AI doesn’t act on things the user can’t see. Early on, Stagehand likely achieved this by checking computed styles or using the Playwright DOM querying (which can filter by visibility). Now, with the new accessibility-tree approach, only elements that would be accessible to a user (i.e. visible or at least present to assistive tech) are captured. This significantly cuts down the snapshot size and focuses it on what’s actionable.

**Snapshot Size/Structure:** A raw full DOM HTML can be very large, but Stagehand’s preprocessing trims it. The snapshot might be structured as a simplified HTML or JSON. For example, Stagehand could convert the DOM into a JSON array of elements with properties like `{ tag: "button", text: "Submit", id: "submit", classes: ["btn","primary"] }` for each significant element. The **typical size** depends on the page – a simple form page might yield a few dozen elements; a news site might yield hundreds. Stagehand employs caching and hashing of page content to avoid re-sending huge snapshots repeatedly. If the page is very large, Stagehand may not include every single text node; it could truncate long text blocks or omit repetitive menu items to stay within token limits. In summary, Stagehand’s DOM snapshot is a filtered, serialized representation of the page’s HTML focused on visible, interactive content (ids, text, roles) to drive AI decisions.

## Screenshot Collection

Stagehand is capable of capturing screenshots of the page to complement DOM data. By default, it relies on DOM/text understanding, but it historically had an option to use “vision” mode (for example, to leverage models like GPT-4 with image input). In such cases, Stagehand would take a screenshot of the current page state and provide it to the AI alongside or instead of the DOM text. The screenshots are typically taken via Playwright’s screenshot capabilities. Stagehand can capture full-page screenshots (covering the entire scrollable area) or viewport snapshots, depending on configuration. Full-page screenshots ensure all content is visible for analysis, but they can be large; viewport screenshots (just what’s on-screen) are smaller but might miss off-screen content. Stagehand likely uses full-page shots for completeness when vision is enabled.

**Format & Resolution:** Screenshots are usually in PNG format (to avoid JPEG artifacts on text). The resolution is whatever the browser’s viewport/CSS pixel ratio is set to. Stagehand’s default viewport might be a standard desktop size, but it can be configured. If the page is very long, the full-page PNG could be large in file size; Stagehand might downscale or compress if needed for faster processing. Importantly, if screenshots are used, Stagehand ensures they are taken **in sync** with the DOM snapshot – typically right after any dynamic content has loaded and just before sending data to the AI. This synchronization guarantees that what the DOM snapshot describes and what the screenshot shows are the same state.

**Visual Annotations:** Out of the box, Stagehand doesn’t necessarily draw bounding boxes or labels on the screenshot before sending it to the model (it relies on the model to interpret the image). However, Stagehand’s design acknowledged that combining DOM and visuals can be powerful. In internal development, they tried a “vision” feature (now being phased out) that let the AI use the screenshot to identify elements by appearance. That said, Stagehand found the DOM + accessibility info often suffices, and the pure vision approach was less effective than hoped (leading to a planned removal of the vision feature). So, currently Stagehand doesn’t actively annotate screenshots with DOM element highlights, but it provides a raw page image if a vision-enabled model is used. Developers debugging a workflow can of course manually inspect screenshots and even overlay the DOM elements (Stagehand’s debugging tools or Playwright’s inspector can map coordinates), but that’s outside the AI’s direct purview.

In summary, screenshot capture is an **optional augment** in Stagehand: it’s used if you employ an AI model that can process images or if you need visual confirmation. The screenshot is taken at the moment of interest and reflects exactly the state of the DOM snapshot. This hybrid approach (image + DOM) was part of Stagehand’s original vision for richer data, but moving forward the focus is on the DOM and accessibility data for reliability.

## Hybrid Integration (DOM + Visual)

Stagehand’s philosophy is to leverage **both** the DOM’s structured information and the visual context of the page. In practice, this means Stagehand can map between DOM elements and their screen coordinates if needed. For instance, when the AI says “click the green **Login** button,” Stagehand can use the DOM to find a button labeled "Login", then ensure that corresponds to an element on the page and execute a click at its location via Playwright. If vision were enabled, the AI might instead pinpoint “the green button in the screenshot,” but in Stagehand the preference is to identify it via DOM attributes (e.g., the button’s text or aria-label “Login”). The combination of DOM + visual was intended to make the system more robust: the DOM provides exact element references, while the screenshot could provide context for disambiguation (like if there are two “Login” buttons, their positions might differ).

Originally, Stagehand even considered using the accessibility (a11y) tree and what’s rendered on the page together, to mimic how a user sees and perceives the page. The **a11y tree** gives a hierarchical outline of interactive elements (with roles like “button” or “link” and names), effectively bridging DOM and user interface. Stagehand’s recent updates have introduced an *accessibility backbone* – extracting the a11y tree as a streamlined representation of the page. This acts as a hybrid data source: it’s derived from the DOM but structured like what’s visually and semantically available to users. Using this, Stagehand can map accessible names (which often correspond to visible labels) to actual DOM selectors.

If a direct DOM selector fails (say an element’s identifier changed between runs), Stagehand’s approach could fall back to a more general strategy: use the instruction and page context to find a similar element. For example, if `#login-btn` disappeared, Stagehand might search the DOM for a “Login” button or link text as a backup. This is part of Stagehand’s self-healing strategy, making automations resilient to minor DOM changes. It doesn’t randomly click things; it uses the combination of remembered selectors and on-the-fly DOM queries to locate the target deterministically.

In summary, Stagehand’s hybrid integration means it doesn’t treat the page as just text or just pixels – it uses the DOM (for structure and stable element identification) and can use visual context when needed. This ensures Director 2.0 can ask questions like “Are we on the login page or 2FA page?” and Stagehand can answer by checking DOM elements (e.g., presence of a 2FA code field) and even confirming via on-screen text. The **mapping** between visual elements and DOM nodes is inherently handled by the browser (DOM gives element coordinates, Playwright clicks at those coordinates), so Stagehand ensures the element chosen via DOM is the one interacted with on the page. This approach provides a reliable backbone for RPA: the deterministic DOM-based actions are informed by what a human would *see* but executed through stable selectors.

# Pre-processing & Filtering Strategies

## Element Filtering

Stagehand does significant preprocessing on the raw DOM to filter out elements that are not useful for automation. There are explicit **whitelists/blacklists** in play. On the whitelist side, *interactive elements* and informative content are included: links (`<a>`), buttons, form controls (`<input>`, `<select>`, `<textarea>`), clickable divs (if they have event listeners), headings, paragraphs, table data, etc. On the blacklist side, purely decorative or script-oriented elements are excluded: `<script>` and `<style>` tags (and their content) are dropped, since they don’t contribute to page UI. Likewise, meta tags, tracking pixels, and usually `<link>` tags (for CSS, RSS feeds, etc.) are ignored in the content snapshot. If Stagehand encounters huge lists of elements that are not relevant (e.g., a long list of options in a hidden dropdown, or dozens of social media icons), it may prune them as noise unless the instruction at hand might need them.

Stagehand defines **“interactable” elements** largely as those a user could click, type into, or otherwise manipulate. This includes standard form controls and links, as well as elements with clickable roles or handlers. Internally, it might check for attributes like `href` on anchors or `role="button"`/`onclick` on divs to classify an element as actionable. Those interactable elements are given priority in the context provided to the AI. For example, Stagehand’s `observe()` might return a list of candidate actions focusing on clickable elements relevant to the instruction. Conversely, elements that are present but not useful – e.g., invisible layout divs, or duplicate menu links – are filtered out to avoid confusing the AI.

**Invisible Elements:** By default, Stagehand filters out elements that are not visible to the user. This includes elements with CSS `display:none`, `visibility:hidden`, zero width/height, or those hidden via attributes (like `aria-hidden="true"` meant to be skipped by assistive tech). Stagehand uses either the browser’s own querying (Playwright’s visibility checks) or the accessibility tree to accomplish this. The **accessible snapshot** Stagehand is moving toward inherently ignores `aria-hidden` content and offscreen stuff. So an element must be visible (or at least perceivable by a screen reader) to make it into Stagehand’s processing pipeline. This prevents, for instance, a hidden dropdown option from being chosen erroneously by the AI when it’s not actually on screen for the user.

In summary, Stagehand’s element filtering strips the DOM down to what matters: **important interactive controls and content** that an automation might need to click, read, or fill. Everything else – scripts, style, hidden cruft – is left behind. This yields a cleaner, more stable representation. In practical terms, Stagehand might maintain an internal **allow-list** of tags or roles (e.g., “button”, “link”, “input”, “heading”, etc.) and discard nodes not matching these unless explicitly referenced by an action. By providing only meaningful elements, Stagehand reduces noise and improves the reliability of the AI’s understanding of the page.

## Attribute Filtering

When Stagehand captures attributes of elements, it doesn’t treat all attributes equally – it filters and selects those most useful for identification. **Preserved attributes** typically include:

* **IDs:** If an element has an `id`, Stagehand will keep it, as IDs are prime candidates for stable selectors.
* **Classes:** Stagehand may include class names, but often with some filtering. Many sites have multiple classes on elements (sometimes auto-generated or irrelevant ones). Stagehand might keep classes that look semantic (e.g., `btn-primary` might be kept, but `jsx-123abc` or hashed classes might be dropped if recognized as non-deterministic). This prevents the AI from relying on transient class strings.
* **Data attributes:** Custom `data-*` attributes (like `data-testid`, `data-automation-id`) are gold for test automation. Stagehand preserves these since they’re explicitly meant to be stable hooks. If an element has a `data-test` attribute, Stagehand will likely surface that as the preferred selector in actions.
* **Name and Value:** For input fields, `name` attributes are kept (useful for forms). Similarly, for options or buttons, any value or label attribute that defines them might be captured.
* **Aria attributes:** Attributes like `aria-label`, `aria-labelledby`, `role`, etc., are preserved because they often describe the purpose of the element in a stable way (e.g., a `role="dialog"` or `aria-label="Search"` gives a stable handle to what it is).
* **Href/src:** For links or images, the `href` or `src` might be included if needed (though long URLs might be truncated if they’re very lengthy or contain tracking tokens).

On the other hand, **filtered-out attributes** include:

* **Styles:** Inline `style` attributes or presentation-related attributes (like `width`, `height` on elements) are usually ignored. They don’t help identify the element for actions.
* **Dynamic/framework attributes:** Many frontend frameworks add attributes like `data-reactid`, `ng-*`, `vue-*`, etc., or long autogenerated IDs. Stagehand would typically drop or sanitize these. For example, an id like `id="__uid12345"` might be recognized as unstable; Stagehand’s AI won’t trust it as a sole selector. If such an id is the only hook, Stagehand might still note it, but it might accompany it with other context (like text) to ensure stability.
* **Event handlers:** Attributes like `onclick` (if present as attribute) or other JS hooks aren’t needed for identification, so they’re not included in the AI context.
* **Class name filtering:** As noted, classes that look like hashes or non-descriptive might be stripped. Stagehand doesn’t explicitly list “blacklisted class names” in public docs, but the intent is to avoid classes that change per session. (E.g., classes with a mix of letters/numbers like `btn-xYZ123` could be truncated to just `btn-` prefix or ignored, whereas a constant class like `btn-primary` is kept.)

**Dynamic Attribute Handling:** If the page generates new IDs on each load (common in React apps), Stagehand’s strategy leans on more stable indicators. It might notice that an element’s `id` is different each time and thus not rely on it. Instead, it could use the element’s text or role. For instance, rather than using `#login-abc123` which changes, it might use `button[aria-label="Login"]` if that’s constant. There isn’t magic to know what’s dynamic without patterns, but Stagehand’s AI is quite good at interpreting whether an attribute looks machine-generated versus human meaningful. In essence, Stagehand is biased toward *human-readable attributes* for building selectors (ids or data attributes often qualify, long random strings do not).

**Attribute Value Transformations:** Stagehand might do minor cleaning like lowercasing certain values for comparison (e.g., comparing text in a case-insensitive way), or trimming whitespace. If an attribute has a long value (like a 200-character title or URL), Stagehand could truncate it when sending to the AI, just to save tokens, unless that full string is crucial. But by and large, Stagehand passes through the key attributes verbatim, trusting the AI to use them effectively. For example, if a button has `title="Submit Order"`, that exact string is given to the AI as part of the element’s info, rather than some abstract summary.

In conclusion, Stagehand **preserves attributes that anchor an element’s identity** and strips those that don’t. By doing so, it provides the AI (and the developer) a cleaner set of signals for building reliable selectors. An element might be represented to the AI like: *“`<button id="loginBtn" class="btn primary" aria-label="Log In">Log In</button>` appears on the page”* – where irrelevant bits are already removed. This selective preservation is crucial for Director’s needs, as it means Stagehand can highlight deterministic selectors (IDs, data-\*) inherently.

## Content Processing

Stagehand doesn’t just dump raw text content at the AI – it processes and cleans it to improve relevance. **Text Extraction:** Stagehand will extract visible text nodes from the page to include in the context, but likely in a structured way. For instance, it may concatenate text with its element context (e.g., a heading “Welcome” might be noted as `H1: "Welcome"`, a button “Submit” as `Button: "Submit"`, etc.). All text is typically trimmed of excess whitespace and normalized (removing newlines, unusual characters) to ensure consistency. If a piece of text is extremely long (say a giant paragraph or an entire article) and not directly relevant to the instruction, Stagehand might truncate it or summarize it. It could employ a heuristic like “include the first N characters of long text blocks and then an ellipsis” or exclude large bodies of text unless asked for extraction specifically. This keeps the token count manageable for the LLM.

**Noise Reduction:** “Noise” includes things like headers, footers, ads, navigation menus – text that is present on many pages but not specific to the user’s goal. Stagehand tries to minimize noise. It might do so by recognizing common site sections (many sites mark navs with roles or ids like `id="header"` which Stagehand can downplay). Also, repeated text (e.g., a footer copyright on every page) might be included only once or not at all. Stagehand’s caching of actions also helps here: if an earlier step already read the main content, subsequent steps might not resend the entire page text, focusing instead on what changed or what’s newly relevant.

**Text Length Limits:** While Stagehand’s docs don’t state an explicit character limit, practical use with LLMs imposes one. If a page has, say, 10,000 words, Stagehand is not going to feed all that verbatim to the AI. Instead, it might include the first part of each section or use the model to summarize parts of it. For example, Stagehand could internally prompt, “Summarize this page’s content in 1000 tokens” as an `observe` step, then use that summary for an `extract` query. This isn’t explicit, but *reducing inference cost* is a stated goal, which implies summarization or selective inclusion. In simpler terms, Stagehand might include all headings and the first lines of paragraphs, but not every word of every paragraph, unless the instruction is specifically to extract detailed content.

**Cleaning:** Any extraneous whitespace, HTML entities, or scripts are cleaned out of text. Stagehand ensures that text like “ ” or “<script>…</script>” never reaches the AI context. It also likely strips out things like comments or hidden alt text that aren’t relevant. If there are dynamic texts (e.g., timers or counts updating), Stagehand would take a snapshot value at the moment and use that.

To illustrate, suppose the page has: `<div id="footer">© 2025 Company. All rights reserved.</div>` – Stagehand knows this is a footer (by id or role “contentinfo”) and would consider it noise for most tasks, thus probably exclude it. If the task is to scrape the page for an article text, Stagehand will focus on the article container text and not include the site navigation text.

Overall, Stagehand’s content processing pipeline yields a **clean, focused textual representation** of the page. It’s as if an expert user skimmed the page and jotted down the important bits: key labels, visible text of buttons/links, form field labels, headings, and any instruction-relevant content. This ensures the AI (and by extension Director) doesn’t get distracted or run out of context window due to irrelevant text. And since all this is done in code, it can be tuned or customized – for example, if Director needs even stricter filtering (maybe completely drop header/nav text always), we could adjust Stagehand’s filters accordingly (it’s open-source MIT, so modifiable).

# Codebase & Integration Analysis

## Language & Architecture

Stagehand is implemented in **TypeScript** (Node.js). It’s built on top of Playwright (a Node library for browser automation) as the core driving engine. The architecture is such that Stagehand wraps or extends Playwright’s `Browser`/`BrowserContext`/`Page` classes to inject AI capabilities. When you install Stagehand via npm (`@browserbasehq/stagehand`), you’re essentially getting a library that depends on Playwright – in fact, you run `npx playwright install` as part of setup to ensure browsers are available. Internally, Stagehand likely maintains a **Stagehand** class that manages the Playwright browser instance and an AI client. For example, when you do `const stagehand = new Stagehand(config)`, it prepares a browser context and configures an LLM (like OpenAI or Gemini) based on the provided settings. Stagehand uses a plugin-like system for different LLM providers (OpenAI, Anthropic/Claude, Gemini, local models via Ollama, etc. are supported).

The codebase is structured with separation of concerns:

* A module for “handlers” or “actions” (implementing the logic for `act`, `observe`, `extract`).
* Integration with LLM APIs (probably under a clients or providers directory, handling API calls and formatting prompts).
* Utilities for DOM processing (the logic that filters DOM, generates text snippets, caches results, etc.).
* Playwright integration layer which likely monkey-patches the Page object or provides a subclass with extra methods.

Stagehand is designed as a **library**, not a standalone server. That means it can be required in any Node.js application. There is also a Python version (stagehand-py) that provides similar functionality via Playwright Python, indicating the architecture is flexible and language-agnostic in concept. But our focus is the Node/TS version for Director 2.0. The use of TypeScript gives strong typing – Stagehand defines types for things like the `instruction` and `schema` objects you pass to `page.extract()`, the return types of these calls, etc., making integration less error-prone.

Dependency-wise, besides Playwright, Stagehand uses **Zod** (for schema validation as seen in examples using `z.object({...})` for extraction). It likely also uses libraries for parsing HTML (though Playwright provides the DOM directly) and perhaps OpenAI/Anthropic SDKs for calling the models. The package.json in Stagehand shows it’s fairly lean, relying mostly on Playwright and a few AI-client libraries. Package management is via `pnpm` (as the repository includes a pnpm workspace), but you as a user can just do `npm install @browserbasehq/stagehand` to add it to your project.

**Installation & Setup:** To use Stagehand, you install the package and ensure Playwright’s browser binaries are installed. Then you need API keys for the LLM. Stagehand provides a `.env.example` for configuring these. This implies Stagehand can load config from env vars or an options object. For instance, you can specify which AI provider and model to use in the Stagehand constructor options (like `{ provider: "openai", model: "gpt-4" }` or for Gemini as in Google’s case). You also can configure browser launch options (headless or not, which browser). By default, it runs a Chromium-based browser in the background.

In summary, Stagehand’s architecture is a **layer on Playwright** adding an AI decision-making component. It retains the robustness of a tested automation framework (Playwright) and augments it with high-level AI-driven functions. The code is organized to allow swapping out AI models or even disabling AI (you can still use `stagehand.page` as a normal Playwright page). This modular design will let us integrate it into Director’s Node backend cleanly, and even fork or modify parts of the DOM processing if needed to meet specific RPA requirements.

## API Design

Stagehand’s API is designed to feel like an extension of Playwright’s API. The key class/method we interact with is `Stagehand` and its `page`:

* **Stagehand constructor:** `new Stagehand(options)` – creates a Stagehand instance. Options include configuration for the environment (like which LLM provider and model to use, any API keys, etc.), and possibly browser launch settings (e.g., headless or not, default timeout). The constructor returns an object with properties like `.page` and `.context`. In code, you often see:

  ```ts
  const stagehand = new Stagehand({...StagehandConfig});
  await stagehand.init(); // launches browser and sets up context
  const page = stagehand.page;
  ```

  Here, `stagehand.init()` is an initialization method to launch the browser (this step is sometimes required if Stagehand doesn’t auto-launch on construction). After that, `stagehand.page` is a Playwright `Page` object that has been **augmented** with Stagehand’s AI methods.

* **page.act()** – *Execute an action via AI.* This function can be called in two ways:

  1. Simply with a natural language string, e.g. `await page.act("Click the submit button")`.
  2. With an object specifying the action, e.g. `await page.act({ action: "click on the 'Quickstart'" })`. The object form can allow additional parameters (for example, some versions might let you specify a timeout or a flag to preview the action). The simplest signature is effectively `page.act(instruction: string | { action: string }) => Promise<void>`. When called, Stagehand will take the instruction, process the page (DOM snapshot, etc.), ask the LLM to interpret it into a concrete action (like finding a selector for the "submit" button), then execute that action using Playwright (e.g., `page.click(selector)`). If the target element can’t be found or the AI’s instruction is ambiguous, `page.act` may throw an error or return a failure result – in practice, Stagehand tries to handle minor ambiguities by choosing the most likely element.

* **page.observe()** – *Plan an action or gather info via AI.* This function returns one or more suggestions rather than executing them. For example, `const [suggestedAction] = await page.observe("find the search bar")` might return a string or structured action that describes what to do. In many cases, `observe` is used to **preview** what `act` would do. Think of it as *dry-run in natural language*: it processes the instruction with the LLM and returns, say, a snippet like *“{ action: 'click', selector: '#search-input' }”* without actually clicking. Then you can inspect or modify it before calling `page.act(suggestedAction)`. The signature is something like `page.observe(instruction: string | { instruction: string }) => Promise<string[] | Action[]>`. Simpler: you give it an instruction and it gives you an array of possible action steps (often one element array with the most likely action). Developers use this to validate what the AI *thinks* it should do before doing it. In Director’s context, this is useful for incremental workflow building – you can `observe` on a page to get a list of, say, “what clickable elements are on this page?” or “how would you navigate next?” and then decide which to execute.

* **page.extract()** – *Extract structured data via AI.* This is one of the most powerful features. Its signature is `page.extract(options: { instruction: string, schema: ZodSchema | JSON schema, [optional parameters] }) => Promise<any>`. You provide a natural language instruction describing what data to extract and a schema describing the shape of the output. Under the hood, Stagehand will feed the page content plus your instruction to the LLM, which will then return data that Stagehand validates against the schema. For example:

  ```ts
  const result = await page.extract({
    instruction: "Extract the product name and price",
    schema: z.object({
      name: z.string(),
      price: z.string()
    })
  });
  console.log(result.name, result.price);
  ```

  Stagehand ensures the LLM’s answer is parsed into that JSON structure (using Zod or equivalent). If the LLM returns something that doesn’t fit (malformatted or missing fields), Stagehand will flag an error or possibly retry. The `extract` function is deterministic in that given the same page state and instruction, the schema validation means you get consistent key-value pairs out (the AI is guided to fill the schema exactly). This is crucial for RPA data scraping tasks. The typical implementation likely involves Stagehand constructing a prompt like: *“Here is the page content... Based on the instruction, provide a JSON with fields X and Y.”* and then parsing the model’s output.

In addition to these, Stagehand’s API includes:

* **stagehand.agent()** – which creates an “agent” for multi-step strategies (not heavily needed for Director’s deterministic approach, but it’s there to chain multiple actions with the AI autonomously if desired).
* Standard Playwright methods – since `stagehand.page` *is* a Playwright page, you can call `page.goto(url)`, `page.click(selector)` (if you have a selector), `page.fill(selector, text)` etc., directly. Stagehand doesn’t remove any Playwright functionality; rather it interoperates. For example, you might use `page.getByRole('button', { name: 'Submit' })` from Playwright in one step, then `page.act("click the Submit button")` in another – both will work. This interoperability is highlighted in the docs.

**Integration with Node.js backend:** Since Stagehand is a library, integrating it into a Node backend (like an Express server or a workflow orchestrator) is straightforward. You would initialize Stagehand likely as a singleton or per-session basis. For instance, in an Express route handler, you might do:

```ts
// Pseudo-code for an Express route using Stagehand
app.post('/run-workflow', async (req, res) => {
  const stagehand = new Stagehand({ /* config with API keys, model */ });
  await stagehand.init();
  const page = stagehand.page;
  try {
    await page.goto(req.body.startUrl);
    // Use a mix of direct Playwright and Stagehand AI calls:
    const [nextAction] = await page.observe("find and click the login link");
    await page.act(nextAction);
    const data = await page.extract({ instruction: "get the confirmation message", schema: z.object({ message: z.string() }) });
    res.json({ success: true, data });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await stagehand.close();
  }
});
```

This illustrates how you can embed Stagehand’s calls in any JS/TS code – it’s promise-based, so using `await` is natural (or `.then` if you prefer). Stagehand’s API is synchronous from the caller’s perspective (you don’t have to handle callbacks or events; you just await the promise from `act/observe/extract`). This design makes it **easy to integrate** into our Director 2.0 backend: Director can call Stagehand’s methods at each step of building the workflow, and get either results or errors to handle.

## Error Handling

Stagehand’s error handling aims to make automation failures more intelligible. At the low level, it wraps Playwright errors (like “element not found”, navigation timeouts, etc.) and might enrich them with AI context. For example, if `page.act("click the Submit button")` fails because no element was identified as “Submit button”, Stagehand could return an error explaining “No element matching 'Submit button' was found” rather than just a generic exception. Internally, Stagehand likely uses try/catch around the AI calls and DOM interactions. If the AI returns an invalid action (say a selector that doesn’t exist), Stagehand catches the resulting Playwright error and may attempt a fallback. A fallback might be: re-run an `observe` to get an alternative selector or ask the LLM a second time with more guidance. However, these retries are limited to keep determinism – Stagehand won’t loop indefinitely. If an action truly cannot be executed, it will throw an error up to the user.

From the development discussions, we know that error handling has been an area of attention. For instance, a Stagehand issue mentions an *“uncaught exception during cache operations”*. This implies that some errors (like failing to store or retrieve a cached result for an action) were not gracefully handled in early versions. The team is working on catching those so they don’t crash the user’s script. We can expect that Stagehand now logs warnings if something non-critical fails (like if it can’t save to cache, it just proceeds without cache rather than throwing).

For **DOM extraction failures**: If Stagehand cannot retrieve the DOM (perhaps the page is blank or an eval script fails), it will likely throw an error indicating DOM could not be fetched. However, this is rare since Playwright’s `page.content()` is reliable after page load. More common would be **extraction (AI) failures** – e.g., the LLM returns something that doesn’t match the schema in `extract()`. In that case, Stagehand handles it by treating it as a failed extraction. It might log the LLM’s raw response for debugging (in a verbose mode) and then throw an error or return an empty result. Because the schema is there, Stagehand can validate and be sure if the extraction is correct. If validation fails, that’s an error case. The user (or Director) could catch this and decide to perhaps re-prompt or use a different strategy.

For **screenshot/vision failures**: If vision were enabled and the screenshot couldn’t be captured (say the browser context was closed or an out-of-memory issue), Stagehand would log an error about failing to get the screenshot and fall back to using only DOM text. Since the vision component is being deprecated (they found it “ineffective” and are removing it, with just a warning if someone tries to use it), this fallback scenario will be less relevant. Essentially, Stagehand will prefer to run even without vision rather than fail entirely.

**Fallback Mechanisms:** Stagehand incorporates a few safety nets. One is caching of AI decisions – if an `extract` was done once on a page and the page hasn’t changed, Stagehand may reuse the result to avoid another AI call, thus also avoiding potential AI errors on subsequent runs. Another is multi-modal fallback: if the AI fails to identify an element via text, Stagehand could potentially attempt a simpler heuristic (for example, if instruction says "click Login", Stagehand might try `page.click('text=Login')` as a backup). This isn’t explicitly documented, but given the goal of resiliency, it’s plausible. At minimum, Stagehand allows the developer to intervene – using `observe` first means you can see what the AI *wants* to do and adjust if it looks wrong, preventing an error.

From the code quality report, there was mention that some parts of error handling could be improved (uncaught exceptions, etc.). As of now, typical errors you might have to catch in Director integration include:

* Timeout errors (Stagehand will timeout if an AI call takes too long or a page action is hanging).
* Element not found errors (if AI suggests a selector that doesn’t match anything).
* Model errors (if the LLM API fails – Stagehand will propagate that, e.g., OpenAI API error).
* Validation errors (extract returns wrong format).

Stagehand probably throws custom error types or at least error messages that indicate the stage (e.g., “\[Stagehand]\[Act] Element not found: selector=…”) to help debugging. These can be caught in a try/catch around `page.act` or `page.extract`.

In summary, Stagehand’s error handling philosophy is: **fail gracefully and informatively**. It won’t crash the entire process silently; it surfaces issues so that the workflow builder (like Director) can adjust. For Director 2.0, this means we can trap Stagehand exceptions and use the debugging info (like DOM state, etc.) to assist the user in fixing the workflow – which aligns with the requirement of “inspect page state when workflows fail.” Stagehand gives us the hooks to do exactly that (for example, if a selector failed, we can log the current DOM or take a screenshot for the user because we still have the Playwright page handle at that point).

## Selector Strategy Analysis

The way Stagehand generates and uses selectors is a critical point. Stagehand strives to create **robust, deterministic selectors** for elements, wherever possible, rather than brittle ones. When the AI model is given the page DOM, it’s implicitly encouraged (by the prompt design and Stagehand’s few-shot examples) to choose uniquely identifying attributes. In practice, this means the model will look for things like an element’s `id` or a data attribute to refer to it. If the “submit” button has `id="submit-btn"`, the AI’s output might explicitly say something like: *Click the button with id "submit-btn"* or it might even return an action object with that selector. Stagehand then executes using that selector (which is stable across sessions). Indeed, Stagehand’s creators emphasize determinism – *“Stagehand adds determinism to otherwise unpredictable agents”*. This suggests that Stagehand’s internal prompt or logic likely says: *“Prefer using stable identifiers (IDs, names, etc.) rather than positional or fragile descriptions.”*

If an element lacks a neat identifier, Stagehand might combine attributes to form a selector. For example, maybe a login button has no id, but it has `class="btn login-btn"` and text "Login". The AI could propose a selector like `"button.login-btn:text("Login")"` or use Playwright’s text selector. Stagehand might then use Playwright’s fuzzy selectors (Playwright allows things like `page.getByText('Login', { exact: true })`). While text is less deterministic (it can change with localization or wording changes), if it’s the only way, Stagehand will use it but also include element type to avoid mistakes (e.g., “click the **link** labeled Reports” vs a button labeled Reports).

Stagehand also leverages **Playwright’s built-in selector engines** such as `getByRole`. In pure Playwright usage, a good practice is to select by role and name (accessible name) because it’s resilient. Stagehand’s own docs show an example of avoiding AI entirely by using `page.getByRole('link', { name: /Contributors/ })`. This philosophy carries into the AI side: the AI could output something like “click the element with role `button` named 'Submit'”. Stagehand’s execution layer might interpret that into a Playwright query. It’s possible Stagehand has a utility that converts an English description into a concrete selector (for instance, mapping “search box” to `input[type=search]` or `role=textbox name~search`). Whether done by AI or code, the effect is the same: **stable attributes first**. Ids and `data-testid` are top of the list, followed by unique combination of classes, then text as a fallback.

Natural language descriptions are primarily used in the communication with the AI. Once an element is identified, Stagehand will rely on the actual selector for execution. For example, the AI might say, “the ‘Login’ button with class `btn-primary`.” Stagehand can then form a selector from that (like `"button.btn-primary:has-text('Login')"` in Playwright syntax). This intermediate step might not be exposed to the user, but it’s how Stagehand ensures the action is repeatable – it doesn’t click by screen coordinates or some ephemeral reference, but by a selector built from page structure.

**Reliability Strategies:** Stagehand’s strategy for reliability includes:

* **Uniqueness check:** It likely checks that a chosen selector uniquely identifies one element. If the AI suggests something that matches multiple elements, Stagehand might refine it or warn. (E.g., if two buttons have the text "Submit", Stagehand might include additional context like form index or parent element to distinguish them.)
* **Attribute prioritization:** As noted, `id` and `data-*` are considered most stable (they rarely change and usually unique). If present, Stagehand will use those. Many modern sites include test hooks; Stagehand takes advantage of them if they exist.
* **Avoid brittle selectors:** Stagehand avoids selectors based on DOM index or absolute XPaths (“nth-child” chains) because those break easily. The AI is unlikely to output an absolute XPath unless no other way (and Stagehand’s examples probably discourage that). It’s more inclined to use human-like cues (the same ones a QA engineer would choose).
* **Self-healing:** If a selector fails (element not found), Stagehand can call `observe` again or even a different instruction to find an alternative. For example, if `#submit-btn` disappeared, Stagehand might catch that error and ask the AI, “the previous selector didn’t work, find the Submit button another way.” This is speculative, but aligns with the idea of self-healing and resilient workflows. It means even if the site changes, Stagehand tries to adapt rather than give up immediately.

For Director’s deterministic RPA needs, we ultimately want to lock in these stable selectors. Stagehand can help discover them. In fact, a highly requested feature (which is in development) is the ability to **dump Stagehand actions as code** in pure Playwright/Puppeteer selectors. That means Stagehand could output something like: `page.click('#submit-btn')` after figuring out that `#submit-btn` is the selector. This is exactly the bridge from an AI-driven step to a hard-coded workflow. The team’s PR on *“Add playwright/cypress/puppeteer code dumping”* shows they are adding functionality to generate deterministic code from the AI’s actions. This will allow taking a learned workflow and freezing it as a script – ideal for RPA. So Stagehand is aligning with the goal of deterministic repeatability.

**Public vs. Implementation:** Stagehand doesn’t expose all this selector logic directly in the API; it’s happening behind the scenes in `act` and `observe`. But as we integrate it, we can peek at what it’s doing. For instance, using `page.observe(...)` to see what action it suggests often yields a selector or description we can refine. We might incorporate a step in Director where after Stagehand finds a target element, we fetch that element’s stable attributes to store permanently. Because Stagehand is MIT-licensed and open source, we could even modify its selector generator to enforce stricter rules (for example, always prefer `aria-label` over innerText, etc., if that suits our use case).

In conclusion, Stagehand currently **prioritizes stable selectors whenever possible** for interacting with elements. It uses natural language to figure out *which* element, but once identified, it executes via concrete selectors (favoring IDs, data attributes, and robust Playwright queries). This approach yields repeatable actions that tend to survive minor UI changes. For Director 2.0, this means we can leverage Stagehand to automatically find good selectors, but we might want to add custom filtering for extremely dynamic attributes (Stagehand’s defaults are good, but in a tightly controlled RPA scenario we might tighten them further). Overall, Stagehand’s selector strategy is well-aligned with constructing deterministic workflows – it was built precisely to combat brittle selectors in traditional scripts, making it a strong candidate to support Director’s needs out-of-the-box, with minimal tweaks for our specific domain.

**Code Example – Using Stagehand in Node.js (Summary):** To tie it together, here’s a small snippet illustrating how one might use Stagehand in a Node context to build a stable workflow:

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

// Configure Stagehand (using, say, OpenAI GPT-4 and a headless browser)
const stagehand = new Stagehand({
  provider: "openai",
  model: "gpt-4", 
  headless: true 
});
await stagehand.init();
const page = stagehand.page;
await page.goto("https://example.com/login");

// Identify login form elements in a deterministic way
const [fillAction] = await page.observe("Type username 'alice' into the username field");
console.log("Suggested action:", fillAction);
// e.g., Suggested action: { action: 'fill', selector: '#username', value: 'alice' }
await page.act(fillAction);

// Similarly for password and click login
await page.act("Type password into the password field");
await page.act("Click the Login button");

// Validate we reached the dashboard page by extracting a greeting text
const { greeting } = await page.extract({
  instruction: "Find the greeting message on the page",
  schema: z.object({ greeting: z.string() })
});
console.log("Extracted greeting:", greeting);

await stagehand.close();
```

In this hypothetical code, `observe` and `act` work together to choose selectors like `#username` (if available) for the username field and perform the actions. The `extract` uses the DOM content to pull out a greeting message reliably. All these steps use Stagehand’s internal logic for stable element handling and demonstrate how it can be integrated directly into a Node workflow. The result is an automation script that is concise but also robust – exactly what we aim for in Director 2.0’s workflow construction.

**Sources:**

* Stagehand passes the page’s HTML (and optionally screenshots) to an AI model to interpret instructions, using Playwright as a backbone.
* Stagehand is an early-release browser automation library that emphasizes durable, repeatable workflows using a mix of code and AI.
* The project is actively improving strategies like caching results and using the accessibility tree for context to enhance reliability and reduce token usage.
* Upcoming features include outputting equivalent Playwright/Puppeteer code for AI-driven actions, underlining the focus on deterministic automation.
* *“Most existing tools are brittle to minor DOM changes… Stagehand makes automations more resilient to UI changes.”* This mindset is reflected in Stagehand’s selector strategy of preferring stable identifiers and self-healing if things move around.
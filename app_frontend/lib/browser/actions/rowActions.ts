// We use Stagehand's Page which is not Playwright's type; use any to stay framework-agnostic

// Generic configuration interface for row-level primitives
export interface RowConfig {
  tableName?: string; // optional – many grids don't expose a name
  searchCriteria?: {
    primaryKey?: string;
    searchFields?: string[];
    fuzzyMatch?: boolean;
    matchThreshold?: number; // 0-1 similarity
  };
  fieldMapping: Record<string, string>; // workflowVar -> column header text
  upsertStrategy?: 'create_only' | 'update_only' | 'create_or_update';
  requiredFields?: string[];
  defaultValues?: Record<string, any>;
  saveSelector?: string;      // optional explicit save button
  addRowSelector?: string;    // optional explicit add-record button (create_row)
}

// Simple in-memory selector cache keyed by origin+pathname
interface ColumnSelectorCache {
  [originPath: string]: {
    columnSelectors: Record<string, string>; // headerText -> cell selector template e.g. "tr[data-row-id] td:nth-child(3)"
    addRowSelector?: string;
    timestamp: number;
  };
}
const selectorCache: ColumnSelectorCache = {};

function cacheKey(url: string) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Learn stable selectors for column headers & cells by asking Stagehand AI once.
 */
async function learnSelectors(page: any, retries = 2): Promise<{ columnSelectors: Record<string, string>; addRowSelector?: string }> {
  const instruction = `Identify each visible column header in the current table or grid and return JSON mapping {headerText: cellCssSelectorUnderThatHeader}. Also include {addRowSelector:"CSS"} pointing to the button or row that adds a new record.`;

  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const learn = await page.act(instruction);
      const parsed = typeof learn === 'string' ? JSON.parse(learn) : learn;
      const { addRowSelector, ...columnSelectors } = parsed;
      if (!Object.keys(columnSelectors).length) throw new Error('No columns detected');
      return { columnSelectors, addRowSelector };
    } catch (e) {
      lastErr = e;
      if (i < retries) await page.waitForTimeout(1000);
    }
  }
  throw new Error(`Selector learning failed: ${lastErr?.message || lastErr}`);
}

/**
 * Locate an existing row, optionally fuzzy matching.
 * Returns the row element handle or null.
 */
async function locateRow(page: any, cfg: RowConfig, vars: Record<string, any>): Promise<any | null> {
  if (!cfg.searchCriteria || !cfg.searchCriteria.searchFields?.length) return null;

  const valuePool = cfg.searchCriteria.searchFields
    .map((field) => vars[field])
    .filter(Boolean);

  // Build instruction with fuzzy flag
  const instruction = cfg.searchCriteria.fuzzyMatch
    ? `Find the table row where ANY of these values approximately match (threshold ${cfg.searchCriteria.matchThreshold ?? 0.8}): ${valuePool.join(', ')}`
    : `Find the table row where ANY of these values exactly match: ${valuePool.join(', ')}`;

  const result = await page.act(instruction);
  // page.act should return a selector (string) or element – we normalise to element handle
  if (!result) return null;
  const rowHandle = typeof result === 'string' ? await page.$(result) : result;
  return rowHandle;
}

export async function updateRow(page: any, cfg: RowConfig, vars: Record<string, any>) {
  const key = cacheKey(page.url());
  if (!selectorCache[key]) {
    const learned = await learnSelectors(page);
    selectorCache[key] = { ...learned, timestamp: Date.now() };
  }
  const { columnSelectors } = selectorCache[key];

  const row = await locateRow(page, cfg, vars);
  if (!row) {
    if (cfg.upsertStrategy === 'update_only') {
      throw new Error('Row not found and upsertStrategy=update_only');
    }
    // fallback to create
    return await createRow(page, cfg, vars);
  }

  // Edit each mapped field
  for (const [varName, headerText] of Object.entries(cfg.fieldMapping)) {
    const newVal = vars[varName] ?? cfg.defaultValues?.[varName];
    if (newVal === undefined) continue;
    const cellSel = columnSelectors[headerText];
    if (!cellSel) continue;
    const cell = await row.$(cellSel);
    if (cell) {
      await cell.click({ clickCount: 2 });
      await page.keyboard.type(String(newVal));
      await page.keyboard.press('Enter');
    }
  }

  // Save if explicit selector provided
  if (cfg.saveSelector) {
    await page.click(cfg.saveSelector);
  }

  return { updated: true };
}

export async function createRow(page: any, cfg: RowConfig, vars: Record<string, any>) {
  const key = cacheKey(page.url());
  if (!selectorCache[key]) {
    const learned = await learnSelectors(page);
    selectorCache[key] = { ...learned, timestamp: Date.now() };
  }
  const { columnSelectors, addRowSelector } = selectorCache[key];

  const addSel = cfg.addRowSelector || addRowSelector;
  if (!addSel) throw new Error('No addRowSelector found');

  await page.click(addSel);
  // Let UI render the new row
  await page.waitForTimeout(500);

  // Try AI to locate the newly created row
  let newRow = null;
  try {
    const sel = await page.act('Return a CSS selector that uniquely identifies the row that is currently focussed for editing (the new empty record you just created).');
    newRow = typeof sel === 'string' ? await page.$(sel) : sel;
  } catch {}

  // Fallback: last <tr>
  if (!newRow) {
    const rows = await page.$$('tr');
    newRow = rows[rows.length - 1];
  }

  for (const [varName, headerText] of Object.entries(cfg.fieldMapping)) {
    let value = vars[varName] ?? cfg.defaultValues?.[varName];
    if (value === undefined && cfg.requiredFields?.includes(varName)) {
      throw new Error(`Required field ${varName} missing for create_row`);
    }
    if (value === undefined) continue;

    const cellSel = columnSelectors[headerText];
    if (!cellSel) continue;
    const cell = await newRow.$(cellSel);
    if (cell) {
      await cell.click({ clickCount: 2 });
      await page.keyboard.type(String(value));
      await page.keyboard.press('Enter');
    }
  }

  if (cfg.saveSelector) {
    await page.click(cfg.saveSelector);
  }

  return { created: true };
} 
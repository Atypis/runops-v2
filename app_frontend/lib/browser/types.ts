export interface BrowserSessionConfig {
  executionId: string;
  userId: string;
  headless?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  timeout?: number;
}

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'act' | 'wait' | 'wait_for_navigation' | 
        'observe' | 'clear_memory' | 'label_email' | 'search_airtable' | 'paginate_extract' | 'extract_list' |
        'update_row' | 'create_row';
  data: any;
  stepId?: string;
  // New: Instructions for stagehand-style actions (for credential injection)
  instruction?: string;
  // New: Flag to indicate if this action requires credential injection
  requiresCredentials?: boolean;
}

export interface BrowserState {
  currentUrl: string;
  screenshot?: string; // base64 encoded
  isReady: boolean;
  lastAction?: string;
  error?: string;
  timestamp: number;
}

export interface BrowserSession {
  id: string;
  executionId: string;
  userId: string;
  containerId?: string; // Docker container ID
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'closed';
  createdAt: Date;
  lastActivity: Date;
}

export interface WebSocketMessage {
  type: 'browser_update' | 'action_complete' | 'error' | 'checkpoint' | 'execution_status';
  timestamp: number;
  data: any;
}

export interface ExecutionStep {
  id: string;
  type: string;
  instruction: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

export interface ExtractListConfig {
  itemSelector?: string;           // CSS selector for list items (learned if not provided)
  nextPageSelector?: string;       // CSS selector for next page button (optional)
  fields: Record<string, string>;  // Field mapping: fieldName -> CSS selector
  maxItems?: number;               // Maximum items to extract (default: 300)
  maxPages?: number;               // Maximum pages to scroll (default: 20)
  scrollStrategy?: 'auto' | 'manual' | 'infinite'; // Scrolling strategy (default: auto)
  deduplication?: boolean;         // Remove duplicates (default: true)
  stream?: boolean;                // Stream results via WebSocket (default: false)
  stopPredicate?: string;          // Optional JS predicate to stop extraction
  throttleMs?: number;             // Throttle between scrolls (default: 250ms)
  debug?: boolean;                 // Enable debug logging (default: false)
}

export interface ExtractListResult {
  items: any[];                    // Extracted items
  pagesVisited: number;            // Number of pages processed
  totalItems: number;              // Total items found (before deduplication)
  selectorCache?: {                // Learned selectors for future use
    domain: string;
    path: string;
    itemSelector: string;
    nextPageSelector?: string;
    timestamp: number;
  };
}

export interface ActionResponse<T = any> {
  stepId?: string;
  action: string;
  payload: T;
  state: {
    currentUrl: string;
    isReady: boolean;
    timestamp: number;
  };
} 
/**
 * Browser Automation Types
 * 
 * Defines the interfaces for browser automation, session management,
 * and browser-based step execution in AEF workflows.
 */

/**
 * Browser session configuration
 */
export interface BrowserSessionConfig {
  // Basic configuration
  headless?: boolean;                      // Run browser in headless mode
  userAgent?: string;                      // Custom user agent
  viewport?: {
    width: number;
    height: number;
  };
  
  // Security and isolation
  incognito?: boolean;                     // Use incognito/private mode
  disableImages?: boolean;                 // Disable image loading for performance
  disableJavaScript?: boolean;             // Disable JavaScript execution
  
  // Performance settings
  timeout?: number;                        // Page load timeout in seconds
  navigationTimeout?: number;              // Navigation timeout in seconds
  
  // Recording and debugging
  recordVideo?: boolean;                   // Record session video (future)
  saveScreenshots?: boolean;               // Save step screenshots
  enableDevTools?: boolean;                // Enable browser dev tools access
}

/**
 * Browser session state and metadata
 */
export interface BrowserSession {
  // Session identification
  id: string;
  userId: string;
  executionId?: string;
  
  // Session lifecycle
  status: BrowserSessionStatus;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
  
  // Browser configuration
  config: BrowserSessionConfig;
  
  // Current state
  currentUrl?: string;
  pageTitle?: string;
  
  // Performance metrics
  memoryUsage?: number;                    // MB
  cpuUsage?: number;                       // Percentage
  
  // Error tracking
  lastError?: {
    message: string;
    timestamp: Date;
    recoverable: boolean;
  };
  
  // Session metadata
  metadata: {
    browserEngine: 'playwright' | 'stagehand';
    version: string;
    capabilities: string[];                // Supported automation features
  };
}

/**
 * Browser session lifecycle status
 */
export enum BrowserSessionStatus {
  INITIALIZING = 'initializing',           // Session being created
  READY = 'ready',                         // Ready for automation
  ACTIVE = 'active',                       // Currently executing actions
  IDLE = 'idle',                           // No recent activity
  ERROR = 'error',                         // Session in error state
  CLOSING = 'closing',                     // Session being terminated
  CLOSED = 'closed'                        // Session terminated
}

/**
 * Browser automation action types
 */
export enum BrowserActionType {
  NAVIGATE = 'navigate',                   // Navigate to URL
  CLICK = 'click',                         // Click element
  TYPE = 'type',                           // Type text
  SELECT = 'select',                       // Select dropdown option
  SCROLL = 'scroll',                       // Scroll page
  WAIT = 'wait',                           // Wait for condition
  SCREENSHOT = 'screenshot',               // Take screenshot
  EXTRACT = 'extract',                     // Extract data from page
  UPLOAD = 'upload',                       // Upload file
  DOWNLOAD = 'download'                    // Download file
}

/**
 * Browser automation action request
 */
export interface BrowserActionRequest {
  id: string;
  sessionId: string;
  type: BrowserActionType;
  
  // Action parameters
  selector?: string;                       // CSS selector or element description
  value?: string;                          // Text to type or URL to navigate
  options?: Record<string, any>;           // Additional action options
  
  // Wait conditions
  waitFor?: {
    type: 'selector' | 'text' | 'url' | 'timeout';
    value: string | number;
    timeout?: number;
  };
  
  // Retry configuration
  retryCount?: number;
  retryDelay?: number;                     // milliseconds
  
  // Metadata
  stepId?: string;                         // Associated workflow step
  description?: string;                    // Human-readable description
  timestamp: Date;
}

/**
 * Browser automation action result
 */
export interface BrowserActionResult {
  actionId: string;
  sessionId: string;
  success: boolean;
  
  // Timing information
  startedAt: Date;
  completedAt: Date;
  duration: number;                        // milliseconds
  
  // Result data
  data?: any;                              // Extracted data or action result
  screenshot?: string;                     // Base64 encoded screenshot
  
  // Error information
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable: boolean;
  };
  
  // Page state after action
  pageState?: {
    url: string;
    title: string;
    readyState: 'loading' | 'interactive' | 'complete';
  };
  
  // Browser automation details
  browserLogs?: string[];                  // Console logs from browser
  networkRequests?: NetworkRequest[];      // Network activity (if tracking enabled)
}

/**
 * Network request information for debugging
 */
export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  timing: number;                          // Response time in ms
  size: number;                            // Response size in bytes
}

/**
 * Page element information
 */
export interface PageElement {
  selector: string;
  tagName: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  clickable: boolean;
}

/**
 * Page state snapshot for debugging and recovery
 */
export interface PageSnapshot {
  sessionId: string;
  timestamp: Date;
  
  // Page information
  url: string;
  title: string;
  html?: string;                           // Full page HTML (optional)
  screenshot: string;                      // Base64 encoded screenshot
  
  // Interactive elements
  clickableElements?: PageElement[];
  forms?: PageElement[];
  inputs?: PageElement[];
  
  // Page metrics
  loadTime: number;                        // Page load time in ms
  domNodeCount: number;
  
  // Errors and warnings
  consoleErrors: string[];
  consoleWarnings: string[];
}

/**
 * Browser automation capabilities
 */
export interface BrowserCapabilities {
  // Engine information
  engine: 'playwright' | 'stagehand';
  version: string;
  
  // Supported actions
  supportedActions: BrowserActionType[];
  
  // AI-powered features (Stagehand specific)
  aiElementFinding?: boolean;              // Can find elements by description
  aiActionPlanning?: boolean;              // Can plan multi-step actions
  aiContentExtraction?: boolean;           // Can extract structured data
  
  // Browser features
  supportedBrowsers: string[];             // Chrome, Firefox, Safari, etc.
  supportsHeadless: boolean;
  supportsVideo: boolean;
  supportsScreenshots: boolean;
  
  // Performance features
  supportsParallelSessions: boolean;
  maxConcurrentSessions?: number;
}

/**
 * Default browser session configuration for MVP
 */
export const DEFAULT_BROWSER_CONFIG: BrowserSessionConfig = {
  headless: true,
  incognito: true,
  viewport: {
    width: 1920,
    height: 1080
  },
  timeout: 30,                             // 30 seconds page load timeout
  navigationTimeout: 10,                   // 10 seconds navigation timeout
  disableImages: false,                    // Keep images for better automation
  disableJavaScript: false,                // Keep JS for interactive sites
  recordVideo: false,                      // MVP: No video recording
  saveScreenshots: true,                   // Always save screenshots
  enableDevTools: false                    // MVP: No dev tools access
};

/**
 * Browser session manager interface
 */
export interface BrowserSessionManager {
  // Session lifecycle
  createSession(userId: string, config?: BrowserSessionConfig): Promise<BrowserSession>;
  getSession(sessionId: string): Promise<BrowserSession | null>;
  destroySession(sessionId: string): Promise<void>;
  
  // Session management
  listSessions(userId?: string): Promise<BrowserSession[]>;
  cleanupExpiredSessions(): Promise<number>;
  
  // Action execution
  executeAction(request: BrowserActionRequest): Promise<BrowserActionResult>;
  takeScreenshot(sessionId: string): Promise<string>;
  getPageSnapshot(sessionId: string): Promise<PageSnapshot>;
  
  // Capabilities
  getCapabilities(): BrowserCapabilities;
} 
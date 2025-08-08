import { Stagehand } from '@browserbasehq/stagehand';
import { EventEmitter } from 'events';
import {
  BrowserSessionConfig,
  BrowserAction,
  BrowserState,
  WebSocketMessage,
  ExecutionStep,
  ActionResponse
} from './types';

export class BrowserSession extends EventEmitter {
  public readonly id: string;
  public readonly executionId: string;
  public readonly userId: string;
  public status: 'initializing' | 'ready' | 'busy' | 'error' | 'closed' = 'initializing';
  
  private stagehand: Stagehand | null = null;
  private currentState: BrowserState;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private lastActivity: Date = new Date();
  
  constructor(config: BrowserSessionConfig) {
    super();
    this.id = `session_${config.executionId}_${Date.now()}`;
    this.executionId = config.executionId;
    this.userId = config.userId;
    
    this.currentState = {
      currentUrl: '',
      isReady: false,
      timestamp: Date.now()
    };
    
    this.init(config);
  }
  
  private async init(config: BrowserSessionConfig) {
    try {
      console.log(`[BrowserSession] Initializing session ${this.id}`);
      
             // Configure Stagehand based on environment
       const stagehandConfig = {
         modelName: 'gpt-4o',
         modelClientOptions: {
           apiKey: process.env.OPENAI_API_KEY,
         },
         env: 'LOCAL' as const,
         headless: config.headless ?? false,
         verbose: 1 as 0 | 1 | 2,
         localBrowserLaunchOptions: {
           headless: config.headless ?? false,
           viewport: config.viewport ?? { width: 1280, height: 720 },
           args: [
             '--no-first-run',
             '--disable-web-security',
             '--disable-features=VizDisplayCompositor',
             '--force-device-scale-factor=1'
           ]
         }
       };
      
      this.stagehand = new Stagehand(stagehandConfig);
      await this.stagehand.init();
      
      this.status = 'ready';
      this.currentState.isReady = true;
      this.currentState.currentUrl = this.stagehand.page.url();
      this.lastActivity = new Date();
      
      console.log(`[BrowserSession] Session ${this.id} initialized successfully`);
      
      // Start screenshot monitoring
      this.startScreenshotMonitoring();
      
      this.emit('ready', this.getState());
      
    } catch (error) {
      console.error(`[BrowserSession] Failed to initialize session ${this.id}:`, error);
      this.status = 'error';
      this.currentState.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', error);
    }
  }
  
  private startScreenshotMonitoring() {
    // Take screenshots every 3 seconds when ready
    this.screenshotInterval = setInterval(async () => {
      if (this.status === 'ready' && this.stagehand) {
        try {
          const screenshot = await this.takeScreenshot();
          if (screenshot) {
            this.emit('screenshot', { screenshot, timestamp: Date.now() });
          }
        } catch (error) {
          console.error(`[BrowserSession] Screenshot error:`, error);
        }
      }
    }, 3000);
  }
  
  public async executeAction(action: BrowserAction): Promise<any> {
    if (!this.stagehand || this.status !== 'ready') {
      throw new Error('Browser session not ready');
    }
    
    this.status = 'busy';
    this.lastActivity = new Date();
    
    try {
      console.log(`[BrowserSession] Executing action:`, action);
      
      let result: any;
      
      switch (action.type) {
        case 'navigate':
          await this.stagehand.page.goto(action.data.url);
          result = { url: action.data.url };
          break;
          
        case 'click':
          if (action.data.selector) {
            await this.stagehand.page.click(action.data.selector);
          } else if (action.data.instruction) {
            await this.stagehand.page.act(action.data.instruction);
          }
          result = { action: 'click', target: action.data.selector || action.data.instruction };
          break;
          
        case 'type':
          if (action.data.selector && action.data.text) {
            await this.stagehand.page.fill(action.data.selector, action.data.text);
          }
          result = { action: 'type', text: action.data.text };
          break;
          
        case 'act':
          result = await this.stagehand.page.act(action.data.instruction);
          break;
          
        case 'extract':
          result = await this.stagehand.page.extract({
            instruction: action.data.instruction,
            schema: action.data.schema
          });
          break;
          
        case 'screenshot':
          result = await this.takeScreenshot();
          break;
          
        case 'update_row': {
          const { updateRow } = await import('./actions/rowActions');
          result = await updateRow(this.stagehand.page as any, action.data.rowConfig, action.data.variables ?? {});
          break;
        }
        case 'create_row': {
          const { createRow } = await import('./actions/rowActions');
          result = await createRow(this.stagehand.page as any, action.data.rowConfig, action.data.variables ?? {});
          break;
        }
          
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      // Update state
      this.currentState.currentUrl = this.stagehand.page.url();
      this.currentState.lastAction = `${action.type}: ${JSON.stringify(action.data)}`;
      this.currentState.timestamp = Date.now();
      this.currentState.error = undefined;
      
      this.status = 'ready';
      
      // Take a screenshot after action
      const screenshot = await this.takeScreenshot();
      
      const actionResult: ActionResponse = {
        stepId: action.stepId,
        action: action.type,
        payload: result,
        state: {
          currentUrl: this.currentState.currentUrl,
          isReady: this.currentState.isReady,
          timestamp: Date.now()
        }
      };
      
      this.emit('action_complete', actionResult);
      
      console.log(`[BrowserSession] Action completed:`, action.type);
      return actionResult;
      
    } catch (error) {
      this.status = 'ready'; // Reset status even on error
      this.currentState.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`[BrowserSession] Action failed:`, error);
      this.emit('action_error', { action, error });
      throw error;
    }
  }
  
  public async takeScreenshot(): Promise<string | null> {
    if (!this.stagehand) return null;
    
         try {
       const screenshot = await this.stagehand.page.screenshot({ 
         fullPage: false // Only visible area for performance
       });
      
      const base64 = screenshot.toString('base64');
      this.currentState.screenshot = base64;
      return base64;
      
    } catch (error) {
      console.error(`[BrowserSession] Screenshot failed:`, error);
      return null;
    }
  }
  
  public getState(): BrowserState {
    return {
      ...this.currentState,
      timestamp: Date.now()
    };
  }

  public getPage(): any {
    if (!this.stagehand?.page) {
      throw new Error('BrowserSession not properly initialized - no page available');
    }
    return this.stagehand.page;
  }
  
  public async close(): Promise<void> {
    console.log(`[BrowserSession] Closing session ${this.id}`);
    
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    
    if (this.stagehand) {
      try {
        await this.stagehand.close();
      } catch (error) {
        console.error(`[BrowserSession] Error closing Stagehand:`, error);
      }
      this.stagehand = null;
    }
    
    this.status = 'closed';
    this.emit('closed');
  }
  
  public isIdle(): boolean {
    const idleTimeout = 30 * 60 * 1000; // 30 minutes
    return Date.now() - this.lastActivity.getTime() > idleTimeout;
  }
} 
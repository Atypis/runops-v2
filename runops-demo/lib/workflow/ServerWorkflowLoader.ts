// Server-side workflow loader - uses fs directly (only for API routes)
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { AEFWorkflow, WorkflowValidationError, WorkflowLoadError } from './WorkflowLoader';

// Import schema for validation (local minimal schema)
import workflowSchema from './schemas/workflow-schema.json';

export class ServerWorkflowLoader {
  private static cache = new Map<string, AEFWorkflow>();
  private static watching = false; // dev-mode file watcher guard
  private static ajv = new Ajv({ allErrors: true });
  private static validateWorkflow = ServerWorkflowLoader.ajv.compile(workflowSchema);

  /**
   * Load a workflow by ID from the filesystem (server-side only)
   */
  static async loadWorkflow(workflowId: string): Promise<AEFWorkflow> {
    try {
      // Check cache first
      if (ServerWorkflowLoader.cache.has(workflowId)) {
        return ServerWorkflowLoader.cache.get(workflowId)!;
      }

      console.log(`🔄 [ServerWorkflowLoader] Loading workflow: ${workflowId}`);

      const workflowPath = path.join(process.cwd(), 'aef', 'workflows', `${workflowId}.json`);
      console.log(`🔍 [ServerWorkflowLoader] Looking for file at: ${workflowPath}`);
      
      if (!fs.existsSync(workflowPath)) {
        throw new WorkflowLoadError(`Workflow file not found: ${workflowId}`);
      }

      const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
      const workflow = JSON.parse(workflowContent);
      
      // Validate against schema
      const valid = ServerWorkflowLoader.validateWorkflow(workflow);
      
      if (!valid) {
        const errors = ServerWorkflowLoader.validateWorkflow.errors || [];
        const errorMessage = errors.map(error => {
          const dataPath = (error as any).instancePath || error.schemaPath || 'root';
          return `${dataPath}: ${error.message}`;
        }).join('; ');
        
        throw new WorkflowValidationError(
          'Workflow validation failed: ' + errorMessage,
          errors
        );
      }

      const validatedWorkflow = workflow as AEFWorkflow;
      
      // Cache the workflow
      ServerWorkflowLoader.cache.set(workflowId, validatedWorkflow);

      console.log(`✅ [ServerWorkflowLoader] Successfully loaded workflow: ${validatedWorkflow.meta.title}`);
      return validatedWorkflow;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new WorkflowLoadError(`Invalid JSON in workflow file: ${workflowId}`, error);
      }
      if (error instanceof WorkflowValidationError || error instanceof WorkflowLoadError) {
        throw error;
      }
      throw new WorkflowLoadError(`Failed to load workflow: ${workflowId}`, error as Error);
    }
  }

  /**
   * List available workflows
   */
  static async listWorkflows(): Promise<Array<{id: string, title: string, version: string, description: string}>> {
    try {
      const workflowsDir = path.join(process.cwd(), 'aef', 'workflows');
      
      if (!fs.existsSync(workflowsDir)) {
        return [];
      }

      const files = fs.readdirSync(workflowsDir);
      const workflowFiles = files
        .filter(file => file.endsWith('.json') && !file.includes('schema'))
        .map(file => file.replace('.json', ''));

      // Get metadata for each workflow
      const workflows = [];
      for (const workflowId of workflowFiles) {
        try {
          const workflowPath = path.join(workflowsDir, `${workflowId}.json`);
          const content = fs.readFileSync(workflowPath, 'utf-8');
          const workflow = JSON.parse(content);
          
          workflows.push({
            id: workflowId,
            title: workflow.meta?.title || workflowId,
            version: workflow.meta?.version || '1.0.0',
            description: workflow.meta?.purpose || 'No description available'
          });
        } catch (error) {
          console.warn(`⚠️ Failed to read metadata for workflow ${workflowId}:`, error);
        }
      }

      return workflows;
    } catch (error) {
      console.error('Failed to list workflows:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * In development, watch the workflows directory and clear the in-memory cache
   * whenever *any* .json file changes. This means you can edit a workflow file
   * and immediately re-run without restarting the dev server.
   */
  static enableWatch(): void {
    if (this.watching || process.env.NODE_ENV !== 'development') return;

    const workflowsDir = path.join(process.cwd(), 'aef', 'workflows');
    if (!fs.existsSync(workflowsDir)) return;

    try {
      fs.watch(workflowsDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          ServerWorkflowLoader.clearCache();
          console.log(`🔄 [ServerWorkflowLoader] Workflow cache invalidated due to change in ${filename}`);
        }
      });
      this.watching = true;
      console.log('👀 [ServerWorkflowLoader] Watching workflow directory for changes');
    } catch (err) {
      console.warn('⚠️  [ServerWorkflowLoader] Failed to set up watcher:', err);
    }
  }
}

// Automatically enable watch mode in development
if (process.env.NODE_ENV === 'development') {
  ServerWorkflowLoader.enableWatch();
} 
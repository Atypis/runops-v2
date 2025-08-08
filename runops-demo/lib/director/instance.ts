// Manages per-workflow DirectorService instances
// Imports JS implementation from services directory

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { DirectorService } from './services/directorService.js';

const workflowIdToDirector = new Map<string, InstanceType<typeof DirectorService>>();

export function getDirectorForWorkflow(workflowId: string, userId?: string) {
  if (!workflowIdToDirector.has(workflowId)) {
    // Create and initialize a new DirectorService
    const director = new DirectorService();
    // Initialize context; DirectorService handles default user if missing
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    director.initialize(workflowId, userId);
    workflowIdToDirector.set(workflowId, director);
  }
  return workflowIdToDirector.get(workflowId)!;
}

export function disposeDirector(workflowId: string) {
  workflowIdToDirector.delete(workflowId);
}


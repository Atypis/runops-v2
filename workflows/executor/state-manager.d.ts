/**
 * StateManager - Type definitions
 * 
 * A comprehensive state management system for workflows
 */

export interface MutationRecord {
  timestamp: string;
  operation: 'set' | 'delete' | 'clear' | 'merge' | 'restore';
  path: string;
  oldValue: any;
  newValue: any;
}

export interface StateSnapshot {
  timestamp: string;
  state: Record<string, any>;
  mutationCount: number;
}

export declare class StateManager {
  /**
   * Creates a new StateManager instance
   * @param initialState - Initial state object (optional)
   */
  constructor(initialState?: Record<string, any>);

  /**
   * Get value at a specific path
   * @param path - Dot notation path (e.g., "user.profile.name" or "items[0].id")
   * @returns The value at the path, or undefined if not found
   * 
   * @example
   * state.get('user.name'); // 'John'
   * state.get('items[0].id'); // 123
   * state.get(''); // Returns entire state
   */
  get(path: string): any;

  /**
   * Set value at a specific path
   * @param path - Dot notation path
   * @param value - Value to set
   * @returns True if successful, false otherwise
   * 
   * @example
   * state.set('user.name', 'Jane');
   * state.set('items[0].active', true);
   */
  set(path: string, value: any): boolean;

  /**
   * Get the entire state object
   * @returns Deep clone of the current state
   */
  getAll(): Record<string, any>;

  /**
   * Clear all state
   * @returns True if successful, false otherwise
   */
  clear(): boolean;

  /**
   * Resolve template variables in a string
   * Supports {{variable}} and {{nested.path}} syntax
   * @param template - Template string with variables
   * @returns Resolved string
   * 
   * @example
   * state.resolveTemplate('Hello {{user.name}}!'); // 'Hello John!'
   */
  resolveTemplate(template: string): string;
  resolveTemplate<T>(template: T): T;

  /**
   * Resolve all template variables in an object recursively
   * @param obj - Object containing template strings
   * @returns Object with resolved templates
   * 
   * @example
   * const resolved = state.resolveTemplates({
   *   to: '{{user.email}}',
   *   subject: 'Hello {{user.name}}'
   * });
   */
  resolveTemplates<T>(obj: T): T;

  /**
   * Check if a path exists in the state
   * @param path - Dot notation path
   * @returns True if path exists (even if value is null/undefined)
   */
  has(path: string): boolean;

  /**
   * Delete a value at a specific path
   * @param path - Dot notation path
   * @returns True if successful, false otherwise
   */
  delete(path: string): boolean;

  /**
   * Merge an object into the state at a specific path
   * @param path - Dot notation path (empty string for root)
   * @param obj - Object to merge
   * @returns True if successful, false otherwise
   * 
   * @example
   * state.merge('user', { age: 31, city: 'NYC' });
   * state.merge('', { newProp: 'value' }); // Merge at root
   */
  merge(path: string, obj: Record<string, any>): boolean;

  /**
   * Get mutation history for debugging
   * @param limit - Maximum number of mutations to return (default: 50)
   * @returns Array of mutation records
   */
  getMutationHistory(limit?: number): MutationRecord[];

  /**
   * Create a snapshot of the current state
   * @returns Snapshot object
   */
  createSnapshot(): StateSnapshot;

  /**
   * Restore state from a snapshot
   * @param snapshot - Snapshot object
   * @returns True if successful, false otherwise
   */
  restoreSnapshot(snapshot: StateSnapshot): boolean;
}

export default StateManager;
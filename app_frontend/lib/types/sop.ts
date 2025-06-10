export interface SOPMeta {
  id: string;
  title: string;
  version: string;
  goal: string;
  purpose: string;
  owner: string[];
}

export interface SOPTrigger {
  type: string; // e.g., "cron"
  config: string; // e.g., "0 20 * * *"
  description: string;
}

// New: Browser automation instruction interface
export interface BrowserInstruction {
  sequence: number;                   // Order of execution (1, 2, 3...)
  action_type: "navigate"|"click"|"type"|"extract"|"wait"|"verify";
  description: string;                // Human-readable description
  stagehand_instruction: string;      // Exact instruction for page.act()
  selector_strategies: string[];      // Multiple ways to target elements
  expected_result: string;            // What should happen after this action
  wait_conditions?: string[];         // What to wait for before continuing
  fallback_actions?: string[];        // Alternative approaches if primary fails
}

// New: Automation metadata for enhanced SOPs
export interface AutomationConfig {
  automatable: boolean;               // Can this step be automated?
  automation_type: "ui"|"api"|"manual"|"hybrid";
  instructions: BrowserInstruction[]; // Step-by-step browser actions
  confidence_level: "high"|"medium"|"low";
  estimated_duration_ms: number;
  error_recovery: string[];           // What to do if automation fails
  human_checkpoint: boolean;          // Should human approve this step?
}

export interface SOPNode {
  id: string;
  type: string; // e.g., "task", "loop", "decision", "end", "compound_task", "atomic_task", "iterative_loop"
  label: string;
  intent: string;
  context: string;
  position?: { x: number; y: number }; // Optional, as it's more for ReactFlow
  iterator?: string; // For loop nodes
  exit_condition?: string; // For loop nodes
  children?: string[]; // IDs of child nodes
  parentId?: string; // ID of the parent node (useful for atomic steps)
  id_path?: string; // Hierarchical ID for visual display (e.g., "2.1", "2.3Y")
  // Compound task properties
  canExecuteAsGroup?: boolean; // Whether compound task can execute all children sequentially
  actions?: any[]; // Actions for atomic tasks (compound tasks have empty actions array)
  // Populated by processing function
  childNodes?: SOPNode[]; 
  
  // New: Optional automation configuration (added by AEF enhancement)
  automation?: AutomationConfig;
}

export interface SOPEdge {
  source: string; // ID of the source node
  target: string; // ID of the target node
  condition?: string; // e.g., "yes", "no", "next", "all_processed"
  decision_path?: string; // For decision branches, e.g., "Y", "N" - used with ID paths
  // ReactFlow specific, can be added during transformation
  id?: string; 
  type?: string; // e.g., 'smoothstep', 'step'
  animated?: boolean;
  label?: string; // For displaying condition on edge
}

export interface SOPVariable {
  [key: string]: string; // e.g., "current_email_sender": "string (...)"
}

export interface SOPClarificationRequest {
  id: string;
  question: string;
  importance: "high" | "medium" | "low";
}

export interface SOPPublicData {
  triggers: SOPTrigger[];
  nodes: SOPNode[];
  edges: SOPEdge[];
  variables: SOPVariable;
  clarification_requests: SOPClarificationRequest[];
}

export interface SOPSkill {
  id: string;
  app: string;
  method_type: "ui" | "api";
  performance_hint?: string;
  variables_in?: string[];
  variables_out?: string[];
}

export interface SOPPrivateStepDetail {
  node_id: string;
  primary_skill: string;
  alt_skills?: string[];
}

export interface SOPPrivateData {
  skills: SOPSkill[];
  steps: SOPPrivateStepDetail[];
  artifacts: any[]; // Define more strictly if structure is known
}

export interface SOPDocument {
  meta: SOPMeta;
  public: SOPPublicData;
  private: SOPPrivateData;
}

// Custom ELK types to include application-specific data
import { ElkNode, ElkExtendedEdge, LayoutOptions } from 'elkjs';
// AppSOPNode and SOPTrigger are already defined above in this file

// Data for ELK nodes can be a mix of SOPNode, SOPTrigger, or other UI state
export type CustomElkNodeData = Partial<SOPNode> & Partial<SOPTrigger> & { // Use SOPNode directly
  isTrigger?: boolean;
  isExpanded?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  // Add other fields from SOPNode that you definitely expect in `data`
  // 'type' is already in SOPNode, label, title (from AppSOPNode's label), description (from intent/context)
  // Explicitly adding them here if their presence in `data` is guaranteed for ReactFlow mapping
  type: string; // Make non-optional if always present for ReactFlow
  label?: string; 
  title?: string;
  description?: string;
};

export interface CustomElkNode extends ElkNode {
  data: CustomElkNodeData; // Make data non-optional if we always assign it.
  layoutOptions?: LayoutOptions; 
}

export interface CustomElkEdge extends ElkExtendedEdge {
  data?: { 
    label?: string; 
    animated?: boolean;
  };
} 
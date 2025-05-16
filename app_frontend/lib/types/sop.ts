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

export interface SOPNode {
  id: string;
  type: string; // e.g., "task", "loop", "decision", "end"
  label: string;
  intent: string;
  context: string;
  position?: { x: number; y: number }; // Optional, as it's more for ReactFlow
  iterator?: string; // For loop nodes
  exit_condition?: string; // For loop nodes
  children?: string[]; // IDs of child nodes
  parentId?: string; // ID of the parent node (useful for atomic steps)
  id_path?: string; // Hierarchical ID for visual display (e.g., "2.1", "2.3Y")
  // Populated by processing function
  childNodes?: SOPNode[]; 
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
# 🎨 ReactFlow Visualization Architecture Guide

> **AI Agent Deep Dive - SOP Diagram Rendering & Interactive Features**

## 🏗️ Architecture Overview

### ReactFlow Component Hierarchy
```
SOPFlowView.tsx (Main Container)
├── ReactFlow Core Engine
├── Custom Node Types (5 types)
├── Custom Edge Rendering
├── Dagre Layout Algorithm  
├── Port/Handle Optimization
└── Expanded Node Editor (Modal)
```

### Data Flow Pipeline
```
SOP JSON → transformSopToFlowData() → Layout Engine → ReactFlow Rendering
     ↓              ↓                      ↓              ↓
Database     FlowNode/FlowEdge      Positioned Nodes   Interactive UI
```

## 🎭 Custom Node Types (5 Variants)

### 1. TriggerNode (Start Points)
**File**: `components/sop/TriggerNode.tsx`
**Purpose**: Workflow entry points, usually generated for each SOP
**Visual**: Rounded rectangle with play icon
**Size**: 208×112px standard

```typescript
interface TriggerNodeData {
  label: string;           // Display title
  description?: string;    // Detailed instructions
  sopId?: string;          // Reference to parent SOP
}
```

### 2. StepNode (Tasks & Containers)
**File**: `components/sop/StepNode.tsx`  
**Purpose**: Regular workflow steps + container for child nodes
**Visual**: Rectangle with task icon, expandable for containers
**Size**: 240×80px standard, dynamic for containers

```typescript
interface StepNodeData {
  label: string;
  description?: string;
  childSopNodeIds?: string[];    // Makes it a container
  calculatedWidth?: number;      // For container sizing
  calculatedHeight?: number;
  collapsed?: boolean;           // Container state
}
```

### 3. DecisionNode (Branching Logic)
**File**: `components/sop/DecisionNode.tsx`
**Purpose**: Yes/No decision points with conditional branching
**Visual**: Diamond shape with question mark icon
**Size**: 208×104px standard

```typescript
interface DecisionNodeData {
  label: string;           // Decision question
  description?: string;    // Decision criteria
  condition?: boolean;     // Has conditional edges
}
```

### 4. LoopNode (Iteration Containers)
**File**: `components/sop/LoopNode.tsx`
**Purpose**: Repeated workflow sections, always containers
**Visual**: Rounded rectangle with loop icon + children
**Size**: Dynamic based on children count

```typescript
interface LoopNodeData {
  label: string;
  description?: string;
  childSopNodeIds: string[];     // Always has children
  calculatedWidth: number;       // Container dimensions
  calculatedHeight: number;
  collapsed?: boolean;
}
```

### 5. EndNode (Terminal States)
**File**: `components/sop/EndNode.tsx`
**Purpose**: Workflow completion points
**Visual**: Rounded rectangle with stop icon
**Size**: 208×112px standard

```typescript
interface EndNodeData {
  label: string;
  description?: string;
  outcome?: string;        // Success/failure/neutral
}
```

## 🔗 Edge Routing & Connection Logic

### Custom Edge Implementation (SOPFlowView.tsx:155-340)
```typescript
// VERIFIED CUSTOM EDGE COMPONENT
const CustomEdge: React.FC<EdgeProps> = ({ 
  id, source, target, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, data
}) => {
  // Connection type determination
  const connectionType = data?.connectionType || ConnectionType.STANDARD;
  
  // Path styling based on edge semantics
  const isYesPath = data?.condition && data?.label?.toLowerCase() === 'yes';
  const isNoPath = data?.condition && data?.label?.toLowerCase() === 'no';
  const isTriggerPath = data?.sourceType === 'trigger';
  
  // Enhanced path generation with curvature
  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    targetPosition,
    curvature: connectionType === ConnectionType.DECISION_PATH ? 0.3 : 0.2
  });
  
  return (
    <>
      <path d={edgePath} style={{stroke: strokeColor, strokeWidth}} />
      <text x={labelX} y={labelY}>{labelText}</text>
    </>
  );
};
```

### Connection Types (utils/edgeUtils.ts)
```typescript
enum ConnectionType {
  STANDARD = 'standard',           // Normal step → step
  DECISION_PATH = 'decision_path', // Decision → outcome  
  PARENT_TO_CHILD = 'parent_child', // Container → contained
  CHILD_TO_PARENT = 'child_parent', // Contained → external
  CHILD_TO_CHILD_SAME = 'child_same',  // Within container
  CHILD_TO_CHILD_DIFF = 'child_diff'   // Between containers
}
```

### Port/Handle Optimization Strategy
```typescript
// VERIFIED IMPLEMENTATION - utils/edgeUtils.ts:169-343
export const getOptimalHandles = (nodes: FlowNode[], edges: FlowEdge[]) => {
  return edges.map(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    // Calculate relative positioning
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    // Container nodes force vertical connections
    const involvesContainer = isSourceContainer || isTargetContainer;
    
    if (involvesContainer) {
      sourceHandle = dy > 0 ? 'bottom' : 'top';
      targetHandle = dy > 0 ? 'top' : 'bottom';
    } else {
      // Standard directional logic
      if (isHorizontal) {
        sourceHandle = dx > 0 ? 'right' : 'left';
        targetHandle = dx > 0 ? 'left' : 'right';
      } else {
        sourceHandle = dy > 0 ? 'bottom' : 'top';
        targetHandle = dy > 0 ? 'top' : 'bottom';
      }
    }
    
    return { ...edge, sourceHandle, targetHandle };
  });
};
```

## 📐 Layout Algorithm (Dagre + Custom)

### Hybrid Layout Strategy
1. **Dagre Positioning**: Top-level nodes (non-children) positioned by Dagre
2. **Manual Container Layout**: Child nodes positioned within containers  
3. **Edge Optimization**: Handle selection for clean connections

### Dagre Configuration (SOPFlowView.tsx:746-780)
```typescript
// VERIFIED DAGRE SETUP
const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const dagreGraphInstance = new dagre.graphlib.Graph();
  
  dagreGraphInstance.setGraph({ 
    rankdir: 'TB',               // Top-to-bottom flow
    ranksep: 100,                // Vertical spacing
    nodesep: 120,                // Horizontal spacing  
    marginx: 50,                 // Graph margins
    marginy: 25
  });
  
  // Add only top-level nodes to Dagre
  const nonChildNodes = nodes.filter(node => !node.parentNode);
  nonChildNodes.forEach(node => {
    dagreGraphInstance.setNode(node.id, { 
      width: node.data?.calculatedWidth || 240,
      height: node.data?.calculatedHeight || 80 
    });
  });
  
  // Add edges between top-level nodes only
  edges.forEach(edge => {
    if (!childNodeIds.has(edge.source) && !childNodeIds.has(edge.target)) {
      dagreGraphInstance.setEdge(edge.source, edge.target);
    }
  });
  
  dagre.layout(dagreGraphInstance);
  
  // Extract positioned coordinates
  const layoutedNodes = nonChildNodes.map(node => {
    const nodeWithPosition = dagreGraphInstance.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2
      }
    };
  });
};
```

### Container Child Layout (SOPFlowView.tsx:487-592)
```typescript
// SIMPLIFIED CONTAINER LAYOUT ALGORITHM
const layoutChildrenSimple = (
  children: FlowNode[],
  containerWidth: number,
  parentPosition: {x: number, y: number},
  actualParentPixelWidth: number
) => {
  const childNodeWidth = 200;
  const childNodeHeight = 100;
  const gridSpacingX = 60;
  const gridSpacingY = 15;
  const containerPadding = 20;
  
  // Calculate grid dimensions
  const availableWidth = actualParentPixelWidth - (containerPadding * 2);
  const maxItemsPerRow = Math.max(1, 
    Math.floor((availableWidth + gridSpacingX) / (childNodeWidth + gridSpacingX))
  );
  
  // Position children in grid
  let currentX = containerPadding;
  let currentY = headerHeight + containerPadding;
  let itemsInCurrentRow = 0;
  
  return children.map(child => ({
    ...child,
    position: { x: currentX, y: currentY },
    parentNode: parentNodeId  // Set ReactFlow parent relationship
  }));
};
```

## 📊 Container Node Architecture

### Container Size Calculation (lib/sop-utils.ts:331-398)
```typescript
// VERIFIED CONTAINER SIZING LOGIC
if (appNode.children && appNode.children.length > 0) {
  const childCount = appNode.children.length;
  
  // Grid-based width calculation
  const containerWidth = Math.min(Math.ceil(Math.sqrt(childCount)), 4);
  
  // Size calculations
  const HEADER_HEIGHT = 60;
  const CHILD_HEIGHT = 100; 
  const ROW_SPACING = 15;
  const CONTAINER_PADDING = 40;
  
  const rows = Math.ceil(childCount / containerWidth);
  const contentHeight = (rows * CHILD_HEIGHT) + ((rows - 1) * ROW_SPACING);
  const estimatedHeight = HEADER_HEIGHT + CONTAINER_PADDING + contentHeight + 50;
  
  const CHILD_WIDTH = 200;
  const COL_SPACING = 60;
  const estimatedWidth = (containerWidth * CHILD_WIDTH) + 
                        ((containerWidth - 1) * COL_SPACING) + 100;
  
  flowNodeData.calculatedWidth = Math.max(estimatedWidth, 450);
  flowNodeData.calculatedHeight = Math.max(estimatedHeight, 300);
}
```

### Container Visual Implementation
- **Background**: Light gray container with rounded corners
- **Header**: Container label with collapse/expand toggle
- **Content Area**: Grid layout for child nodes
- **Borders**: Visual indication of containment relationship

## 🎛️ Interactive Features

### Node Selection & Editing
```typescript
// Expanded Node Editor (ExpandedNodeEditor.tsx)
const ExpandedNodeEditor: React.FC<{
  selectedNode: FlowNode;
  onClose: () => void;
  position: { x: number; y: number };
}> = ({ selectedNode, onClose, position }) => {
  // Portal-based rendering for proper z-index
  return ReactDOM.createPortal(
    <div 
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000
      }}
      className="bg-white border rounded-lg shadow-lg p-4 max-w-md"
    >
      <h3>{selectedNode.data.label}</h3>
      <p>{selectedNode.data.description}</p>
      <button onClick={onClose}>Close</button>
    </div>,
    document.body
  );
};
```

### Zoom & Pan Controls
```typescript
// ReactFlow configuration (SOPFlowView.tsx:1450-1470)
<ReactFlow
  fitView
  fitViewOptions={{ 
    padding: 0.2,        // 20% padding around content
    minZoom: 0.4,        // Minimum zoom level
    maxZoom: 1.6         // Maximum zoom level
  }}
  minZoom={0.2}          // Global minimum
  maxZoom={2}            // Global maximum
  defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
  className="bg-neutral-100"
>
  <Controls />           // Zoom controls
  <MiniMap />           // Overview map
</ReactFlow>
```

### Edge Interaction
```typescript
// Edge hover effects (SOPFlowView.tsx:1475-1490)
onEdgeMouseEnter={(event, edge) => {
  const edgeElement = document.querySelector(
    `[data-testid="rf__edge-${edge.id}"] path`
  );
  if (edgeElement) {
    edgeElement.setAttribute('stroke-width', '3');
  }
}}

onEdgeMouseLeave={(event, edge) => {
  const edgeElement = document.querySelector(
    `[data-testid="rf__edge-${edge.id}"] path`
  );
  if (edgeElement) {
    const originalWidth = edge.data?.condition ? '2' : '1.5';
    edgeElement.setAttribute('stroke-width', originalWidth);
  }
}}
```

## 🎨 Styling & Theming

### Node Styling Patterns
```typescript
// Base node styles (shared across node types)
const baseNodeStyles = {
  backgroundColor: 'white',
  border: '2px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  fontSize: '14px',
  fontWeight: '500',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  minWidth: '200px',
  textAlign: 'center'
};

// Type-specific styling
const triggerNodeStyles = {
  ...baseNodeStyles,
  borderColor: '#10b981',
  backgroundColor: '#f0fdf4'
};

const decisionNodeStyles = {
  ...baseNodeStyles,
  borderColor: '#f59e0b',
  backgroundColor: '#fefbf0',
  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
};
```

### Edge Styling Logic
```typescript
// Edge color coding (CustomEdge component)
const getEdgeColor = (edgeData) => {
  if (edgeData?.label?.toLowerCase() === 'yes') return '#15803d';
  if (edgeData?.label?.toLowerCase() === 'no') return '#b91c1c';
  if (edgeData?.sourceType === 'trigger') return '#ca8a04';
  return '#6b7280'; // Default gray
};

const getEdgeWidth = (edgeData) => {
  if (edgeData?.condition) return '2px';
  return '1.5px';
};
```

## 🔧 Performance Optimizations

### Rendering Optimizations
```typescript
// Node type registration (outside component to prevent re-creation)
const nodeTypesConfig = {
  trigger: TriggerNode,
  step: StepNode,
  end: EndNode,
  decision: DecisionNode,
  loop: LoopNode,
};

// Memoized node change handler
const safeOnNodesChange = useCallback((changes: NodeChange[]) => {
  // Filter out position changes for child nodes to prevent layout conflicts
  const filteredChanges = changes.filter(change => {
    if (change.type === 'position') {
      const node = nodes.find(n => n.id === change.id);
      return !node?.parentNode; // Only allow position changes for top-level nodes
    }
    return true;
  });
  onNodesChange(filteredChanges);
}, [nodes, onNodesChange]);
```

### Layout Caching
```typescript
// Layout result caching (recommended enhancement)
const layoutCache = new Map();

const getCachedLayout = (nodes, edges) => {
  const cacheKey = JSON.stringify({ 
    nodeIds: nodes.map(n => n.id).sort(),
    edgeIds: edges.map(e => e.id).sort()
  });
  
  if (layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey);
  }
  
  const result = getLayoutedElements(nodes, edges);
  layoutCache.set(cacheKey, result);
  return result;
};
```

## 🐛 Common Visualization Issues & Solutions

### Issue 1: Overlapping Nodes
**Symptoms**: Nodes render on top of each other
**Causes**: Insufficient spacing in Dagre config or container sizing
**Solutions**:
```typescript
// Increase spacing in Dagre configuration
dagreGraphInstance.setGraph({ 
  ranksep: 120,  // Increase from 100
  nodesep: 140   // Increase from 120
});

// Verify container size calculations
console.log('Container dimensions:', {
  width: flowNodeData.calculatedWidth,
  height: flowNodeData.calculatedHeight,
  childCount: node.children?.length
});
```

### Issue 2: Edge Routing Problems  
**Symptoms**: Edges don't connect properly or look incorrect
**Causes**: Handle selection logic or container edge routing
**Solutions**:
```typescript
// Debug edge handle selection
console.log('Edge routing:', {
  edgeId: edge.id,
  sourceHandle: edge.sourceHandle,
  targetHandle: edge.targetHandle,
  connectionType: edge.data?.connectionType
});

// Force container edges to use vertical connections
if (involvesContainer) {
  sourceHandle = dy > 0 ? 'bottom' : 'top';
  targetHandle = dy > 0 ? 'top' : 'bottom';
}
```

### Issue 3: Performance with Large SOPs
**Symptoms**: Slow rendering or interaction lag
**Causes**: Too many nodes or complex layout calculations
**Solutions**:
```typescript
// Implement node virtualization for large SOPs
const isComplexSOP = nodes.length > 50 || 
                     nodes.some(n => n.data?.childSopNodeIds?.length > 20);

if (isComplexSOP) {
  // Disable auto-layout and use simplified rendering
  return <SimplifiedSOPView sopData={sopData} />;
}

// Debounce layout recalculations
const debouncedLayout = useMemo(
  () => debounce(getLayoutedElements, 300),
  []
);
```

## 📋 Testing Visualization Components

### Unit Testing Approach
```typescript
// Test node rendering
test('TriggerNode renders with correct props', () => {
  const mockData = {
    label: 'Start Process',
    description: 'Begin the workflow'
  };
  
  render(<TriggerNode data={mockData} />);
  expect(screen.getByText('Start Process')).toBeInTheDocument();
});

// Test edge routing logic
test('getOptimalHandles selects correct ports', () => {
  const nodes = [/* test nodes */];
  const edges = [/* test edges */];
  
  const optimizedEdges = getOptimalHandles(nodes, edges);
  expect(optimizedEdges[0].sourceHandle).toBe('bottom');
  expect(optimizedEdges[0].targetHandle).toBe('top');
});
```

### Integration Testing
```typescript
// Test full SOP rendering
test('SOPFlowView renders complex SOP correctly', () => {
  const complexSOP = {
    meta: { title: 'Complex Workflow' },
    public: {
      nodes: [/* multiple node types */],
      edges: [/* various edge types */]
    }
  };
  
  render(<SOPFlowView sopData={complexSOP} />);
  
  // Verify all node types render
  expect(screen.getByTestId('trigger-node')).toBeInTheDocument();
  expect(screen.getByTestId('decision-node')).toBeInTheDocument();
  expect(screen.getByTestId('loop-node')).toBeInTheDocument();
});
```

---

## 🎯 Quick Reference

### Key Files
- **SOPFlowView.tsx**: Main ReactFlow container (1494 lines)
- **Node Components**: `components/sop/[Type]Node.tsx` (5 files)
- **Edge Utils**: `components/sop/utils/edgeUtils.ts` (418 lines)
- **Data Transform**: `lib/sop-utils.ts` (514 lines)
- **Type Definitions**: `lib/types/sop.ts`

### Configuration Constants
- **Dagre Spacing**: ranksep=100, nodesep=120
- **Container Padding**: 20px internal, 50px external  
- **Child Node Size**: 200×100px standard
- **Grid Spacing**: 60px horizontal, 15px vertical

### Performance Limits
- **Recommended Max Nodes**: 50 per SOP
- **Max Children per Container**: 20 nodes
- **Layout Calculation Time**: <200ms typical

---

## 📁 File Structure & Data Flow

### Core Files Overview
- **`lib/types/sop.ts`** - TypeScript interfaces for SOP data structures
- **`lib/sop-utils.ts`** - Data transformation utilities
- **`components/sop/SOPFlowView.tsx`** - Main ReactFlow container
- **`components/sop/[Type]Node.tsx`** - Individual node components (5 types)
- **`app/sop/[sopId]/page.tsx`** - SOP viewer with List/Flow toggle

### Data Transformation Pipeline
```
Raw SOP JSON → processSopData() → transformSopToFlowData() → ReactFlow Rendering
     ↓              ↓                      ↓                        ↓
  Database      Resolved Relations    FlowNode/FlowEdge      Interactive Diagram
```

### Implementation Integration
The ReactFlow visualization is integrated into the main SOP viewer:
- **Toggle Views**: Users can switch between List View (detailed) and Flow View (visual)
- **Unified Data Source**: Both views use the same SOP data structure
- **Real-time Updates**: Changes reflect across both visualization modes
- **Authentication**: Access controlled via RLS policies

### Data Source Standards
For consistent visualization, SOP files must include:
1. **Hierarchical IDs**: Format like "L1_C3_A1_" for proper nesting
2. **Parent-Child Relations**: `parentId` fields for container relationships  
3. **ID Paths**: Hierarchical positioning like "2.9.1" for layout
4. **Decision Paths**: Marked with `decision_path:"Y"` or `decision_path:"N"`

**Last Updated**: Dec 2024 | **Status**: Consolidated production visualization documentation 
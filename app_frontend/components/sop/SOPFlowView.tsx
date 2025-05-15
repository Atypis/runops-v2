'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node as FlowNode,
  Edge as FlowEdge,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { SOPDocument, SOPNode as AppSOPNode } from '@/lib/types/sop';
import { getElkLayoutOptions, transformSopToElkInput } from '@/lib/sop-utils';
import ELKConstructor, { ElkNode as ElkLayoutNodeRoot, ElkExtendedEdge as ElkLayoutEdge, LayoutOptions } from 'elkjs';
import { CustomElkNode, CustomElkEdge, CustomElkNodeData } from '@/lib/types/sop';
import TriggerNode from './TriggerNode';
import StepNode from './StepNode';
import EndNode from './EndNode';
import DecisionNode from './DecisionNode';

// Define the ELK constructor type properly
type ELK = InstanceType<typeof ELKConstructor>;

// MOVED outside component: React Flow recommendation (Error #002)
const nodeTypes = {
  trigger: TriggerNode,
  step: StepNode,
  end: EndNode,
  decision: DecisionNode,
  // Add missing node types - map them to StepNode for now
  task: StepNode,
  loop: StepNode,
};

const getAllDescendantIds = (nodeId: string, allSopNodes: AppSOPNode[]): string[] => {
  let descendantIds: string[] = [];
  const findNodeRecursive = (currentId: string) => {
      const node = allSopNodes.find(n => n.id === currentId);
      if (node && node.children) {
          node.children.forEach(childId => {
              if (!descendantIds.includes(childId)) {
                  descendantIds.push(childId);
                  findNodeRecursive(childId);
              }
          });
      }
  };
  findNodeRecursive(nodeId);
  return descendantIds;
};

interface SOPFlowViewProps {
  sopData: SOPDocument;
}

const SOPFlowView: React.FC<SOPFlowViewProps> = ({ sopData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isLayouting, setIsLayouting] = useState(false);

  const [verticalNodeSpacing, setVerticalNodeSpacing] = useState(50);
  const [horizontalBranchSpacing, setHorizontalBranchSpacing] = useState(50);
  const [siblingInBranchSpacing, setSiblingInBranchSpacing] = useState(30);

  const elkRef = useRef<ELK | null>(null);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  // Initialize ELK in the main thread instead of a worker
  useEffect(() => {
    console.log('[SOPFlowView] Initializing ELK directly (no worker)');
    elkRef.current = new ELKConstructor({
      // Disable worker mode
      defaultLayoutOptions: {
        'elk.algorithm': 'layered',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.layered.edgeRouting': 'ORTHOGONAL',
      }
    });
  }, []);

  // Run layout whenever necessary data changes
  useEffect(() => {
    if (!sopData?.public || !elkRef.current) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const runLayout = async () => {
      setIsLayouting(true);
      console.log('[SOPFlowView] Starting ELK layout calculation');
      
      try {
        const layoutOptionsMap = getElkLayoutOptions(
          verticalNodeSpacing,
          horizontalBranchSpacing,
          siblingInBranchSpacing
        );
  
        const { elkNodes: allInitialElkNodes, elkEdges: allInitialElkEdges } = transformSopToElkInput(sopData, layoutOptionsMap);
        
        let visibleElkNodes: CustomElkNode[] = [];
        let visibleElkEdges: CustomElkEdge[] = [...allInitialElkEdges];
  
        const trulyVisibleNodeIds = new Set<string>();
        allInitialElkNodes.forEach(elkNode => {
          const originalSopNode = sopData.public.nodes.find(n => n.id === elkNode.id);
          const isParent = originalSopNode && originalSopNode.children && originalSopNode.children.length > 0;
          const isCurrentlyExpanded = expandedNodes[elkNode.id!] === undefined ? true : expandedNodes[elkNode.id!];
  
          if (!isParent || isCurrentlyExpanded) {
              trulyVisibleNodeIds.add(elkNode.id!);
          } else {
              trulyVisibleNodeIds.add(elkNode.id!);
          }
        });
        
        allInitialElkNodes.forEach(elkNode => {
          const originalSopNode = sopData.public.nodes.find(n => n.id === elkNode.id);
          const isParent = originalSopNode && originalSopNode.children && originalSopNode.children.length > 0;
          const isCurrentlyExpanded = expandedNodes[elkNode.id!] === undefined ? true : expandedNodes[elkNode.id!];
  
          if (isParent && !isCurrentlyExpanded) {
              visibleElkNodes.push(elkNode);
              const descendantsToHide = getAllDescendantIds(elkNode.id!, sopData.public.nodes);
              visibleElkEdges = visibleElkEdges.filter(edge => 
                  !(descendantsToHide.includes(edge.sources[0]) && descendantsToHide.includes(edge.targets[0])) &&
                  !descendantsToHide.includes(edge.targets[0])
              );
          } else if (originalSopNode?.parentId && !trulyVisibleNodeIds.has(originalSopNode.parentId)){
          } else {
              visibleElkNodes.push(elkNode);
          }
        });
        
        const finalVisibleNodeIds = new Set(visibleElkNodes.map(n => n.id));
        visibleElkEdges = visibleElkEdges.filter(edge => 
          finalVisibleNodeIds.has(edge.sources[0]) && finalVisibleNodeIds.has(edge.targets[0])
        );
  
        // Prepare graph for ELK layout
        const graphToLayout = {
          id: 'root',
          layoutOptions: layoutOptionsMap.rootLayout,
          children: visibleElkNodes,
          edges: visibleElkEdges,
        };
  
        // Run layout on main thread - ensure elkRef.current is not null
        console.log('[SOPFlowView] Running ELK layout with graph:', graphToLayout);
        const elkInstance = elkRef.current;
        if (!elkInstance) {
          throw new Error("ELK was not initialized");
        }
        
        const laidOutGraph = await elkInstance.layout(graphToLayout);
        console.log('[SOPFlowView] ELK layout complete, result:', laidOutGraph);
        
        if (laidOutGraph.children && laidOutGraph.edges) {
          // Process layout result
          const elkChildren = laidOutGraph.children as CustomElkNode[];
          const newFlowNodes: FlowNode<CustomElkNodeData>[] = elkChildren.map((elkNode: CustomElkNode) => {
            const isBranchLike = elkNode.data.isBranchRoot; 
            const isVerticalFlow = !isBranchLike; 
            
            const originalSopNode = sopData.public.nodes.find(n => n.id === elkNode.id);
            const isParentNode = originalSopNode && originalSopNode.children && originalSopNode.children.length > 0;
  
            const nodeDataForFlow: CustomElkNodeData = {
              ...elkNode.data,
              ...(isParentNode && {
                isExpanded: expandedNodes[elkNode.id!] === undefined ? true : expandedNodes[elkNode.id!],
                onToggleCollapse: handleToggleCollapse,
              })
            };
  
            return {
              id: elkNode.id!,
              type: nodeDataForFlow.type,
              position: { x: elkNode.x!, y: elkNode.y! },
              data: nodeDataForFlow, 
              style: { width: elkNode.width, height: elkNode.height },
              targetPosition: isVerticalFlow ? Position.Top : Position.Left,
              sourcePosition: isVerticalFlow ? Position.Bottom : Position.Right,
            };
          });
  
          const elkEdges = laidOutGraph.edges as CustomElkEdge[];
          const newFlowEdges: FlowEdge<{ label?: string; animated?: boolean }>[] = elkEdges.map((elkEdge: CustomElkEdge) => ({
            id: elkEdge.id!,
            source: elkEdge.sources[0], 
            target: elkEdge.targets[0],
            label: elkEdge.data?.label,
            type: 'smoothstep', 
            animated: elkEdge.data?.animated || false,
            data: elkEdge.data ? { label: elkEdge.data.label, animated: elkEdge.data.animated } : undefined,
          }));
  
          setNodes(newFlowNodes as any);
          setEdges(newFlowEdges as any);
          console.log('[SOPFlowView] ReactFlow state updated - Nodes:', newFlowNodes);
          console.log('[SOPFlowView] ReactFlow state updated - Edges:', newFlowEdges);
        }
      } catch (error) {
        console.error('[SOPFlowView] Error during ELK layout:', error);
      } finally {
        setIsLayouting(false);
      }
    };

    runLayout();
  }, [sopData, expandedNodes, verticalNodeSpacing, horizontalBranchSpacing, siblingInBranchSpacing, setNodes, setEdges, handleToggleCollapse]);

  // Log ReactFlow nodes and edges state when they change
  useEffect(() => {
    console.log('[SOPFlowView] ReactFlow internal state - Nodes:', nodes);
    console.log('[SOPFlowView] ReactFlow internal state - Edges:', edges);
  }, [nodes, edges]);

  if (!sopData) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading diagram data...</p></div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '500px', display: 'flex', flexDirection: 'column' }} data-testid="sop-flow-view">
      <div style={{ padding: 10, background: '#f9f9f9', borderBottom: '1px solid #eee', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="vSpacing" style={{ marginRight: '8px', fontSize: '12px' }}>Spine/Vertical Spacing: {verticalNodeSpacing}</label>
          <input type="range" id="vSpacing" min="20" max="150" value={verticalNodeSpacing} onChange={(e) => setVerticalNodeSpacing(Number(e.target.value))} style={{ verticalAlign: 'middle' }}/>
        </div>
        <div>
          <label htmlFor="hBranchSpacing" style={{ marginRight: '8px', fontSize: '12px' }}>Branch Parent-Child Spacing: {horizontalBranchSpacing}</label>
          <input type="range" id="hBranchSpacing" min="20" max="150" value={horizontalBranchSpacing} onChange={(e) => setHorizontalBranchSpacing(Number(e.target.value))} style={{ verticalAlign: 'middle' }}/>
        </div>
        <div>
          <label htmlFor="siblingSpacing" style={{ marginRight: '8px', fontSize: '12px' }}>Branch Sibling Spacing: {siblingInBranchSpacing}</label>
          <input type="range" id="siblingSpacing" min="10" max="100" value={siblingInBranchSpacing} onChange={(e) => setSiblingInBranchSpacing(Number(e.target.value))} style={{ verticalAlign: 'middle' }}/>
        </div>
        {isLayouting && <div className="text-sm">Computing layout...</div>}
      </div>
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            className="bg-neutral-100"
          >
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default SOPFlowView; 
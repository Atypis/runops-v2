# SOP ReactFlow Architecture

This document outlines the architecture of the SOP (Standard Operating Procedure) visualization system built with ReactFlow. It explains each component's role in rendering the interactive diagram.

## Overview

The SOP visualization frontend is built on [ReactFlow](https://reactflow.dev/), a library for building node-based editors and interactive diagrams. Our implementation transforms a structured SOP document into a visual flow diagram with custom node types, edge routing, and layout optimization.

## Core Files

### Data Model and Types

- **`lib/types/sop.ts`**  
  Defines the TypeScript interfaces for SOP data structures including:
  - `SOPDocument`: The overall container for a complete SOP
  - `SOPNode`: Individual nodes in the flow (tasks, decisions, loops)
  - `SOPEdge`: Connections between nodes
  - `SOPTrigger`, `SOPMeta`, etc.: Supporting data structures

### Data Processing and Transformation

- **`lib/sop-utils.ts`**  
  Contains utility functions that transform raw SOP data into ReactFlow compatible format:
  - `processSopData()`: Resolves child node references and ensures parent IDs are set
  - `transformSopToFlowData()`: Converts SOP nodes/edges to ReactFlow nodes/edges
  - `getLayoutedElements()`: Uses Dagre layout algorithm to position nodes
  - `pickOptimalPorts()`: Optimizes edge connections between nodes

### Main Components

- **`components/sop/SOPFlowView.tsx`**  
  The primary container component that:
  - Initializes the ReactFlow instance
  - Registers custom node and edge types
  - Handles node state (collapsing/expanding)
  - Implements zoom controls and minimap
  - Contains custom edge rendering logic

### Node Components

Each node type has a dedicated component with custom styling and behavior:

- **`components/sop/StepNode.tsx`**  
  Renders standard task nodes with:
  - Top/bottom/left/right connection handles
  - Parent-child styling variations
  - Content display with ID path and label

- **`components/sop/LoopNode.tsx`**  
  Renders loop/iteration nodes with:
  - Container for child nodes
  - Expand/collapse functionality
  - Distinctive styling (purple border and icon)

- **`components/sop/DecisionNode.tsx`**  
  Renders decision points with:
  - Diamond shape
  - Yes/No output paths
  - Custom styling for decision branches

- **`components/sop/TriggerNode.tsx`**  
  Renders starting trigger nodes with:
  - Distinctive styling
  - Single output handle

- **`components/sop/EndNode.tsx`**  
  Renders terminal ending nodes with:
  - Distinctive styling
  - Single input handle

## Implementation

The SOP visualization is integrated directly into the main SOP viewer:

- **`app/sop/[sopId]/page.tsx`**  
  The main implementation with:
  - Toggle between List View and Flow View
  - List View shows detailed step information in a linear format
  - Flow View renders the interactive ReactFlow diagram with compound nodes
  - Both views now use a single unified data source

## Data Source

We've implemented a unified data source approach:

- **`public/mocksop-original-structure.json`**  
  Serves as the single source of truth for both views. This file combines:
  - Detailed descriptions, context, and clarifications needed for the List View
  - Hierarchical structure with parent-child relationships and ID paths needed for the Flow View
  - Complete edge definitions with decision paths for visual flow representation
  
  Using a single source of truth ensures consistency between views and simplifies data maintenance.

## Key Technical Features

1. **Compound Node Rendering**  
   Visual representation of parent-child relationships with proper containment.

2. **Intelligent Edge Routing**  
   Smart path selection between nodes with optimized port selection.

3. **Auto Layout with Dagre**  
   Automatic positioning of nodes using the Dagre graph layout algorithm.

4. **Custom Edge Styling**  
   Different edge types (yes/no paths, next paths, parent-child) with distinctive visual styling.

5. **Handle Positioning**  
   Multiple connection points (top, bottom, left, right) for flexible edge routing.

## Future Enhancements

As documented in Phase 3.3, future improvements include:

- Better connection point visibility for child nodes
- Advanced edge routing to prevent crossing through nodes
- Enhanced arrow styling for different connection types
- Support for multi-level hierarchy (nested compound nodes)
- Dynamic collapsing logic for compound nodes 
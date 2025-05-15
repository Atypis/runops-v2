# Phase 1: Foundation & Core Rendering

**Goal:** Get a basic, linear sequence of tasks rendering on screen from a manually loaded JSON file using ReactFlow.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, `reactflow`, `@reactflow/dagre`

**Key Steps:**

1.  **Setup Visualizer Route:**
    *   Create a dedicated page/route (e.g., `/visualizer`) within the Next.js app.
    *   Install dependencies: `npm i reactflow @reactflow/dagre`.
2.  **JSON Input Component:**
    *   Build a component (`JsonDrop` or similar) for drag-and-drop/file selection of `.json` files.
    *   Parse the file content and store the resulting JSON object in React state.
3.  **Basic JSON-to-Flow Transformer:**
    *   Create an initial `toFlow` function.
    *   Map `public.nodes` (assuming simple task nodes initially) to ReactFlow `nodes`.
    *   Map `public.edges` (assuming simple sequential `next` or `start` conditions) to ReactFlow `edges` (`type: "smoothstep"`).
    *   Apply `dagre` for automatic layout.
4.  **ReactFlow Canvas Integration:**
    *   Render the `<ReactFlow>` component.
    *   Pass the generated `nodes` and `edges` from the transformer.
    *   Ensure basic pan/zoom functionality works. 
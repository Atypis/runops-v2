console.log('[ELK Worker] Script start');

/* eslint-disable no-restricted-globals */

// Load ELK using importScripts for a classic worker
// Path is relative to the deployed application's root, assuming node_modules is accessible.
// If Next.js copies node_modules to a specific static path, this might need adjustment
// or ELK needs to be copied to a public path.
// For now, let's assume direct access or that Next.js handles node_modules paths for importScripts.
// A more robust solution might be to copy elk.bundled.js to the public folder.
// Given the research mentions Next.js copies the worker to .next/static, this path for importScripts
// will likely fail unless node_modules is also served from a predictable path relative to the worker.
// THE SAFEST WAY for a classic worker is to have elk.bundled.js available in the public folder
// and use a relative path like importScripts('/elk.bundled.js');
// For now, trying with the node_modules path as it was suggested in one research option.
// If this fails, we copy elk.bundled.js to public.

console.log('[ELK Worker] Before importScripts');
// Alternative from research: Lazy import inside onmessage (still needs module context or pre-compilation if in TS)
// For classic .js worker, importScripts is the standard.

// Assuming elkjs/lib/elk.bundled.js defines a global ELK constructor after being imported.
// importScripts('/node_modules/elkjs/lib/elk.bundled.js'); 
importScripts('/vendor/elk.bundled.js');
console.log('[ELK Worker] After importScripts. typeof ELK:', typeof ELK);

// Check if ELK was loaded
if (typeof ELK === 'undefined') {
  console.error("[ELK Worker] ELK script not loaded or ELK global not defined! (Inside check)");
  // Post an error back to the main thread immediately
  self.postMessage({ error: "ELK script loading failed in worker." });
  // Potentially throw an error to stop worker execution, though postMessage is cleaner for main thread.
}

console.log('[ELK Worker] Before new ELK()');
const elk = new ELK({
  workerUrl: null, // Attempt to disable ELK's internal worker
  defaultLayoutOptions: {
    'elk.algorithm': 'layered', 
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 
    'elk.layered.edgeRouting': 'ORTHOGONAL', 
  }
});
console.log('[ELK Worker] After new ELK(). ELK instance:', elk);

self.onmessage = async (evt) => {
  console.log('[ELK Worker] onmessage triggered');
  // In a .js file, we don't have TypeScript's strong typing for evt.data.
  // We assume it matches the structure sent from the main thread.
  const { nodes, edges, rootLayoutOptions } = evt.data;

  if (!elk) {
    console.error('[ELK Worker] ELK object is null or undefined before layout attempt.');
    self.postMessage({ error: "ELK not initialized in worker." });
    return;
  }

  const graphToLayout = {
    id: 'root',
    layoutOptions: rootLayoutOptions,
    children: nodes, 
    edges: edges,
  };

  console.log('[ELK Worker] Attempting elk.layout with graph:', JSON.stringify(graphToLayout));

  try {
    const laidOutGraph = await elk.layout(graphToLayout);
    console.log('[ELK Worker] elk.layout successful, result:', JSON.stringify(laidOutGraph));
    self.postMessage(laidOutGraph); 
  } catch (err) {
    console.error('[ELK Worker] Error during elk.layout:', err);
    self.postMessage({ error: err.message, stack: err.stack });
  }
};

// No export {} needed for classic workers typically. 
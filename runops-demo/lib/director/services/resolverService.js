import { supabase as sb } from '@/lib/director/config/supabase.js';

// Utility: ensure array uniqueness and numeric sort
function uniqueSortedPositions(positions) {
  const set = new Set();
  for (const p of positions) {
    if (typeof p === 'number' && Number.isFinite(p)) set.add(p);
  }
  return Array.from(set).sort((a, b) => a - b);
}

// Utility: shallow clone JSON object
function clone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

// Snapshot of workflow nodes for fast resolution
async function getWorkflowSnapshot(workflowId) {
  const { data, error } = await sb
    .from('nodes')
    .select('id, workflow_id, position, type, description, params, alias, created_at')
    .eq('workflow_id', workflowId)
    .order('position', { ascending: true });
  if (error) throw new Error(`Failed to load workflow snapshot: ${error.message}`);

  const nodes = data || [];
  const byPosition = new Map();
  const byAlias = new Map();
  for (const n of nodes) {
    byPosition.set(n.position, n);
    if (n.alias) byAlias.set(n.alias, n);
  }

  return { nodes, byPosition, byAlias };
}

// Helper: resolve alias to position with report tracking
function resolveAliasesToPositions(aliases, snapshot, report) {
  const positions = [];
  for (const a of aliases || []) {
    const n = snapshot.byAlias.get(a);
    if (n) positions.push(n.position); else report.missing_aliases.push(a);
  }
  return positions;
}

// Helper: resolve a flexible reference (number | alias | range string "a..b" | "5-10") to positions
function resolveFlexibleRefToPositions(ref, snapshot, report) {
  if (Array.isArray(ref)) {
    const positions = [];
    for (const item of ref) {
      if (typeof item === 'number') {
        positions.push(item);
      } else if (typeof item === 'string') {
        if (item.includes('..')) {
          const [startAlias, endAlias] = item.split('..');
          const start = snapshot.byAlias.get(startAlias?.trim());
          const end = snapshot.byAlias.get(endAlias?.trim());
          if (start && end) {
            const [lo, hi] = start.position <= end.position ? [start.position, end.position] : [end.position, start.position];
            for (let p = lo; p <= hi; p++) positions.push(p);
          } else {
            if (!start) report.missing_aliases.push(startAlias);
            if (!end) report.missing_aliases.push(endAlias);
          }
        } else if (/^\d+-\d+$/.test(item)) {
          const [s, e] = item.split('-').map(Number);
          const [lo, hi] = s <= e ? [s, e] : [e, s];
          for (let p = lo; p <= hi; p++) positions.push(p);
        } else {
          const n = snapshot.byAlias.get(item);
          if (n) positions.push(n.position); else report.missing_aliases.push(item);
        }
      }
    }
    return positions;
  }
  if (typeof ref === 'number') return [ref];
  if (typeof ref === 'string') {
    if (ref.includes('..')) {
      const [startAlias, endAlias] = ref.split('..');
      const start = snapshot.byAlias.get(startAlias?.trim());
      const end = snapshot.byAlias.get(endAlias?.trim());
      if (start && end) {
        const [lo, hi] = start.position <= end.position ? [start.position, end.position] : [end.position, start.position];
        const out = [];
        for (let p = lo; p <= hi; p++) out.push(p);
        return out;
      }
      if (!start) report.missing_aliases.push(startAlias);
      if (!end) report.missing_aliases.push(endAlias);
      return [];
    }
    if (/^\d+-\d+$/.test(ref)) {
      const [s, e] = ref.split('-').map(Number);
      const [lo, hi] = s <= e ? [s, e] : [e, s];
      const out = [];
      for (let p = lo; p <= hi; p++) out.push(p);
      return out;
    }
    const n = snapshot.byAlias.get(ref);
    if (n) return [n.position];
    // Otherwise: treat as unknown alias
    report.missing_aliases.push(ref);
    return [];
  }
  return [];
}

// Create inline children nodes at the end; set _parent_position
async function createInlineNodes(workflowId, containerNode, inlineNodes, report) {
  if (!inlineNodes || inlineNodes.length === 0) return [];

  // Get current max position
  const { data: maxNode } = await sb
    .from('nodes')
    .select('position')
    .eq('workflow_id', workflowId)
    .order('position', { ascending: false })
    .limit(1)
    .single();
  let nextPos = (maxNode?.position || 0) + 1;

  const createdPositions = [];
  for (const spec of inlineNodes) {
    const alias = spec.alias;
    if (!alias || !/^[a-z][a-z0-9_]*$/.test(alias)) {
      report.warnings.push(`Inline node missing or invalid alias: ${alias ?? '(none)'}`);
      continue;
    }
    // Ensure alias uniqueness
    let existing = null;
    try {
      const { data: ex } = await sb
        .from('nodes')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('alias', alias)
        .single();
      existing = ex || null;
    } catch {}

    if (existing) {
      report.warnings.push(`Inline node alias already exists, skipping create: ${alias}`);
      continue;
    }

    const params = clone(spec.params) || {};
    params._parent_position = containerNode.position;

    const insertPayload = {
      workflow_id: workflowId,
      position: nextPos,
      type: spec.type,
      params,
      description: spec.description || `${spec.type} (inline child of ${containerNode.alias || containerNode.position})`,
      status: 'pending',
      alias
    };
    const { data: newNode, error } = await sb
      .from('nodes')
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      report.warnings.push(`Failed to create inline node ${alias}: ${error.message}`);
      continue;
    }
    report.created_nodes.push({ alias, position: nextPos, id: newNode.id });
    createdPositions.push(nextPos);
    nextPos += 1;
  }
  return createdPositions;
}

// Evaluate NodeSelectorSpec or array of specs
async function resolveNodeSelectorSpec(specOrArray, workflowId, containerNode, snapshot, report) {
  const positions = [];
  const specs = Array.isArray(specOrArray) ? specOrArray : [specOrArray];
  for (const spec of specs) {
    if (!spec || typeof spec !== 'object') continue;

    // Inline nodes first (create then include positions)
    if (Array.isArray(spec.inline_nodes) && spec.inline_nodes.length) {
      const created = await createInlineNodes(workflowId, containerNode, spec.inline_nodes, report);
      positions.push(...created);
    }

    if (Array.isArray(spec.by_aliases)) {
      positions.push(...resolveAliasesToPositions(spec.by_aliases, snapshot, report));
    }
    if (Array.isArray(spec.by_positions)) {
      positions.push(...spec.by_positions.filter(p => typeof p === 'number'));
    }
    if (spec.by_range && typeof spec.by_range.start === 'number' && typeof spec.by_range.end === 'number') {
      const s = spec.by_range.start;
      const e = spec.by_range.end;
      const [lo, hi] = s <= e ? [s, e] : [e, s];
      for (let p = lo; p <= hi; p++) positions.push(p);
    }
    if (spec.by_between_markers && spec.by_between_markers.start_alias && spec.by_between_markers.end_alias) {
      const start = snapshot.byAlias.get(spec.by_between_markers.start_alias);
      const end = snapshot.byAlias.get(spec.by_between_markers.end_alias);
      if (start && end) {
        const [lo, hi] = start.position <= end.position ? [start.position, end.position] : [end.position, start.position];
        for (let p = lo; p <= hi; p++) positions.push(p);
      } else {
        if (!start) report.missing_aliases.push(spec.by_between_markers.start_alias);
        if (!end) report.missing_aliases.push(spec.by_between_markers.end_alias);
      }
    }
    if (spec.by_recent && typeof spec.by_recent.count === 'number') {
      const count = Math.max(0, spec.by_recent.count | 0);
      let filtered = snapshot.nodes;
      const f = spec.by_recent.filter || {};
      if (f.type) filtered = filtered.filter(n => n.type === f.type);
      if (f.tag) filtered = filtered.filter(n => Array.isArray(n.params?.tags) && n.params.tags.includes(f.tag));
      // Most recent by created_at desc; fallback to position desc
      filtered = filtered
        .slice()
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return b.position - a.position;
        })
        .slice(0, count);
      positions.push(...filtered.map(n => n.position));
    }
    if (spec.by_query) {
      const q = spec.by_query;
      let filtered = snapshot.nodes;
      if (q.type) filtered = filtered.filter(n => n.type === q.type);
      if (q.tag) filtered = filtered.filter(n => Array.isArray(n.params?.tags) && n.params.tags.includes(q.tag));
      if (q.text_match) {
        const needle = q.text_match.toLowerCase();
        filtered = filtered.filter(n => (n.description || '').toLowerCase().includes(needle) || (n.alias || '').toLowerCase().includes(needle));
      }
      positions.push(...filtered.map(n => n.position));
    }
    if (spec.by_group && typeof spec.by_group === 'string') {
      // Try workflow_memory key: group_def_${name}
      let group = null;
      try {
        const { data } = await sb
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', `group_def_${spec.by_group}`)
          .single();
        group = data?.value ?? null;
      } catch {}
      
      if (group && Array.isArray(group.positions)) {
        positions.push(...group.positions);
      } else if (group && Array.isArray(group.aliases)) {
        positions.push(...resolveAliasesToPositions(group.aliases, snapshot, report));
      } else {
        report.warnings.push(`Group not found or invalid: ${spec.by_group}`);
      }
    }
  }
  return uniqueSortedPositions(positions);
}

export async function resolveIterate(containerNode, workflowId) {
  const report = { missing_aliases: [], missing_uuids: [], warnings: [], created_nodes: [] };
  const snapshot = await getWorkflowSnapshot(workflowId);

  // Determine spec
  const params = containerNode.params || {};
  const spec = params.body_spec;
  let bodyPositions = [];

  if (spec) {
    bodyPositions = await resolveNodeSelectorSpec(spec, workflowId, containerNode, snapshot, report);
  } else if (Array.isArray(params.body) || typeof params.body === 'string' || typeof params.body === 'number') {
    // Back-compat resolution from legacy body
    bodyPositions = uniqueSortedPositions(resolveFlexibleRefToPositions(params.body, snapshot, report));
  } else if (params.body && typeof params.body === 'object' && params.body.start != null && params.body.end != null) {
    const s = Number(params.body.start); const e = Number(params.body.end);
    const [lo, hi] = s <= e ? [s, e] : [e, s];
    for (let p = lo; p <= hi; p++) bodyPositions.push(p);
    bodyPositions = uniqueSortedPositions(bodyPositions);
  }

  return {
    body_positions: bodyPositions,
    updates: {},
    report
  };
}

export async function resolveRoute(containerNode, workflowId) {
  const report = { missing_aliases: [], missing_uuids: [], warnings: [], created_nodes: [] };
  const snapshot = await getWorkflowSnapshot(workflowId);
  const params = containerNode.params || [];
  const branches = [];

  if (Array.isArray(params)) {
    for (const branch of params) {
      const branchName = branch.name || 'branch';
      const branchSpec = branch.branch_spec;
      let positions = [];
      if (branchSpec) {
        positions = await resolveNodeSelectorSpec(branchSpec, workflowId, containerNode, snapshot, report);
      } else if (branch.branch !== undefined) {
        positions = uniqueSortedPositions(resolveFlexibleRefToPositions(branch.branch, snapshot, report));
      }
      branches.push({ name: branchName, positions });
    }
  } else if (params && typeof params === 'object' && params.paths_spec) {
    // Map-based spec (legacy alternative): { [branchName]: spec }
    const paths_spec = params.paths_spec || {};
    for (const [branchName, spec] of Object.entries(paths_spec)) {
      const positions = await resolveNodeSelectorSpec(spec, workflowId, containerNode, snapshot, report);
      branches.push({ name: branchName, positions });
    }
  }

  return { branches, updates: {}, report };
}

// Pure patcher for iterate body_spec (idempotent-ish). Minimal v1: replace or append.
export function applyIterateSpecPatch(currentSpec, op, incomingSpec) {
  switch (op) {
    case 'replace':
      return incomingSpec;
    case 'add':
      if (currentSpec == null) return incomingSpec;
      return Array.isArray(currentSpec) ? [...currentSpec, incomingSpec] : [currentSpec, incomingSpec];
    case 'remove':
      // Not implemented broadly: return current unchanged with warning
      return currentSpec;
    case 'reorder':
      // Requires stable identifiers inside spec; skip in v1
      return currentSpec;
    default:
      return currentSpec;
  }
}

// For route: patch per-branch branch_spec (v1 supports replace/add new branch)
export function applyRouteSpecPatch(currentParams, op, paths_spec) {
  // currentParams is array-of-branches or object
  if (Array.isArray(currentParams)) {
    if (op === 'replace') {
      // Replace entire branches spec from paths_spec: object {branchName: spec}
      const out = [];
      for (const [name, spec] of Object.entries(paths_spec || {})) {
        out.push({ name, condition: 'true', branch_spec: spec });
      }
      return out;
    }
    if (op === 'add') {
      const out = currentParams.map(b => ({ ...b }));
      for (const [name, spec] of Object.entries(paths_spec || {})) {
        out.push({ name, condition: 'true', branch_spec: spec });
      }
      return out;
    }
    // remove/reorder not implemented in v1
    return currentParams;
  }
  if (currentParams && typeof currentParams === 'object') {
    const obj = { ...(currentParams || {}) };
    obj.paths_spec = paths_spec;
    return obj;
  }
  return currentParams;
}



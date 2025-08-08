import { NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const workflowsDir = path.join(process.cwd(), 'aef', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      return NextResponse.json({ success: true, workflows: [] });
    }

    const files = await fsp.readdir(workflowsDir);
    const workflows = [] as Array<{ id: string; title?: string } >;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const id = file.replace(/\.json$/, '');
      try {
        const raw = await fsp.readFile(path.join(workflowsDir, file), 'utf-8');
        const json = JSON.parse(raw);
        const title = json?.meta?.title || json?.title || id;
        workflows.push({ id, title });
      } catch {
        workflows.push({ id });
      }
    }

    workflows.sort((a, b) => a.title?.localeCompare(b.title || '') || 0);
    return NextResponse.json({ success: true, workflows });
  } catch (error: any) {
    console.error('[workflows] list error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}



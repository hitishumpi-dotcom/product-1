import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { WORKSPACE, safeJoin } from '../workspace';

export const router = Router();

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'dist-server', '.pnpm-store', 'pnpm-lock.yaml'
]);

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}

function buildTree(dir: string, depth = 0): TreeNode[] {
  if (depth > 5) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: TreeNode[] = [];
  for (const e of entries) {
    if (IGNORE.has(e.name) || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const rel  = path.relative(WORKSPACE, full);
    if (e.isDirectory()) {
      result.push({ name: e.name, path: rel, type: 'dir', children: buildTree(full, depth + 1) });
    } else {
      result.push({ name: e.name, path: rel, type: 'file' });
    }
  }
  return result;
}

// GET /api/files/tree
router.get('/tree', (_req, res) => {
  const tree = buildTree(WORKSPACE);
  res.json(tree);
});

// GET /api/files/read?path=relative/path
router.get('/read', (req, res) => {
  const rel = req.query['path'];
  if (typeof rel !== 'string') {
    res.status(400).json({ error: 'path required' });
    return;
  }
  try {
    const abs = safeJoin(WORKSPACE, rel);
    const stat = fs.statSync(abs);
    if (!stat.isFile()) { res.status(400).json({ error: 'not a file' }); return; }
    if (stat.size > 256 * 1024) { res.status(413).json({ error: 'file too large (>256KB)' }); return; }
    const content = fs.readFileSync(abs, 'utf-8');
    res.json({ path: rel, content });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(400).json({ error: msg });
  }
});

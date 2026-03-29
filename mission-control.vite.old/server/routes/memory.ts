import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { WORKSPACE } from '../workspace';

export const router = Router();

const LANES = ['WorkLab', 'FinanceManager', 'BusinessOps', 'SocialHub'];

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  exists: boolean;
  preview: string;
}

interface LaneMemory {
  lane: string;
  files: MemoryFile[];
}

function readMemoryFile(abs: string, rel: string): MemoryFile {
  try {
    const stat = fs.statSync(abs);
    const raw = fs.readFileSync(abs, 'utf-8');
    return {
      name: path.basename(abs),
      path: rel,
      size: stat.size,
      exists: true,
      preview: raw.slice(0, 400),
    };
  } catch {
    return { name: path.basename(abs), path: rel, size: 0, exists: false, preview: '' };
  }
}

// GET /api/memory
router.get('/', (_req, res) => {
  const globalPath = path.join(WORKSPACE, 'MEMORY.md');
  const globalRel  = 'MEMORY.md';
  const global = readMemoryFile(globalPath, globalRel);

  const lanes: LaneMemory[] = LANES.map(lane => {
    const memDir = path.join(WORKSPACE, 'lanes', lane, 'memory');
    let names: string[] = [];
    try { names = fs.readdirSync(memDir).filter(f => f.endsWith('.md')); } catch { /* empty */ }
    const files: MemoryFile[] = names.map(n => {
      const abs = path.join(memDir, n);
      const rel = path.relative(WORKSPACE, abs);
      return readMemoryFile(abs, rel);
    });
    return { lane, files };
  });

  res.json({ global, lanes });
});

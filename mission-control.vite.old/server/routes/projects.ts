import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { WORKSPACE } from '../workspace';

export const router = Router();

interface Project {
  id: string;
  name: string;
  path: string;
  hasPkg: boolean;
  devScript: string | null;
}

function detectProjects(): Project[] {
  const results: Project[] = [];
  const top = fs.readdirSync(WORKSPACE, { withFileTypes: true });
  for (const entry of top) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const pkgPath = path.join(WORKSPACE, entry.name, 'package.json');
    try {
      const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
        scripts?: Record<string, string>;
      };
      const devScript = raw.scripts?.['dev'] ?? null;
      results.push({
        id:        entry.name,
        name:      entry.name,
        path:      entry.name,
        hasPkg:    true,
        devScript,
      });
    } catch {
      // no package.json — skip
    }
  }
  return results;
}

// GET /api/projects
router.get('/', (_req, res) => {
  res.json(detectProjects());
});

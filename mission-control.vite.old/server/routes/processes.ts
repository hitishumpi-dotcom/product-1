import { Router } from 'express';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { WORKSPACE, safeJoin } from '../workspace';

export const router = Router();

interface ManagedProcess {
  id: string;
  name: string;
  cwd: string;
  cmd: string;
  args: string[];
  port: number | null;
  url: string | null;
  pid: number | undefined;
  status: 'running' | 'stopped' | 'error';
  logs: string[];
  proc: ChildProcess | null;
}

const processes = new Map<string, ManagedProcess>();

function addLog(mp: ManagedProcess, line: string) {
  mp.logs.push(line);
  if (mp.logs.length > 200) mp.logs.shift();
  // Detect port from vite output
  if (!mp.port) {
    const m = line.match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (m) {
      mp.port = parseInt(m[1], 10);
      mp.url  = `http://localhost:${mp.port}`;
    }
  }
}

function serialize(mp: ManagedProcess) {
  const { proc: _proc, ...rest } = mp;
  return rest;
}

// GET /api/processes
router.get('/', (_req, res) => {
  res.json([...processes.values()].map(serialize));
});

// POST /api/processes/start
// body: { id, name, cwd, cmd, args }
router.post('/start', (req, res) => {
  const { id, name, cwd: relCwd, cmd, args } = req.body as {
    id: string; name: string; cwd: string; cmd: string; args: string[];
  };
  if (!id || !name || !relCwd || !cmd) {
    res.status(400).json({ error: 'id, name, cwd, cmd required' });
    return;
  }
  if (processes.get(id)?.status === 'running') {
    res.status(409).json({ error: 'already running' });
    return;
  }

  let absCwd: string;
  try { absCwd = safeJoin(WORKSPACE, relCwd); } catch (e: unknown) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }

  const mp: ManagedProcess = {
    id, name, cwd: relCwd, cmd, args: args ?? [],
    port: null, url: null, pid: undefined,
    status: 'running', logs: [], proc: null,
  };

  const child = spawn(cmd, args ?? [], {
    cwd: absCwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  mp.proc = child;
  mp.pid  = child.pid;

  child.stdout?.on('data', (d: Buffer) => addLog(mp, d.toString()));
  child.stderr?.on('data', (d: Buffer) => addLog(mp, d.toString()));
  child.on('exit', () => { mp.status = 'stopped'; mp.proc = null; });
  child.on('error', () => { mp.status = 'error'; mp.proc = null; });

  processes.set(id, mp);
  res.json(serialize(mp));
});

// POST /api/processes/stop
router.post('/stop', (req, res) => {
  const { id } = req.body as { id: string };
  const mp = processes.get(id);
  if (!mp) { res.status(404).json({ error: 'not found' }); return; }
  mp.proc?.kill('SIGTERM');
  mp.status = 'stopped';
  res.json(serialize(mp));
});

// GET /api/processes/:id/logs
router.get('/:id/logs', (req, res) => {
  const mp = processes.get(req.params['id'] ?? '');
  if (!mp) { res.status(404).json({ error: 'not found' }); return; }
  res.json(mp.logs);
});

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

// ── File tree ──────────────────────────────────────────
export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
}
export const fetchTree  = () => get<TreeNode[]>('/files/tree');
export const fetchFile  = (p: string) => get<{ path: string; content: string }>(`/files/read?path=${encodeURIComponent(p)}`);

// ── Memory ─────────────────────────────────────────────
export interface MemoryFile { name: string; path: string; size: number; exists: boolean; preview: string; }
export interface LaneMemory { lane: string; files: MemoryFile[]; }
export interface MemoryStatus { global: MemoryFile; lanes: LaneMemory[]; }
export const fetchMemory = () => get<MemoryStatus>('/memory');

// ── Projects ───────────────────────────────────────────
export interface Project { id: string; name: string; path: string; hasPkg: boolean; devScript: string | null; }
export const fetchProjects = () => get<Project[]>('/projects');

// ── Processes ──────────────────────────────────────────
export interface ManagedProcess {
  id: string; name: string; cwd: string; cmd: string; args: string[];
  port: number | null; url: string | null; pid: number | undefined;
  status: 'running' | 'stopped' | 'error'; logs: string[];
}
export const fetchProcesses  = () => get<ManagedProcess[]>('/processes');
export const fetchLogs       = (id: string) => get<string[]>(`/processes/${id}/logs`);
export const startProcess    = (body: { id: string; name: string; cwd: string; cmd: string; args: string[] }) =>
  post<ManagedProcess>('/processes/start', body);
export const stopProcess     = (id: string) => post<ManagedProcess>('/processes/stop', { id });

// ── Chat ───────────────────────────────────────────────
export interface ChatResponse { role: string; content: string; stub: boolean; }
export const sendChat = (message: string, lane: string) =>
  post<ChatResponse>('/chat', { message, lane });

// ── Health ─────────────────────────────────────────────
export const fetchHealth = () => get<{ ok: boolean; ts: number }>('/health');

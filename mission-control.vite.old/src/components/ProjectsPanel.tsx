import { useApi } from '../hooks/useApi';
import { fetchProjects, fetchProcesses, startProcess, stopProcess } from '../api/client';
import type { Project, ManagedProcess } from '../api/client';
import { useState } from 'react';

export function ProjectsPanel() {
  const { data: projects, loading: pLoading } = useApi(fetchProjects);
  const { data: procs, loading: rLoading, refetch } = useApi(fetchProcesses, [], 3000);
  const [launching, setLaunching] = useState<string | null>(null);

  if (pLoading || rLoading) return <div className="text-xs text-gray-500">Loading…</div>;

  const runningById = new Map<string, ManagedProcess>(
    (procs ?? []).map(p => [p.id, p])
  );

  async function launch(project: Project) {
    if (!project.devScript) return;
    setLaunching(project.id);
    try {
      await startProcess({
        id:   project.id,
        name: project.name,
        cwd:  project.path,
        cmd:  'pnpm',
        args: ['dev'],
      });
      refetch();
    } finally {
      setLaunching(null);
    }
  }

  async function stop(id: string) {
    await stopProcess(id);
    refetch();
  }

  return (
    <div className="space-y-2">
      {(projects ?? []).map(p => {
        const proc = runningById.get(p.id);
        const isRunning = proc?.status === 'running';
        return (
          <div key={p.id} className="bg-[#131720] border border-[#1e2433] rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-200">{p.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                ${isRunning ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {isRunning ? 'running' : 'stopped'}
              </span>
            </div>
            <div className="text-xs font-mono text-gray-600 mb-2">{p.path}</div>
            {isRunning && proc?.url && (
              <a href={proc.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono block mb-2">
                {proc.url}
              </a>
            )}
            <div className="flex gap-2">
              {p.devScript && !isRunning && (
                <button
                  onClick={() => void launch(p)}
                  disabled={launching === p.id}
                  className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                >
                  {launching === p.id ? 'Starting…' : '▶ Start'}
                </button>
              )}
              {isRunning && (
                <button
                  onClick={() => void stop(p.id)}
                  className="text-xs px-3 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/50 text-red-400"
                >
                  ■ Stop
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

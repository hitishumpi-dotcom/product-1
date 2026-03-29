import { useApi } from '../hooks/useApi';
import { fetchProcesses, fetchLogs, stopProcess } from '../api/client';
import { useState } from 'react';

export function RunningAppsPanel() {
  const { data: procs, loading, refetch } = useApi(fetchProcesses, [], 3000);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const { data: logs } = useApi(
    () => logsFor ? fetchLogs(logsFor) : Promise.resolve(null),
    [logsFor], logsFor ? 2000 : undefined
  );

  if (loading) return <div className="text-xs text-gray-500">Loading…</div>;
  const running = (procs ?? []).filter(p => p.status === 'running');

  if (running.length === 0)
    return <div className="text-sm text-gray-500">No running apps. Launch one from Projects.</div>;

  return (
    <div className="space-y-3">
      {running.map(p => (
        <div key={p.id} className="bg-[#131720] border border-[#1e2433] rounded-lg px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-gray-200">{p.name}</span>
              {p.pid && <span className="text-[10px] text-gray-600">pid {p.pid}</span>}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 font-medium">running</span>
          </div>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 block mb-2">
              {p.url}
            </a>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setLogsFor(logsFor === p.id ? null : p.id)}
              className="text-xs px-3 py-1 rounded-lg bg-[#1e2433] hover:bg-[#252d3d] text-gray-400"
            >
              {logsFor === p.id ? 'Hide logs' : 'Logs'}
            </button>
            <button
              onClick={() => { void stopProcess(p.id); refetch(); }}
              className="text-xs px-3 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/50 text-red-400"
            >
              ■ Stop
            </button>
          </div>
          {logsFor === p.id && (
            <pre className="mt-2 text-[10px] text-gray-500 font-mono bg-[#0a0d14] rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {(logs ?? []).join('')}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

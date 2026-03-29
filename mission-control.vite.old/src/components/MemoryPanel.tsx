import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { fetchMemory } from '../api/client';

const STATUS_COLOR = (exists: boolean, size: number) =>
  !exists ? 'bg-gray-800 text-gray-500'
  : size > 0 ? 'bg-green-900/40 text-green-400'
  : 'bg-yellow-900/40 text-yellow-400';

export function MemoryPanel() {
  const { data, loading, error, refetch } = useApi(fetchMemory);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  if (loading) return <div className="text-xs text-gray-500">Loading…</div>;
  if (error)   return <div className="text-xs text-red-400">{error}</div>;
  if (!data)   return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">Memory</span>
        <button onClick={refetch} className="text-[10px] text-indigo-400 hover:text-indigo-300">↻ refresh</button>
      </div>

      {/* Global */}
      <div
        className="bg-[#131720] border border-[#1e2433] rounded-lg px-3 py-2.5 cursor-pointer hover:border-indigo-500/50"
        onClick={() => { setPreviewTitle('MEMORY.md'); setPreview(data.global.preview); }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-300">Global · MEMORY.md</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR(data.global.exists, data.global.size)}`}>
            {data.global.exists ? `${data.global.size}B` : 'missing'}
          </span>
        </div>
      </div>

      {/* Per-lane */}
      {data.lanes.map(l => (
        <div key={l.lane} className="bg-[#131720] border border-[#1e2433] rounded-lg px-3 py-2.5">
          <div className="text-xs font-semibold text-gray-400 mb-2">{l.lane}</div>
          {l.files.length === 0
            ? <div className="text-[11px] text-gray-600">No memory files</div>
            : l.files.map(f => (
              <div
                key={f.path}
                className="flex items-center justify-between py-0.5 cursor-pointer hover:text-indigo-300"
                onClick={() => { setPreviewTitle(f.name); setPreview(f.preview); }}
              >
                <span className="text-[11px] font-mono text-gray-400 hover:text-indigo-300">{f.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLOR(f.exists, f.size)}`}>
                  {f.exists ? `${f.size}B` : 'missing'}
                </span>
              </div>
            ))
          }
        </div>
      ))}

      {/* Preview */}
      {preview !== null && (
        <div className="bg-[#0a0d14] border border-[#1e2433] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 font-mono">{previewTitle}</span>
            <button onClick={() => setPreview(null)} className="text-[10px] text-gray-600 hover:text-gray-300">✕</button>
          </div>
          <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{preview || '(empty)'}</pre>
        </div>
      )}
    </div>
  );
}

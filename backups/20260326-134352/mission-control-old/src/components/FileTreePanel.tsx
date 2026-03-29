import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { fetchTree, fetchFile } from '../api/client';
import type { TreeNode } from '../api/client';

function TreeItem({ node, onSelect }: { node: TreeNode; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-white/5 cursor-pointer text-xs font-mono"
        onClick={() => node.type === 'dir' ? setOpen(o => !o) : onSelect(node.path)}
      >
        <span className="text-gray-600 text-[10px]">{node.type === 'dir' ? (open ? '▾' : '▸') : ' '}</span>
        <span>{node.type === 'dir' ? '📁' : '📄'}</span>
        <span className={node.type === 'dir' ? 'text-indigo-300' : 'text-gray-300'}>{node.name}</span>
      </div>
      {node.type === 'dir' && open && node.children && (
        <div className="pl-4">
          {node.children.map(c => <TreeItem key={c.path} node={c} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

export function FileTreePanel() {
  const { data: tree, loading, error } = useApi(fetchTree);
  const [selected, setSelected] = useState<string | null>(null);
  const { data: fileData, loading: fileLoading } = useApi(
    () => selected ? fetchFile(selected) : Promise.resolve(null),
    [selected]
  );

  if (loading) return <div className="text-xs text-gray-500">Loading…</div>;
  if (error)   return <div className="text-xs text-red-400">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="bg-[#131720] border border-[#1e2433] rounded-lg p-2 max-h-64 overflow-y-auto">
        <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 px-1">Read-only</div>
        {tree?.map(n => <TreeItem key={n.path} node={n} onSelect={setSelected} />)}
      </div>

      {selected && (
        <div className="bg-[#131720] border border-[#1e2433] rounded-lg p-3">
          <div className="text-[10px] text-gray-500 font-mono mb-2 truncate">{selected}</div>
          {fileLoading
            ? <div className="text-xs text-gray-500">Loading…</div>
            : <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{fileData?.content}</pre>
          }
        </div>
      )}
    </div>
  );
}

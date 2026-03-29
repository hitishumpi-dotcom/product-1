import { TOOLS } from '../data/mock';

export function ToolsPanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] text-gray-600 uppercase tracking-widest border-b border-[#1e2433]">
            <th className="pb-2 pr-4">Tool</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Lanes</th>
          </tr>
        </thead>
        <tbody>
          {TOOLS.map(t => (
            <tr key={t.id} className="border-b border-[#1e2433]/50 hover:bg-white/[0.02]">
              <td className="py-2 pr-4 font-mono text-indigo-300 text-xs">{t.name}</td>
              <td className="py-2 pr-4">
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 font-medium">
                  {t.status}
                </span>
              </td>
              <td className="py-2">
                <span className="text-xs text-gray-400">
                  {t.lanes.join(', ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

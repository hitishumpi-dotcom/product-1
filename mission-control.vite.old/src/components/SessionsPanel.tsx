import { SESSIONS } from '../data/mock';

export function SessionsPanel() {
  return (
    <div className="space-y-2">
      {SESSIONS.map(s => (
        <div key={s.id} className="bg-[#131720] border border-[#1e2433] rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-200">{s.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.lane} · {s.model}</div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
              ${s.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {s.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

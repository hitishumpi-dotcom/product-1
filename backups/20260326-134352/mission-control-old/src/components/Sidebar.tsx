import { LANES } from '../data/mock';

interface Props {
  activeLane: string;
  onSelectLane: (id: string) => void;
}

export function Sidebar({ activeLane, onSelectLane }: Props) {
  return (
    <div className="w-52 flex-shrink-0 bg-[#0a0d14] border-r border-[#1e2433] flex flex-col">
      <div className="px-4 py-4 border-b border-[#1e2433]">
        <div className="text-xs font-bold text-indigo-400 tracking-widest uppercase">OpenClaw</div>
        <div className="text-[11px] text-gray-500 mt-0.5">Mission Control</div>
      </div>

      <div className="px-3 pt-4 pb-2">
        <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-1 mb-2">Lanes</div>
        {LANES.map(lane => (
          <button
            key={lane.id}
            onClick={() => onSelectLane(lane.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors
              ${activeLane === lane.id
                ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
          >
            <span>{lane.emoji}</span>
            <span className="truncate">{lane.label}</span>
            {lane.active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
          </button>
        ))}
      </div>

      <div className="mt-auto px-4 py-4 border-t border-[#1e2433]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-500">Gateway online</span>
        </div>
      </div>
    </div>
  );
}

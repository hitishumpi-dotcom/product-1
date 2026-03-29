import { APPROVALS } from '../data/mock';

const RULE_STYLE: Record<string, { badge: string; dot: string }> = {
  'proceed':   { badge: 'bg-green-900/40 text-green-400',  dot: 'bg-green-400'  },
  'ask':       { badge: 'bg-yellow-900/40 text-yellow-400', dot: 'bg-yellow-400' },
  'must-ask':  { badge: 'bg-red-900/40 text-red-400',      dot: 'bg-red-400'    },
};

export function ApprovalsPanel() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['proceed', 'ask', 'must-ask'] as const).map(rule => (
          <div key={rule} className={`rounded-lg px-3 py-2 text-center ${RULE_STYLE[rule].badge}`}>
            <div className="text-xs font-bold uppercase tracking-widest">{rule}</div>
          </div>
        ))}
      </div>

      {APPROVALS.map(a => (
        <div key={a.id} className="bg-[#131720] border border-[#1e2433] rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${RULE_STYLE[a.rule]?.dot}`} />
            <span className="text-sm text-gray-300 truncate">{a.action}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${RULE_STYLE[a.rule]?.badge}`}>
            {a.rule}
          </span>
        </div>
      ))}
    </div>
  );
}

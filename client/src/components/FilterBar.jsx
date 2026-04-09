const MARKUP_TYPES = ['add', 'delete', 'move', 'modify', 'dimension', 'note', 'clarify', 'detail']
const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'done', 'flagged']

const TYPE_COLORS = {
  add: 'bg-emerald-900/50 text-emerald-400 border-emerald-800',
  delete: 'bg-red-900/50 text-red-400 border-red-800',
  move: 'bg-blue-900/50 text-blue-400 border-blue-800',
  modify: 'bg-amber-900/50 text-amber-400 border-amber-800',
  dimension: 'bg-purple-900/50 text-purple-400 border-purple-800',
  note: 'bg-slate-700/50 text-slate-300 border-slate-600',
  clarify: 'bg-orange-900/50 text-orange-400 border-orange-800',
  detail: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
}

export default function FilterBar({ activeTypes, statusFilter, onTypeToggle, onStatusChange }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-[#1e2128]">
      <div className="flex flex-wrap gap-1.5">
        {MARKUP_TYPES.map(type => {
          const active = activeTypes.includes(type)
          return (
            <button
              key={type}
              onClick={() => onTypeToggle(type)}
              className={[
                'px-2 py-0.5 rounded text-[11px] font-medium border transition-opacity',
                TYPE_COLORS[type] ?? 'bg-slate-700 text-slate-300 border-slate-600',
                active ? 'opacity-100' : 'opacity-35',
              ].join(' ')}
            >
              {type}
            </button>
          )
        })}
      </div>
      <div className="flex gap-1">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className={[
              'px-2.5 py-0.5 rounded text-[11px] font-medium border transition-colors',
              statusFilter === s
                ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                : 'text-[#6b7280] border-[#2e3340] hover:border-[#4b5563] hover:text-[#9ca3af]',
            ].join(' ')}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

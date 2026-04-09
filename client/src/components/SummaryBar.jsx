export default function SummaryBar({ markups }) {
  const total = markups.length
  const done = markups.filter(m => m.status === 'done').length
  const flagged = markups.filter(m => m.flagged).length
  const pending = markups.filter(m => m.status === 'pending' || !m.status).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex items-center gap-6 px-4 py-2.5 border-t border-[#1e2128] bg-[#0c0e12] text-xs font-mono">
      <span className="text-[#4b5563]">
        <span className="text-[#e2e4e9] font-medium">{total}</span> items
      </span>
      <span className="text-[#4b5563]">
        <span className="text-[#1D9E75] font-medium">{done}</span> done
      </span>
      <span className="text-[#4b5563]">
        <span className="text-orange-400 font-medium">{flagged}</span> flagged
      </span>
      <span className="text-[#4b5563]">
        <span className="text-[#6b7280] font-medium">{pending}</span> pending
      </span>
      <div className="flex-1" />
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1 bg-[#1e2128] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1D9E75] rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[#1D9E75]">{pct}%</span>
        </div>
      )}
    </div>
  )
}

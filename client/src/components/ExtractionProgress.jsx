export default function ExtractionProgress({ pagesComplete, totalPages, phase }) {
  const isUploading = phase === 'uploading'
  const isExtracting = phase === 'extracting'
  const pct = totalPages > 0 ? Math.round((pagesComplete / totalPages) * 100) : null

  const label = isUploading
    ? 'uploading pdf…'
    : pct !== null
      ? `analyzing page ${pagesComplete} of ${totalPages}`
      : 'starting extraction…'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-3)] shimmer">{label}</span>
        {pct !== null && isExtracting && (
          <span className="mono text-[10px] text-[var(--accent)] tabular-nums">{pct}%</span>
        )}
      </div>
      <div className="w-full h-[2px] bg-[var(--line)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: isUploading ? '8%' : pct !== null ? `${pct}%` : '4%' }}
        />
      </div>
    </div>
  )
}

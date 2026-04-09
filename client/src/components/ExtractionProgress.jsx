export default function ExtractionProgress({ pagesComplete, totalPages, phase }) {
  const isUploading = phase === 'uploading'
  const isExtracting = phase === 'extracting'

  const pct = totalPages && totalPages > 0
    ? Math.round((pagesComplete / totalPages) * 100)
    : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-[#9ca3af]">
        <span className="font-mono">
          {isUploading && 'Uploading PDF…'}
          {isExtracting && (
            pct !== null
              ? `Analyzing page ${pagesComplete} of ${totalPages}`
              : 'Starting extraction…'
          )}
        </span>
        {pct !== null && isExtracting && (
          <span className="font-mono text-[#1D9E75]">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 bg-[#1a1d23] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1D9E75] rounded-full transition-all duration-300"
          style={{
            width: isUploading
              ? '8%'
              : pct !== null
                ? `${pct}%`
                : '4%',
          }}
        />
      </div>
      {isExtracting && totalPages && (
        <div className="flex gap-1 mt-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={[
                'flex-1 h-1 rounded-sm transition-colors duration-300',
                i < pagesComplete ? 'bg-[#1D9E75]' : 'bg-[#2e3340]',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

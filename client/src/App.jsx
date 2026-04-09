import { useState, useCallback } from 'react'
import { useExtraction } from './hooks/useExtraction.js'
import { updateItemStatus, flagItem } from './services/api.js'
import UploadZone from './components/UploadZone.jsx'
import ExtractionProgress from './components/ExtractionProgress.jsx'
import ChecklistPanel from './components/ChecklistPanel.jsx'
import PdfViewer from './components/PdfViewer.jsx'
import SummaryBar from './components/SummaryBar.jsx'

export default function App() {
  const extraction = useExtraction()
  const [selectedId, setSelectedId] = useState(null)
  // Local markup state so we can optimistically update status/flags
  const [localMarkups, setLocalMarkups] = useState([])

  // Sync incoming markups from extraction into local state
  const markups = extraction.markups.map(m => {
    const local = localMarkups.find(l => l.id === m.id)
    return local ? { ...m, ...local } : m
  })

  const selectedItem = markups.find(m => m.id === selectedId) ?? null

  const handleStatusChange = useCallback(async (itemId, status) => {
    // Optimistic update
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      if (exists) return prev.map(l => l.id === itemId ? { ...l, status } : l)
      return [...prev, { id: itemId, status }]
    })
    if (extraction.project?.id) {
      try {
        await updateItemStatus(extraction.project.id, itemId, status)
      } catch (err) {
        console.error('Failed to update status:', err)
      }
    }
  }, [extraction.project?.id])

  const handleFlag = useCallback(async (itemId, message) => {
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      if (exists) return prev.map(l => l.id === itemId ? { ...l, flagged: true, flagMessage: message } : l)
      return [...prev, { id: itemId, flagged: true, flagMessage: message }]
    })
    if (extraction.project?.id) {
      try {
        await flagItem(extraction.project.id, itemId, message)
      } catch (err) {
        console.error('Failed to flag item:', err)
      }
    }
  }, [extraction.project?.id])

  const isActive = extraction.phase !== 'idle'
  const isProcessing = extraction.phase === 'uploading' || extraction.phase === 'extracting'

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1e2128] bg-[#0c0e12] shrink-0">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#1D9E75" opacity="0.15"/>
            <path d="M7 8h10M7 12h6M7 16h8" stroke="#1D9E75" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          <span className="font-semibold text-[#e2e4e9] tracking-tight text-base">RedlineIQ</span>
        </div>

        <div className="flex items-center gap-3">
          {extraction.phase === 'error' && (
            <span className="text-red-400 text-xs font-mono">{extraction.error}</span>
          )}
          {extraction.phase === 'done' && (
            <span className="text-[#1D9E75] text-xs font-mono">Extraction complete</span>
          )}
          {isActive && (
            <button
              onClick={extraction.reset}
              className="text-xs text-[#4b5563] hover:text-[#9ca3af] transition-colors font-mono"
            >
              New project
            </button>
          )}
          {extraction.project && (
            <span className="text-xs text-[#374151] font-mono truncate max-w-[200px]" title={extraction.project.filename}>
              {extraction.project.filename}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      {!isActive ? (
        /* Landing / upload state */
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="w-full max-w-lg flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-[#e2e4e9] mb-1">Upload a redlined drawing</h1>
              <p className="text-sm text-[#4b5563]">AI extracts every markup into a structured checklist</p>
            </div>
            <UploadZone onUpload={extraction.upload} disabled={isProcessing} />
          </div>
        </div>
      ) : (
        /* Active session: split panel */
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — checklist */}
          <div className="flex flex-col w-[420px] shrink-0 border-r border-[#1e2128] overflow-hidden">
            {/* Progress bar (during extraction) */}
            {isProcessing && (
              <div className="px-4 py-3 border-b border-[#1e2128] bg-[#0c0e12]">
                <ExtractionProgress
                  phase={extraction.phase}
                  pagesComplete={extraction.pagesComplete}
                  totalPages={extraction.totalPages}
                />
              </div>
            )}

            {/* Checklist or empty state */}
            {markups.length > 0 ? (
              <>
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ChecklistPanel
                    markups={markups}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onStatusChange={handleStatusChange}
                    onFlag={handleFlag}
                  />
                </div>
                <SummaryBar markups={markups} />
              </>
            ) : (
              <div className="flex flex-col flex-1 items-center justify-center gap-3 text-center px-6">
                {isProcessing ? (
                  <>
                    <div className="w-6 h-6 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[#4b5563]">Markups will appear as pages are analyzed…</p>
                  </>
                ) : (
                  <p className="text-xs text-[#4b5563]">No markups found</p>
                )}
              </div>
            )}
          </div>

          {/* Right panel — PDF viewer */}
          <div className="flex-1 bg-[#0a0c0f] overflow-hidden">
            <PdfViewer project={extraction.project} selectedItem={selectedItem} />
          </div>
        </div>
      )}
    </div>
  )
}

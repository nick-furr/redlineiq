import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useExtraction } from '../hooks/useExtraction.js'
import { updateItemStatus, flagItem } from '../services/api.js'
import ExtractionProgress from '../components/ExtractionProgress.jsx'
import ChecklistPanel from '../components/ChecklistPanel.jsx'
import PdfViewer from '../components/PdfViewer.jsx'
import SummaryBar from '../components/SummaryBar.jsx'

export default function ProjectPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const extraction = useExtraction()
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [localMarkups, setLocalMarkups] = useState([])

  // Ref so action callbacks always have the current project ID without stale closure issues.
  // useCallback with [extraction.project?.id] as a dep can silently skip the API call if the
  // callback was first created before initialize() resolved (project was null at that point).
  const projectIdRef = useRef(null)
  useEffect(() => {
    projectIdRef.current = extraction.project?.id ?? null
  }, [extraction.project?.id])

  useEffect(() => {
    const jobId = state?.jobId ?? null
    extraction.initialize(id, jobId).finally(() => setLoading(false))
    return () => extraction.reset()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Merge server markups with optimistic local updates
  const markups = extraction.markups.map(m => {
    const local = localMarkups.find(l => l.id === m.id)
    return local ? { ...m, ...local } : m
  })

  const selectedItem = markups.find(m => m.id === selectedId) ?? null

  const handleStatusChange = useCallback(async (itemId, status) => {
    // When clearing flagged status, also reset the flagged bool so filters update immediately
    const patch = { status, ...(status !== 'flagged' && { flagged: false }) }
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      if (exists) return prev.map(l => l.id === itemId ? { ...l, ...patch } : l)
      return [...prev, { id: itemId, ...patch }]
    })
    const projectId = projectIdRef.current
    if (projectId) {
      try {
        await updateItemStatus(projectId, itemId, status)
      } catch (err) {
        console.error('Failed to update status:', err)
      }
    }
  }, []) // stable — reads projectId from ref, never stale

  const handleFlag = useCallback(async (itemId, message) => {
    // Optimistically mark as flagged so filters and summary update before the API responds
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      if (exists) return prev.map(l => l.id === itemId ? { ...l, flagged: true, status: 'flagged' } : l)
      return [...prev, { id: itemId, flagged: true, status: 'flagged' }]
    })
    const projectId = projectIdRef.current
    if (projectId) {
      try {
        await flagItem(projectId, itemId, message)
      } catch (err) {
        console.error('Failed to flag item:', err)
      }
    }
  }, []) // stable — reads projectId from ref, never stale

  const isProcessing = extraction.phase === 'extracting'

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (extraction.phase === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-400 text-sm font-mono">{extraction.error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — checklist */}
      <div className="flex flex-col w-[420px] shrink-0 border-r border-[#1e2128] overflow-hidden">
        {isProcessing && (
          <div className="px-4 py-3 border-b border-[#1e2128] bg-[#0c0e12]">
            <ExtractionProgress
              phase={extraction.phase}
              pagesComplete={extraction.pagesComplete}
              totalPages={extraction.totalPages}
            />
          </div>
        )}

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
  )
}

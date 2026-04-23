import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useExtraction } from '../hooks/useExtraction.js'
import { updateItemStatus, flagItem } from '../services/api.js'
import { SAMPLE_PROJECT, SAMPLE_ITEMS } from '../sampleData.js'
import ExtractionProgress from '../components/ExtractionProgress.jsx'
import ChecklistPanel from '../components/ChecklistPanel.jsx'
import PdfViewer from '../components/PdfViewer.jsx'
import DrawingPlate from '../components/DrawingPlate.jsx'
import DetailStrip from '../components/DetailStrip.jsx'

const SAMPLE_ID = 'sample-demo-001'

function buildCSV(items, projectName) {
  const headers = ['id', 'type', 'confidence', 'ambiguous', 'status', 'flagged', 'drawing_reference', 'location', 'markup_text', 'clarification']
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = items.map(i => [
    i.id, i.markup_type, i.confidence, i.ambiguous, i.status, i.flagged,
    i.drawing_reference, i.location_on_drawing, i.markup_text, i.clarification_request ?? '',
  ].map(esc).join(','))
  return [headers.join(','), ...rows].join('\n')
}

// ── Sample project (runs fully local, no API needed) ──────────────────────
function SampleProjectPage() {
  const [items, setItems] = useState(SAMPLE_ITEMS)
  const [selectedId, setSelectedId] = useState(SAMPLE_ITEMS[0]?.id ?? null)

  const selectedItem = items.find(m => m.id === selectedId) ?? null

  const counts = useMemo(() => {
    const total = items.length
    const done = items.filter(m => m.status === 'done').length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, pct }
  }, [items])

  const handleStatusChange = useCallback((itemId, status) => {
    setItems(prev => prev.map(m => {
      if (m.id !== itemId) return m
      return { ...m, status, flagged: status === 'flagged', ...(status === 'pending' && { flagged: false }) }
    }))
  }, [])

  const handleFlag = useCallback((itemId, message) => {
    setItems(prev => prev.map(m =>
      m.id === itemId ? { ...m, flagged: true, status: 'flagged', clarification_request: message || null } : m
    ))
  }, [])

  const exportCSV = useCallback(() => {
    const csv = buildCSV(items, SAMPLE_PROJECT.name)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-demo-plan-markups.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [items])

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-[420px] shrink-0 border-r border-[var(--line)] flex flex-col bg-[var(--bg)]">
        <div className="px-5 pt-5 pb-4">
          <div className="mono text-[10px] text-[var(--fg-3)] uppercase tracking-[0.18em] mb-2">sample project</div>
          <h2 className="text-[17px] font-semibold text-[var(--fg)] tracking-tight mb-1">{SAMPLE_PROJECT.name}</h2>
          <div className="flex items-center gap-3 mono text-[10.5px] text-[var(--fg-3)]">
            <span>{SAMPLE_PROJECT.pdf_filename}</span>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="tabular-nums">{counts.total} markups</span>
            <span className="text-[var(--fg-4)]">·</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-[var(--fg-2)]">{counts.done}</span>
              <div className="w-16 h-[2px] bg-[var(--line)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${counts.pct}%` }}/>
              </div>
              <span className="tabular-nums text-[var(--fg-2)]">{counts.pct}%</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <ChecklistPanel
            markups={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onStatusChange={handleStatusChange}
            onFlag={handleFlag}
          />
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-1)]">
        <div className="h-10 shrink-0 border-b border-[var(--line)] bg-[var(--bg)] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 mono text-[11px] text-[var(--fg-3)]">
            <span className="tabular-nums">p.1<span className="text-[var(--fg-4)]">/1</span></span>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="text-[var(--fg-2)]">BATH 01 — E</span>
            {selectedItem && (
              <>
                <span className="text-[var(--fg-4)]">·</span>
                <span className="text-[var(--accent)] tabular-nums">{selectedItem.id}</span>
              </>
            )}
          </div>
          <button onClick={exportCSV} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[3px] text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)] mono text-[11px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2 M7 10l5 5 5-5 M12 15V3"/>
            </svg>
            export CSV
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <DrawingPlate selectedId={selectedId}/>
        </div>
        <DetailStrip item={selectedItem} onStatusChange={handleStatusChange} onFlag={handleFlag}/>
      </main>
    </div>
  )
}

// ── Real project (uses extraction hook + API) ─────────────────────────────
function RealProjectPage({ id }) {
  const { state } = useLocation()
  const extraction = useExtraction()
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [localMarkups, setLocalMarkups] = useState([])
  const projectIdRef = useRef(null)

  useEffect(() => { projectIdRef.current = extraction.project?.id ?? null }, [extraction.project?.id])

  useEffect(() => {
    const jobId = state?.jobId ?? null
    extraction.initialize(id, jobId).finally(() => setLoading(false))
    return () => extraction.reset()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const markups = extraction.markups.map(m => {
    const local = localMarkups.find(l => l.id === m.id)
    return local ? { ...m, ...local } : m
  })

  useEffect(() => {
    if (markups.length > 0 && !selectedId) setSelectedId(markups[0].id)
  }, [markups.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedItem = markups.find(m => m.id === selectedId) ?? null

  const counts = useMemo(() => {
    const total = markups.length
    const done = markups.filter(m => m.status === 'done').length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, pct }
  }, [markups])

  const handleStatusChange = useCallback(async (itemId, status) => {
    const patch = { status, ...(status !== 'flagged' && { flagged: false }) }
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      if (exists) return prev.map(l => l.id === itemId ? { ...l, ...patch } : l)
      return [...prev, { id: itemId, ...patch }]
    })
    const projectId = projectIdRef.current
    if (projectId) {
      try { await updateItemStatus(projectId, itemId, status) }
      catch (err) { console.error('Failed to update status:', err) }
    }
  }, [])

  const handleFlag = useCallback(async (itemId, message) => {
    setLocalMarkups(prev => {
      const exists = prev.find(l => l.id === itemId)
      const patch = { flagged: true, status: 'flagged', clarification_request: message || null }
      if (exists) return prev.map(l => l.id === itemId ? { ...l, ...patch } : l)
      return [...prev, { id: itemId, ...patch }]
    })
    const projectId = projectIdRef.current
    if (projectId) {
      try { await flagItem(projectId, itemId, message) }
      catch (err) { console.error('Failed to flag item:', err) }
    }
  }, [])

  const exportCSV = useCallback(() => {
    const csv = buildCSV(markups, extraction.project?.name ?? 'project')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(extraction.project?.name ?? 'redlineiq').replace(/[^\w]+/g, '-')}-markups.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [markups, extraction.project?.name])

  const isProcessing = extraction.phase === 'extracting'
  const project = extraction.project

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  if (extraction.phase === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="mono text-[12px] text-[var(--accent)]">{extraction.error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-[420px] shrink-0 border-r border-[var(--line)] flex flex-col bg-[var(--bg)]">
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-[17px] font-semibold text-[var(--fg)] tracking-tight mb-1">
            {project?.name ?? 'Loading…'}
          </h2>
          <div className="flex items-center gap-3 mono text-[10.5px] text-[var(--fg-3)]">
            <span>{project?.pdf_filename ?? '—'}</span>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="tabular-nums">{counts.total} markups</span>
            <span className="text-[var(--fg-4)]">·</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-[var(--fg-2)]">{counts.done}</span>
              <div className="w-16 h-[2px] bg-[var(--line)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${counts.pct}%` }}/>
              </div>
              <span className="tabular-nums text-[var(--fg-2)]">{counts.pct}%</span>
            </div>
          </div>
        </div>
        {isProcessing && (
          <div className="px-5 pb-4 border-b border-[var(--line)]">
            <ExtractionProgress
              phase={extraction.phase}
              pagesComplete={extraction.pagesComplete}
              totalPages={extraction.totalPages}
            />
          </div>
        )}
        {markups.length > 0 ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChecklistPanel
              markups={markups}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStatusChange={handleStatusChange}
              onFlag={handleFlag}
            />
          </div>
        ) : (
          <div className="flex flex-col flex-1 items-center justify-center gap-3 px-6">
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"/>
                <p className="mono text-[11px] text-[var(--fg-3)]">markups will appear as pages are analyzed…</p>
              </>
            ) : (
              <p className="mono text-[11px] text-[var(--fg-3)]">no markups found</p>
            )}
          </div>
        )}
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-1)]">
        <PdfViewer project={project} selectedItem={selectedItem} onExport={exportCSV}/>
        <DetailStrip item={selectedItem} onStatusChange={handleStatusChange} onFlag={handleFlag}/>
      </main>
    </div>
  )
}

// ── Router shim ───────────────────────────────────────────────────────────
export default function ProjectPage() {
  const { id } = useParams()
  if (id === SAMPLE_ID) return <SampleProjectPage/>
  return <RealProjectPage id={id}/>
}

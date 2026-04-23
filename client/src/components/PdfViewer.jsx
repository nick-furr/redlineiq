import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const BASE_PAGE_WIDTH = 800

// Coordinates in the 1200×820 SVG space used by DrawingPlate
const MARKUP_LOCS = {
  'MK-001': [380, 110, 520, 40],
  'MK-002': [360, 90, 560, 80],
  'MK-003': [95, 150, 20, 180],
  'MK-004': [560, 145, 70, 26],
  'MK-005': [[420, 225], [630, 225], [820, 225]],
  'MK-006': [380, 240, 180, 150],
  'MK-007': [270, 320, 120, 22],
  'MK-008': [760, 240, 180, 150],
  'MK-009': [200, 540, 90, 22],
  'MK-010': [380, 450, 180, 150],
  'MK-011': [760, 450, 180, 150],
  'MK-012': [330, 640, 30, 30],
  'MK-013': [410, 680, 30, 16],
  'MK-014': [490, 680, 34, 16],
  'MK-015': [610, 680, 30, 16],
  'MK-016': [740, 680, 30, 16],
  'MK-017': [830, 640, 30, 30],
  'MK-018': [220, 720, 180, 22],
  'MK-019': [220, 745, 180, 22],
}

const RESET_PATH = 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5'
const EXPORT_PATH = 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2 M7 10l5 5 5-5 M12 15V3'

function MarkupHighlight({ itemId }) {
  const sel = MARKUP_LOCS[itemId]
  if (!sel) return null
  const ACCENT = 'oklch(0.66 0.19 25)'
  const FILL = 'oklch(0.66 0.19 25 / 0.10)'
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
      viewBox="0 0 1200 820"
      preserveAspectRatio="xMidYMid meet"
    >
      {!Array.isArray(sel[0]) ? (
        <rect
          x={sel[0] - 10} y={sel[1] - 10}
          width={sel[2] + 20} height={sel[3] + 20}
          stroke={ACCENT} strokeWidth="2" strokeDasharray="6 4"
          fill={FILL} rx="4"
        />
      ) : (
        sel.map(([x, y], i) => (
          <rect key={i}
            x={x - 14} y={y - 14} width="52" height="52"
            stroke={ACCENT} strokeWidth="2" strokeDasharray="6 4"
            fill={FILL} rx="4"
          />
        ))
      )}
    </svg>
  )
}

function Icon({ d, size = 14, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

export default function PdfViewer({ project, pdfUrl: pdfUrlProp, selectedItem, onExport }) {
  const [numPages, setNumPages] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [loadError, setLoadError] = useState(null)
  const pageRefs = useRef({})

  const pdfUrl = pdfUrlProp ?? (project ? `/api/projects/${project.id}/pdf` : null)

  useEffect(() => {
    if (!selectedItem?.page_number) return
    const el = pageRefs.current[selectedItem.page_number]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedItem?.id, selectedItem?.page_number])

  const handleLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages)
    setLoadError(null)
  }, [])

  const handleLoadError = useCallback((err) => {
    console.error('PDF load error:', err)
    setLoadError('Failed to load PDF')
  }, [])

  const setPageRef = useCallback((pageNum, el) => {
    if (el) pageRefs.current[pageNum] = el
    else delete pageRefs.current[pageNum]
  }, [])

  const zoomIn = () => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  const resetZoom = () => setZoom(1)

  const totalPages = numPages ?? project?.total_pages ?? null

  if (!pdfUrl) {
    return (
      <div className="flex flex-col h-full">
        <ViewerToolbar
          selectedItem={selectedItem}
          totalPages={totalPages}
          zoom={Math.round(zoom * 100)}
          onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom}
          onExport={onExport}
          drawingRef={null}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="mono text-[11px] text-[var(--fg-3)]">no pdf loaded</p>
        </div>
      </div>
    )
  }

  const pageWidth = Math.round(BASE_PAGE_WIDTH * zoom)

  return (
    <div className="flex flex-col h-full">
      <ViewerToolbar
        selectedItem={selectedItem}
        totalPages={totalPages}
        zoom={Math.round(zoom * 100)}
        onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom}
        onExport={onExport}
        drawingRef={selectedItem?.drawing_reference}
      />
      <div className="flex-1 overflow-auto bg-[var(--bg-1)]">
        {loadError ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-400 text-sm mono">{loadError}</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <div className="flex items-center justify-center h-full gap-3">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"/>
                <span className="mono text-[11px] text-[var(--fg-3)]">loading pdf…</span>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4 py-6 px-4">
              {Array.from({ length: numPages ?? 0 }, (_, i) => i + 1).map(pageNum => {
                const isActive = selectedItem?.page_number === pageNum
                return (
                  <div key={pageNum} ref={el => setPageRef(pageNum, el)} className="relative">
                    <div className={[
                      'absolute inset-0 rounded pointer-events-none z-10 transition-all',
                      isActive ? 'ring-1 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-1)]' : '',
                    ].join(' ')}/>
                    {isActive && selectedItem && (
                      <MarkupHighlight itemId={selectedItem.id} />
                    )}
                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="shadow-xl"
                      loading={
                        <div className="bg-[var(--bg-2)] animate-pulse"
                          style={{ width: pageWidth, height: Math.round(pageWidth * 1.294) }}/>
                      }
                    />
                    <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/70 mono text-[10px] text-[var(--fg-3)] select-none">
                      {pageNum}
                    </div>
                  </div>
                )
              })}
            </div>
          </Document>
        )}
      </div>
    </div>
  )
}

function ViewerToolbar({ selectedItem, totalPages, zoom, onZoomIn, onZoomOut, onReset, onExport, drawingRef }) {
  const [page] = useState(1)
  return (
    <div className="h-10 shrink-0 border-b border-[var(--line)] bg-[var(--bg)] px-4 flex items-center justify-between">
      <div className="flex items-center gap-3 mono text-[11px] text-[var(--fg-3)]">
        <span className="tabular-nums">
          p.{selectedItem?.page_number ?? page}
          <span className="text-[var(--fg-4)]">/{totalPages ?? '—'}</span>
        </span>
        {drawingRef && (
          <>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="text-[var(--fg-2)]">{drawingRef}</span>
          </>
        )}
        {selectedItem && (
          <>
            <span className="text-[var(--fg-4)]">·</span>
            <span className="text-[var(--accent)] tabular-nums">{selectedItem.id}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onReset} className="w-7 h-7 inline-flex items-center justify-center rounded-[3px] text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)]">
          <Icon d={RESET_PATH} size={12}/>
        </button>
        <div className="flex items-center border border-[var(--line)] rounded-[3px] overflow-hidden">
          <button onClick={onZoomOut} disabled={zoom <= 50} className="w-7 h-6 text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)] disabled:opacity-30">−</button>
          <span className="mono text-[10.5px] text-[var(--fg-2)] px-2 tabular-nums w-[44px] text-center">{zoom}%</span>
          <button onClick={onZoomIn} disabled={zoom >= 300} className="w-7 h-6 text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)] disabled:opacity-30">+</button>
        </div>
        {onExport && (
          <button onClick={onExport} className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-[3px] text-[var(--fg-3)] hover:text-[var(--fg-1)] hover:bg-[var(--bg-2)] mono text-[11px]">
            <Icon d={EXPORT_PATH} size={12}/> export CSV
          </button>
        )}
      </div>
    </div>
  )
}

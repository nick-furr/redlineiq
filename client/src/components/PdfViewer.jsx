import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Use the pdfjs worker bundled with react-pdf via Vite's URL import
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const ZOOM_STEP = 0.25
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const BASE_PAGE_WIDTH = 800

export default function PdfViewer({ project, selectedItem }) {
  const [numPages, setNumPages] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [loadError, setLoadError] = useState(null)
  const pageRefs = useRef({})

  const pdfUrl = project ? `/api/projects/${project.id}/pdf` : null

  // Scroll to the selected item's page whenever selection changes
  useEffect(() => {
    if (!selectedItem?.page_number) return
    const el = pageRefs.current[selectedItem.page_number]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
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

  if (!pdfUrl) {
    return <EmptyPlaceholder selectedItem={selectedItem} />
  }

  const pageWidth = Math.round(BASE_PAGE_WIDTH * zoom)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2128] bg-[#0c0e12] shrink-0">
        <span className="text-[11px] font-mono text-[#4b5563]">
          {numPages != null ? `${numPages} page${numPages !== 1 ? 's' : ''}` : 'Loading…'}
        </span>

        {selectedItem?.page_number && (
          <span className="text-[11px] font-mono text-[#1D9E75]">
            p.{selectedItem.page_number} · {selectedItem.drawing_reference}
          </span>
        )}

        <div className="flex items-center gap-0.5">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded text-lg font-light text-[#6b7280] hover:text-[#e2e4e9] hover:bg-[#1e2128] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="px-2 h-7 rounded text-[11px] font-mono text-[#4b5563] hover:text-[#9ca3af] hover:bg-[#1e2128] transition-colors"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded text-lg font-light text-[#6b7280] hover:text-[#e2e4e9] hover:bg-[#1e2128] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* PDF scroll area */}
      <div className="flex-1 overflow-auto bg-[#07080b]">
        {loadError ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-400 text-sm font-mono">{loadError}</p>
          </div>
        ) : (
          <Document
            file={pdfUrl}
            onLoadSuccess={handleLoadSuccess}
            onLoadError={handleLoadError}
            loading={
              <div className="flex items-center justify-center h-full gap-3">
                <div className="w-5 h-5 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#4b5563] text-sm font-mono">Loading PDF…</span>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4 py-6 px-4">
              {Array.from({ length: numPages ?? 0 }, (_, i) => i + 1).map(pageNum => {
                const isActive = selectedItem?.page_number === pageNum
                return (
                  <div
                    key={pageNum}
                    ref={el => setPageRef(pageNum, el)}
                    className="relative"
                  >
                    {/* Active page highlight ring */}
                    <div
                      className={[
                        'absolute inset-0 rounded pointer-events-none z-10 transition-all',
                        isActive
                          ? 'ring-2 ring-[#1D9E75] ring-offset-2 ring-offset-[#07080b]'
                          : '',
                      ].join(' ')}
                    />

                    <Page
                      pageNumber={pageNum}
                      width={pageWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="shadow-xl"
                      loading={
                        <div
                          className="bg-[#13151a] animate-pulse"
                          style={{ width: pageWidth, height: Math.round(pageWidth * 1.294) }}
                        />
                      }
                    />

                    {/* Page number badge */}
                    <div className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-[#6b7280] select-none">
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

function EmptyPlaceholder({ selectedItem }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2e3340" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <div>
        <p className="text-[#374151] font-medium text-sm">PDF Viewer</p>
        <p className="text-[#2e3340] text-xs mt-1">Upload a PDF to view it here</p>
      </div>
      {selectedItem && (
        <div className="mt-2 p-3 rounded-lg border border-[#1e2128] bg-[#13151a] max-w-sm w-full text-left">
          <p className="text-[10px] text-[#4b5563] font-mono uppercase tracking-wider mb-2">Selected Item</p>
          {selectedItem.drawing_reference && (
            <div className="mb-1.5">
              <span className="text-[11px] text-[#4b5563] font-mono">Drawing: </span>
              <span className="text-[11px] text-[#1D9E75] font-mono">{selectedItem.drawing_reference}</span>
            </div>
          )}
          {selectedItem.location_on_drawing && (
            <div className="mb-1.5">
              <span className="text-[11px] text-[#4b5563] font-mono">Location: </span>
              <span className="text-[11px] text-[#9ca3af] font-mono">{selectedItem.location_on_drawing}</span>
            </div>
          )}
          <p className="text-xs text-[#6b7280] mt-2 leading-snug">{selectedItem.markup_text}</p>
        </div>
      )}
    </div>
  )
}

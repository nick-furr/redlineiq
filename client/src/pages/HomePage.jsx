import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { uploadProject, startExtraction, listProjects, deleteProject } from '../services/api.js'
import { SAMPLE_PROJECT } from '../sampleData.js'
import UploadZone from '../components/UploadZone.jsx'
import TypeBadge from '../components/TypeBadge.jsx'

const SAMPLE_ID = 'sample-demo-001'
const ARROW_PATH = 'M9 6l6 6-6 6'
const FOLDER_PATH = 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
const CLOSE_PATH = 'M6 6l12 12 M18 6L6 18'

function Icon({ d, size = 13, stroke = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

function Stat({ k, v }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[22px] font-semibold tracking-tight text-[var(--fg)] mb-1 tabular-nums">{k}</div>
      <div className="text-[11.5px] text-[var(--fg-3)] leading-snug">{v}</div>
    </div>
  )
}

function HowStep({ n, title, desc, children }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-[84px] h-[84px] rounded-full border border-[var(--line)] bg-[var(--bg)] flex items-center justify-center relative z-10 mb-3">
        <div className="w-12 h-12">{children}</div>
      </div>
      <div className="mono text-[10px] text-[var(--fg-4)] tracking-[0.18em] mb-1">{n}</div>
      <div className="text-[13.5px] font-semibold text-[var(--fg)] tracking-tight mb-1.5">{title}</div>
      <div className="text-[11.5px] text-[var(--fg-3)] leading-snug max-w-[200px]">{desc}</div>
    </div>
  )
}

function FakeFlag({ type, text }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-[2px]">
      <TypeBadge type={type} showColors={false}/>
      <span className="text-[11.5px] text-[var(--fg-1)] italic flex-1 truncate">&ldquo;{text}&rdquo;</span>
      <span className="mono text-[9px] uppercase tracking-wider text-[var(--accent)]">flag</span>
    </div>
  )
}

function Spec({ k, v }) {
  return (
    <div>
      <div className="text-[var(--fg-4)] mono uppercase tracking-[0.18em] mb-1 text-[10.5px]">{k}</div>
      <div className="text-[var(--fg-2)] mono text-[10.5px]">{v}</div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    listProjects()
      .then(({ projects }) => {
        const real = projects.filter(p => p.id !== SAMPLE_ID)
        setProjects([SAMPLE_PROJECT, ...real])
      })
      .catch(() => {
        setProjects([SAMPLE_PROJECT])
      })
      .finally(() => setProjectsLoading(false))
  }, [])

  const handleUpload = async (file) => {
    setUploadError(null)
    setUploading(true)
    setProgress(0)
    // Simulate progress while uploading
    let p = 0
    const tick = () => {
      p += 4 + Math.random() * 6
      setProgress(Math.min(p, 85))
      if (p < 85) setTimeout(tick, 120)
    }
    tick()
    try {
      const { project } = await uploadProject(file)
      const { jobId } = await startExtraction(project.id)
      setProgress(100)
      setTimeout(() => navigate(`/projects/${project.id}`, { state: { jobId } }), 300)
    } catch (err) {
      setUploadError(err.message)
      setUploading(false)
    }
  }

  const handleDelete = async (projectId) => {
    setDeletingId(projectId)
    try {
      await deleteProject(projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
      setConfirmingId(null)
    } catch (err) {
      console.error('Failed to delete project:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-6 pt-16 pb-16">

        {/* hero */}
        <div className="mb-8">
          <div className="mono text-[10px] text-[var(--fg-3)] uppercase tracking-[0.22em] mb-4 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--fg-4)]"/>
            extraction engine
            <span className="w-1 h-1 rounded-full bg-[var(--accent)] redpulse"/>
          </div>
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.022em] text-[var(--fg)] mb-4">
            Turn handwritten redlines into a structured checklist.
          </h1>
          <p className="text-[14.5px] text-[var(--fg-2)] leading-relaxed max-w-[560px]">
            Upload a marked-up plan set. Every annotation — clouds, arrows, dimensions,
            illegible scrawl — is extracted, categorized, and organized into a drafter-ready
            worklist. Ambiguous items are auto-flagged for clarification.
          </p>
        </div>

        {/* ROI strip */}
        <div className="mb-10 grid grid-cols-3 border border-[var(--line)] rounded-[3px] divide-x divide-[var(--line)] overflow-hidden">
          <Stat k="≈ 45 min" v="saved per plan set vs manual transcription"/>
          <Stat k="19" v="markups auto-extracted on the sample below"/>
          <Stat k="100%" v="capture rate on legible items in pilot testing"/>
        </div>

        {/* upload zone */}
        {!uploading ? (
          <UploadZone onUpload={handleUpload} disabled={uploading}/>
        ) : (
          <div className="relative border border-dashed border-[var(--accent)] bg-[var(--accent-f)] rounded-[4px]">
            <div className="w-full py-10 px-6 flex flex-col items-center gap-3">
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--fg-3)]">
                extracting · {Math.round(progress)}%
              </div>
              <div className="w-full max-w-[360px] h-[2px] bg-[var(--line)] overflow-hidden">
                <div className="h-full bg-[var(--accent)] transition-[width] duration-100" style={{ width: `${progress}%` }}/>
              </div>
              <div className="mono text-[10.5px] text-[var(--fg-3)] shimmer">
                {progress < 30 ? 'rasterizing pages…' : progress < 60 ? 'analyzing markups…' : progress < 90 ? 'categorizing items…' : 'finalizing…'}
              </div>
            </div>
          </div>
        )}

        {uploadError && (
          <p className="mt-2 mono text-[11px] text-[var(--accent)] text-center">{uploadError}</p>
        )}

        {/* sample link */}
        <div className="mt-4 flex items-center justify-between">
          <Link to={`/projects/${SAMPLE_ID}`} className="mono text-[11px] text-[var(--fg-2)] hover:text-[var(--fg)] flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[var(--accent)]"/>
            try the sample project
            <Icon d={ARROW_PATH}/>
          </Link>
          <div className="mono text-[10px] text-[var(--fg-4)]">claude sonnet · vision</div>
        </div>

        {/* how it works */}
        <div className="mt-16">
          <div className="mono text-[10px] text-[var(--fg-3)] uppercase tracking-[0.18em] mb-4">how it works</div>
          <div className="grid grid-cols-3 gap-3 relative">
            <div aria-hidden className="absolute top-[42px] left-[33%] w-[34%] h-px bg-[var(--line-2)]"/>
            <div aria-hidden className="absolute top-[42px] h-px bg-[var(--line-2)]" style={{ left: '66.6%', width: '33.6%' }}/>
            <HowStep n="01" title="Upload" desc="Drop a redlined PDF. Plan sets up to 10 pages. No setup, no integration.">
              <svg viewBox="0 0 60 60" className="w-full h-full">
                <rect x="18" y="10" width="28" height="38" rx="1.5" fill="none" stroke="var(--fg-2)" strokeWidth="1.2"/>
                <line x1="24" y1="20" x2="40" y2="20" stroke="var(--fg-3)" strokeWidth="1"/>
                <line x1="24" y1="26" x2="40" y2="26" stroke="var(--fg-3)" strokeWidth="1"/>
                <line x1="24" y1="32" x2="36" y2="32" stroke="var(--fg-3)" strokeWidth="1"/>
                <path d="M 28 38 q 4 -3 8 -1 q 4 3 8 -1" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="42" cy="40" r="2.5" fill="var(--accent)"/>
              </svg>
            </HowStep>
            <HowStep n="02" title="Vision AI" desc="Claude reads every annotation — clouds, arrows, dims, handwritten notes — and classifies each.">
              <svg viewBox="0 0 60 60" className="w-full h-full">
                <circle cx="30" cy="30" r="18" fill="none" stroke="var(--fg-2)" strokeWidth="1.2"/>
                <circle cx="30" cy="30" r="7" fill="none" stroke="var(--accent)" strokeWidth="1.4"/>
                <circle cx="30" cy="30" r="2" fill="var(--accent)"/>
                <line x1="30" y1="8" x2="30" y2="14" stroke="var(--fg-3)" strokeWidth="1"/>
                <line x1="30" y1="46" x2="30" y2="52" stroke="var(--fg-3)" strokeWidth="1"/>
                <line x1="8" y1="30" x2="14" y2="30" stroke="var(--fg-3)" strokeWidth="1"/>
                <line x1="46" y1="30" x2="52" y2="30" stroke="var(--fg-3)" strokeWidth="1"/>
              </svg>
            </HowStep>
            <HowStep n="03" title="Checklist" desc="Structured worklist with type, location, and confidence. Ambiguous items auto-flagged.">
              <svg viewBox="0 0 60 60" className="w-full h-full">
                <rect x="14" y="12" width="32" height="36" rx="1.5" fill="none" stroke="var(--fg-2)" strokeWidth="1.2"/>
                {[20, 28, 36].map(y => (
                  <g key={y}>
                    <rect x="18" y={y - 2} width="4" height="4" fill="none" stroke="var(--fg-3)" strokeWidth="1"/>
                    <line x1="25" y1={y} x2="42" y2={y} stroke="var(--fg-3)" strokeWidth="1"/>
                  </g>
                ))}
                <path d="M 19 19 l 1.5 1.5 L 23 18" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </HowStep>
          </div>
        </div>

        {/* ambiguous auto-flag callout */}
        <div className="mt-12 border border-[var(--line)] rounded-[3px] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto]">
            <div className="p-6">
              <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] mb-3">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)] redpulse"/>
                differentiator
              </div>
              <h3 className="text-[17px] font-semibold text-[var(--fg)] tracking-tight mb-2">
                Illegible scrawl gets flagged — not guessed.
              </h3>
              <p className="text-[13px] text-[var(--fg-2)] leading-relaxed max-w-[440px]">
                Generic OCR silently fabricates when it can&apos;t read a word. RedlineIQ rates
                every extraction for legibility and intent, and routes low-confidence items
                straight to a clarification queue. Drafters stop guessing. Engineers answer
                once, in context.
              </p>
            </div>
            <div className="bg-[var(--bg-1)] border-l border-[var(--line)] p-4 flex flex-col gap-2 min-w-[240px] justify-center">
              <FakeFlag type="note" text="Hit is soaking"/>
              <FakeFlag type="note" text="Arching penned w/ 4%"/>
              <FakeFlag type="note" text="Turn U"/>
            </div>
          </div>
        </div>

        {/* recent projects */}
        <div className="mt-12">
          <div className="mono text-[10px] text-[var(--fg-3)] uppercase tracking-[0.18em] mb-3 flex items-center justify-between">
            <span>recent</span>
            {!projectsLoading && <span className="text-[var(--fg-4)]">{projects.length}</span>}
          </div>

          {projectsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-[var(--line)] rounded-[3px] px-4 py-8 text-center mono text-[11px] text-[var(--fg-3)]">
              no projects yet — upload one above
            </div>
          ) : (
            <div className="border border-[var(--line)] rounded-[3px] divide-y divide-[var(--line)]">
              {projects.map(project => {
                const done = project.summary?.done ?? 0
                const total = project.summary?.total ?? 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                const isConfirming = confirmingId === project.id
                const isDeleting = deletingId === project.id
                const isSample = project.id === SAMPLE_ID

                return (
                  <div key={project.id}>
                    <div className="flex items-center">
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex flex-1 items-center gap-4 px-4 py-3 hover:bg-[var(--bg-1)] transition text-left group min-w-0"
                      >
                        <span className="text-[var(--fg-4)]"><Icon d={FOLDER_PATH}/></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-[var(--fg)] truncate">{project.name}</div>
                          <div className="mono text-[10px] text-[var(--fg-3)]">{formatDate(project.created_at)}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {total > 0 ? (
                            <>
                              <span className="mono text-[10.5px] text-[var(--fg-3)] tabular-nums">
                                <span className={pct === 100 ? 'text-[var(--fg-1)]' : 'text-[var(--fg-2)]'}>{done}</span>/{total}
                              </span>
                              <div className="w-16 h-[2px] bg-[var(--line)] overflow-hidden">
                                <div className={`h-full ${pct === 100 ? 'bg-[var(--fg-1)]' : 'bg-[var(--accent)]'}`} style={{ width: `${pct}%` }}/>
                              </div>
                              <span className="mono text-[10px] text-[var(--fg-3)] tabular-nums w-8 text-right">{pct}%</span>
                            </>
                          ) : (
                            <span className="mono text-[10.5px] text-[var(--fg-3)]">no items</span>
                          )}
                          <span className="text-[var(--fg-4)]"><Icon d={ARROW_PATH}/></span>
                        </div>
                      </Link>
                      {!isSample && (
                        <button
                          onClick={() => setConfirmingId(isConfirming ? null : project.id)}
                          className="px-3 py-3 text-[var(--fg-4)] hover:text-[var(--accent)] transition shrink-0"
                          title="Delete project"
                        >
                          <Icon d={CLOSE_PATH} size={12}/>
                        </button>
                      )}
                    </div>
                    {isConfirming && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[var(--line)] bg-[var(--bg-1)]">
                        <span className="mono text-[11px] text-[var(--fg-3)]">Delete this project? This can&apos;t be undone.</span>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setConfirmingId(null)} className="mono text-[10.5px] px-2.5 py-1 rounded text-[var(--fg-3)] hover:text-[var(--fg-1)]">
                            cancel
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            disabled={isDeleting}
                            className="mono text-[10.5px] px-2.5 py-1 rounded bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-d)] disabled:opacity-50"
                          >
                            {isDeleting ? 'deleting…' : 'delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* footer specs */}
        <div className="mt-16 pt-6 border-t border-[var(--line)] grid grid-cols-3 gap-6">
          <Spec k="extraction" v="vision api · per-page streaming"/>
          <Spec k="export" v="CSV · per-item status & flags"/>
          <Spec k="persistence" v="sqlite · row-level writes"/>
        </div>

      </div>
    </div>
  )
}

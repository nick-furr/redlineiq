import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { uploadProject, startExtraction, listProjects, deleteProject } from '../services/api.js'
import UploadZone from '../components/UploadZone.jsx'

const SAMPLE_ID = 'sample-demo-001'

function formatDate(iso) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

export default function HomePage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  // ID of the project currently showing the delete confirmation inline
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    listProjects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => {})
      .finally(() => setProjectsLoading(false))
  }, [])

  const handleUpload = async (file) => {
    setUploadError(null)
    setUploading(true)
    try {
      const { project } = await uploadProject(file)
      const { jobId } = await startExtraction(project.id)
      navigate(`/projects/${project.id}`, { state: { jobId } })
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
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-12">
      {/* Upload zone */}
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#e2e4e9] mb-1">Upload a redlined drawing</h1>
          <p className="text-sm text-[#4b5563]">AI extracts every markup into a structured checklist</p>
        </div>
        {uploadError && (
          <p className="text-red-400 text-xs font-mono text-center">{uploadError}</p>
        )}
        <UploadZone onUpload={handleUpload} disabled={uploading} />

        <div className="text-center">
          <span className="text-xs text-[#374151]">or </span>
          <Link
            to={`/projects/${SAMPLE_ID}`}
            className="text-xs text-[#1D9E75] hover:text-[#22c55e] transition-colors underline underline-offset-2"
          >
            try with a sample redlined drawing
          </Link>
        </div>
      </div>

      {/* Project list */}
      <div className="w-full max-w-lg mt-10">
        <h2 className="text-xs font-mono text-[#4b5563] uppercase tracking-widest mb-3">Recent projects</h2>

        {projectsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-[#374151] text-center py-8">No projects yet</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {projects.map(project => {
              const done = project.summary?.done ?? 0
              const total = project.summary?.total ?? 0
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const isConfirming = confirmingId === project.id
              const isDeleting = deletingId === project.id
              const isSample = project.id === SAMPLE_ID

              return (
                <li key={project.id}>
                  <div className="rounded-lg border border-[#1e2128] bg-[#13151a] overflow-hidden">
                    {/* Main row */}
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex flex-1 items-center justify-between gap-4 px-4 py-3 hover:bg-[#16181e] transition-colors group min-w-0"
                      >
                        {/* Left: name + date */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm text-[#e2e4e9] font-medium truncate group-hover:text-white transition-colors">
                            {project.name}
                          </span>
                          <span className="text-[11px] text-[#374151] font-mono">
                            {formatDate(project.created_at)}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center gap-3 shrink-0">
                          {total > 0 ? (
                            <>
                              <span className="text-xs font-mono text-[#4b5563]">
                                <span className="text-[#1D9E75]">{done}</span>/{total} done
                              </span>
                              <div className="w-16 h-1 bg-[#1e2128] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#1D9E75] rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-[11px] font-mono text-[#374151]">no items</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#2e3340] group-hover:text-[#4b5563] transition-colors">
                            <polyline points="9,6 15,12 9,18"/>
                          </svg>
                        </div>
                      </Link>

                      {/* Delete button — hidden for the sample project */}
                      {!isSample && (
                        <button
                          onClick={() => setConfirmingId(isConfirming ? null : project.id)}
                          title="Delete project"
                          className="px-3 py-3 text-[#2e3340] hover:text-red-500 transition-colors shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                            <path d="M10,11v6M14,11v6"/>
                            <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Inline confirm bar */}
                    {isConfirming && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-[#1e2128] bg-[#0f1014]">
                        <span className="text-xs text-[#9ca3af]">Delete this project? This can't be undone.</span>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="px-2.5 py-1 rounded text-xs text-[#6b7280] hover:text-[#9ca3af] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(project.id)}
                            disabled={isDeleting}
                            className="px-2.5 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                          >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

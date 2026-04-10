import { useState, useRef, useCallback } from 'react'
import { createJobStream, getProject } from '../services/api.js'

// Checklist items from the API have markup fields nested under item.markup.
// Flatten them so downstream components can use item.markup_type, item.markup_text, etc.
function flattenItem(item) {
  return {
    ...item.markup,
    id: item.id,
    status: item.status,
    flagged: item.status === 'flagged',
    drafter_notes: item.drafter_notes,
    clarification_request: item.clarification_request,
    clarification_response: item.clarification_response,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

const INITIAL_STATE = {
  phase: 'idle', // idle | uploading | extracting | done | error
  project: null,
  jobId: null,
  markups: [],
  pagesComplete: 0,
  totalPages: null,
  error: null,
}

export function useExtraction() {
  const [state, setState] = useState(INITIAL_STATE)
  const eventSourceRef = useRef(null)

  const patchState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const subscribeToJob = useCallback((projectId, jobId) => {
    closeStream()

    const es = createJobStream(jobId)
    eventSourceRef.current = es

    es.addEventListener('connected', () => {
      // Connection established, nothing to do
    })

    es.addEventListener('page_start', (e) => {
      try {
        const data = JSON.parse(e.data)
        patchState({ totalPages: data.totalPages ?? null })
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener('page_complete', (e) => {
      try {
        const data = JSON.parse(e.data)
        const newMarkups = (data.markups ?? []).map(flattenItem)
        setState(prev => ({
          ...prev,
          pagesComplete: prev.pagesComplete + 1,
          totalPages: data.totalPages ?? prev.totalPages,
          markups: [...prev.markups, ...newMarkups],
        }))
      } catch {
        // ignore parse errors
      }
    })

    es.addEventListener('job_complete', async () => {
      closeStream()
      // Fetch full project to ensure we have the complete checklist
      try {
        const { project } = await getProject(projectId)
        setState(prev => ({
          ...prev,
          phase: 'done',
          project,
          markups: (project.checklist ?? []).map(flattenItem),
        }))
      } catch {
        patchState({ phase: 'done' })
      }
    })

    es.addEventListener('job_error', (e) => {
      closeStream()
      let message = 'Extraction failed'
      try {
        const data = JSON.parse(e.data)
        message = data.error ?? message
      } catch {
        // ignore
      }
      patchState({ phase: 'error', error: message })
    })

    es.onerror = () => {
      // SSE connection dropped — surface error only if we're not done
      setState(prev => {
        if (prev.phase === 'done') return prev
        return { ...prev, phase: 'error', error: 'Connection to server lost during extraction.' }
      })
      closeStream()
    }
  }, [closeStream, patchState])

  // Load an existing project and optionally reconnect to a running extraction job.
  // Called by ProjectPage on mount — jobId comes from navigation state if we just
  // kicked off extraction in HomePage.
  const initialize = useCallback(async (projectId, jobId = null) => {
    try {
      const { project } = await getProject(projectId)
      const existingMarkups = (project.checklist ?? []).map(flattenItem)

      if (jobId && existingMarkups.length === 0) {
        // Job is still running — subscribe to SSE stream
        patchState({ phase: 'extracting', project, jobId, markups: [], pagesComplete: 0 })
        subscribeToJob(projectId, jobId)
      } else {
        // Job finished (or never started) — render what we have
        patchState({
          phase: existingMarkups.length > 0 ? 'done' : 'idle',
          project,
          markups: existingMarkups,
        })
      }
    } catch (err) {
      patchState({ phase: 'error', error: err.message })
    }
  }, [patchState, subscribeToJob])

  const reset = useCallback(() => {
    closeStream()
    setState(INITIAL_STATE)
  }, [closeStream])

  return { ...state, initialize, reset }
}

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function uploadProject(file) {
  const form = new FormData()
  form.append('pdf', file)
  return request('/projects', { method: 'POST', body: form })
}

export async function getProject(id) {
  return request(`/projects/${id}`)
}

export async function listProjects() {
  return request('/projects')
}

export async function startExtraction(projectId) {
  return request(`/projects/${projectId}/extract`, { method: 'POST' })
}

export async function pollJob(jobId) {
  return request(`/jobs/${jobId}`)
}

export async function updateItemStatus(projectId, itemId, status) {
  return request(`/projects/${projectId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function flagItem(projectId, itemId, message) {
  return request(`/projects/${projectId}/items/${itemId}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export async function getProjectSummary(projectId) {
  return request(`/projects/${projectId}/summary`)
}

export async function deleteProject(projectId) {
  return request(`/projects/${projectId}`, { method: 'DELETE' })
}

// Returns an EventSource connected to the job status SSE stream
export function createJobStream(jobId) {
  return new EventSource(`${BASE}/jobs/${jobId}/status`)
}

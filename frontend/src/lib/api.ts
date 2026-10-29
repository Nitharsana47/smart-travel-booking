// Small fetch wrapper for the SkyVoyage API.
// - Adds the access token to every request.
// - On a 401, refreshes the session once (httpOnly cookie) and retries.
// - Turns error responses into ApiError with the server's message.

export class ApiError extends Error {
  status: number
  details?: Record<string, unknown>
  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.details = details
  }
}

let accessToken: string | null = null
let onSession: ((s: { user: ApiUser; accessToken: string } | null) => void) | null = null

export interface ApiUser {
  id: string
  name: string
  email: string
  phone: string
  role: 'USER' | 'ADMIN'
}

export const setAccessToken = (t: string | null) => (accessToken = t)
export const onSessionChange = (fn: typeof onSession) => (onSession = fn)

let refreshing: Promise<boolean> | null = null

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession() {
  // If the user logs in or signs up while this request is in flight, its (older) answer must not overwrite that session.
  const tokenAtStart = accessToken
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => {
      const stale = accessToken !== tokenAtStart
      if (!res.ok) {
        if (stale) return true
        accessToken = null
        onSession?.(null)
        return false
      }
      const body = await res.json()
      if (stale) return true
      accessToken = body.accessToken
      onSession?.(body)
      return true
    })
    .catch(() => false)
    .finally(() => (refreshing = null))
  return refreshing
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; retry?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.json !== undefined) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin', body: init.json !== undefined ? JSON.stringify(init.json) : init.body })
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?")
  }

  if (res.status === 401 && init.retry !== false && !path.startsWith('/auth/') && (await refreshSession())) {
    return api<T>(path, { ...init, retry: false })
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.details)
  return body as T
}

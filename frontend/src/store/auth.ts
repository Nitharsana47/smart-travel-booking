// Session state. The access token lives only in memory; the refresh token is
// an httpOnly cookie the browser sends to /api/auth automatically, so
// JavaScript (and any injected script) can never read it.
import { create } from 'zustand'
import { api, ApiError, onSessionChange, refreshSession, setAccessToken, type ApiUser } from '../lib/api'

export type User = ApiUser

interface AuthState {
  user: User | null
  ready: boolean // true once the startup session check has finished
  init: () => Promise<void>
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<string | null>
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

type Session = { user: User; accessToken: string }

const message = (e: unknown) => (e instanceof ApiError ? (e.details ? Object.values(e.details).flat().join(' ') || e.message : e.message) : 'Something went wrong')

export const useAuth = create<AuthState>()((set) => {
  onSessionChange((s) => set({ user: s?.user ?? null }))
  const start = (s: Session) => {
    setAccessToken(s.accessToken)
    set({ user: s.user })
  }
  return {
    user: null,
    ready: false,

    // On page load, try to resume the session from the refresh cookie.
    init: async () => {
      await refreshSession()
      set({ ready: true })
    },

    register: async (input) => {
      try {
        start(await api<Session>('/auth/register', { method: 'POST', json: input }))
        return null
      } catch (e) {
        return message(e)
      }
    },

    login: async (email, password) => {
      try {
        start(await api<Session>('/auth/login', { method: 'POST', json: { email, password } }))
        return null
      } catch (e) {
        return message(e)
      }
    },

    logout: async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
      setAccessToken(null)
      set({ user: null })
    },
  }
})

export const useCurrentUser = () => useAuth((s) => s.user)

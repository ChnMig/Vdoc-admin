import { create } from 'zustand'
import { removeCookie } from '@/lib/cookies'

const VDOC_ACCESS_TOKEN = 'vdoc_admin_access_token'

function readAccessToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.sessionStorage.getItem(VDOC_ACCESS_TOKEN) ?? ''
  } catch {
    return ''
  }
}

function writeAccessToken(accessToken: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(VDOC_ACCESS_TOKEN, accessToken)
  } catch {
    // The in-memory Zustand value still supports the active page when storage is unavailable.
  }
  removeCookie(VDOC_ACCESS_TOKEN)
}

function clearAccessToken(): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(VDOC_ACCESS_TOKEN)
    } catch {
      // Ignore unavailable browser storage while still clearing in-memory state.
    }
  }
  removeCookie(VDOC_ACCESS_TOKEN)
}

export interface AuthUser {
  id: string
  email: string
  name: string
  is_super_admin: boolean
  status: number
  created_at?: string
  updated_at?: string
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const initToken = readAccessToken()
  // Remove the legacy JWT cookie so it is no longer attached to static or public-share requests.
  removeCookie(VDOC_ACCESS_TOKEN)

  return {
    auth: {
      user: null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          writeAccessToken(accessToken)
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          clearAccessToken()
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      reset: () =>
        set((state) => {
          clearAccessToken()
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '' },
          }
        }),
    },
  }
})

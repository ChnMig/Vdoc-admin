import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isUnauthenticatedError } from './auth-errors'
import { getIdentity } from './vdoc-api'

const IDENTITY_FRESH_MS = 30_000
let verifiedIdentity:
  | {
      sessionVersion: number
      accessToken: string
      userId: string
      verifiedAt: number
    }
  | undefined

export async function requireAuthenticatedUser(
  href: string,
  signal: AbortSignal
) {
  if (signal.aborted) return
  const { accessToken, sessionVersion, user } = useAuthStore.getState().auth
  if (!accessToken) {
    throw redirect({ to: '/sign-in', search: { redirect: href } })
  }

  // Search-only navigation is still authenticated navigation. Reuse only a
  // recent successful check for this exact session, never a restored JWT alone.
  if (
    user?.status === 1 &&
    verifiedIdentity?.sessionVersion === sessionVersion &&
    verifiedIdentity.accessToken === accessToken &&
    verifiedIdentity.userId === user.id &&
    Date.now() - verifiedIdentity.verifiedAt >= 0 &&
    Date.now() - verifiedIdentity.verifiedAt < IDENTITY_FRESH_MS
  ) {
    return
  }

  // A sign-out followed by sign-in can reuse the same JWT. Bind this request
  // to the session generation, including when a transport ignores cancellation.
  const isCurrentSession = () =>
    !signal.aborted &&
    useAuthStore.getState().auth.sessionVersion === sessionVersion &&
    useAuthStore.getState().auth.accessToken === accessToken

  try {
    const user = await getIdentity({ signal })
    if (isCurrentSession()) {
      useAuthStore.getState().auth.setUser(user)
      verifiedIdentity = {
        sessionVersion,
        accessToken,
        userId: user.id,
        verifiedAt: Date.now(),
      }
    }
  } catch (error) {
    if (!isCurrentSession()) return
    if (isUnauthenticatedError(error)) {
      useAuthStore.getState().auth.reset()
      throw redirect({ to: '/sign-in', search: { redirect: href } })
    }
    throw error
  }
}

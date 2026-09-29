import { redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isUnauthenticatedError } from './auth-errors'
import { getIdentity } from './vdoc-api'

export async function requireAuthenticatedUser(
  href: string,
  signal: AbortSignal
) {
  const { accessToken, sessionVersion } = useAuthStore.getState().auth
  if (!accessToken) {
    throw redirect({ to: '/sign-in', search: { redirect: href } })
  }

  // A sign-out followed by sign-in can reuse the same JWT. Bind this request
  // to the session generation, including when a transport ignores cancellation.
  const isCurrentSession = () =>
    !signal.aborted &&
    useAuthStore.getState().auth.sessionVersion === sessionVersion

  try {
    const user = await getIdentity({ signal })
    if (isCurrentSession()) useAuthStore.getState().auth.setUser(user)
  } catch (error) {
    if (!isCurrentSession()) return
    if (isUnauthenticatedError(error)) {
      useAuthStore.getState().auth.reset()
      throw redirect({ to: '/sign-in', search: { redirect: href } })
    }
    throw error
  }
}

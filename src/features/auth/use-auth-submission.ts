import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import type { VdocSession } from '@/lib/vdoc-api'

// Login and registration share one intent, even when two forms overlap.
let activeSubmission: AbortController | null = null

export function useAuthSubmission() {
  const [isLoading, setIsLoading] = useState(false)
  const submission = useRef<AbortController | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      submission.current?.abort()
      if (activeSubmission === submission.current) activeSubmission = null
      submission.current = null
    }
  }, [])

  async function submit(
    request: (signal: AbortSignal) => Promise<VdocSession>,
    onSuccess: (session: VdocSession) => Promise<void>
  ) {
    if (!mounted.current) return
    activeSubmission?.abort()
    const controller = new AbortController()
    submission.current = activeSubmission = controller
    let sessionVersion = useAuthStore.getState().auth.sessionVersion
    const isCurrent = () =>
      !controller.signal.aborted &&
      activeSubmission === controller &&
      useAuthStore.getState().auth.sessionVersion === sessionVersion
    setIsLoading(true)

    try {
      const session = await request(controller.signal)
      // Cancellation alone cannot guard transports that already delivered a response.
      if (!isCurrent()) return
      sessionVersion += 1
      useAuthStore.getState().auth.setSession(session.user, session.token)
      if (!isCurrent()) return
      await onSuccess(session)
    } catch (error) {
      if (isCurrent()) handleServerError(error)
    } finally {
      if (submission.current === controller) {
        submission.current = null
        setIsLoading(false)
      }
      if (activeSubmission === controller) activeSubmission = null
    }
  }

  return { isLoading, submit }
}

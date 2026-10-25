import { useEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import LoadingBar, { type LoadingBarRef } from 'react-top-loading-bar'

export function NavigationProgress() {
  const ref = useRef<LoadingBarRef>(null)
  const started = useRef(false)
  const pendingPage = useRouterState({
    select: (state) =>
      state.status === 'pending' &&
      state.location.pathname !== state.resolvedLocation?.pathname,
  })

  useEffect(() => {
    if (!pendingPage) {
      if (!started.current) return
      started.current = false
      ref.current?.complete()
      return
    }
    const timer = window.setTimeout(() => {
      started.current = true
      ref.current?.continuousStart()
    }, 160)
    return () => window.clearTimeout(timer)
  }, [pendingPage])

  return (
    <LoadingBar
      color='var(--muted-foreground)'
      ref={ref}
      shadow={false}
      height={2}
    />
  )
}

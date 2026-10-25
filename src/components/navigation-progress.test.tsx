import type { Ref } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavigationProgress } from './navigation-progress'

const progress = vi.hoisted(() => ({ start: vi.fn(), complete: vi.fn() }))
const routerState = vi.hoisted(() => ({
  status: 'idle',
  location: { pathname: '/documents' },
  resolvedLocation: { pathname: '/documents' },
}))

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: typeof routerState) => boolean
  }) => select(routerState),
}))
vi.mock('react-top-loading-bar', async () => {
  const { useImperativeHandle } = await import('react')
  return {
    default: function LoadingBar({ ref }: { ref: Ref<unknown> }) {
      useImperativeHandle(ref, () => ({
        continuousStart: progress.start,
        complete: progress.complete,
      }))
      return null
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  routerState.status = 'idle'
  routerState.location.pathname = '/documents'
  routerState.resolvedLocation.pathname = '/documents'
})
afterEach(() => vi.useRealTimers())

it('does not flash global progress for folders, tools, or version changes on the same page', () => {
  routerState.status = 'pending'
  const screen = render(<NavigationProgress />)
  act(() => vi.advanceTimersByTime(1000))
  routerState.status = 'idle'
  screen.rerender(<NavigationProgress />)
  expect(progress.start).not.toHaveBeenCalled()
  expect(progress.complete).not.toHaveBeenCalled()
})

it('does not flash a completion bar for a fast page navigation', () => {
  const screen = render(<NavigationProgress />)
  routerState.status = 'pending'
  routerState.location.pathname = '/settings'
  screen.rerender(<NavigationProgress />)
  act(() => vi.advanceTimersByTime(100))
  routerState.status = 'idle'
  screen.rerender(<NavigationProgress />)
  act(() => vi.advanceTimersByTime(1000))
  expect(progress.start).not.toHaveBeenCalled()
  expect(progress.complete).not.toHaveBeenCalled()
})

it('shows progress only for a slow page navigation and completes the started bar', () => {
  const screen = render(<NavigationProgress />)
  routerState.status = 'pending'
  routerState.location.pathname = '/settings'
  screen.rerender(<NavigationProgress />)
  act(() => vi.advanceTimersByTime(159))
  expect(progress.start).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(progress.start).toHaveBeenCalledOnce()
  routerState.status = 'idle'
  routerState.resolvedLocation.pathname = '/settings'
  screen.rerender(<NavigationProgress />)
  expect(progress.complete).toHaveBeenCalledOnce()
})

it('cancels an unstarted indicator when its component unmounts', () => {
  routerState.status = 'pending'
  routerState.location.pathname = '/settings'
  const screen = render(<NavigationProgress />)
  screen.unmount()
  act(() => vi.advanceTimersByTime(1000))
  expect(progress.start).not.toHaveBeenCalled()
})

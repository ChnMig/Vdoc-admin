import { createBrowserHistory } from '@tanstack/react-router'
import { Route } from '@/routes/share/$shareId'
import { afterEach, describe, expect, it, vi } from 'vitest'

const shareId = 'a'.repeat(32)
const secret = `vdoc_share_${'b'.repeat(48)}`
let browserHistory: ReturnType<typeof createBrowserHistory> | undefined

afterEach(() => {
  browserHistory?.destroy()
  browserHistory = undefined
  window.history.replaceState(null, '', '/')
})

describe('public share route capability consumption', () => {
  it('erases the fragment without notifying the router or changing history state', async () => {
    window.history.replaceState(
      { marker: 'current-navigation' },
      '',
      `/share/${shareId}?view=1#${secret}`
    )
    browserHistory = createBrowserHistory()
    const onNavigation = vi.fn()
    browserHistory.subscribe(onNavigation)
    const historyState = { ...window.history.state }

    const context = await Route.options.beforeLoad?.({} as never)

    expect(context?.shareSecret === secret).toBe(true)
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe(`/share/${shareId}`)
    expect(window.location.search).toBe('?view=1')
    expect(window.history.state).toEqual(historyState)
    expect(JSON.stringify(window.history.state).includes(secret)).toBe(false)
    expect(onNavigation).not.toHaveBeenCalled()
  })

  it('does not recover an erased capability when the page is loaded again', async () => {
    window.history.replaceState(null, '', `/share/${shareId}#${secret}`)
    browserHistory = createBrowserHistory()

    const initial = await Route.options.beforeLoad?.({} as never)
    const reloaded = await Route.options.beforeLoad?.({} as never)

    expect(initial?.shareSecret === secret).toBe(true)
    expect(reloaded?.shareSecret).toBeUndefined()
    expect(window.location.hash).toBe('')
  })
})

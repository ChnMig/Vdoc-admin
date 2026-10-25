import { StrictMode, Suspense } from 'react'
import { lazyRouteComponent } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

describe('lazy route React compatibility', () => {
  it('finishes a suspended route without dropping its use() call', async () => {
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    let resolveImport!: (value: { default: () => React.ReactNode }) => void
    const importer = vi.fn(
      () =>
        new Promise<{ default: () => React.ReactNode }>((resolve) => {
          resolveImport = resolve
        })
    )
    const LazyRoute = lazyRouteComponent(importer)

    try {
      await act(async () => {
        render(
          <StrictMode>
            <Suspense fallback={<p>Loading route</p>}>
              <LazyRoute />
            </Suspense>
          </StrictMode>
        )
      })
      expect(screen.getByText('Loading route')).toBeInTheDocument()

      await act(async () => {
        resolveImport({ default: () => <p>Loaded route</p> })
      })

      expect(await screen.findByText('Loaded route')).toBeInTheDocument()
      expect(importer).toHaveBeenCalledTimes(1)
      expect(errors.mock.calls.flat().join(' ')).not.toContain(
        'called use() to suspend'
      )
    } finally {
      errors.mockRestore()
    }
  })

  it('reuses a route import that completed before mounting', async () => {
    const importer = vi.fn(async () => ({
      default: () => <p>Preloaded route</p>,
    }))
    const LazyRoute = lazyRouteComponent(importer)
    await LazyRoute.preload?.()

    await act(async () => {
      render(
        <Suspense fallback={<p>Loading route</p>}>
          <LazyRoute />
        </Suspense>
      )
    })

    expect(screen.getByText('Preloaded route')).toBeInTheDocument()
    expect(importer).toHaveBeenCalledTimes(1)
  })
})

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownDocumentViewer } from '@/features/public-share/markdown-document-viewer'
import {
  MarkdownImageProvider,
  type MarkdownImageLoader,
} from './markdown-images'

const reference = `vdoc-asset:${'a'.repeat(64)}`
const createObjectURL = vi.fn(() => 'blob:managed-image')
const revokeObjectURL = vi.fn()
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('managed document image rendering', () => {
  it('loads managed images through the provided scope and never requests remote images', async () => {
    const loadImage = vi
      .fn()
      .mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    render(
      <MarkdownImageProvider loadImage={loadImage}>
        <MarkdownDocumentViewer
          content={`![Architecture](${reference})\n\n![remote](https://example.test/a.png)\n\n[invalid anchor](${reference})`}
        />
      </MarkdownImageProvider>
    )
    expect(
      await screen.findByRole('img', { name: 'Architecture' })
    ).toHaveAttribute('src', 'blob:managed-image')
    expect(
      screen.queryByRole('img', { name: 'remote' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'invalid anchor' })
    ).not.toBeInTheDocument()
    expect(loadImage).toHaveBeenCalledOnce()
    expect(loadImage.mock.calls[0][0]).toBe('a'.repeat(64))
  })
  it('aborts old scope requests and releases URLs when the share proof or account changes', async () => {
    let resolveOld!: (blob: Blob) => void
    const oldLoader: MarkdownImageLoader = vi.fn(
      (_id: string, _signal: AbortSignal) =>
        new Promise<Blob>((resolve) => {
          resolveOld = resolve
        })
    )
    const currentLoader = vi
      .fn()
      .mockResolvedValue(new Blob(['current'], { type: 'image/png' }))
    const ui = (loadImage: MarkdownImageLoader) => (
      <MarkdownImageProvider loadImage={loadImage}>
        <MarkdownDocumentViewer content={`![image](${reference})`} />
      </MarkdownImageProvider>
    )
    const view = render(ui(oldLoader))
    view.rerender(ui(currentLoader))
    await screen.findByRole('img')
    expect(vi.mocked(oldLoader).mock.calls[0][1].aborted).toBe(true)
    await act(async () => resolveOld(new Blob(['old'], { type: 'image/png' })))
    expect(createObjectURL).toHaveBeenCalledOnce()
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:managed-image')
  })
  it('shows a retryable localized failure without leaking a raw URL', async () => {
    const loadImage = vi.fn().mockRejectedValue(new Error('private details'))
    render(
      <MarkdownImageProvider loadImage={loadImage}>
        <MarkdownDocumentViewer content={`![diagram](${reference})`} />
      </MarkdownImageProvider>
    )
    await waitFor(() =>
      expect(screen.getByText(/Image could not be loaded/)).toBeVisible()
    )
    expect(screen.queryByText('private details')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})

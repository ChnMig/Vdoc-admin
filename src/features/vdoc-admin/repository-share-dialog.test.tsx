import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider } from '@/context/language-provider'
import { RepositoryShareDialog } from './repository-share-dialog'

const api = vi.hoisted(() => ({
  listRepositoryShares: vi.fn(),
  createRepositoryShare: vi.fn(),
  revealRepositoryShare: vi.fn(),
  revokeRepositoryShare: vi.fn(),
}))
vi.mock('@/lib/repository-share-api', () => api)
vi.mock('@/lib/public-share-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-share-config')>()),
  resolvePublicShareBaseUrl: () => 'https://docs.example.test',
}))

const result = {
  share: { id: 'a'.repeat(32) },
  secret: `vdoc_share_${'b'.repeat(48)}`,
}

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const panel = (releaseId = 'release-1') => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <RepositoryShareDialog
          projectId='project-1'
          documentId='document-1'
          releaseId={releaseId}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  return { client, panel }
}

describe('RepositoryShareDialog secret lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    document.cookie = `${LANGUAGE_COOKIE_NAME}=en; path=/`
    api.listRepositoryShares.mockResolvedValue({ items: [], total: 0 })
    api.createRepositoryShare.mockResolvedValue(result)
  })
  afterEach(cleanup)

  it('clears the capability and password when the dialog closes', async () => {
    const user = userEvent.setup()
    const { client, panel } = harness()
    const view = render(panel())
    await user.click(view.getByRole('button', { name: 'Share release' }))
    await user.type(
      view.getByLabelText('Access password (optional)'),
      'share-password-2026'
    )
    await user.click(view.getByRole('button', { name: 'Create share link' }))
    expect(await view.findByLabelText('Share link')).toHaveValue(
      `https://docs.example.test/share/${result.share.id}#${result.secret}`
    )
    expect(api.createRepositoryShare).toHaveBeenCalledWith(
      'project-1',
      'release-1',
      'document-1',
      { expiry_preset: '3_months', password: 'share-password-2026' }
    )
    expect(client.getMutationCache().getAll()).toHaveLength(0)
    await user.click(view.getByRole('button', { name: 'Close' }))
    await user.click(view.getByRole('button', { name: 'Share release' }))
    expect(view.queryByLabelText('Share link')).not.toBeInTheDocument()
    expect(view.getByLabelText('Access password (optional)')).toHaveValue('')
  })

  it('ignores a capability returned after switching the release', async () => {
    let resolve!: (value: typeof result) => void
    api.createRepositoryShare.mockReturnValueOnce(
      new Promise<typeof result>((done) => {
        resolve = done
      })
    )
    const user = userEvent.setup()
    const { panel } = harness()
    const view = render(panel())
    await user.click(view.getByRole('button', { name: 'Share release' }))
    await user.click(view.getByRole('button', { name: 'Create share link' }))
    await waitFor(() =>
      expect(api.createRepositoryShare).toHaveBeenCalledTimes(1)
    )
    view.rerender(panel('release-2'))
    await act(async () => {
      resolve(result)
    })
    await waitFor(() =>
      expect(api.listRepositoryShares).toHaveBeenCalledWith(
        'project-1',
        'release-2',
        'document-1',
        expect.any(Object)
      )
    )
    expect(view.queryByLabelText('Share link')).not.toBeInTheDocument()
    expect(
      view.getByRole('button', { name: 'Create share link' })
    ).toBeEnabled()
  })
})

import { clearCookies } from '@/test-utils/cookies'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDocumentShareSecret } from '@/lib/document-share-url'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider } from '@/context/language-provider'
import { PublicDocumentSharePage } from './public-document-share-page'

const publicShareApiMocks = vi.hoisted(() => ({
  downloadPublicShareVersion: vi.fn(),
  getPublicShareContent: vi.fn(),
  getPublicShareMetadata: vi.fn(),
  listPublicShareVersions: vi.fn(),
  savePublicShareDownload: vi.fn(),
  unlockPublicShare: vi.fn(),
}))

vi.mock('@/lib/public-share-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/public-share-api')>()
  return { ...actual, ...publicShareApiMocks }
})

vi.mock('./markdown-document-viewer', () => ({
  MarkdownDocumentViewer: ({ content }: { readonly content: string }) => (
    <article>{content}</article>
  ),
}))

const shareId = 'a'.repeat(32)
const secret = parseDocumentShareSecret(`vdoc_share_${'b'.repeat(48)}`)
const versionId = 'c'.repeat(32)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('PublicDocumentSharePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCookies(LANGUAGE_COOKIE_NAME)
    publicShareApiMocks.getPublicShareMetadata
      .mockRejectedValueOnce(new Error('password required'))
      .mockResolvedValue({
        document_name: 'Release policy',
        document_type: 2,
        version_scope: 1,
        current_version: {
          id: versionId,
          version_name: 'v1',
          published_at: '2026-01-01T00:00:00Z',
        },
      })
    publicShareApiMocks.unlockPublicShare.mockResolvedValue({
      unlock_proof: 'proof-1',
      expires_at: '2026-01-01T01:00:00Z',
    })
    publicShareApiMocks.getPublicShareContent.mockResolvedValue({
      version_id: versionId,
      content: 'Protected policy content',
    })
  })

  it('keeps an unlocked protected share open when the display language changes', async () => {
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    await screen.findByText('Enter the share password to continue.')
    await user.type(screen.getByLabelText('Share password'), '密码密码')
    await user.click(screen.getByRole('button', { name: 'Unlock document' }))

    expect(
      await screen.findByText('Protected policy content')
    ).toBeInTheDocument()
    expect(publicShareApiMocks.unlockPublicShare).toHaveBeenCalledWith(
      expect.objectContaining({ password: '密码密码' })
    )
    expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledWith(
      expect.objectContaining({ unlockProof: 'proof-1' })
    )

    await user.click(screen.getByRole('button', { name: 'Language: English' }))
    await user.click(screen.getByRole('menuitem', { name: /Chinese/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '语言：中文' })
      ).toBeInTheDocument()
    )
    expect(screen.getByText('Protected policy content')).toBeInTheDocument()
    expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(2)
    expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(1)
  })

  it('ignores stale version content responses that arrive out of order', async () => {
    const secondVersionId = 'd'.repeat(32)
    const thirdVersionId = 'e'.repeat(32)
    publicShareApiMocks.getPublicShareMetadata.mockReset()
    publicShareApiMocks.getPublicShareMetadata.mockResolvedValue({
      document_name: 'Release policy',
      document_type: 2,
      version_scope: 2,
      current_version: {
        id: versionId,
        version_name: 'v1',
        published_at: '2026-01-01T00:00:00Z',
      },
    })
    publicShareApiMocks.listPublicShareVersions.mockResolvedValue([
      {
        id: versionId,
        version_name: 'v1',
        published_at: '2026-01-01T00:00:00Z',
      },
      {
        id: secondVersionId,
        version_name: 'v2',
        published_at: '2026-01-02T00:00:00Z',
      },
      {
        id: thirdVersionId,
        version_name: 'v3',
        published_at: '2026-01-03T00:00:00Z',
      },
    ])
    const second = deferred<{ version_id: string; content: string }>()
    const third = deferred<{ version_id: string; content: string }>()
    publicShareApiMocks.getPublicShareContent.mockReset()
    publicShareApiMocks.getPublicShareContent
      .mockResolvedValueOnce({ version_id: versionId, content: 'Version one' })
      .mockImplementationOnce(() => second.promise)
      .mockImplementationOnce(() => third.promise)
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    expect(await screen.findByText('Version one')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Version'), secondVersionId)
    await user.selectOptions(screen.getByLabelText('Version'), thirdVersionId)

    act(() => {
      third.resolve({ version_id: thirdVersionId, content: 'Version three' })
    })
    expect(await screen.findByText('Version three')).toBeInTheDocument()

    act(() => {
      second.resolve({ version_id: secondVersionId, content: 'Version two' })
    })
    await waitFor(() => {
      expect(screen.getByText('Version three')).toBeInTheDocument()
      expect(screen.queryByText('Version two')).not.toBeInTheDocument()
    })
  })
})

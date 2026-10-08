import { clearCookies } from '@/test-utils/cookies'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseDocumentShareSecret } from '@/lib/document-share-url'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import {
  PublicShareRequestError,
  type PublicShareDownload,
} from '@/lib/public-share-api'
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
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('PublicDocumentSharePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearCookies(LANGUAGE_COOKIE_NAME)
    publicShareApiMocks.getPublicShareMetadata
      .mockRejectedValueOnce(
        new PublicShareRequestError(401, 'PASSWORD_REQUIRED')
      )
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

  it('coalesces rapid password unlock submissions', async () => {
    const unlock = deferred<{ unlock_proof: string; expires_at: string }>()
    publicShareApiMocks.unlockPublicShare.mockReset()
    publicShareApiMocks.unlockPublicShare.mockReturnValueOnce(unlock.promise)
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    await screen.findByText('Enter the share password to continue.')
    const passwordInput = screen.getByLabelText('Share password')
    await user.type(passwordInput, '密码密码')
    const form = passwordInput.closest('form')
    if (!form) throw new Error('missing public-share unlock form')

    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() =>
      expect(publicShareApiMocks.unlockPublicShare).toHaveBeenCalledOnce()
    )

    await act(async () => {
      unlock.resolve({
        unlock_proof: 'proof-1',
        expires_at: '2026-01-01T01:00:00Z',
      })
      await unlock.promise
    })
    expect(
      await screen.findByText('Protected policy content')
    ).toBeInTheDocument()
  })

  it('recovers an initial transient failure without asking for a password', async () => {
    publicShareApiMocks.getPublicShareMetadata.mockReset()
    publicShareApiMocks.getPublicShareMetadata
      .mockRejectedValueOnce(
        new PublicShareRequestError(408, 'REQUEST_TIMEOUT')
      )
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
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    await screen.findByText(
      'Check your connection and try again. The link and password have not been stored.'
    )
    expect(screen.queryByLabelText('Share password')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByText('Protected policy content')
    ).toBeInTheDocument()
    expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(2)
    expect(publicShareApiMocks.unlockPublicShare).not.toHaveBeenCalled()
  })

  it('shows invalid or revoked links as unavailable without a password form', async () => {
    publicShareApiMocks.getPublicShareMetadata.mockReset()
    publicShareApiMocks.getPublicShareMetadata.mockRejectedValueOnce(
      new PublicShareRequestError(404, 'NOT_FOUND')
    )
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    expect(
      await screen.findByText('This link is invalid, expired, or revoked.')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Share password')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Try again' })
    ).not.toBeInTheDocument()
  })

  it('ignores an older full-page retry that finishes after a newer retry', async () => {
    const olderVersionId = 'd'.repeat(32)
    const newerVersionId = 'e'.repeat(32)
    const older = deferred<{
      document_name: string
      document_type: number
      version_scope: number
      current_version: {
        id: string
        version_name: string
        published_at: string
      }
    }>()
    const newer = deferred<{
      document_name: string
      document_type: number
      version_scope: number
      current_version: {
        id: string
        version_name: string
        published_at: string
      }
    }>()
    publicShareApiMocks.getPublicShareMetadata.mockReset()
    publicShareApiMocks.getPublicShareMetadata
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise)
    publicShareApiMocks.getPublicShareContent.mockReset()
    publicShareApiMocks.getPublicShareContent.mockImplementation(
      async ({ versionId: requestedVersionId }: { versionId: string }) => ({
        version_id: requestedVersionId,
        content:
          requestedVersionId === newerVersionId
            ? 'Newer retry content'
            : 'Older retry content',
      })
    )
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    await screen.findByText(
      'Check your connection and try again. The link and password have not been stored.'
    )
    const retry = screen.getByRole('button', { name: 'Try again' })
    act(() => {
      retry.click()
      retry.click()
    })
    await waitFor(() =>
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        3
      )
    )

    act(() => {
      newer.resolve({
        document_name: 'Newer release policy',
        document_type: 2,
        version_scope: 1,
        current_version: {
          id: newerVersionId,
          version_name: 'v3',
          published_at: '2026-01-03T00:00:00Z',
        },
      })
    })
    expect(await screen.findByText('Newer retry content')).toBeInTheDocument()

    act(() => {
      older.resolve({
        document_name: 'Older release policy',
        document_type: 2,
        version_scope: 1,
        current_version: {
          id: olderVersionId,
          version_name: 'v2',
          published_at: '2026-01-02T00:00:00Z',
        },
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Newer retry content')).toBeInTheDocument()
      expect(screen.queryByText('Older retry content')).not.toBeInTheDocument()
    })
    expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(1)
  })

  it('keeps the current version visible when another version fails to load', async () => {
    const secondVersionId = 'd'.repeat(32)
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
    ])
    publicShareApiMocks.getPublicShareContent
      .mockReset()
      .mockResolvedValueOnce({ version_id: versionId, content: 'Version one' })
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        version_id: secondVersionId,
        content: 'Version two',
      })
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    expect(await screen.findByText('Version one')).toBeInTheDocument()
    const versionSelect = screen.getByLabelText('Version')
    await user.selectOptions(versionSelect, secondVersionId)

    expect(
      await screen.findByText(
        'That version could not be loaded. The previously opened version remains available.'
      )
    ).toBeInTheDocument()
    expect(versionSelect).toHaveValue(versionId)
    expect(screen.getByText('Version one')).toBeInTheDocument()
    expect(
      screen.queryByText('Enter the share password to continue.')
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Version two')).toBeInTheDocument()
    expect(versionSelect).toHaveValue(secondVersionId)
    expect(
      screen.getByText('v2', { selector: '[data-slot="badge"]' })
    ).toBeInTheDocument()
  })

  it('allows password re-entry when an in-memory unlock proof stops working', async () => {
    publicShareApiMocks.downloadPublicShareVersion.mockRejectedValueOnce(
      new PublicShareRequestError(401, 'PASSWORD_REQUIRED')
    )
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

    await user.click(screen.getByRole('button', { name: 'Download original' }))
    expect(
      await screen.findByText(
        'Your password session expired. Enter the password again to continue.'
      )
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Enter password again' })
    )

    expect(
      await screen.findByText('Enter the share password to continue.')
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Share password'), '密码密码')
    await user.click(screen.getByRole('button', { name: 'Unlock document' }))
    expect(
      await screen.findByText('Protected policy content')
    ).toBeInTheDocument()
    expect(publicShareApiMocks.unlockPublicShare).toHaveBeenCalledTimes(2)
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

  describe('latest-only publication recovery', () => {
    const newerVersionId = 'd'.repeat(32)
    const currentVersion = {
      id: versionId,
      version_name: 'v1',
      published_at: '2026-01-01T00:00:00Z',
    }
    const newerVersion = {
      id: newerVersionId,
      version_name: 'v2',
      published_at: '2026-01-02T00:00:00Z',
    }
    const currentMetadata = {
      document_name: 'Release policy',
      document_type: 2,
      version_scope: 1,
      current_version: currentVersion,
    }
    const recoverableMessage =
      'Check your connection and try again. The link and password have not been stored.'

    beforeEach(() => {
      publicShareApiMocks.getPublicShareMetadata.mockReset()
      publicShareApiMocks.getPublicShareMetadata.mockResolvedValue(
        currentMetadata
      )
      publicShareApiMocks.getPublicShareContent.mockReset()
      publicShareApiMocks.getPublicShareContent.mockRejectedValue(
        new PublicShareRequestError(404, 'NOT_FOUND')
      )
    })

    it('opens the new publication when the latest version moves after metadata loads', async () => {
      publicShareApiMocks.getPublicShareMetadata
        .mockResolvedValueOnce(currentMetadata)
        .mockResolvedValueOnce({
          ...currentMetadata,
          document_name: 'Updated release policy',
          current_version: newerVersion,
        })
      publicShareApiMocks.getPublicShareContent
        .mockRejectedValueOnce(new PublicShareRequestError(404, 'NOT_FOUND'))
        .mockResolvedValueOnce({
          version_id: newerVersionId,
          content: 'New publication content',
        })
      const screen = render(
        <LanguageProvider>
          <PublicDocumentSharePage shareId={shareId} secret={secret} />
        </LanguageProvider>
      )

      expect(
        await screen.findByText('New publication content')
      ).toBeInTheDocument()
      expect(screen.getByText('Updated release policy')).toBeInTheDocument()
      expect(
        screen.getByText('v2', { selector: '[data-slot="badge"]' })
      ).toBeInTheDocument()
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        2
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ versionId })
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ versionId: newerVersionId })
      )
      expect(publicShareApiMocks.listPublicShareVersions).not.toHaveBeenCalled()
      expect(
        screen.queryByText('This link is invalid, expired, or revoked.')
      ).not.toBeInTheDocument()
    })

    it('offers recovery without repeating content when refreshed metadata has the same version', async () => {
      const screen = render(
        <LanguageProvider>
          <PublicDocumentSharePage shareId={shareId} secret={secret} />
        </LanguageProvider>
      )

      expect(await screen.findByText(recoverableMessage)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Try again' })
      ).toBeInTheDocument()
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        2
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(1)
      expect(
        screen.queryByText('This link is invalid, expired, or revoked.')
      ).not.toBeInTheDocument()
    })

    it('limits automatic migration to one retry and permits a later manual retry', async () => {
      publicShareApiMocks.getPublicShareMetadata
        .mockResolvedValueOnce(currentMetadata)
        .mockResolvedValue({
          ...currentMetadata,
          current_version: newerVersion,
        })
      const user = userEvent.setup()
      const screen = render(
        <LanguageProvider>
          <PublicDocumentSharePage shareId={shareId} secret={secret} />
        </LanguageProvider>
      )

      expect(await screen.findByText(recoverableMessage)).toBeInTheDocument()
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        2
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(2)
      publicShareApiMocks.getPublicShareContent.mockResolvedValueOnce({
        version_id: newerVersionId,
        content: 'Recovered publication content',
      })
      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(
        await screen.findByText('Recovered publication content')
      ).toBeInTheDocument()
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        3
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(3)
    })

    it.each([
      ['NOT_FOUND', 404, 'This link is invalid, expired, or revoked.'],
      ['PASSWORD_REQUIRED', 401, 'Enter the share password to continue.'],
      ['REQUEST_TIMEOUT', 408, recoverableMessage],
    ] as const)(
      'handles %s from refreshed metadata as a share-level failure',
      async (status, code, message) => {
        publicShareApiMocks.getPublicShareMetadata
          .mockResolvedValueOnce(currentMetadata)
          .mockRejectedValueOnce(new PublicShareRequestError(code, status))
        const screen = render(
          <LanguageProvider>
            <PublicDocumentSharePage shareId={shareId} secret={secret} />
          </LanguageProvider>
        )

        expect(await screen.findByText(message)).toBeInTheDocument()
        expect(
          publicShareApiMocks.getPublicShareMetadata
        ).toHaveBeenCalledTimes(2)
        expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(
          1
        )
        if (status === 'NOT_FOUND') {
          expect(
            screen.queryByRole('button', { name: 'Try again' })
          ).not.toBeInTheDocument()
        }
        if (status === 'PASSWORD_REQUIRED') {
          expect(screen.getByLabelText('Share password')).toBeInTheDocument()
        }
      }
    )

    it('keeps an all-versions content miss recoverable without an automatic migration', async () => {
      publicShareApiMocks.getPublicShareMetadata.mockResolvedValue({
        ...currentMetadata,
        version_scope: 2,
      })
      publicShareApiMocks.listPublicShareVersions.mockResolvedValue([
        currentVersion,
        newerVersion,
      ])
      const screen = render(
        <LanguageProvider>
          <PublicDocumentSharePage shareId={shareId} secret={secret} />
        </LanguageProvider>
      )

      expect(await screen.findByText(recoverableMessage)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Try again' })
      ).toBeInTheDocument()
      expect(publicShareApiMocks.getPublicShareMetadata).toHaveBeenCalledTimes(
        1
      )
      expect(publicShareApiMocks.getPublicShareContent).toHaveBeenCalledTimes(1)
    })
  })

  it.each(['success', 'PASSWORD_REQUIRED', 'NETWORK_ERROR'])(
    'ignores an old download %s after reauthentication while a new download is pending',
    async (completion) => {
      const secondVersionId = 'd'.repeat(32)
      const olderDownload = deferred<PublicShareDownload>()
      const newerDownload = deferred<PublicShareDownload>()
      const currentVersion = {
        id: versionId,
        version_name: 'v1',
        published_at: '2026-01-01T00:00:00Z',
      }
      publicShareApiMocks.getPublicShareMetadata.mockResolvedValue({
        document_name: 'Release policy',
        document_type: 2,
        version_scope: 2,
        current_version: currentVersion,
      })
      publicShareApiMocks.listPublicShareVersions.mockResolvedValue([
        currentVersion,
        { ...currentVersion, id: secondVersionId, version_name: 'v2' },
      ])
      publicShareApiMocks.unlockPublicShare
        .mockResolvedValueOnce({
          unlock_proof: 'proof-1',
          expires_at: '2026-01-01T01:00:00Z',
        })
        .mockResolvedValueOnce({
          unlock_proof: 'proof-2',
          expires_at: '2026-01-01T02:00:00Z',
        })
      publicShareApiMocks.getPublicShareContent
        .mockResolvedValueOnce({
          version_id: versionId,
          content: 'First unlocked content',
        })
        .mockRejectedValueOnce(
          new PublicShareRequestError(401, 'PASSWORD_REQUIRED')
        )
        .mockResolvedValueOnce({
          version_id: versionId,
          content: 'Newly unlocked content',
        })
      publicShareApiMocks.downloadPublicShareVersion
        .mockReturnValueOnce(olderDownload.promise)
        .mockReturnValueOnce(newerDownload.promise)
      const user = userEvent.setup()
      const screen = render(
        <LanguageProvider>
          <PublicDocumentSharePage shareId={shareId} secret={secret} />
        </LanguageProvider>
      )

      await screen.findByLabelText('Share password')
      await user.type(screen.getByLabelText('Share password'), '密码密码')
      await user.click(screen.getByRole('button', { name: 'Unlock document' }))
      await screen.findByText('First unlocked content')
      await user.click(
        screen.getByRole('button', { name: 'Download original' })
      )
      expect(
        publicShareApiMocks.downloadPublicShareVersion
      ).toHaveBeenCalledWith(
        expect.objectContaining({ unlockProof: 'proof-1' })
      )
      await user.selectOptions(
        screen.getByLabelText('Version'),
        secondVersionId
      )
      await screen.findByText(
        'Your password session expired. Enter the password again to continue.'
      )
      await user.click(
        screen.getByRole('button', { name: 'Enter password again' })
      )
      await screen.findByLabelText('Share password')
      await user.type(screen.getByLabelText('Share password'), '密码密码')
      await user.click(screen.getByRole('button', { name: 'Unlock document' }))
      await screen.findByText('Newly unlocked content')
      expect(
        publicShareApiMocks.getPublicShareContent
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({ unlockProof: 'proof-2' })
      )
      await user.click(
        screen.getByRole('button', { name: 'Download original' })
      )
      expect(
        publicShareApiMocks.downloadPublicShareVersion
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({ unlockProof: 'proof-2' })
      )
      expect(
        screen.getByRole('button', { name: 'Preparing download…' })
      ).toBeDisabled()

      await act(async () => {
        if (completion === 'success') {
          olderDownload.resolve({
            blob: new Blob(['old']),
            filename: 'old.md',
            mimeType: 'text/markdown',
          })
        } else {
          olderDownload.reject(
            completion === 'PASSWORD_REQUIRED'
              ? new PublicShareRequestError(401, completion)
              : new Error('network error')
          )
        }
        await olderDownload.promise.catch(() => undefined)
      })
      expect(publicShareApiMocks.savePublicShareDownload).not.toHaveBeenCalled()
      expect(screen.getByText('Newly unlocked content')).toBeInTheDocument()
      expect(
        screen.queryByText(
          'Your password session expired. Enter the password again to continue.'
        )
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('The original file could not be downloaded.')
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Preparing download…' })
      ).toBeDisabled()
      expect(
        publicShareApiMocks.downloadPublicShareVersion
      ).toHaveBeenCalledTimes(2)

      const savedDownload = {
        blob: new Blob(['new']),
        filename: 'new.md',
        mimeType: 'text/markdown',
      }
      await act(async () => {
        newerDownload.resolve(savedDownload)
        await newerDownload.promise
      })
      expect(publicShareApiMocks.savePublicShareDownload).toHaveBeenCalledOnce()
      expect(publicShareApiMocks.savePublicShareDownload).toHaveBeenCalledWith(
        savedDownload
      )
      expect(
        screen.getByRole('button', { name: 'Download original' })
      ).toBeEnabled()
    }
  )

  it('preserves the error and allows retry for a current download network failure', async () => {
    publicShareApiMocks.downloadPublicShareVersion
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        blob: new Blob(['current']),
        filename: 'current.md',
        mimeType: 'text/markdown',
      })
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <PublicDocumentSharePage shareId={shareId} secret={secret} />
      </LanguageProvider>
    )

    await screen.findByLabelText('Share password')
    await user.type(screen.getByLabelText('Share password'), '密码密码')
    await user.click(screen.getByRole('button', { name: 'Unlock document' }))
    await screen.findByText('Protected policy content')
    await user.click(screen.getByRole('button', { name: 'Download original' }))
    expect(
      await screen.findByText('The original file could not be downloaded.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Download original' })
    ).toBeEnabled()
    expect(publicShareApiMocks.downloadPublicShareVersion).toHaveBeenCalledWith(
      expect.objectContaining({ unlockProof: 'proof-1' })
    )
    await user.click(screen.getByRole('button', { name: 'Download original' }))
    expect(publicShareApiMocks.savePublicShareDownload).toHaveBeenCalledOnce()
  })
})

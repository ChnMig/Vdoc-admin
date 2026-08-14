import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BranchDTO, VersionDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentSharePanel } from './document-share-panel'

const shareApiMocks = vi.hoisted(() => ({
  createDocumentShare: vi.fn(),
  listDocumentShares: vi.fn(),
  revealDocumentShare: vi.fn(),
  revokeDocumentShare: vi.fn(),
}))

vi.mock('@/lib/document-share-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/document-share-api')>()
  return { ...actual, ...shareApiMocks }
})

const branch: BranchDTO = {
  id: 'branch-1',
  document_id: 'document-1',
  name: 'main',
  kind: 1,
  is_default: true,
  is_protected: false,
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const activeShare = {
  id: 'a'.repeat(32),
  project_id: 'project-1',
  document_id: 'document-1',
  branch_id: branch.id,
  version_scope: 1,
  status: 1,
  password_protected: true,
  expires_at: '2026-10-01T00:00:00Z',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const version: VersionDTO = {
  id: 'version-1',
  project_id: 'project-1',
  document_id: 'document-1',
  branch_id: branch.id,
  draft_id: 'draft-1',
  version_name: '1.0.0',
  document_format: 3,
  source_type: 1,
  status: 1,
  published_by: 'user-1',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  )
  return { queryClient, wrap }
}

function panel(
  projectId = 'project-1',
  documentId = 'document-1',
  options: {
    branches?: readonly BranchDTO[]
    versions?: readonly VersionDTO[]
    interactive?: boolean
  } = {}
) {
  return (
    <DocumentSharePanel
      key={`${projectId}:${documentId}`}
      projectId={projectId}
      documentId={documentId}
      branches={options.branches ?? [branch]}
      versions={options.versions ?? [version]}
      canManage
      interactive={options.interactive ?? true}
    />
  )
}

describe('DocumentSharePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shareApiMocks.listDocumentShares.mockResolvedValue({ items: [], total: 0 })
    shareApiMocks.createDocumentShare.mockResolvedValue({
      share: activeShare,
      secret: `vdoc_share_${'b'.repeat(48)}`,
    })
    shareApiMocks.revokeDocumentShare.mockResolvedValue({
      ...activeShare,
      status: 2,
    })
  })

  it('creates a share with the three-month default and a valid CJK byte password', async () => {
    const user = userEvent.setup()
    const { wrap } = createHarness()
    const screen = render(wrap(panel()))

    expect(screen.getByLabelText('Expiry')).toHaveValue('3_months')
    await user.selectOptions(
      screen.getByLabelText('Published branch'),
      branch.id
    )
    await user.type(
      screen.getByLabelText('Optional password (12–72 bytes)'),
      '密码密码'
    )
    await user.click(screen.getByRole('button', { name: 'Create share link' }))

    await waitFor(() =>
      expect(shareApiMocks.createDocumentShare).toHaveBeenCalledWith(
        'project-1',
        'document-1',
        {
          branch_id: branch.id,
          version_scope: 1,
          expiry_preset: '3_months',
          password: '密码密码',
        }
      )
    )
  })

  it('offers only active branches that have a published version', async () => {
    const archived = {
      ...branch,
      id: 'branch-archived',
      name: 'archived',
      status: 2,
    }
    const unpublished = {
      ...branch,
      id: 'branch-unpublished',
      name: 'unpublished',
    }
    const { wrap } = createHarness()
    const screen = render(
      wrap(
        panel('project-1', 'document-1', {
          branches: [branch, archived, unpublished],
          versions: [
            version,
            { ...version, id: 'version-2', branch_id: archived.id },
          ],
        })
      )
    )
    const branchSelect = screen.getByLabelText('Published branch')

    expect(
      within(branchSelect).getByRole('option', { name: 'main' })
    ).toBeInTheDocument()
    expect(
      within(branchSelect).queryByRole('option', { name: 'archived' })
    ).not.toBeInTheDocument()
    expect(
      within(branchSelect).queryByRole('option', { name: 'unpublished' })
    ).not.toBeInTheDocument()
  })

  it('keeps list and revoke available while archived, without create or reveal', async () => {
    shareApiMocks.listDocumentShares.mockResolvedValue({
      items: [activeShare],
      total: 1,
    })
    const user = userEvent.setup()
    const { wrap } = createHarness()
    const screen = render(
      wrap(panel('project-1', 'document-1', { interactive: false }))
    )

    expect(
      await screen.findByText('Archived context is read-only')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Published branch')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Show link' })
    ).toBeDisabled()
    expect(shareApiMocks.createDocumentShare).not.toHaveBeenCalled()
    expect(shareApiMocks.revealDocumentShare).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Revoke',
      })
    )
    await waitFor(() =>
      expect(shareApiMocks.revokeDocumentShare).toHaveBeenCalledWith(
        'project-1',
        'document-1',
        activeShare.id
      )
    )
  })

  it('renders expired shares as expired rather than revoked', async () => {
    shareApiMocks.listDocumentShares.mockResolvedValue({
      items: [{ ...activeShare, status: 3 }],
      total: 1,
    })
    const { wrap } = createHarness()
    const screen = render(wrap(panel()))

    expect(await screen.findByText('Expired')).toBeInTheDocument()
    expect(screen.queryByText('Revoked')).not.toBeInTheDocument()
  })

  it('drops the capability link when the project or document context changes', async () => {
    const user = userEvent.setup()
    const { wrap } = createHarness()
    const screen = render(wrap(panel()))

    await user.selectOptions(
      screen.getByLabelText('Published branch'),
      branch.id
    )
    await user.click(screen.getByRole('button', { name: 'Create share link' }))
    expect(await screen.findByText(/vdoc_share_/)).toBeInTheDocument()

    screen.rerender(wrap(panel('project-2', 'document-2')))

    expect(screen.queryByText(/vdoc_share_/)).not.toBeInTheDocument()
  })

  it('shows a recoverable message when copying the capability link fails', async () => {
    const user = userEvent.setup()
    const { wrap } = createHarness()
    const screen = render(wrap(panel()))

    await user.selectOptions(
      screen.getByLabelText('Published branch'),
      branch.id
    )
    await user.click(screen.getByRole('button', { name: 'Create share link' }))
    expect(await screen.findByText(/vdoc_share_/)).toBeInTheDocument()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    const message = await screen.findByText(
      'The share link could not be copied. Select and copy it manually.'
    )
    expect(message).toHaveAttribute('role', 'status')
    writeText.mockRestore()
  })

  it('requires an irreversible-action confirmation before revoking a share', async () => {
    shareApiMocks.listDocumentShares.mockResolvedValue({
      items: [activeShare],
      total: 1,
    })
    const user = userEvent.setup()
    const { wrap } = createHarness()
    const screen = render(wrap(panel()))

    const revokeButton = await screen.findByRole('button', { name: 'Revoke' })
    await user.click(revokeButton)
    let dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText('This action is irreversible.', {
        exact: false,
      })
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(shareApiMocks.revokeDocumentShare).not.toHaveBeenCalled()

    await user.click(revokeButton)
    dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    await waitFor(() =>
      expect(shareApiMocks.revokeDocumentShare).toHaveBeenCalledWith(
        'project-1',
        'document-1',
        activeShare.id
      )
    )
  })
})

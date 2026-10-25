import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BranchDTO, DocumentDTO, VersionDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspaceShare } from './document-workspace-share'

const apiMocks = vi.hoisted(() => ({
  getVersion: vi.fn(),
  getDocumentOverview: vi.fn(),
  listBranches: vi.fn(),
  listDocumentShares: vi.fn(),
  createDocumentShare: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  getVersion: apiMocks.getVersion,
  getDocumentOverview: apiMocks.getDocumentOverview,
  listBranches: apiMocks.listBranches,
}))

vi.mock('@/lib/document-share-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/document-share-api')>()),
  listDocumentShares: apiMocks.listDocumentShares,
  createDocumentShare: apiMocks.createDocumentShare,
}))

const document: DocumentDTO = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'API guide',
  document_type: 3,
  latest_version_id: 'version-latest',
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const branch: BranchDTO = {
  id: 'branch-selected',
  document_id: document.id,
  name: 'release-guide',
  kind: 2,
  is_default: false,
  is_protected: false,
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const version: VersionDTO = {
  id: 'version-selected',
  project_id: document.project_id,
  document_id: document.id,
  branch_id: branch.id,
  draft_id: 'draft-1',
  version_name: '1.2.0',
  document_format: 3,
  source_type: 1,
  status: 1,
  published_by: 'user-1',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function createHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (children: ReactNode) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  )
}

function share(
  options: {
    selectedVersionId?: string | null
    selectedBranchId?: string
    canManage?: boolean
    embedded?: boolean
  } = {}
) {
  return (
    <DocumentWorkspaceShare
      projectId={document.project_id}
      document={document}
      canManage={options.canManage ?? true}
      interactive
      selectedVersionId={options.selectedVersionId}
      selectedBranchId={options.selectedBranchId}
      embedded={options.embedded}
    />
  )
}

describe('DocumentWorkspaceShare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getVersion.mockResolvedValue(version)
    apiMocks.getDocumentOverview.mockResolvedValue({
      version_count: 2,
      endpoint_count: 0,
      latest_version: { ...version, id: document.latest_version_id },
      published_branch_ids: [branch.id],
      has_reviewed_draft: false,
      raw_size_bytes: 1,
      raw_line_count: 1,
    })
    apiMocks.listBranches.mockResolvedValue({ items: [branch], total: 1 })
    apiMocks.listDocumentShares.mockResolvedValue({ items: [], total: 0 })
    apiMocks.createDocumentShare.mockResolvedValue({
      share: { id: 'a'.repeat(32) },
      secret: `vdoc_share_${'b'.repeat(48)}`,
    })
  })

  it('creates a fixed link for the displayed version and its branch instead of the latest publication', async () => {
    const user = userEvent.setup()
    const wrap = createHarness()
    const screen = render(
      wrap(
        share({ selectedVersionId: version.id, selectedBranchId: branch.id })
      )
    )

    await user.click(
      await screen.findByRole('button', { name: 'Create share link' })
    )

    expect(apiMocks.getVersion).toHaveBeenCalledWith(
      document.project_id,
      document.id,
      version.id,
      { signal: expect.any(AbortSignal) }
    )
    await waitFor(() =>
      expect(apiMocks.createDocumentShare).toHaveBeenCalledWith(
        document.project_id,
        document.id,
        {
          branch_id: branch.id,
          version_scope: 3,
          version_id: version.id,
          expiry_preset: '3_months',
          password: '',
        }
      )
    )
    expect(screen.getByText('release-guide')).toBeInTheDocument()
    expect(screen.getByText('1.2.0')).toBeInTheDocument()
  })

  it('passes the embedded presentation through to the production share panel', async () => {
    const wrap = createHarness()
    const screen = render(
      wrap(share({ selectedVersionId: version.id, embedded: true }))
    )

    expect(
      await screen.findByRole('button', { name: 'Create share link' })
    ).toBeEnabled()
    expect(screen.queryByText('Public sharing')).not.toBeInTheDocument()
    expect(screen.getByText('Sharing this version')).toBeInTheDocument()
    expect(
      screen.container.querySelector('[data-slot="card"]')
    ).not.toBeInTheDocument()
  })

  it.each([
    ['different ID', { id: 'version-other' }],
    ['different project', { project_id: 'project-other' }],
    ['different document', { document_id: 'document-other' }],
    ['different branch', { branch_id: 'branch-other' }],
    ['withdrawn publication', { status: 2 }],
  ])(
    'rejects a %s returned for the selected version',
    async (_label, overrides) => {
      apiMocks.getVersion.mockResolvedValue({ ...version, ...overrides })
      const wrap = createHarness()
      const screen = render(
        wrap(
          share({ selectedVersionId: version.id, selectedBranchId: branch.id })
        )
      )

      expect(
        await screen.findByText('This version cannot be shared')
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Create share link' })
      ).not.toBeInTheDocument()
      expect(apiMocks.createDocumentShare).not.toHaveBeenCalled()
    }
  )

  it('does not fall back to the latest publication while displaying a draft', async () => {
    const wrap = createHarness()
    const screen = render(
      wrap(share({ selectedVersionId: null, selectedBranchId: branch.id }))
    )

    expect(
      await screen.findByText('Publish before sharing')
    ).toBeInTheDocument()
    expect(apiMocks.getVersion).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Create share link' })
    ).not.toBeInTheDocument()
  })

  it('defaults older call sites to the document latest version', async () => {
    apiMocks.getVersion.mockResolvedValue({
      ...version,
      id: document.latest_version_id,
    })
    const wrap = createHarness()
    const screen = render(wrap(share()))

    expect(
      await screen.findByRole('button', { name: 'Create share link' })
    ).toBeEnabled()
    expect(apiMocks.getVersion).toHaveBeenCalledWith(
      document.project_id,
      document.id,
      document.latest_version_id,
      { signal: expect.any(AbortSignal) }
    )
  })

  it('blocks creation until the selected version loads, then retries a failed lookup', async () => {
    apiMocks.getVersion.mockRejectedValueOnce(new Error('Version unavailable'))
    const user = userEvent.setup()
    const wrap = createHarness()
    const screen = render(wrap(share({ selectedVersionId: version.id })))

    expect(
      screen.queryByRole('button', { name: 'Create share link' })
    ).not.toBeInTheDocument()
    expect(await screen.findByText('Version unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('button', { name: 'Create share link' })
    ).toBeEnabled()
    expect(apiMocks.getVersion).toHaveBeenCalledTimes(2)
  })

  it('ignores a late lookup from the previous selected version', async () => {
    let resolve!: (value: VersionDTO) => void
    const pending = new Promise<VersionDTO>((next) => {
      resolve = next
    })
    apiMocks.getVersion.mockReturnValueOnce(pending)
    const wrap = createHarness()
    const screen = render(wrap(share({ selectedVersionId: version.id })))
    screen.rerender(wrap(share({ selectedVersionId: null })))
    expect(
      await screen.findByText('Publish before sharing')
    ).toBeInTheDocument()
    await act(async () => {
      resolve(version)
      await pending
    })

    expect(screen.getByText('Publish before sharing')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create share link' })
    ).not.toBeInTheDocument()
  })

  it('does not request private share dependencies without management permission', () => {
    const wrap = createHarness()
    const screen = render(
      wrap(share({ selectedVersionId: version.id, canManage: false }))
    )

    expect(screen.container).toBeEmptyDOMElement()
    expect(apiMocks.getVersion).not.toHaveBeenCalled()
    expect(apiMocks.getDocumentOverview).not.toHaveBeenCalled()
    expect(apiMocks.listBranches).not.toHaveBeenCalled()
    expect(apiMocks.listDocumentShares).not.toHaveBeenCalled()
  })
})

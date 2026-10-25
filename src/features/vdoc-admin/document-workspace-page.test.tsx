import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { selectOption } from '@/test/select-option'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import type {
  BranchDTO,
  DocumentDTO,
  DocumentFolderDTO,
  DraftDTO,
  ProjectDTO,
  VersionDTO,
} from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentFileTree } from './document-file-tree'
import { DocumentWorkspacePage } from './document-workspace-page'
import { ContextSelectorGrid, PageChrome } from './page-shared'
import { WorkspaceEmbedding } from './workspace-embedding'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentFolders: vi.fn(),
  listProjectMembers: vi.fn(),
  createDocumentFolder: vi.fn(),
  listBranches: vi.fn(),
  listVersions: vi.fn(),
  listDrafts: vi.fn(),
  getVersion: vi.fn(),
  getVersionContent: vi.fn(),
  getDraftContent: vi.fn(),
  getAISummary: vi.fn(),
  listAIChatSessions: vi.fn(),
}))
const panes = vi.hoisted(() => ({ realVersions: false }))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
}))
vi.mock('@/components/search', () => ({ Search: () => null }))
vi.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }))
vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))
vi.mock('./drafts-page', () => ({
  DraftsPage: ({ search }: { search?: VdocRouteSearch }) => (
    <section>
      <p>Draft pane {search?.draft_id}</p>
      <input aria-label='Working draft text' defaultValue='' />
    </section>
  ),
}))
vi.mock('./versions-page', async (load) => {
  const actual = await load<typeof import('./versions-page')>()
  return {
    VersionsPage: (props: Parameters<typeof actual.VersionsPage>[0]) =>
      panes.realVersions ? (
        <actual.VersionsPage {...props} />
      ) : (
        <section>Version pane {props?.search?.version_id}</section>
      ),
  }
})
vi.mock('./diffs-page', () => ({
  DiffsPage: ({ search }: { search?: VdocRouteSearch }) => (
    <section>Diff pane {search?.diff_id}</section>
  ),
}))

const project = (id: string, team_id: string): ProjectDTO => ({
  id,
  team_id,
  team_name: team_id === 'team-1' ? 'Product team' : 'Other team',
  name: id === 'project-1' ? 'Product docs' : 'Other docs',
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})
const document = (id: string, name: string): DocumentDTO => ({
  id,
  project_id: 'project-1',
  name,
  file_name: `${id}.txt`,
  document_type: 3,
  folder_id: null,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})
const documents: DocumentDTO[] = [
  {
    ...document('published', 'Published guide'),
    workflow_state: 'published',
    has_draft: true,
    latest_version_id: 'version-1',
    latest_draft_id: 'draft-new',
  },
  {
    ...document('draft-only', 'Draft guide'),
    workflow_state: 'draft',
    latest_draft_id: 'draft-1',
  },
  { ...document('empty', 'Empty guide'), workflow_state: 'empty' },
]

const branch = (documentId: string, id = 'branch-1'): BranchDTO => ({
  id,
  document_id: documentId,
  name: id === 'branch-1' ? 'main' : 'release/2026',
  kind: 2,
  is_default: id === 'branch-1',
  is_protected: false,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})
const draft = (
  id: string,
  documentId = 'published',
  branchId = 'branch-1'
): DraftDTO => ({
  id,
  revision: `${id}-revision`,
  review_revision: '',
  project_id: 'project-1',
  document_id: documentId,
  branch_id: branchId,
  version_name: `${id} name`,
  document_format: 3,
  source_type: 1,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})
const version = (id: string, branchId = 'branch-1'): VersionDTO => ({
  id,
  project_id: 'project-1',
  document_id: 'published',
  branch_id: branchId,
  version_name:
    id === 'version-1'
      ? 'v2 latest'
      : id === 'version-0'
        ? 'v1 historical'
        : 'release v3',
  document_format: 3,
  source_type: 1,
  draft_id: `${id}-draft`,
  status: 1,
  published_by: 'user-1',
  published_at: '',
  created_at: '',
  updated_at: '',
})
const versions = [
  version('version-1'),
  version('version-0'),
  version('version-release', 'branch-2'),
]
const drafts = [
  draft('draft-new'),
  draft('exact-draft'),
  draft('draft-release', 'published', 'branch-2'),
  draft('draft-1', 'draft-only'),
]
const clients: QueryClient[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolveValue) => {
    resolve = resolveValue
  })
  return { promise, resolve }
}

function renderWorkspace(
  initialSearch: VdocRouteSearch = {
    team_id: 'team-1',
    project_id: 'project-1',
  },
  defaultView?: 'drafts' | 'versions' | 'diffs'
) {
  const changes = vi.fn()
  function Harness() {
    const [search, setSearch] = useState(initialSearch)
    return (
      <>
        <button onClick={() => setSearch(initialSearch)}>Restore URL</button>
        <DocumentWorkspacePage
          search={search}
          defaultView={defaultView}
          onSearchChange={(patch, options) => {
            changes(patch, options)
            setSearch((current) => ({ ...current, ...patch }))
          }}
        />
      </>
    )
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return {
    ...render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <Harness />
        </LanguageProvider>
      </QueryClientProvider>
    ),
    changes,
    client,
  }
}

describe('document workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    panes.realVersions = false
    useVdocContextStore.getState().reset()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    useAuthStore.setState({
      auth: {
        ...useAuthStore.getState().auth,
        user: {
          id: 'user-1',
          name: 'Admin',
          email: 'admin@example.test',
          is_super_admin: true,
          can_access_audit: true,
          status: 1,
        },
      },
    })
    api.listProjects.mockResolvedValue({
      items: [project('project-1', 'team-1'), project('project-2', 'team-2')],
      total: 2,
    })
    api.listDocuments.mockImplementation(async (id: string) => ({
      items:
        id === 'project-1'
          ? documents
          : [{ ...document('other', 'Other file'), project_id: id }],
      total: id === 'project-1' ? documents.length : 1,
    }))
    api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.listBranches.mockImplementation(
      async (_project: string, documentId: string) => ({
        items: [branch(documentId), branch(documentId, 'branch-2')],
        total: 2,
      })
    )
    api.listVersions.mockImplementation(
      async (_project: string, documentId: string, branchId: string) => {
        const items = versions.filter(
          (item) =>
            item.document_id === documentId && item.branch_id === branchId
        )
        return { items, total: items.length }
      }
    )
    api.listDrafts.mockImplementation(
      async (_project: string, documentId: string, branchId: string) => {
        const items = drafts.filter(
          (item) =>
            item.document_id === documentId && item.branch_id === branchId
        )
        return { items, total: items.length }
      }
    )
    api.getVersion.mockImplementation(
      async (_project: string, _document: string, id: string) => {
        const found = versions.find((item) => item.id === id)
        if (!found) throw new Error('Version not found')
        return found
      }
    )
    api.getVersionContent.mockImplementation(
      async (_project: string, _document: string, id: string) => ({
        content:
          id === 'version-0'
            ? 'Historical body exact\n'
            : id === 'version-release'
              ? 'Release branch body\n'
              : 'Published <literal>\r\ntext\n',
      })
    )
    api.getDraftContent.mockImplementation(
      async (_project: string, _document: string, id: string) => {
        const found = drafts.find((item) => item.id === id)
        if (!found) throw new Error('Draft not found')
        return {
          draft: found,
          content:
            id === 'draft-release' ? 'Release draft body\n' : 'Private draft\n',
        }
      }
    )
  })

  afterEach(() => {
    cleanup()
    for (const client of clients) client.clear()
    clients.length = 0
  })

  it('shows file states without per-file detail fetches and reads published content first', async () => {
    const screen = renderWorkspace()
    const tree = await screen.findByRole('navigation', { name: 'Files' })
    expect(within(tree).getByText('Published')).toBeInTheDocument()
    expect(within(tree).getByText('Draft')).toBeInTheDocument()
    expect(within(tree).getByText('Empty')).toBeInTheDocument()
    expect(api.getVersionContent).not.toHaveBeenCalled()
    expect(api.getDraftContent).not.toHaveBeenCalled()
    await userEvent.click(
      within(tree).getByRole('button', { name: /published.txt/ })
    )
    expect(
      await screen.findByText('Published <literal> text')
    ).toBeInTheDocument()
    expect(api.getVersionContent).toHaveBeenCalledWith(
      'project-1',
      'published',
      'version-1',
      'raw',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(api.getDraftContent).not.toHaveBeenCalled()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.container.querySelector('literal')).toBeNull()
    expect(screen.changes).toHaveBeenLastCalledWith(
      expect.objectContaining({
        document_id: 'published',
        workspace_view: 'content',
      }),
      { replace: false }
    )
  })

  it('opens a draft in the selected branch without falling back to the document latest draft', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      branch_id: 'branch-2',
    })
    await screen.findByText('Release branch body')
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }))
    expect(await screen.findByText('Draft pane draft-release')).toBeVisible()
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        workspace_view: 'drafts',
        content_mode: 'draft',
        version_id: undefined,
        branch_id: 'branch-2',
        draft_id: undefined,
      },
      { replace: false }
    )
  })

  it('reads only the authorized draft when no published content exists, and makes empty files actionable', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'draft-only',
    })
    expect(await screen.findByText('Private draft')).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Content state' })
    ).toHaveTextContent('Draft')
    expect(api.getVersionContent).not.toHaveBeenCalled()
    const tree = screen.getByRole('navigation', { name: 'Files' })
    await userEvent.click(
      within(tree).getByRole('button', { name: /empty.txt/ })
    )
    expect(
      await screen.findByText('This branch has no published version yet.', {
        selector: 'p',
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit draft' })).toBeEnabled()
  })

  it('clears subordinate IDs when changing team and never carries the old file into another project', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      content_mode: 'published',
      branch_id: 'branch-1',
      draft_id: 'draft-1',
      version_id: 'version-1',
      endpoint_id: 'endpoint-1',
      from_version_id: 'v0',
      to_version_id: 'v1',
      diff_id: 'diff-1',
    })
    await screen.findByText('Published <literal> text')
    await selectOption(screen.getByRole('combobox', { name: 'Team' }), 'team-2')
    expect(await screen.findByText('Other file')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Published guide' })
    ).not.toBeInTheDocument()
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        team_id: 'team-2',
        content_mode: undefined,
        project_id: 'project-2',
        folder_id: undefined,
        workspace_view: 'content',
        document_id: undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      },
      { replace: false }
    )
    expect(
      api.listDocuments.mock.calls.some(([id]) => id === 'project-2')
    ).toBe(true)
  })

  it('rejects a project belonging to another team instead of falling back to a cached scope', async () => {
    const screen = renderWorkspace({
      team_id: 'team-2',
      project_id: 'project-1',
      document_id: 'published',
    })
    expect(
      await screen.findByText(
        'The selected team, project, folder, or file is unavailable.'
      )
    ).toBeInTheDocument()
    expect(api.listDocuments).not.toHaveBeenCalled()
    expect(api.getVersionContent).not.toHaveBeenCalled()
  })

  it('reads the exact historical revision selected at the top and restores it from the URL', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      version_id: 'version-0',
      content_mode: 'published',
    })
    expect(await screen.findByText('Historical body exact')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Version' })).toHaveTextContent(
      'v1 historical'
    )
    expect(api.getVersionContent).toHaveBeenCalledWith(
      'project-1',
      'published',
      'version-0',
      'raw',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
    await selectOption(
      screen.getByRole('combobox', { name: 'Version' }),
      'version-1'
    )
    expect(await screen.findByText('Published <literal> text')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Restore URL' }))
    expect(await screen.findByText('Historical body exact')).toBeVisible()
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
  })

  it('keeps a branch without versions empty instead of reading another branch latest version', async () => {
    api.listVersions.mockImplementation(
      async (_project: string, _document: string, branchId: string) => ({
        items:
          branchId === 'branch-1'
            ? versions.filter((item) => item.branch_id === branchId)
            : [],
        total: branchId === 'branch-1' ? 2 : 0,
      })
    )
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
    })
    await screen.findByText('Published <literal> text')
    const priorContentCalls = api.getVersionContent.mock.calls.length
    await selectOption(
      screen.getByRole('combobox', { name: 'Branch' }),
      'branch-2'
    )
    expect(
      await screen.findByText('This branch has no published version yet.', {
        selector: 'p',
      })
    ).toBeVisible()
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
    expect(api.getVersionContent).toHaveBeenCalledTimes(priorContentCalls)
    expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveTextContent(
      'release/2026'
    )
    expect(screen.getByRole('combobox', { name: 'Version' })).toBeDisabled()
  })

  it('switches published and draft reading contexts within the current branch', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      branch_id: 'branch-2',
    })
    expect(await screen.findByText('Release branch body')).toBeVisible()
    await selectOption(
      screen.getByRole('combobox', { name: 'Content state' }),
      'draft'
    )
    expect(await screen.findByText('Release draft body')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Draft' })).toHaveTextContent(
      'draft-release name'
    )
    expect(screen.queryByText('Release branch body')).not.toBeInTheDocument()
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument()
    await selectOption(
      screen.getByRole('combobox', { name: 'Content state' }),
      'published'
    )
    expect(await screen.findByText('Release branch body')).toBeVisible()
    expect(screen.queryByText('Release draft body')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveTextContent(
      'release/2026'
    )
  })

  it.each([
    { branch_id: 'missing' },
    { version_id: 'missing', content_mode: 'published' as const },
    {
      branch_id: 'branch-1',
      version_id: 'version-release',
      content_mode: 'published' as const,
    },
  ])(
    'does not fetch other content for an invalid reading route: %j',
    async (readingSearch) => {
      const screen = renderWorkspace({
        team_id: 'team-1',
        project_id: 'project-1',
        document_id: 'published',
        ...readingSearch,
      })
      expect(await screen.findByRole('alert', { name: '' })).toBeInTheDocument()
      await screen.findAllByText(
        'The selected branch or revision is unavailable. Choose another branch or revision.'
      )
      expect(api.getVersionContent).not.toHaveBeenCalled()
      expect(
        screen.queryByText('Published <literal> text')
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Release branch body')).not.toBeInTheDocument()
    }
  )

  it('hides the previous body while a newly selected branch revision is loading', async () => {
    const delayed = deferred<{ content: string }>()
    const originalContent = api.getVersionContent.getMockImplementation()!
    api.getVersionContent.mockImplementation((...args) =>
      args[2] === 'version-release' ? delayed.promise : originalContent(...args)
    )
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
    })
    await screen.findByText('Published <literal> text')
    await selectOption(
      screen.getByRole('combobox', { name: 'Branch' }),
      'branch-2'
    )
    await waitFor(() =>
      expect(api.getVersionContent).toHaveBeenCalledWith(
        'project-1',
        'published',
        'version-release',
        'raw',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading backend data...'
    )
    await act(async () => delayed.resolve({ content: 'Loaded release body\n' }))
    expect(await screen.findByText('Loaded release body')).toBeVisible()
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
  })

  it('keeps an invalid version URL unavailable in real document tools, AI, and sharing', async () => {
    panes.realVersions = true
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      branch_id: 'branch-1',
      version_id: 'missing-version',
      content_mode: 'published',
      workspace_view: 'versions',
    })
    await screen.findAllByText(
      'The selected branch or revision is unavailable. Choose another branch or revision.'
    )
    // VersionsPage normally selects its first version when no preferred ID is
    // supplied. The workspace must not discard an invalid requested ID and
    // allow that normalization to replace the URL or fetch another body.
    expect(screen.changes).not.toHaveBeenCalled()
    expect(api.getVersionContent).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
    await userEvent.click(screen.getByRole('tab', { name: 'Document AI' }))
    await screen.findAllByText(
      'The selected branch or revision is unavailable. Choose another branch or revision.'
    )
    expect(api.getAISummary).not.toHaveBeenCalled()
    expect(api.listAIChatSessions).not.toHaveBeenCalled()
    expect(api.getVersionContent).not.toHaveBeenCalled()
    expect(screen.changes.mock.calls).toEqual([
      [{ workspace_view: 'ai' }, { replace: false }],
    ])
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Create share link' })
    ).not.toBeInTheDocument()
  })

  it('does not mount real tools or normalize to latest while an exact version lookup is pending', async () => {
    panes.realVersions = true
    const pending = deferred<VersionDTO>()
    api.getVersion.mockReturnValueOnce(pending.promise)
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      branch_id: 'branch-1',
      version_id: 'version-0',
      content_mode: 'published',
      workspace_view: 'versions',
    })
    await waitFor(() =>
      expect(api.getVersion).toHaveBeenCalledWith(
        'project-1',
        'published',
        'version-0',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
    expect(screen.changes).not.toHaveBeenCalled()
    expect(api.getVersionContent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled()
    await act(async () => pending.resolve(version('version-0')))
    expect(await screen.findByText('Historical body exact')).toBeVisible()
    expect(
      api.getVersionContent.mock.calls.every((call) => call[2] === 'version-0')
    ).toBe(true)
    expect(screen.changes).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Published <literal> text')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeEnabled()
  })

  it('retains the selected document body when its folder is collapsed', async () => {
    const folder: DocumentFolderDTO = {
      id: 'guides',
      project_id: 'project-1',
      parent_id: null,
      name: 'Guides',
      path: 'guides',
      created_by: 'user-1',
      created_at: '',
      updated_at: '',
    }
    api.listDocumentFolders.mockResolvedValue({ items: [folder], total: 1 })
    api.listDocuments.mockResolvedValue({
      items: documents.map((item) =>
        item.id === 'published' ? { ...item, folder_id: folder.id } : item
      ),
      total: documents.length,
    })
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
    })
    await screen.findByText('Published <literal> text')
    const tree = screen.getByRole('navigation', { name: 'Files' })
    expect(
      within(tree).getByRole('button', { name: /published.txt/ })
    ).toBeVisible()
    await userEvent.click(
      within(tree).getByRole('button', { name: 'Collapse Guides' })
    )
    expect(
      within(tree).queryByRole('button', { name: /published.txt/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Published guide' })
    ).toBeVisible()
    expect(screen.getByText('Published <literal> text')).toBeVisible()
    expect(screen.changes).toHaveBeenLastCalledWith(
      { folder_id: 'guides' },
      { replace: false }
    )
  })

  it('creates a folder at the explicitly selected project root while keeping the document open', async () => {
    const existing: DocumentFolderDTO = {
      id: 'guides',
      project_id: 'project-1',
      parent_id: null,
      name: 'Guides',
      path: 'guides',
      created_by: 'user-1',
      created_at: '',
      updated_at: '',
    }
    const created: DocumentFolderDTO = {
      ...existing,
      id: 'root-child',
      name: 'Release notes',
      path: 'Release notes',
    }
    let folders = [existing]
    api.listDocumentFolders.mockImplementation(async () => ({
      items: folders,
      total: folders.length,
    }))
    api.createDocumentFolder.mockImplementation(async () => {
      folders = [...folders, created]
      return created
    })
    api.listDocuments.mockResolvedValue({
      items: documents.map((item) =>
        item.id === 'published' ? { ...item, folder_id: existing.id } : item
      ),
      total: documents.length,
    })
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
    })
    await screen.findByText('Published <literal> text')
    const tree = screen.getByRole('navigation', { name: 'Files' })
    await userEvent.click(
      within(tree).getByRole('button', { name: 'Project root' })
    )
    expect(screen.changes).toHaveBeenLastCalledWith(
      { folder_id: 'root' },
      { replace: false }
    )
    expect(
      screen.getByRole('heading', { name: 'Published guide' })
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'New folder' })
    )
    expect(dialog.getByText('Project root')).toBeVisible()
    await userEvent.type(dialog.getByLabelText('Folder name'), 'Release notes')
    await userEvent.click(dialog.getByRole('button', { name: 'Create folder' }))
    await waitFor(() =>
      expect(api.createDocumentFolder).toHaveBeenCalledWith('project-1', {
        parent_id: null,
        name: 'Release notes',
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(screen.changes).toHaveBeenLastCalledWith(
      { folder_id: 'root-child' },
      { replace: false }
    )
    expect(
      screen.getByRole('heading', { name: 'Published guide' })
    ).toBeVisible()
    expect(screen.getByText('Published <literal> text')).toBeVisible()
  })

  it('opens legacy pane deep links, retains working text between tabs, and restores URL controlled selection', async () => {
    const screen = renderWorkspace(
      {
        team_id: 'team-1',
        project_id: 'project-1',
        document_id: 'published',
        draft_id: 'exact-draft',
      },
      'drafts'
    )
    expect(
      await screen.findByText('Draft pane exact-draft')
    ).toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('Working draft text'),
      'Unsaved edits'
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Document tools' }))
    expect(await screen.findByText('Version pane')).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: 'Diffs' }))
    expect(await screen.findByText('Diff pane')).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: 'Working draft text' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Document' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }))
    expect(screen.getByLabelText('Working draft text')).toHaveValue(
      'Unsaved edits'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Restore URL' }))
    expect(await screen.findByText('Draft pane exact-draft')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Document' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  it('explicit embedding removes duplicate chrome and only the scope selector fields', () => {
    const screen = render(
      <LanguageProvider>
        <WorkspaceEmbedding>
          <PageChrome page='diffs'>
            <ContextSelectorGrid>
              <span>Project selector</span>
              <span>Document selector</span>
              <span>From version selector</span>
              <span>To version selector</span>
            </ContextSelectorGrid>
          </PageChrome>
        </WorkspaceEmbedding>
      </LanguageProvider>
    )
    expect(screen.queryByRole('main')).not.toBeInTheDocument()
    expect(screen.queryByText('Project selector')).not.toBeInTheDocument()
    expect(screen.queryByText('Document selector')).not.toBeInTheDocument()
    expect(screen.getByText('From version selector')).toBeInTheDocument()
    expect(screen.getByText('To version selector')).toBeInTheDocument()
  })

  it('opens deep linked ancestors once, allows manual collapse, and bounds only visual indentation', async () => {
    const folders: DocumentFolderDTO[] = Array.from(
      { length: 12 },
      (_, index) => ({
        id: `f${index}`,
        parent_id: index ? `f${index - 1}` : null,
        project_id: 'project-1',
        name: `Folder ${index}`,
        path: `path-${index}`,
        created_by: 'user-1',
        created_at: '',
        updated_at: '',
      })
    )
    const selected = { ...document('deep', 'Deep file'), folder_id: 'f11' }
    const screen = render(
      <LanguageProvider>
        <DocumentFileTree
          folders={folders}
          documents={[selected]}
          documentId='deep'
          folderId='f11'
          onDocumentSelect={vi.fn()}
          onFolderSelect={vi.fn()}
        />
      </LanguageProvider>
    )
    expect(
      screen.getByRole('button', { name: /deep.txt/ }).parentElement
    ).toHaveStyle({ paddingInlineStart: '5.25rem' })
    await userEvent.click(
      screen.getByRole('button', { name: 'Collapse Folder 0' })
    )
    expect(
      screen.queryByRole('button', { name: /deep.txt/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expand Folder 0' })
    ).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(
      screen.getByRole('button', { name: 'Expand Folder 0' })
    )
    expect(screen.getByRole('button', { name: /deep.txt/ })).toBeInTheDocument()
  })
})

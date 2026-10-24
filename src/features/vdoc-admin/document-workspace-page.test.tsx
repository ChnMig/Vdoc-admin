import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { selectOption } from '@/test/select-option'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { DocumentDTO, DocumentFolderDTO, ProjectDTO } from '@/lib/vdoc-api'
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
  getVersionContent: vi.fn(),
  getDraftContent: vi.fn(),
}))
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
vi.mock('./versions-page', () => ({
  VersionsPage: ({ search }: { search?: VdocRouteSearch }) => (
    <section>Version pane {search?.version_id}</section>
  ),
}))
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
  return {
    ...render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <Harness />
        </LanguageProvider>
      </QueryClientProvider>
    ),
    changes,
  }
}

describe('document workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    api.getVersionContent.mockResolvedValue({
      content: 'Published <literal>\r\ntext\n',
    })
    api.getDraftContent.mockResolvedValue({ content: 'Private draft\n' })
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

  it('opens the latest draft without retaining an unrelated version branch filter', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
      branch_id: 'other-branch',
    })
    await screen.findByText('Published <literal> text')
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }))
    expect(await screen.findByText('Draft pane draft-new')).toBeVisible()
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        workspace_view: 'drafts',
        branch_id: undefined,
        draft_id: 'draft-new',
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
    expect(screen.getByText('Unpublished draft content')).toBeInTheDocument()
    expect(api.getVersionContent).not.toHaveBeenCalled()
    const tree = screen.getByRole('navigation', { name: 'Files' })
    await userEvent.click(
      within(tree).getByRole('button', { name: /empty.txt/ })
    )
    expect(
      await screen.findByText(
        'This document has no content yet. Upload or write its first draft.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit draft' })).toBeEnabled()
  })

  it('clears subordinate IDs when changing team and never carries the old file into another project', async () => {
    const screen = renderWorkspace({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'published',
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
    await userEvent.click(screen.getByRole('tab', { name: 'Versions' }))
    expect(await screen.findByText('Version pane')).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Working draft text' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Drafts' }))
    expect(screen.getByLabelText('Working draft text')).toHaveValue(
      'Unsaved edits'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Restore URL' }))
    expect(await screen.findByText('Draft pane exact-draft')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute(
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

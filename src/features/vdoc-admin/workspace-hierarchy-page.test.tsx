import { type ComponentProps, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { translate } from '@/lib/i18n'
import type {
  createDocument,
  createDocumentFolder,
  DocumentDTO,
  DocumentFolderDTO,
  listDocumentFolders,
  listDocuments,
  listProjectMemberCandidates,
  listProjectMembers,
  listProjects,
  listTeams,
  listUsers,
  ProjectDTO,
  ProjectMemberDTO,
  TeamDTO,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { WorkspaceHierarchyPage } from './workspace-hierarchy-page'

const api = vi.hoisted(() => ({
  createDocument: vi.fn<typeof createDocument>(),
  createDocumentFolder: vi.fn<typeof createDocumentFolder>(),
  listDocumentFolders: vi.fn<typeof listDocumentFolders>(),
  listDocuments: vi.fn<typeof listDocuments>(),
  listProjectMembers: vi.fn<typeof listProjectMembers>(),
  listProjectMemberCandidates: vi.fn<typeof listProjectMemberCandidates>(),
  listProjects: vi.fn<typeof listProjects>(),
  listTeams: vi.fn<typeof listTeams>(),
  listUsers: vi.fn<typeof listUsers>(),
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
vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))
vi.mock('@/components/search', () => ({ Search: () => null }))
vi.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }))
vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))

const timestamp = '2026-01-01T00:00:00Z'
const user = {
  id: 'reader',
  email: 'reader@example.test',
  name: 'Reader',
  is_super_admin: false,
  can_access_audit: false,
  status: 1,
}
const team = (id: string, name: string): TeamDTO => ({
  id,
  name,
  created_by: 'admin',
  created_at: timestamp,
  updated_at: timestamp,
})
const teams = [
  team('team-a', 'Product team'),
  team('team-b', 'Research team'),
  team('team-empty', 'Empty team'),
]
const project = (id: string, teamIndex: number, name: string): ProjectDTO => ({
  id,
  team_id: teams[teamIndex].id,
  team_name: teams[teamIndex].name,
  name,
  status: 1,
  created_by: 'admin',
  created_at: timestamp,
  updated_at: timestamp,
})
const projects = [
  project('project-a', 0, 'Product handbook'),
  project('project-a2', 0, 'Developer handbook'),
  project('project-b', 1, 'Research notebook'),
]
const folder = (
  id: string,
  name: string,
  path: string,
  parent_id: string | null = null
): DocumentFolderDTO => ({
  id,
  project_id: 'project-a',
  name,
  path,
  parent_id,
  created_by: 'admin',
  created_at: timestamp,
  updated_at: timestamp,
})
const folders = [
  folder('guides', 'Guides', 'Guides'),
  folder('advanced', 'Advanced', 'Guides/Advanced', 'guides'),
]
const makeDocument = (
  id: string,
  name: string,
  document_type: number,
  folder_id: string | null,
  file_name: string
): DocumentDTO => ({
  id,
  name,
  document_type,
  folder_id,
  file_name,
  project_id: 'project-a',
  relative_path: folder_id
    ? `${folders.find((item) => item.id === folder_id)?.path}/${file_name}`
    : file_name,
  workflow_state: 'published',
  status: 1,
  created_by: 'admin',
  created_at: timestamp,
  updated_at: timestamp,
})
const documents = [
  makeDocument('api', 'API reference', 1, null, 'api.json'),
  makeDocument('overview', 'Overview', 2, null, 'overview.md'),
  makeDocument('notes', 'Release notes', 3, null, 'notes.txt'),
  makeDocument('guide', 'Getting started', 2, 'guides', 'start.md'),
  makeDocument('nested', 'Advanced usage', 3, 'advanced', 'advanced.txt'),
]
const projectMember = (projectId: string): ProjectMemberDTO => ({
  project_id: projectId,
  user_id: user.id,
  user_email: `${projectId}@example.test`,
  user_name: `Reader in ${projectId}`,
  user_status: 1,
  role: 1,
  status: 1,
  added_by: 'admin',
  created_at: timestamp,
  updated_at: timestamp,
})
const clients: QueryClient[] = []

function setup(
  initialProps: ComponentProps<typeof WorkspaceHierarchyPage> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  let props = initialProps
  const panel = () => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <WorkspaceHierarchyPage {...props} />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(panel())
  return {
    client,
    screen,
    user: userEvent.setup(),
    tree: () => {
      const navigation = screen
        .getAllByRole('navigation')
        .find((element) =>
          element.querySelector('[data-hierarchy-kind="workspace"]')
        )
      if (!navigation) throw new Error('Missing workspace navigation')
      return within(navigation)
    },
    rerender: (next: typeof initialProps) => {
      props = { ...props, ...next }
      screen.rerender(panel())
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  document.cookie = 'vdoc-admin-language=en; Path=/'
  useAuthStore.getState().auth.setUser(user)
  useVdocContextStore.getState().reset()
  useVdocContextStore.getState().setProjectId('project-b')
  api.listProjects.mockResolvedValue({
    items: projects,
    total: projects.length,
  })
  api.listTeams.mockResolvedValue({ items: teams, total: teams.length })
  api.listUsers.mockResolvedValue({ items: [], total: 0 })
  api.listDocumentFolders.mockImplementation(async (projectId) => ({
    items: projectId === 'project-a' ? folders : [],
    total: projectId === 'project-a' ? folders.length : 0,
  }))
  api.listDocuments.mockImplementation(async (projectId) => ({
    items:
      projectId === 'project-a'
        ? documents
        : [
            {
              ...documents[0],
              id: 'research',
              project_id: projectId,
              name: 'Research API',
            },
          ],
    total: projectId === 'project-a' ? documents.length : 1,
  }))
  api.listProjectMembers.mockImplementation(async (projectId) => ({
    items: [projectMember(projectId)],
    total: 1,
  }))
  api.listProjectMemberCandidates.mockResolvedValue({ items: [], total: 0 })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  vi.unstubAllGlobals()
  document.cookie = 'vdoc-admin-language=; Max-Age=0; Path=/'
})

describe('workspace hierarchy', () => {
  it('derives ordinary-user teams from projects and starts without project content', async () => {
    const view = setup()

    expect(
      await view.tree().findByRole('button', {
        name: 'Product team',
      })
    ).toBeVisible()
    expect(
      view.tree().getByRole('button', { name: 'Research team' })
    ).toBeVisible()
    expect(
      view.tree().queryByRole('button', { name: 'Empty team' })
    ).not.toBeInTheDocument()
    expect(api.listTeams).not.toHaveBeenCalled()
    expect(api.listUsers).not.toHaveBeenCalled()
    expect(api.listDocuments).not.toHaveBeenCalled()
    expect(api.listDocumentFolders).not.toHaveBeenCalled()
    expect(api.listProjectMembers).not.toHaveBeenCalled()
  })

  it('includes teams without projects for a SuperAdmin', async () => {
    useAuthStore.getState().auth.setUser({ ...user, is_super_admin: true })
    const view = setup()

    expect(
      await view.tree().findByRole('button', {
        name: 'Empty team',
      })
    ).toBeVisible()
    expect(api.listTeams).toHaveBeenCalledOnce()
    expect(api.listDocuments).not.toHaveBeenCalled()
    expect(api.listProjectMembers).not.toHaveBeenCalled()
  })

  it.each([
    { team_id: 'unknown-team' },
    { team_id: 'team-a', project_id: 'project-b' },
    { team_id: 'team-a', project_id: 'unknown-project' },
  ])(
    'does not fall back to another project for unavailable context %j',
    async (search) => {
      const view = setup({ search })

      expect(
        await view.screen.findByText(
          translate('en', 'admin.hierarchy.unavailable')
        )
      ).toBeVisible()
      expect(api.listDocuments).not.toHaveBeenCalled()
      expect(api.listDocumentFolders).not.toHaveBeenCalled()
      expect(api.listProjectMembers).not.toHaveBeenCalled()
      expect(api.listTeams).not.toHaveBeenCalled()
      expect(api.listUsers).not.toHaveBeenCalled()
    }
  )

  it.each([
    { name: 'Research team', teamId: 'team-b', projectId: undefined },
    {
      name: 'Developer handbook',
      teamId: 'team-a',
      projectId: 'project-a2',
    },
  ])(
    'clears every reading selection when navigating to $name',
    async ({ name, teamId, projectId }) => {
      const onSearchChange = vi.fn()
      const view = setup({
        search: {
          team_id: 'team-a',
          project_id: 'project-a',
          content_mode: 'draft',
          document_id: 'nested',
          branch_id: 'old-branch',
          draft_id: 'old-draft',
          version_id: 'old-version',
          endpoint_id: 'old-endpoint',
          from_version_id: 'old-from-version',
          to_version_id: 'old-to-version',
          from_branch_id: 'old-from-branch',
          to_branch_id: 'old-to-branch',
          diff_id: 'old-diff',
          folder_id: 'advanced',
          workspace_view: 'ai',
        },
        onSearchChange,
      })

      await view.user.click(await view.tree().findByRole('button', { name }))

      expect(onSearchChange).toHaveBeenCalledOnce()
      expect(onSearchChange.mock.calls[0]?.[0]).toStrictEqual({
        team_id: teamId,
        project_id: projectId,
        content_mode: undefined,
        document_id: undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        from_branch_id: undefined,
        to_branch_id: undefined,
        diff_id: undefined,
        folder_id: undefined,
        workspace_view: undefined,
      })
    }
  )

  it('lets a selected team collapse and expand without changing project context', async () => {
    const view = setup({ search: { team_id: 'team-a' } })
    expect(
      await view.screen.findByRole('heading', { name: 'Product team' })
    ).toBeVisible()
    const collapseName = translate('en', 'admin.documentForm.collapseFolder', {
      name: 'Product team',
    })
    expect(
      view.tree().getByRole('button', { name: collapseName })
    ).toHaveAttribute('aria-expanded', 'true')

    await view.user.click(
      view.tree().getByRole('button', { name: collapseName })
    )

    const expandName = translate('en', 'admin.documentForm.expandFolder', {
      name: 'Product team',
    })
    expect(
      view.tree().getByRole('button', { name: expandName })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      view.tree().queryByRole('button', { name: 'Product handbook' })
    ).not.toBeInTheDocument()
    expect(
      view.screen.getByRole('heading', { name: 'Product team' })
    ).toBeVisible()
    await view.user.click(view.tree().getByRole('button', { name: expandName }))

    expect(
      view.tree().getByRole('button', { name: 'Product handbook' })
    ).toBeVisible()
    expect(api.listDocuments).not.toHaveBeenCalled()
    expect(api.listProjectMembers).not.toHaveBeenCalled()
  })

  it('loads content only after choosing a project within its team', async () => {
    const view = setup()
    await view.user.click(
      await view.tree().findByRole('button', {
        name: 'Product team',
      })
    )

    expect(
      await view.tree().findByRole('button', {
        name: 'Product handbook',
      })
    ).toBeVisible()
    expect(
      view.tree().getByRole('button', {
        name: 'Developer handbook',
      })
    ).toBeVisible()
    expect(
      view.tree().queryByRole('button', {
        name: 'Research notebook',
      })
    ).not.toBeInTheDocument()
    expect(api.listDocuments).not.toHaveBeenCalled()
    expect(api.listProjectMembers).not.toHaveBeenCalled()

    await view.user.click(
      view.tree().getByRole('button', { name: 'Product handbook' })
    )

    expect(
      await view.screen.findByRole('heading', {
        name: 'Product handbook',
      })
    ).toBeVisible()
    expect(api.listDocuments.mock.calls.map(([id]) => id)).toEqual([
      'project-a',
    ])
    expect(api.listDocumentFolders.mock.calls.map(([id]) => id)).toEqual([
      'project-a',
    ])
    expect(api.listProjectMembers.mock.calls.map(([id]) => id)).toEqual([
      'project-a',
    ])
    expect(api.listTeams).not.toHaveBeenCalled()
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('opens nested documents with the selected project and team', async () => {
    const onDocumentOpen = vi.fn()
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
      onDocumentOpen,
    })
    await view.user.click(
      await view.screen.findByRole('button', { name: 'Guides' })
    )
    await view.user.click(
      await view.screen.findByRole('button', { name: 'Advanced' })
    )
    await view.user.click(
      await view.screen.findByRole('button', { name: /Advanced usage/ })
    )

    expect(onDocumentOpen).toHaveBeenCalledOnce()
    expect(onDocumentOpen).toHaveBeenCalledWith('project-a', 'nested', 'team-a')
  })

  it('does not reuse the previous project content while a controlled project changes', async () => {
    let resolveDocuments!: (
      value: Awaited<ReturnType<typeof listDocuments>>
    ) => void
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
      onSearchChange: vi.fn(),
    })
    expect(
      await view.screen.findByRole('button', { name: /API reference/ })
    ).toBeVisible()
    api.listDocuments.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDocuments = resolve
        })
    )

    view.rerender({ search: { team_id: 'team-b', project_id: 'project-b' } })
    await waitFor(() =>
      expect(api.listDocuments).toHaveBeenCalledWith(
        'project-b',
        undefined,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
    expect(
      view.screen.queryByRole('button', { name: /API reference/ })
    ).not.toBeInTheDocument()
    expect(
      view.screen.getByRole('heading', { name: 'Research notebook' })
    ).toBeVisible()
    const pendingDocuments = view.screen.getByRole('tabpanel', {
      name: translate('en', 'admin.hierarchy.documents'),
    })
    expect(pendingDocuments).toHaveAttribute('aria-busy', 'true')
    expect(
      within(pendingDocuments).getByRole('status', {
        name: translate('en', 'admin.common.loading'),
      })
    ).toBeVisible()
    await act(async () =>
      resolveDocuments({
        items: [
          {
            ...documents[0],
            id: 'research',
            project_id: 'project-b',
            name: 'Research API',
          },
        ],
        total: 1,
      })
    )

    expect(
      await view.screen.findByRole('button', { name: /Research API/ })
    ).toBeVisible()
    expect(
      view.screen.queryByRole('button', { name: /API reference/ })
    ).not.toBeInTheDocument()
    expect(api.listProjectMembers.mock.calls.map(([id]) => id)).toEqual([
      'project-a',
      'project-b',
    ])
  })

  it('keeps the navigation and file controls mounted while browsing folders locally', async () => {
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
    })
    const folderButton = await view.screen.findByRole('button', {
      name: 'Guides',
    })
    const navigation = view
      .tree()
      .getByRole('button', {
        name: 'Product team',
      })
      .closest('nav')
    const fileSearch = view.screen.getByRole('textbox', {
      name: translate('en', 'admin.workspace.searchFiles'),
    })
    await view.user.click(folderButton)

    expect(view.screen.getByRole('heading', { name: 'Guides' })).toHaveFocus()
    expect(
      view.screen.getByRole('textbox', {
        name: translate('en', 'admin.workspace.searchFiles'),
      })
    ).toBe(fileSearch)
    expect(
      view.tree().getByRole('button', { name: 'Product team' }).closest('nav')
    ).toBe(navigation)
    await view.user.click(view.screen.getByRole('button', { name: 'Advanced' }))
    expect(view.screen.getByRole('heading', { name: 'Advanced' })).toHaveFocus()
    expect(
      view.screen.getByRole('button', { name: /Advanced usage/ })
    ).toBeVisible()
    expect(api.listDocuments).toHaveBeenCalledOnce()
    expect(api.listDocumentFolders).toHaveBeenCalledOnce()
    expect(api.listProjectMembers).toHaveBeenCalledOnce()
  })

  it('does not push another location when the current folder breadcrumb is activated', async () => {
    const onSearchChange = vi.fn()
    const view = setup({
      search: {
        team_id: 'team-a',
        project_id: 'project-a',
        folder_id: 'guides',
      },
      onSearchChange,
    })
    await view.user.click(
      await view.screen.findByRole('button', { name: 'Guides' })
    )

    expect(onSearchChange).not.toHaveBeenCalled()
    expect(api.listDocuments).toHaveBeenCalledOnce()
    expect(api.listDocumentFolders).toHaveBeenCalledOnce()
  })

  it('retains visited project panes while hiding inactive content from navigation', async () => {
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
    })
    await view.user.click(
      await view.screen.findByRole('tab', {
        name: translate('en', 'admin.hierarchy.members'),
      })
    )
    const member = await view.screen.findByText('project-a@example.test')
    const requestCount = api.listProjectMembers.mock.calls.length
    await view.user.click(
      view.screen.getByRole('tab', {
        name: translate('en', 'admin.hierarchy.documents'),
      })
    )
    expect(member).toBeInTheDocument()
    expect(member).not.toBeVisible()
    expect(view.screen.getAllByRole('tabpanel')).toHaveLength(1)

    await view.user.click(
      view.screen.getByRole('tab', {
        name: translate('en', 'admin.hierarchy.members'),
      })
    )
    expect(view.screen.getByText('project-a@example.test')).toBe(member)
    expect(member).toBeVisible()
    expect(api.listProjectMembers).toHaveBeenCalledTimes(requestCount)
    expect(api.listTeams).not.toHaveBeenCalled()
    expect(api.listUsers).not.toHaveBeenCalled()

    await view.user.click(
      within(
        view.screen.getByRole('navigation', {
          name: translate('en', 'admin.hierarchy.breadcrumb'),
        })
      ).getByRole('button', { name: 'Product handbook' })
    )
    expect(
      view.screen.getByRole('tab', {
        name: translate('en', 'admin.hierarchy.documents'),
      })
    ).toHaveAttribute('aria-selected', 'true')
    expect(member).not.toBeVisible()
    expect(api.listProjectMembers).toHaveBeenCalledTimes(requestCount)
  })

  it('discards retained project panes when the selected project changes', async () => {
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
      onSearchChange: vi.fn(),
    })
    await view.user.click(
      await view.screen.findByRole('tab', {
        name: translate('en', 'admin.hierarchy.members'),
      })
    )
    const previousMember = await view.screen.findByText(
      'project-a@example.test'
    )

    view.rerender({ search: { team_id: 'team-b', project_id: 'project-b' } })

    expect(
      await view.screen.findByRole('heading', { name: 'Research notebook' })
    ).toBeVisible()
    expect(previousMember).not.toBeInTheDocument()
    expect(
      view.screen.getByRole('tab', {
        name: translate('en', 'admin.hierarchy.documents'),
      })
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      await view.screen.findByRole('button', { name: /Research API/ })
    ).toBeVisible()
  })

  it('shows the current project members without global management data for a Reader', async () => {
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
    })
    await view.user.click(
      await view.screen.findByRole('tab', {
        name: translate('en', 'admin.hierarchy.members'),
      })
    )

    expect(await view.screen.findByText('project-a@example.test')).toBeVisible()
    expect(
      view.screen.queryByText('project-b@example.test')
    ).not.toBeInTheDocument()
    expect(
      view.screen.queryByRole('button', { name: 'Add member' })
    ).not.toBeInTheDocument()
    expect(
      view.screen.queryByRole('button', { name: 'Remove member' })
    ).not.toBeInTheDocument()
    expect(
      api.listProjectMembers.mock.calls.every(([id]) => id === 'project-a')
    ).toBe(true)
    expect(api.listTeams).not.toHaveBeenCalled()
    expect(api.listUsers).not.toHaveBeenCalled()
  })

  it('keeps a pending folder creation on its original project after switching', async () => {
    useAuthStore.getState().auth.setUser({ ...user, is_super_admin: true })
    let finishCreation!: (value: DocumentFolderDTO) => void
    api.createDocumentFolder.mockReturnValue(
      new Promise((resolve) => {
        finishCreation = resolve
      })
    )
    const onSearchChange = vi.fn()
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
      onSearchChange,
    })
    await waitFor(() =>
      expect(
        view.screen.getByRole('button', { name: 'Create folder' })
      ).toBeEnabled()
    )
    const invalidate = vi.spyOn(view.client, 'invalidateQueries')
    await view.user.click(
      view.screen.getByRole('button', { name: 'Create folder' })
    )
    const dialog = within(
      view.screen.getByRole('dialog', { name: 'Create folder' })
    )
    await view.user.type(dialog.getByLabelText('Folder name'), 'New folder')
    await view.user.click(dialog.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(api.createDocumentFolder).toHaveBeenCalledWith('project-a', {
        parent_id: null,
        name: 'New folder',
      })
    )

    view.rerender({ search: { team_id: 'team-b', project_id: 'project-b' } })
    expect(
      await view.screen.findByRole('heading', { name: 'Research notebook' })
    ).toBeVisible()
    await act(async () =>
      finishCreation(folder('new-folder', 'New folder', 'New folder'))
    )

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['document-folders', 'project-a'],
      })
    )
    expect(invalidate).toHaveBeenCalledOnce()
    expect(onSearchChange).not.toHaveBeenCalled()
    expect(
      view.screen.getByRole('heading', { name: 'Research notebook' })
    ).toBeVisible()
    expect(
      view.screen.queryByRole('button', { name: 'New folder' })
    ).not.toBeInTheDocument()
  })

  it('opens an uploaded first draft while preserving the returned draft and branch', async () => {
    useAuthStore.getState().auth.setUser({ ...user, is_super_admin: true })
    // JSDOM does not copy userEvent's FileList into FormData(form).
    // Bridge that browser behavior while retaining the real form submission.
    const NativeFormData = FormData
    vi.stubGlobal(
      'FormData',
      class extends NativeFormData {
        constructor(form?: HTMLFormElement, submitter?: HTMLElement | null) {
          super(form, submitter)
          for (const input of form?.querySelectorAll<HTMLInputElement>(
            'input[type="file"][name]'
          ) ?? []) {
            if (input.disabled || !input.files?.length) continue
            this.delete(input.name)
            for (const file of Array.from(input.files))
              this.append(input.name, file)
          }
        }
      }
    )
    api.createDocument.mockResolvedValue({
      ...makeDocument('uploaded', 'Uploaded guide', 3, null, 'seed.txt'),
      initial_draft_id: 'first-draft',
      initial_branch_id: 'first-branch',
      workflow_state: 'draft',
    })
    const onSearchChange = vi.fn()
    const onDocumentOpen = vi.fn()
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
      onSearchChange,
      onDocumentOpen,
    })
    await waitFor(() =>
      expect(
        view.screen.getByRole('button', { name: 'Create document' })
      ).toBeEnabled()
    )
    await view.user.click(
      view.screen.getByRole('button', { name: 'Create document' })
    )
    const dialog = within(
      view.screen.getByRole('dialog', { name: 'Create document' })
    )
    await view.user.type(dialog.getByLabelText('Name'), 'Uploaded guide')
    await view.user.upload(
      dialog.getByLabelText(translate('en', 'admin.documentForm.upload')),
      new File(['Initial draft content'], 'seed.txt', { type: 'text/plain' })
    )
    await view.user.click(dialog.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(api.createDocument).toHaveBeenCalledWith(
        'project-a',
        expect.objectContaining({
          name: 'Uploaded guide',
          file_name: 'seed.txt',
          document_type: 3,
          folder_id: null,
          initial_content: {
            content: 'Initial draft content',
            version_name: '0.1.0',
          },
        })
      )
    )
    await waitFor(() =>
      expect(onSearchChange).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 'uploaded',
          workspace_view: 'drafts',
          draft_id: 'first-draft',
          branch_id: 'first-branch',
        })
      )
    )
    expect(onSearchChange).toHaveBeenCalledOnce()
    expect(onDocumentOpen).not.toHaveBeenCalled()
  })

  it('distinguishes hierarchy levels and all three document formats with icons', async () => {
    const view = setup({
      search: { team_id: 'team-a', project_id: 'project-a' },
    })
    const apiRow = await view.screen.findByRole('button', {
      name: /API reference/,
    })
    const markdownRow = view.screen.getByRole('button', { name: /Overview/ })
    const textRow = view.screen.getByRole('button', { name: /Release notes/ })

    const icons = [
      view
        .tree()
        .getByRole('button', {
          name: translate('en', 'admin.hierarchy.allTeams'),
        })
        .querySelector('svg[data-hierarchy-kind="workspace"]'),
      view
        .tree()
        .getByRole('button', { name: 'Product team' })
        .querySelector('svg[data-hierarchy-kind="team"]'),
      view
        .tree()
        .getByRole('button', { name: 'Product handbook' })
        .querySelector('svg[data-hierarchy-kind="project"]'),
      view.screen
        .getByRole('button', { name: 'Guides' })
        .querySelector('svg[data-hierarchy-kind="folder"]'),
      apiRow.querySelector('svg[data-document-type="1"]'),
      markdownRow.querySelector('svg[data-document-type="2"]'),
      textRow.querySelector('svg[data-document-type="3"]'),
      view.screen
        .getByRole('tab', { name: translate('en', 'admin.hierarchy.members') })
        .querySelector('svg[data-hierarchy-kind="people"]'),
    ]
    icons.forEach((icon) => expect(icon).toBeInTheDocument())
    expect(new Set(icons.map((icon) => icon?.innerHTML)).size).toBe(
      icons.length
    )
    const breadcrumb = view.screen
      .getAllByRole('navigation')
      .find(
        (element) => !element.querySelector('[data-hierarchy-kind="workspace"]')
      )
    if (!breadcrumb) throw new Error('Missing workspace breadcrumb')
    expect(
      within(breadcrumb).getByRole('button', { name: /Product team/ })
    ).toBeVisible()
    expect(
      within(breadcrumb).getByRole('button', { name: 'Product handbook' })
    ).toBeVisible()
  })
})

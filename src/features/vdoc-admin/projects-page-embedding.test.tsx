import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import type { ProjectDTO, ProjectMemberDTO, UserDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { ProjectsPage } from './projects-page'
import { WorkspaceEmbedding } from './workspace-embedding'

const apiMocks = vi.hoisted(() => ({
  addProjectMember: vi.fn(),
  archiveProject: vi.fn(),
  createProject: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjectMemberCandidates: vi.fn(),
  listProjects: vi.fn(),
  listTeams: vi.fn(),
  listUsers: vi.fn(),
  patchProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
  updateProject: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...apiMocks,
}))

const timestamp = '2026-01-01T00:00:00Z'
const admin: UserDTO = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}
const projects: ProjectDTO[] = ['a', 'b'].map((id) => ({
  id: `project-${id}`,
  team_id: `team-${id}`,
  name: `Project ${id.toUpperCase()}`,
  description: `Description ${id.toUpperCase()}`,
  status: 1,
  created_by: admin.id,
  created_at: timestamp,
  updated_at: timestamp,
}))

function member(
  projectId: string,
  userId = 'reader',
  role = 1
): ProjectMemberDTO {
  return {
    project_id: projectId,
    user_id: userId,
    user_email: `${userId}-${projectId}@example.com`,
    user_status: 1,
    role,
    status: 1,
    added_by: admin.id,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

const clients: QueryClient[] = []

function renderPanel(
  projectId: string,
  section: 'members' | 'settings' = 'members'
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  const panel = (id: string) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <WorkspaceEmbedding>
          <ProjectsPage projectId={id} section={section} />
        </WorkspaceEmbedding>
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(panel(projectId))
  return {
    ...screen,
    selectProject: (id: string) => screen.rerender(panel(id)),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  document.cookie = 'vdoc-admin-language=en; Path=/'
  useVdocContextStore.getState().reset()
  useVdocContextStore.getState().setProjectId('project-a')
  useAuthStore.getState().auth.setUser(admin)
  apiMocks.listProjects.mockResolvedValue({
    items: projects,
    total: projects.length,
  })
  apiMocks.listProjectMembers.mockImplementation(async (projectId: string) => ({
    items: [member(projectId)],
    total: 1,
  }))
  apiMocks.listProjectMemberCandidates.mockResolvedValue({
    items: [],
    total: 0,
  })
  apiMocks.listUsers.mockResolvedValue({ items: [admin], total: 1 })
  apiMocks.listTeams.mockResolvedValue({ items: [], total: 0 })
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  document.cookie = 'vdoc-admin-language=; Max-Age=0; Path=/'
})

describe('ProjectsPage workspace embedding', () => {
  it('waits for the controlled project without querying the previous store project', async () => {
    let resolveProjects!: (value: {
      items: ProjectDTO[]
      total: number
    }) => void
    apiMocks.listProjects.mockReturnValue(
      new Promise((resolve) => {
        resolveProjects = resolve
      })
    )
    const screen = renderPanel('project-b')

    expect(apiMocks.listProjectMembers).not.toHaveBeenCalled()
    await act(async () =>
      resolveProjects({ items: projects, total: projects.length })
    )

    expect(
      await screen.findByText('reader-project-b@example.com')
    ).toBeInTheDocument()
    expect(apiMocks.listProjectMembers.mock.calls.map(([id]) => id)).toEqual([
      'project-b',
    ])
    expect(
      apiMocks.listProjectMemberCandidates.mock.calls.map(([id]) => id)
    ).toEqual(['project-b'])
    expect(screen.queryByLabelText('Project')).not.toBeInTheDocument()
    expect(screen.queryByText('Project A')).not.toBeInTheDocument()
    expect(screen.queryByText('Project B')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create project' })
    ).not.toBeInTheDocument()
    expect(apiMocks.listTeams).not.toHaveBeenCalled()
  })

  it.each(['project-missing', ''])(
    'does not fall back for a controlled project %j',
    async (id) => {
      const screen = renderPanel(id)

      await waitFor(() => expect(apiMocks.listProjects).toHaveBeenCalledOnce())
      await waitFor(() =>
        expect(useVdocContextStore.getState().projectId).toBe('')
      )

      expect(apiMocks.listProjectMembers).not.toHaveBeenCalled()
      expect(apiMocks.listProjectMemberCandidates).not.toHaveBeenCalled()
      expect(
        screen.queryByText('reader-project-a@example.com')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Add member' })
      ).not.toBeInTheDocument()
    }
  )

  it('scopes settings to the selected project without global creation or member controls', async () => {
    const screen = renderPanel('project-b', 'settings')

    expect(
      await screen.findByRole('row', { name: /Project B/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('row', { name: /Project A/ })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Members')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create project' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(apiMocks.listTeams).not.toHaveBeenCalled()
    expect(apiMocks.listUsers).not.toHaveBeenCalled()
    expect(apiMocks.listProjectMemberCandidates).not.toHaveBeenCalled()
  })

  it('lets a Reader see member facts without management controls or global user queries', async () => {
    useAuthStore
      .getState()
      .auth.setUser({ ...admin, id: 'reader', is_super_admin: false })
    const screen = renderPanel('project-b')

    expect(
      await screen.findByText('reader-project-b@example.com')
    ).toBeInTheDocument()
    expect(screen.getByText('Reader')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add member' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove member' })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(apiMocks.listTeams).not.toHaveBeenCalled()
    expect(apiMocks.listUsers).not.toHaveBeenCalled()
    expect(apiMocks.listProjectMemberCandidates).not.toHaveBeenCalled()
  })

  it('keeps project admins on scoped candidates without loading global users', async () => {
    useAuthStore.getState().auth.setUser({ ...admin, is_super_admin: false })
    apiMocks.listProjectMembers.mockImplementation(
      async (projectId: string) => ({
        items: [member(projectId, admin.id, 3)],
        total: 1,
      })
    )
    apiMocks.listProjectMemberCandidates.mockResolvedValue({
      items: [{ ...admin, id: 'candidate', is_super_admin: false }],
      total: 1,
    })
    const screen = renderPanel('project-b')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add member' })).toBeEnabled()
    )
    expect(
      apiMocks.listProjectMemberCandidates.mock.calls.map(([id]) => id)
    ).toEqual(['project-b'])
    expect(apiMocks.listTeams).not.toHaveBeenCalled()
    expect(apiMocks.listUsers).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('button', { name: 'Remove member' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Add another active Project Admin before changing this role or removing this member.'
      )
    ).toBeInTheDocument()
  })

  it('keeps an in-flight removal attached to its original project after switching', async () => {
    let finishRemoval!: () => void
    apiMocks.removeProjectMember.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRemoval = resolve
      })
    )
    const screen = renderPanel('project-a')
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Remove member' })
    )
    const dialog = screen.getByRole('alertdialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove member' })
    )
    await waitFor(() =>
      expect(apiMocks.removeProjectMember).toHaveBeenCalledWith(
        'project-a',
        'reader'
      )
    )

    screen.selectProject('project-b')
    expect(
      await screen.findByText('reader-project-b@example.com')
    ).toBeInTheDocument()
    await act(async () => finishRemoval())

    expect(apiMocks.removeProjectMember).toHaveBeenCalledOnce()
    expect(
      screen.queryByText('reader-project-a@example.com')
    ).not.toBeInTheDocument()
    expect(screen.getByText('reader-project-b@example.com')).toBeInTheDocument()
  })
})

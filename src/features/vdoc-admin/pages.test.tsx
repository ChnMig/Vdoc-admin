import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import {
  compareDiff,
  createAIChatSession,
  getAISummary,
  getEndpoint,
  getMCPToken,
  getVersionContent,
  listDocuments,
  listEndpoints,
  listMCPTokens,
  listProjects,
  listVersions,
  regenerateAISummary,
  revokeMCPToken,
  sendAIChatMessage,
  updateProjectAIProvider,
  updateProjectAIPrompt,
  updateSystemAIProvider,
  updateSystemAIPrompt,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import {
  DashboardPage,
  DiffsPage,
  DraftsPage,
  MCPTokensPage,
  ProjectsPage,
  SettingsPage,
  VersionsPage,
} from './pages'

const apiMocks = vi.hoisted(() => ({
  compareDiff: vi.fn(),
  createMCPToken: vi.fn(),
  createProject: vi.fn(),
  createDraft: vi.fn(),
  createAIChatSession: vi.fn(),
  getAISummary: vi.fn(),
  getAIChatSession: vi.fn(),
  getDiffSummary: vi.fn(),
  getDraftContent: vi.fn(),
  getEndpoint: vi.fn(),
  getHealth: vi.fn(),
  getIdentity: vi.fn(),
  getMCPToken: vi.fn(),
  getProjectAIProvider: vi.fn(),
  getSystemAIProvider: vi.fn(),
  getVersionContent: vi.fn(),
  listBranches: vi.fn(),
  listAIChatSessions: vi.fn(),
  listDocuments: vi.fn(),
  listDrafts: vi.fn(),
  listEndpoints: vi.fn(),
  listMCPTokens: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjectMemberCandidates: vi.fn(),
  listProjectAIPrompts: vi.fn(),
  listProjects: vi.fn(),
  listTeams: vi.fn(),
  listSystemAIPrompts: vi.fn(),
  listUsers: vi.fn(),
  listVersions: vi.fn(),
  promoteDraft: vi.fn(),
  regenerateAISummary: vi.fn(),
  revokeMCPToken: vi.fn(),
  sendAIChatMessage: vi.fn(),
  testProjectAIProvider: vi.fn(),
  testSystemAIProvider: vi.fn(),
  updateProjectAIProvider: vi.fn(),
  updateProjectAIPrompt: vi.fn(),
  updateSystemAIProvider: vi.fn(),
  updateSystemAIPrompt: vi.fn(),
  updateDraft: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vdoc-api')>()
  return {
    ...actual,
    compareDiff: apiMocks.compareDiff,
    createMCPToken: apiMocks.createMCPToken,
    createProject: apiMocks.createProject,
    createDraft: apiMocks.createDraft,
    createAIChatSession: apiMocks.createAIChatSession,
    getAISummary: apiMocks.getAISummary,
    getAIChatSession: apiMocks.getAIChatSession,
    getDiffSummary: apiMocks.getDiffSummary,
    getDraftContent: apiMocks.getDraftContent,
    getEndpoint: apiMocks.getEndpoint,
    getHealth: apiMocks.getHealth,
    getIdentity: apiMocks.getIdentity,
    getMCPToken: apiMocks.getMCPToken,
    getProjectAIProvider: apiMocks.getProjectAIProvider,
    getSystemAIProvider: apiMocks.getSystemAIProvider,
    getVersionContent: apiMocks.getVersionContent,
    listBranches: apiMocks.listBranches,
    listAIChatSessions: apiMocks.listAIChatSessions,
    listDocuments: apiMocks.listDocuments,
    listDrafts: apiMocks.listDrafts,
    listEndpoints: apiMocks.listEndpoints,
    listMCPTokens: apiMocks.listMCPTokens,
    listProjectMembers: apiMocks.listProjectMembers,
    listProjectMemberCandidates: apiMocks.listProjectMemberCandidates,
    listProjectAIPrompts: apiMocks.listProjectAIPrompts,
    listProjects: apiMocks.listProjects,
    listTeams: apiMocks.listTeams,
    listSystemAIPrompts: apiMocks.listSystemAIPrompts,
    listUsers: apiMocks.listUsers,
    listVersions: apiMocks.listVersions,
    promoteDraft: apiMocks.promoteDraft,
    regenerateAISummary: apiMocks.regenerateAISummary,
    revokeMCPToken: apiMocks.revokeMCPToken,
    sendAIChatMessage: apiMocks.sendAIChatMessage,
    testProjectAIProvider: apiMocks.testProjectAIProvider,
    testSystemAIProvider: apiMocks.testSystemAIProvider,
    updateProjectAIProvider: apiMocks.updateProjectAIProvider,
    updateProjectAIPrompt: apiMocks.updateProjectAIPrompt,
    updateSystemAIProvider: apiMocks.updateSystemAIProvider,
    updateSystemAIPrompt: apiMocks.updateSystemAIPrompt,
    updateDraft: apiMocks.updateDraft,
  }
})

vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { readonly children: ReactNode }) => (
    <header>{children}</header>
  ),
}))

vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { readonly children: ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => <button type='button'>Language</button>,
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => <button type='button'>Profile</button>,
}))

vi.mock('@/components/search', () => ({
  Search: () => <div>Search</div>,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <button type='button'>Theme</button>,
}))

function renderPage(element: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{element}</LanguageProvider>
    </QueryClientProvider>
  )
}

const renderVersionsPage = () => renderPage(<VersionsPage />)
const renderDraftsPage = () => renderPage(<DraftsPage />)
const renderDiffsPage = () => renderPage(<DiffsPage />)
const renderSettingsPage = () => renderPage(<SettingsPage />)
const renderMCPTokensPage = () => renderPage(<MCPTokensPage />)
const renderDashboardPage = () => renderPage(<DashboardPage />)
const renderProjectsPage = () => renderPage(<ProjectsPage />)

function setAuthUser(user: typeof identityFixture | null) {
  useAuthStore.getState().auth.setUser(user)
}

beforeEach(() => {
  setAuthUser(identityFixture)
})

describe('DashboardPage role boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAuthUser({ ...identityFixture, is_super_admin: false })
    apiMocks.getIdentity.mockResolvedValue({
      ...identityFixture,
      is_super_admin: false,
    })
    apiMocks.getHealth.mockResolvedValue({
      status: 'ok',
      ready: true,
      dependencies: {},
    })
    apiMocks.listProjects.mockResolvedValue({
      items: [projectFixture],
      total: 1,
    })
    apiMocks.listProjectMembers.mockResolvedValue({
      items: [
        {
          project_id: 'project-1',
          user_id: 'user-1',
          role: 2,
          status: 1,
          added_by: 'user-2',
          created_at: projectFixture.created_at,
          updated_at: projectFixture.updated_at,
        },
      ],
      total: 1,
    })
    apiMocks.listDocuments.mockResolvedValue({
      items: [markdownDocumentFixture],
      total: 1,
    })
    apiMocks.listBranches.mockResolvedValue({
      items: [branchFixture],
      total: 1,
    })
    apiMocks.listDrafts.mockResolvedValue({ items: [], total: 0 })
    apiMocks.listMCPTokens.mockResolvedValue({ items: [], total: 0 })
  })

  it('does not request or onboard Teams for a non-SuperAdmin', async () => {
    const screen = renderDashboardPage()

    expect(await screen.findByText('Writer workspace')).toBeInTheDocument()
    expect(apiMocks.listTeams).not.toHaveBeenCalled()
    expect(screen.queryByText('Create a team')).not.toBeInTheDocument()
  })
})

describe('ProjectsPage lifecycle boundaries', () => {
  const archivedProject = () => ({
    ...projectFixture,
    id: 'project-archived',
    name: 'Archived project',
    status: 2,
  })
  const existingAdmin = () => ({
    ...identityFixture,
    id: 'user-existing',
    email: 'existing@example.com',
    name: 'Existing admin',
    is_super_admin: false,
  })
  const availableAdmin = () => ({
    ...identityFixture,
    id: 'user-available',
    email: 'available@example.com',
    name: 'Available admin',
    is_super_admin: false,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listTeams.mockResolvedValue({
      items: [
        {
          id: 'team-1',
          name: 'Docs team',
          created_by: 'user-1',
          created_at: projectFixture.created_at,
          updated_at: projectFixture.updated_at,
        },
      ],
      total: 1,
    })
    apiMocks.listUsers.mockResolvedValue({
      items: [identityFixture, existingAdmin(), availableAdmin()],
      total: 3,
    })
    apiMocks.listProjectMembers.mockResolvedValue({
      items: [
        {
          project_id: 'project-1',
          user_id: existingAdmin().id,
          role: 3,
          status: 1,
          added_by: identityFixture.id,
          created_at: projectFixture.created_at,
          updated_at: projectFixture.updated_at,
        },
      ],
      total: 1,
    })
    apiMocks.listProjectMemberCandidates.mockResolvedValue({
      items: [availableAdmin()],
      total: 1,
    })
  })

  it('automatically selects the first active project instead of an archived one', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [archivedProject(), secondProjectFixture],
      total: 2,
    })

    const screen = renderProjectsPage()

    await waitFor(() =>
      expect(screen.getByLabelText('Project')).toHaveValue('project-2')
    )
    await waitFor(() =>
      expect(apiMocks.listProjectMembers).toHaveBeenCalledWith('project-2')
    )
  })

  it('keeps project-admin choices independent from current-project membership', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [projectFixture],
      total: 1,
    })

    const screen = renderProjectsPage()
    const createProjectTitle = await screen.findByText('Create project')
    const createProjectCard = createProjectTitle.closest('[data-slot="card"]')
    if (!(createProjectCard instanceof HTMLElement))
      throw new Error('missing create-project card')
    const adminSelect = within(createProjectCard).getByLabelText('User')

    await waitFor(() =>
      expect(
        within(adminSelect).getByRole('option', {
          name: 'Existing admin · existing@example.com',
        })
      ).toBeInTheDocument()
    )
    expect(
      within(adminSelect).getByRole('option', {
        name: 'Available admin · available@example.com',
      })
    ).toBeInTheDocument()
    expect(
      within(adminSelect).queryByRole('option', {
        name: 'Admin · admin@example.com',
      })
    ).not.toBeInTheDocument()

    let memberUserSelect: HTMLElement | undefined
    await waitFor(() => {
      memberUserSelect = screen
        .getAllByLabelText('User')
        .find((element) => element !== adminSelect)
      expect(memberUserSelect).toBeDefined()
    })
    if (!(memberUserSelect instanceof HTMLElement))
      throw new Error('missing member candidate select')
    const resolvedMemberUserSelect = memberUserSelect
    await waitFor(() =>
      expect(
        within(resolvedMemberUserSelect).queryByRole('option', {
          name: 'Existing admin · existing@example.com',
        })
      ).not.toBeInTheDocument()
    )
  })

  it('keeps an archived project and its membership controls read-only', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [archivedProject()],
      total: 1,
    })

    const screen = renderProjectsPage()

    await waitFor(() =>
      expect(screen.getByLabelText('Project')).toHaveValue('project-archived')
    )
    expect(
      screen.queryByRole('button', { name: 'Update' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Archive' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove' })
    ).not.toBeInTheDocument()
    expect(apiMocks.listProjectMemberCandidates).not.toHaveBeenCalled()
  })
})

describe('MCPTokensPage secret lifecycle', () => {
  const token = {
    id: 'token-1',
    user_id: 'user-1',
    name: 'Local agent',
    scopes: [1],
    status: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listMCPTokens.mockResolvedValue({ items: [token], total: 1 })
    apiMocks.getMCPToken.mockResolvedValue({
      ...token,
      token: `vdoc_${'a'.repeat(48)}`,
    })
    apiMocks.revokeMCPToken.mockResolvedValue({ ...token, status: 2 })
    apiMocks.createMCPToken.mockResolvedValue({
      ...token,
      id: 'token-new',
      name: 'New token',
      token: `vdoc_${'b'.repeat(48)}`,
    })
  })

  it('clears a revealed plaintext token as soon as that token is revoked', async () => {
    const user = userEvent.setup()
    const screen = renderMCPTokensPage()

    await user.click(await screen.findByRole('button', { name: 'View' }))
    expect((await screen.findAllByText(/vdoc_a{48}/)).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => expect(revokeMCPToken).toHaveBeenCalledWith('token-1'))
    await waitFor(() =>
      expect(screen.queryByText(/vdoc_a{48}/)).not.toBeInTheDocument()
    )
    expect(getMCPToken).toHaveBeenCalledWith('token-1')
    expect(listMCPTokens).toHaveBeenCalled()
  })

  it('does not let an older reveal overwrite a newly created token', async () => {
    const oldReveal = createDeferred<{
      id: string
      user_id: string
      name: string
      scopes: number[]
      status: number
      created_at: string
      updated_at: string
      token: string
    }>()
    apiMocks.getMCPToken.mockReturnValueOnce(oldReveal.promise)
    const user = userEvent.setup()
    const screen = renderMCPTokensPage()

    await user.click(await screen.findByRole('button', { name: 'View' }))
    const createTokenTitle = screen.getByText('Create MCP token')
    const createTokenCard = createTokenTitle.closest('[data-slot="card"]')
    if (!(createTokenCard instanceof HTMLElement)) {
      throw new Error('missing create-token card')
    }
    await user.type(within(createTokenCard).getByLabelText('Name'), 'New token')
    await user.click(
      within(createTokenCard).getByRole('button', { name: 'Create' })
    )

    expect((await screen.findAllByText(/vdoc_b{48}/)).length).toBeGreaterThan(0)
    await act(async () => {
      oldReveal.resolve({
        ...token,
        token: `vdoc_${'a'.repeat(48)}`,
      })
      await oldReveal.promise
    })

    expect(screen.queryAllByText(/vdoc_a{48}/)).toHaveLength(0)
    expect(screen.getAllByText(/vdoc_b{48}/).length).toBeGreaterThan(0)
  })

  it('does not let a late token creation overwrite a newer reveal', async () => {
    const lateCreation = createDeferred<
      typeof token & { id: string; name: string; token: string }
    >()
    apiMocks.createMCPToken.mockReturnValueOnce(lateCreation.promise)
    apiMocks.getMCPToken.mockResolvedValueOnce({
      ...token,
      token: `vdoc_${'c'.repeat(48)}`,
    })
    const user = userEvent.setup()
    const screen = renderMCPTokensPage()
    const createTokenCard = screen
      .getByText('Create MCP token')
      .closest('[data-slot="card"]')
    if (!(createTokenCard instanceof HTMLElement)) {
      throw new Error('missing create-token card')
    }
    await user.type(
      within(createTokenCard).getByLabelText('Name'),
      'Late token'
    )
    await user.click(
      within(createTokenCard).getByRole('button', { name: 'Create' })
    )
    await waitFor(() => expect(apiMocks.createMCPToken).toHaveBeenCalledOnce())

    await user.click(await screen.findByRole('button', { name: 'View' }))
    expect((await screen.findAllByText(/vdoc_c{48}/)).length).toBeGreaterThan(0)
    await act(async () => {
      lateCreation.resolve({
        ...token,
        id: 'token-late',
        name: 'Late token',
        token: `vdoc_${'b'.repeat(48)}`,
      })
      await lateCreation.promise
    })

    expect(screen.queryAllByText(/vdoc_b{48}/)).toHaveLength(0)
    expect(screen.getAllByText(/vdoc_c{48}/).length).toBeGreaterThan(0)
  })

  it('coalesces rapid token creation submissions', async () => {
    const creation = createDeferred<typeof token & { token: string }>()
    apiMocks.createMCPToken.mockReturnValueOnce(creation.promise)
    const user = userEvent.setup()
    const screen = renderMCPTokensPage()
    const createTokenCard = screen
      .getByText('Create MCP token')
      .closest('[data-slot="card"]')
    if (!(createTokenCard instanceof HTMLElement)) {
      throw new Error('missing create-token card')
    }
    const name = within(createTokenCard).getByLabelText('Name')
    await user.type(name, 'One request')
    const form = name.closest('form')
    if (!form) throw new Error('missing create-token form')

    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect(apiMocks.createMCPToken).toHaveBeenCalledOnce())
    await act(async () => {
      creation.resolve({ ...token, token: `vdoc_${'d'.repeat(48)}` })
      await creation.promise
    })
  })

  it('clears the old plaintext immediately while revealing another token', async () => {
    const secondToken = { ...token, id: 'token-2', name: 'Second token' }
    apiMocks.listMCPTokens.mockResolvedValue({
      items: [token, secondToken],
      total: 2,
    })
    const secondReveal = createDeferred<
      typeof secondToken & { token: string }
    >()
    apiMocks.getMCPToken
      .mockResolvedValueOnce({ ...token, token: `vdoc_${'a'.repeat(48)}` })
      .mockReturnValueOnce(secondReveal.promise)
    const user = userEvent.setup()
    const screen = renderMCPTokensPage()
    const viewButtons = await screen.findAllByRole('button', { name: 'View' })

    await user.click(viewButtons[0]!)
    expect((await screen.findAllByText(/vdoc_a{48}/)).length).toBeGreaterThan(0)
    await user.click(viewButtons[1]!)

    expect(screen.queryAllByText(/vdoc_a{48}/)).toHaveLength(0)
    secondReveal.resolve({ ...secondToken, token: `vdoc_${'c'.repeat(48)}` })
    expect((await screen.findAllByText(/vdoc_c{48}/)).length).toBeGreaterThan(0)
  })

  it('shows recoverable token reveal, revoke, and copy failures', async () => {
    const user = userEvent.setup()
    apiMocks.getMCPToken.mockRejectedValueOnce(new Error('Reveal denied'))
    apiMocks.revokeMCPToken.mockRejectedValueOnce(new Error('Revoke denied'))
    const screen = renderMCPTokensPage()

    await user.click(await screen.findByRole('button', { name: 'View' }))
    expect(
      await screen.findByText('Token could not be revealed')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(
      await screen.findByText('Token could not be revoked')
    ).toBeInTheDocument()

    apiMocks.getMCPToken.mockResolvedValueOnce({
      ...token,
      token: `vdoc_${'a'.repeat(48)}`,
    })
    await user.click(screen.getByRole('button', { name: 'View' }))
    await screen.findAllByText(/vdoc_a{48}/)
    expect(
      screen.queryByText('Token could not be revoked')
    ).not.toBeInTheDocument()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    await user.click(screen.getByRole('button', { name: 'Copy token' }))
    expect(
      await screen.findByText(
        'The token could not be copied. Select and copy it manually.'
      )
    ).toHaveAttribute('role', 'status')
    writeText.mockRestore()
  })
})

function mockWorkspaceQueries() {
  apiMocks.listProjects.mockResolvedValue({ items: [projectFixture], total: 1 })
  apiMocks.listBranches.mockResolvedValue({ items: [], total: 0 })
  apiMocks.listDocuments.mockResolvedValue({
    items: [markdownDocumentFixture],
    total: 1,
  })
}

function mockAIQueries(
  ownerType: 'draft' | 'version' | 'diff',
  ownerId: string
) {
  apiMocks.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
  apiMocks.getAISummary.mockResolvedValue({
    id: `summary-${ownerType}`,
    project_id: 'project-1',
    document_id: 'document-1',
    owner_type: ownerType,
    owner_id: ownerId,
    prompt_key: 'summary.default',
    status: 'ready',
    content: `AI summary for ${ownerType}`,
    generated_by: 'user-1',
    generated_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })
  apiMocks.regenerateAISummary.mockResolvedValue({
    id: `summary-${ownerType}`,
    project_id: 'project-1',
    document_id: 'document-1',
    owner_type: ownerType,
    owner_id: ownerId,
    prompt_key: 'summary.default',
    status: 'ready',
    content: `Regenerated ${ownerType}`,
    generated_by: 'user-1',
    generated_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })
  apiMocks.createAIChatSession.mockResolvedValue({
    id: `session-${ownerType}`,
    project_id: 'project-1',
    document_id: 'document-1',
    context_type: ownerType,
    context_id: ownerId,
    title: 'Context chat',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })
  apiMocks.getAIChatSession.mockResolvedValue({
    session: {
      id: `session-${ownerType}`,
      project_id: 'project-1',
      document_id: 'document-1',
      context_type: ownerType,
      context_id: ownerId,
      title: 'Context chat',
      created_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    messages: [],
  })
  apiMocks.sendAIChatMessage.mockResolvedValue({
    id: `message-${ownerType}`,
    session_id: `session-${ownerType}`,
    role: 'assistant',
    content: 'AI answer',
    created_at: '2026-01-01T00:00:00Z',
  })
}

describe('VersionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceQueries()
    apiMocks.listBranches.mockResolvedValue({
      items: [branchFixture],
      total: 1,
    })
    apiMocks.listVersions.mockResolvedValue({
      items: [markdownVersionFixture],
      total: 1,
    })
    apiMocks.getVersionContent.mockResolvedValue({
      owner_type: 'version',
      owner_id: 'version-1',
      kind: 'document',
      content_kind: 'raw',
      content:
        '# Markdown Guide\n\n- [ ] Review facts\n\nSee [relative](./guide.md).',
      hash: 'hash-1',
    })
    mockAIQueries('version', 'version-1')
  })

  it('renders Markdown facts for Markdown versions without requesting endpoints', async () => {
    const screen = renderVersionsPage()

    expect(
      await screen.findByRole('heading', { name: 'Markdown facts' })
    ).toBeInTheDocument()
    expect(
      (await screen.findAllByText('Markdown Guide')).length
    ).toBeGreaterThan(0)
    expect((await screen.findAllByText('Review facts')).length).toBeGreaterThan(
      0
    )
    expect(screen.getByRole('link', { name: 'relative' })).toHaveAttribute(
      'href',
      './guide.md'
    )
    expect(screen.queryByLabelText('Endpoint search')).not.toBeInTheDocument()

    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce())
    expect(listDocuments).toHaveBeenCalledWith('project-1')
    expect(listVersions).toHaveBeenCalledWith('project-1', 'document-1')
    expect(getVersionContent).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'version-1',
      'raw'
    )
    expect(listEndpoints).not.toHaveBeenCalled()
    expect(getEndpoint).not.toHaveBeenCalled()
  })

  it('renders version AI summary and sends chat through AI helpers only', async () => {
    const user = userEvent.setup()
    const screen = renderVersionsPage()

    expect(
      await screen.findByText('AI summary for version')
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Regenerate AI summary' })
    )
    await user.type(screen.getByLabelText('AI chat message'), 'What changed?')
    await user.click(screen.getByRole('button', { name: 'Send AI message' }))

    const target = {
      projectId: 'project-1',
      documentId: 'document-1',
      ownerType: 'version',
      ownerId: 'version-1',
    }
    await waitFor(() =>
      expect(regenerateAISummary).toHaveBeenCalledWith(target)
    )
    expect(getAISummary).toHaveBeenCalledWith(target)
    expect(createAIChatSession).toHaveBeenCalledWith('project-1', {
      document_id: 'document-1',
      context_type: 'version',
      context_id: 'version-1',
      title: 'AI chat for version version-1',
    })
    expect(sendAIChatMessage).toHaveBeenCalledWith(
      'project-1',
      'session-version',
      'What changed?'
    )
  })
})

describe('SettingsPage AI settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceQueries()
    apiMocks.getIdentity.mockResolvedValue(identityFixture)
    apiMocks.getHealth.mockResolvedValue({ status: 'ok', ready: true })
    apiMocks.getSystemAIProvider.mockResolvedValue(systemProviderFixture)
    apiMocks.getProjectAIProvider.mockResolvedValue(projectProviderFixture)
    apiMocks.updateSystemAIProvider.mockResolvedValue(systemProviderFixture)
    apiMocks.updateProjectAIProvider.mockResolvedValue(projectProviderFixture)
    apiMocks.testSystemAIProvider.mockResolvedValue({ ok: true, content: 'ok' })
    apiMocks.testProjectAIProvider.mockResolvedValue({
      ok: true,
      content: 'ok',
    })
    apiMocks.listSystemAIPrompts.mockResolvedValue({
      items: [promptFixture],
      total: 1,
    })
    apiMocks.listProjectAIPrompts.mockResolvedValue({
      items: [promptFixture],
      total: 1,
    })
    apiMocks.updateSystemAIPrompt.mockResolvedValue(promptOverrideFixture)
    apiMocks.updateProjectAIPrompt.mockResolvedValue(promptOverrideFixture)
  })

  it('renders redacted provider state and preserves keys on save', async () => {
    const user = userEvent.setup()
    const screen = renderSettingsPage()

    expect(await screen.findByText('System AI provider')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getAllByText('Provider configuration: Configured')
      ).toHaveLength(2)
    )
    expect(
      screen.getAllByText('Provider test status: Not tested')
    ).toHaveLength(2)
    expect(
      await screen.findByText('Key set: yes · last4: 1234')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('System API key')).toHaveDisplayValue('')
    expect(screen.queryByDisplayValue('sk-live-secret')).not.toBeInTheDocument()
    const systemProviderEnabled = screen.getAllByLabelText('Enabled')[0]
    if (!systemProviderEnabled) {
      throw new Error('missing system provider enabled select')
    }
    await user.selectOptions(systemProviderEnabled, 'false')
    const systemProviderApiMode = screen.getAllByLabelText('API mode')[0]
    if (!systemProviderApiMode) {
      throw new Error('missing system provider API mode select')
    }
    expect(
      within(systemProviderApiMode).getByRole('option', {
        name: 'Chat Completions',
      })
    ).toHaveValue('chat_completions')
    expect(
      within(systemProviderApiMode).getByRole('option', { name: 'Responses' })
    ).toHaveValue('responses')
    await user.selectOptions(systemProviderApiMode, 'responses')

    const saveSystemProvider = screen.getByRole('button', {
      name: 'Save system provider',
    })
    const systemProviderForm = saveSystemProvider.closest('form')
    if (!systemProviderForm) {
      throw new Error('missing system provider form')
    }
    const systemTemperature =
      within(systemProviderForm).getByLabelText('Temperature')
    const systemTimeout =
      within(systemProviderForm).getByLabelText('Timeout (ms)')
    const systemMaxTokens =
      within(systemProviderForm).getByLabelText('Max output tokens')
    expect(systemTemperature).toHaveDisplayValue('0.4')
    expect(systemTimeout).toHaveDisplayValue('45000')
    expect(systemMaxTokens).toHaveDisplayValue('2048')
    await user.clear(systemTemperature)
    await user.type(systemTemperature, '0.6')
    await user.clear(systemTimeout)
    await user.type(systemTimeout, '60000')
    await user.clear(systemMaxTokens)
    await user.type(systemMaxTokens, '4096')

    await user.click(saveSystemProvider)

    await waitFor(() =>
      expect(updateSystemAIProvider).toHaveBeenCalledWith({
        name: 'openai',
        base_url: 'https://api.openai.example',
        model: 'gpt-4.1',
        api_mode: 'responses',
        temperature: 0.6,
        timeout_ms: 60000,
        max_output_tokens: 4096,
        enabled: false,
      })
    )
    expect(updateProjectAIProvider).not.toHaveBeenCalled()
  })

  it('renders provider test success and inline mutation errors', async () => {
    const user = userEvent.setup()
    apiMocks.testSystemAIProvider.mockResolvedValueOnce({
      ok: true,
      content: 'Provider reached.',
    })
    const screen = renderSettingsPage()

    await screen.findByText('System AI provider')
    await waitFor(() =>
      expect(
        screen.getAllByText('Provider configuration: Configured')
      ).toHaveLength(2)
    )
    await user.click(
      screen.getByRole('button', { name: 'Test system provider' })
    )

    expect(
      await screen.findByText('Provider test status: Success')
    ).toBeInTheDocument()
    expect(screen.getByText('Provider reached.')).toBeInTheDocument()

    apiMocks.testProjectAIProvider.mockRejectedValueOnce(
      new Error('Project provider rejected the test request.')
    )
    await user.click(
      screen.getByRole('button', { name: 'Test project provider' })
    )

    expect(
      await screen.findByText('Provider test status: Error')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Project provider rejected the test request.')
    ).toBeInTheDocument()
    expect(screen.queryByDisplayValue('sk-live-secret')).not.toBeInTheDocument()
  })

  it('ignores late project provider test results after the project scope changes', async () => {
    const projectTest = createDeferred<{
      readonly ok: boolean
      readonly content: string
    }>()
    const user = userEvent.setup()
    apiMocks.listProjects.mockResolvedValue({
      items: [projectFixture, secondProjectFixture],
      total: 2,
    })
    apiMocks.getProjectAIProvider.mockImplementation((projectId: string) =>
      Promise.resolve(
        projectId === 'project-2'
          ? secondProjectProviderFixture
          : projectProviderFixture
      )
    )
    apiMocks.testProjectAIProvider.mockReturnValueOnce(projectTest.promise)
    const screen = renderSettingsPage()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Test project provider' })
      ).toBeEnabled()
    )
    const testProjectProvider = screen.getByRole('button', {
      name: 'Test project provider',
    })
    const projectProviderSection = testProjectProvider.closest('section')
    if (!projectProviderSection) {
      throw new Error('missing project provider section')
    }
    await user.click(testProjectProvider)
    await waitFor(() =>
      expect(apiMocks.testProjectAIProvider).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({ name: 'openai' })
      )
    )
    await user.selectOptions(
      screen.getByLabelText('Project provider scope'),
      'project-2'
    )
    await screen.findByDisplayValue('anthropic')

    await act(async () => {
      projectTest.resolve({ ok: true, content: 'Project one reached.' })
      await projectTest.promise
    })

    expect(screen.queryByText('Project one reached.')).not.toBeInTheDocument()
    const currentProjectProviderSection = screen
      .getByRole('button', { name: 'Test project provider' })
      .closest('section')
    if (!currentProjectProviderSection) {
      throw new Error('missing current project provider section')
    }
    expect(
      within(currentProjectProviderSection).getByText(
        'Provider test status: Not tested'
      )
    ).toBeInTheDocument()
  })

  it('resets project provider test results when form values change', async () => {
    const user = userEvent.setup()
    apiMocks.testProjectAIProvider.mockResolvedValueOnce({
      ok: true,
      content: 'Project provider reached.',
    })
    const screen = renderSettingsPage()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Test project provider' })
      ).toBeEnabled()
    )
    const testProjectProvider = screen.getByRole('button', {
      name: 'Test project provider',
    })
    const projectProviderSection = testProjectProvider.closest('section')
    if (!projectProviderSection) {
      throw new Error('missing project provider section')
    }
    const projectProviderPanel = within(projectProviderSection)
    await user.click(testProjectProvider)
    expect(
      await projectProviderPanel.findByText('Provider test status: Success')
    ).toBeInTheDocument()
    expect(
      projectProviderPanel.getByText('Project provider reached.')
    ).toBeInTheDocument()

    await user.clear(projectProviderPanel.getByLabelText('Model'))
    await user.type(projectProviderPanel.getByLabelText('Model'), 'gpt-4.2')

    expect(
      projectProviderPanel.getByText('Provider test status: Not tested')
    ).toBeInTheDocument()
    expect(
      projectProviderPanel.queryByText('Project provider reached.')
    ).not.toBeInTheDocument()
  })

  it('ignores late project provider test results after form values change', async () => {
    const projectTest = createDeferred<{
      readonly ok: boolean
      readonly content: string
    }>()
    const user = userEvent.setup()
    apiMocks.testProjectAIProvider.mockReturnValueOnce(projectTest.promise)
    const screen = renderSettingsPage()

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Test project provider' })
      ).toBeEnabled()
    )
    const testProjectProvider = screen.getByRole('button', {
      name: 'Test project provider',
    })
    const projectProviderSection = testProjectProvider.closest('section')
    if (!projectProviderSection) {
      throw new Error('missing project provider section')
    }
    const projectProviderPanel = within(projectProviderSection)
    await user.click(testProjectProvider)
    await user.clear(projectProviderPanel.getByLabelText('Base URL'))
    await user.type(
      projectProviderPanel.getByLabelText('Base URL'),
      'https://changed.example'
    )

    await act(async () => {
      projectTest.resolve({ ok: true, content: 'Old form values reached.' })
      await projectTest.promise
    })

    expect(
      projectProviderPanel.getByText('Provider test status: Not tested')
    ).toBeInTheDocument()
    expect(
      projectProviderPanel.queryByText('Old form values reached.')
    ).not.toBeInTheDocument()
  })

  it('renders unconfigured provider status when provider keys are missing', async () => {
    apiMocks.getSystemAIProvider.mockResolvedValueOnce({
      ...systemProviderFixture,
      api_key_set: false,
      api_key_last4: undefined,
    })
    apiMocks.getProjectAIProvider.mockResolvedValueOnce({
      ...projectProviderFixture,
      api_key_set: false,
      api_key_last4: undefined,
    })

    const screen = renderSettingsPage()

    await waitFor(() =>
      expect(
        screen.getAllByText('Provider configuration: Unconfigured')
      ).toHaveLength(1)
    )
    expect(
      screen.getByText(
        'Project override: not configured. AI can use the enabled system provider fallback.'
      )
    ).toBeInTheDocument()
    expect(screen.getAllByText('Key set: no')).toHaveLength(2)
  })

  it('renders project provider tuning defaults when override fields are unset', async () => {
    const screen = renderSettingsPage()

    const saveProjectProvider = await screen.findByRole('button', {
      name: 'Save project provider',
    })
    const projectProviderForm = saveProjectProvider.closest('form')
    if (!projectProviderForm) {
      throw new Error('missing project provider form')
    }

    expect(
      within(projectProviderForm).getByLabelText('Temperature')
    ).toHaveDisplayValue('0.2')
    expect(
      within(projectProviderForm).getByLabelText('Timeout (ms)')
    ).toHaveDisplayValue('30000')
    expect(
      within(projectProviderForm).getByLabelText('Max output tokens')
    ).toHaveDisplayValue('1000')
  })

  it('updates system and project AI prompt helpers', async () => {
    const user = userEvent.setup()
    const screen = renderSettingsPage()

    expect(
      (await screen.findAllByText('diff_change_summary')).length
    ).toBeGreaterThan(0)
    const systemPromptButton = screen.getByRole('button', {
      name: 'Save system prompt diff_change_summary',
    })
    const systemPromptForm = systemPromptButton.closest('form')
    if (!systemPromptForm) {
      throw new Error('missing system prompt form')
    }
    await user.selectOptions(
      within(systemPromptForm).getByLabelText('Enabled'),
      'false'
    )
    await user.click(systemPromptButton)
    await user.click(
      screen.getByRole('button', {
        name: 'Save project prompt diff_change_summary',
      })
    )

    await waitFor(() =>
      expect(updateSystemAIPrompt).toHaveBeenCalledWith('diff_change_summary', {
        system_prompt: 'Summarize carefully.',
        user_prompt_template: 'Summarize {{context}}',
        enabled: false,
      })
    )
    expect(updateProjectAIPrompt).toHaveBeenCalledWith(
      'project-1',
      'diff_change_summary',
      {
        system_prompt: 'Summarize carefully.',
        user_prompt_template: 'Summarize {{context}}',
        enabled: true,
      }
    )
  })
})

describe('DraftsPage and DiffsPage AI panels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceQueries()
    apiMocks.listBranches.mockResolvedValue({
      items: [branchFixture],
      total: 1,
    })
    apiMocks.listDrafts.mockResolvedValue({ items: [draftFixture], total: 1 })
    apiMocks.getDraftContent.mockResolvedValue({
      owner_type: 'draft',
      owner_id: 'draft-1',
      kind: 'document',
      content_kind: 'raw',
      content: '# Draft',
      hash: 'hash-draft',
    })
    apiMocks.listVersions.mockResolvedValue({
      items: [fromVersionFixture, markdownVersionFixture],
      total: 2,
    })
    apiMocks.compareDiff.mockResolvedValue(diffFixture)
    apiMocks.getDiffSummary.mockResolvedValue(diffFixture.summary)
  })

  it('scopes DraftsPage AI panel to the selected draft', async () => {
    mockAIQueries('draft', 'draft-1')
    const user = userEvent.setup()
    const screen = renderDraftsPage()

    await screen.findByRole('option', { name: 'draft v1' })
    await user.selectOptions(screen.getByLabelText('Draft'), 'draft-1')

    expect(await screen.findByText('AI summary for draft')).toBeInTheDocument()

    await waitFor(() =>
      expect(getAISummary).toHaveBeenCalledWith({
        projectId: 'project-1',
        documentId: 'document-1',
        ownerType: 'draft',
        ownerId: 'draft-1',
      })
    )
  })

  it('scopes DiffsPage AI panel to the active diff', async () => {
    mockAIQueries('diff', 'diff-1')
    const user = userEvent.setup()
    const screen = renderDiffsPage()

    await waitFor(() =>
      expect(screen.getAllByRole('option', { name: 'v0' })).toHaveLength(2)
    )
    expect(screen.getAllByRole('option', { name: 'v1' })).toHaveLength(2)
    await user.selectOptions(screen.getByLabelText('From version'), 'version-0')
    await user.selectOptions(screen.getByLabelText('To version'), 'version-1')
    await user.click(screen.getByRole('button', { name: 'Compare' }))

    expect(await screen.findByText('AI summary for diff')).toBeInTheDocument()
    expect(compareDiff).toHaveBeenCalledWith('project-1', 'document-1', {
      from_version_id: 'version-0',
      to_version_id: 'version-1',
    })
    expect(getAISummary).toHaveBeenCalledWith({
      projectId: 'project-1',
      documentId: 'document-1',
      ownerType: 'diff',
      ownerId: 'diff-1',
    })
  })
})

describe('DraftsPage lifecycle boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceQueries()
    apiMocks.listBranches.mockResolvedValue({
      items: [branchFixture],
      total: 1,
    })
    apiMocks.getDraftContent.mockResolvedValue({
      owner_type: 'draft',
      owner_id: 'draft-1',
      kind: 'document',
      content_kind: 'raw',
      content: '# Loaded raw content',
      hash: 'hash-draft',
    })
    apiMocks.listVersions.mockResolvedValue({ items: [], total: 0 })
    apiMocks.updateDraft.mockResolvedValue({ ...draftFixture, status: 1 })
  })

  for (const [status, label] of [
    [1, 'Draft'],
    [3, 'Changes requested'],
  ] as const) {
    it(`loads raw content and preserves the branch while editing a ${label} draft`, async () => {
      apiMocks.listDrafts.mockResolvedValue({
        items: [{ ...draftFixture, status }],
        total: 1,
      })
      const user = userEvent.setup()
      const screen = renderDraftsPage()

      await screen.findByRole('option', { name: 'draft v1' })
      await user.selectOptions(screen.getByLabelText('Draft'), 'draft-1')
      const editorTitle = await screen.findByText('Edit selected draft')
      const editorCard = editorTitle.closest('[data-slot="card"]')
      if (!(editorCard instanceof HTMLElement))
        throw new Error('missing draft editor card')

      expect(within(editorCard).getByLabelText('Branch')).toHaveValue('main')
      expect(within(editorCard).getByLabelText('Branch')).toHaveAttribute(
        'readonly'
      )
      expect(within(editorCard).getByLabelText('Version name')).toHaveValue(
        'draft v1'
      )
      expect(within(editorCard).getByLabelText('Content')).toHaveValue(
        '# Loaded raw content'
      )
      expect(apiMocks.getDraftContent).toHaveBeenCalledWith(
        'project-1',
        'document-1',
        'draft-1',
        'raw'
      )
    })
  }

  for (const [status, label] of [
    [2, 'Submitted'],
    [4, 'Rejected'],
    [5, 'Published'],
  ] as const) {
    it(`renders a ${label} draft as read-only`, async () => {
      apiMocks.listDrafts.mockResolvedValue({
        items: [{ ...draftFixture, status }],
        total: 1,
      })
      const user = userEvent.setup()
      const screen = renderDraftsPage()

      await screen.findByRole('option', { name: 'draft v1' })
      await user.selectOptions(screen.getByLabelText('Draft'), 'draft-1')
      const readOnlyTitle = await screen.findByText(
        'Selected draft is read-only'
      )
      const readOnlyCard = readOnlyTitle.closest('[data-slot="card"]')
      if (!(readOnlyCard instanceof HTMLElement))
        throw new Error('missing read-only draft card')

      expect(within(readOnlyCard).getByText(label)).toBeInTheDocument()
      expect(
        within(readOnlyCard).queryByRole('button', { name: 'Update' })
      ).not.toBeInTheDocument()
      expect(
        within(readOnlyCard).getByRole('button', { name: 'New draft' })
      ).toBeInTheDocument()
    })
  }

  it('preserves edited draft input when the update request fails', async () => {
    apiMocks.listDrafts.mockResolvedValue({
      items: [{ ...draftFixture, status: 1 }],
      total: 1,
    })
    apiMocks.updateDraft.mockRejectedValue(new Error('Update was rejected'))
    const user = userEvent.setup()
    const screen = renderDraftsPage()

    await screen.findByRole('option', { name: 'draft v1' })
    await user.selectOptions(screen.getByLabelText('Draft'), 'draft-1')
    const editorTitle = await screen.findByText('Edit selected draft')
    const editorCard = editorTitle.closest('[data-slot="card"]')
    if (!(editorCard instanceof HTMLElement))
      throw new Error('missing draft editor card')
    const versionName = within(editorCard).getByLabelText('Version name')
    const content = within(editorCard).getByLabelText('Content')

    await user.clear(versionName)
    await user.type(versionName, 'draft v2 unsaved')
    await user.clear(content)
    await user.type(content, '# Unsaved content')
    await user.click(within(editorCard).getByRole('button', { name: 'Update' }))

    expect(
      await within(editorCard).findByText('Update was rejected')
    ).toBeInTheDocument()
    expect(versionName).toHaveValue('draft v2 unsaved')
    expect(content).toHaveValue('# Unsaved content')
    expect(apiMocks.updateDraft).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'draft-1',
      expect.objectContaining({
        branch_id: 'branch-1',
        version_name: 'draft v2 unsaved',
        content: '# Unsaved content',
        schema_content: '# Unsaved content',
      })
    )
  })

  it('limits promotion sources and targets to valid active branch combinations', async () => {
    const activeTarget = {
      ...branchFixture,
      id: 'branch-target',
      name: 'release',
      is_default: false,
    }
    const activeUnpublishedTarget = {
      ...branchFixture,
      id: 'branch-unpublished',
      name: 'next',
      is_default: false,
    }
    const archivedPublishedBranch = {
      ...branchFixture,
      id: 'branch-archived',
      name: 'legacy',
      is_default: false,
      status: 2,
    }
    apiMocks.listBranches.mockResolvedValue({
      items: [
        branchFixture,
        activeTarget,
        activeUnpublishedTarget,
        archivedPublishedBranch,
      ],
      total: 4,
    })
    apiMocks.listDrafts.mockResolvedValue({ items: [], total: 0 })
    apiMocks.listVersions.mockResolvedValue({
      items: [
        markdownVersionFixture,
        {
          ...markdownVersionFixture,
          id: 'version-legacy',
          branch_id: 'branch-archived',
        },
      ],
      total: 2,
    })
    const user = userEvent.setup()
    const screen = renderDraftsPage()

    const promoteTitle = await screen.findByText(
      'Promote published branch to draft'
    )
    const promoteCard = promoteTitle.closest('[data-slot="card"]')
    if (!(promoteCard instanceof HTMLElement))
      throw new Error('missing promotion card')
    const source = within(promoteCard).getByLabelText('Source branch')
    const target = within(promoteCard).getByLabelText('Target branch')

    expect(
      within(source).getByRole('option', { name: 'main' })
    ).toBeInTheDocument()
    expect(
      within(source).queryByRole('option', { name: 'release' })
    ).not.toBeInTheDocument()
    expect(
      within(source).queryByRole('option', { name: 'next' })
    ).not.toBeInTheDocument()
    expect(
      within(source).queryByRole('option', { name: 'legacy' })
    ).not.toBeInTheDocument()

    await user.selectOptions(source, 'branch-1')
    expect(target).not.toBeDisabled()
    expect(
      within(target).queryByRole('option', { name: 'main' })
    ).not.toBeInTheDocument()
    expect(
      within(target).getByRole('option', { name: 'release' })
    ).toBeInTheDocument()
    expect(
      within(target).getByRole('option', { name: 'next' })
    ).toBeInTheDocument()
    expect(
      within(target).queryByRole('option', { name: 'legacy' })
    ).not.toBeInTheDocument()
  })

  it('explains when no distinct active promotion target exists', async () => {
    apiMocks.listDrafts.mockResolvedValue({ items: [], total: 0 })
    apiMocks.listVersions.mockResolvedValue({
      items: [markdownVersionFixture],
      total: 1,
    })

    const screen = renderDraftsPage()

    expect(
      await screen.findByText('Promotion is not available yet')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Promote published branch to draft')
    ).not.toBeInTheDocument()
  })
})

const projectFixture = {
  id: 'project-1',
  team_id: 'team-1',
  name: 'Docs project',
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const identityFixture = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  is_super_admin: true,
  status: 1,
}

const markdownDocumentFixture = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'Markdown document',
  document_type: 2,
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const markdownVersionFixture = {
  id: 'version-1',
  project_id: 'project-1',
  document_id: 'document-1',
  branch_id: 'branch-1',
  draft_id: 'draft-1',
  version_name: 'v1',
  changelog: 'Initial Markdown version',
  document_format: 2,
  source_type: 1,
  status: 1,
  published_by: 'user-1',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const fromVersionFixture = {
  ...markdownVersionFixture,
  id: 'version-0',
  draft_id: 'draft-0',
  version_name: 'v0',
}

const branchFixture = {
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

const draftFixture = {
  id: 'draft-1',
  project_id: 'project-1',
  document_id: 'document-1',
  branch_id: 'branch-1',
  version_name: 'draft v1',
  changelog: 'Draft changelog',
  document_format: 2,
  source_type: 1,
  raw_content: '# Draft',
  normalized_content: '# Draft',
  status: 2,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const diffFixture = {
  id: 'diff-1',
  document_id: 'document-1',
  from_version_id: 'version-0',
  to_version_id: 'version-1',
  diff_status: 1,
  summary: {
    added_endpoints: 1,
    removed_endpoints: 0,
    modified_endpoints: 0,
    breaking_changes: 0,
  },
  items: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const systemProviderFixture = {
  id: 'provider-system',
  scope: 'system',
  name: 'openai',
  base_url: 'https://api.openai.example',
  model: 'gpt-4.1',
  api_mode: 'chat_completions',
  temperature: 0.4,
  timeout_ms: 45000,
  max_output_tokens: 2048,
  api_key_set: true,
  api_key_last4: '1234',
  enabled: true,
}

const projectProviderFixture = {
  ...systemProviderFixture,
  id: 'provider-project',
  scope: 'project',
  project_id: 'project-1',
  api_key_last4: '5678',
  temperature: undefined,
  timeout_ms: undefined,
  max_output_tokens: undefined,
}

const secondProjectFixture = {
  ...projectFixture,
  id: 'project-2',
  name: 'Second docs project',
}

const secondProjectProviderFixture = {
  ...projectProviderFixture,
  id: 'provider-project-2',
  project_id: 'project-2',
  name: 'anthropic',
  base_url: 'https://api.anthropic.example',
  model: 'claude-sonnet-4.5',
  api_key_last4: '2222',
}

const promptFixture = {
  prompt_key: 'diff_change_summary',
  system_prompt: 'Summarize carefully.',
  user_prompt_template: 'Summarize {{context}}',
  enabled: true,
}

const promptOverrideFixture = {
  ...promptFixture,
  id: 'prompt-override-1',
  scope: 'system',
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function createDeferred<T>() {
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined
  let rejectPromise: (reason?: unknown) => void = () => undefined
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

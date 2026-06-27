import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compareDiff,
  createAIChatSession,
  getAISummary,
  getEndpoint,
  getVersionContent,
  listDocuments,
  listEndpoints,
  listProjects,
  listVersions,
  regenerateAISummary,
  sendAIChatMessage,
  updateProjectAIProvider,
  updateProjectAIPrompt,
  updateSystemAIProvider,
  updateSystemAIPrompt,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DiffsPage, DraftsPage, SettingsPage, VersionsPage } from './pages'

const apiMocks = vi.hoisted(() => ({
  compareDiff: vi.fn(),
  createAIChatSession: vi.fn(),
  getAISummary: vi.fn(),
  getAIChatSession: vi.fn(),
  getDiffSummary: vi.fn(),
  getDraftContent: vi.fn(),
  getEndpoint: vi.fn(),
  getHealth: vi.fn(),
  getIdentity: vi.fn(),
  getProjectAIProvider: vi.fn(),
  getSystemAIProvider: vi.fn(),
  getVersionContent: vi.fn(),
  listBranches: vi.fn(),
  listDocuments: vi.fn(),
  listDrafts: vi.fn(),
  listEndpoints: vi.fn(),
  listProjectAIPrompts: vi.fn(),
  listProjects: vi.fn(),
  listSystemAIPrompts: vi.fn(),
  listVersions: vi.fn(),
  regenerateAISummary: vi.fn(),
  sendAIChatMessage: vi.fn(),
  testProjectAIProvider: vi.fn(),
  testSystemAIProvider: vi.fn(),
  updateProjectAIProvider: vi.fn(),
  updateProjectAIPrompt: vi.fn(),
  updateSystemAIProvider: vi.fn(),
  updateSystemAIPrompt: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vdoc-api')>()
  return {
    ...actual,
    compareDiff: apiMocks.compareDiff,
    createAIChatSession: apiMocks.createAIChatSession,
    getAISummary: apiMocks.getAISummary,
    getAIChatSession: apiMocks.getAIChatSession,
    getDiffSummary: apiMocks.getDiffSummary,
    getDraftContent: apiMocks.getDraftContent,
    getEndpoint: apiMocks.getEndpoint,
    getHealth: apiMocks.getHealth,
    getIdentity: apiMocks.getIdentity,
    getProjectAIProvider: apiMocks.getProjectAIProvider,
    getSystemAIProvider: apiMocks.getSystemAIProvider,
    getVersionContent: apiMocks.getVersionContent,
    listBranches: apiMocks.listBranches,
    listDocuments: apiMocks.listDocuments,
    listDrafts: apiMocks.listDrafts,
    listEndpoints: apiMocks.listEndpoints,
    listProjectAIPrompts: apiMocks.listProjectAIPrompts,
    listProjects: apiMocks.listProjects,
    listSystemAIPrompts: apiMocks.listSystemAIPrompts,
    listVersions: apiMocks.listVersions,
    regenerateAISummary: apiMocks.regenerateAISummary,
    sendAIChatMessage: apiMocks.sendAIChatMessage,
    testProjectAIProvider: apiMocks.testProjectAIProvider,
    testSystemAIProvider: apiMocks.testSystemAIProvider,
    updateProjectAIProvider: apiMocks.updateProjectAIProvider,
    updateProjectAIPrompt: apiMocks.updateProjectAIPrompt,
    updateSystemAIProvider: apiMocks.updateSystemAIProvider,
    updateSystemAIPrompt: apiMocks.updateSystemAIPrompt,
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

function mockWorkspaceQueries() {
  apiMocks.listProjects.mockResolvedValue({ items: [projectFixture], total: 1 })
  apiMocks.listDocuments.mockResolvedValue({
    items: [markdownDocumentFixture],
    total: 1,
  })
}

function mockAIQueries(
  ownerType: 'draft' | 'version' | 'diff',
  ownerId: string
) {
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
    expect(await screen.findByText('Markdown Guide')).toBeInTheDocument()
    expect(await screen.findByText('Review facts')).toBeInTheDocument()
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
    expect(
      await screen.findByText('Key set: yes · last4: 1234')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('System API key')).toHaveDisplayValue('')
    expect(screen.queryByDisplayValue('sk-live-secret')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Save system provider' })
    )

    await waitFor(() =>
      expect(updateSystemAIProvider).toHaveBeenCalledWith({
        name: 'openai',
        base_url: 'https://api.openai.example/v1',
        model: 'gpt-4.1',
        api_mode: 'openai-compatible',
        enabled: true,
      })
    )
    expect(updateProjectAIProvider).not.toHaveBeenCalled()
  })

  it('updates system and project AI prompt helpers', async () => {
    const user = userEvent.setup()
    const screen = renderSettingsPage()

    expect(await screen.findByText('summary.default')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Save system prompt summary.default' })
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Save project prompt summary.default',
      })
    )

    await waitFor(() =>
      expect(updateSystemAIPrompt).toHaveBeenCalledWith('summary.default', {
        prompt_key: 'summary.default',
        system_prompt: 'Summarize carefully.',
        user_prompt_template: 'Summarize {content}',
        enabled: true,
      })
    )
    expect(updateProjectAIPrompt).toHaveBeenCalledWith(
      'project-1',
      'summary.default',
      {
        prompt_key: 'summary.default',
        system_prompt: 'Summarize carefully.',
        user_prompt_template: 'Summarize {content}',
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
  base_url: 'https://api.openai.example/v1',
  model: 'gpt-4.1',
  api_mode: 'openai-compatible',
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
}

const promptFixture = {
  prompt_key: 'summary.default',
  system_prompt: 'Summarize carefully.',
  user_prompt_template: 'Summarize {content}',
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

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@/stores/auth-store'
import type {
  AIProviderDTO,
  AIPromptTemplateDTO,
  ProjectDTO,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { AISettingsPanel } from './ai-settings'

const apiMocks = vi.hoisted(() => ({
  getProjectAIProvider: vi.fn(),
  getSystemAIProvider: vi.fn(),
  listProjectAIPrompts: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjects: vi.fn(),
  listSystemAIPrompts: vi.fn(),
  testProjectAIProvider: vi.fn(),
  testSystemAIProvider: vi.fn(),
  updateProjectAIProvider: vi.fn(),
  updateProjectAIPrompt: vi.fn(),
  updateSystemAIProvider: vi.fn(),
  updateSystemAIPrompt: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vdoc-api')>()
  return { ...actual, ...apiMocks }
})

const timestamp = '2026-01-01T00:00:00Z'

const activeProject = project('project-active', 'Active project', 1)
const archivedProject = project('project-archived', 'Archived project', 2)

const superAdmin: AuthUser = {
  id: 'super-admin',
  email: 'super@example.com',
  name: 'Super Admin',
  is_super_admin: true,
  status: 1,
}

const reader: AuthUser = {
  id: 'reader',
  email: 'reader@example.com',
  name: 'Reader',
  is_super_admin: false,
  status: 1,
}

function project(id: string, name: string, status: number): ProjectDTO {
  return {
    id,
    team_id: 'team-1',
    name,
    status,
    created_by: 'super-admin',
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function provider(projectId: string): AIProviderDTO {
  return {
    id: `provider-${projectId}`,
    scope: 'project',
    project_id: projectId,
    name: `Provider ${projectId}`,
    base_url: 'https://api.openai.example',
    model: 'gpt-test',
    api_mode: 'responses',
    api_key_set: true,
    api_key_last4: 'test',
    enabled: true,
    temperature: 0.2,
    timeout_ms: 30000,
    max_output_tokens: 1000,
  }
}

function prompts(projectId: string): AIPromptTemplateDTO[] {
  return [
    {
      prompt_key: 'page_chat',
      system_prompt: `System prompt ${projectId}`,
      user_prompt_template: `User prompt ${projectId}: {{context}} {{message}}`,
      enabled: true,
    },
  ]
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderSettings(user: AuthUser) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  )
  return render(wrap(<AISettingsPanel user={user} />))
}

describe('AISettingsPanel project boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject, archivedProject],
      total: 2,
    })
    apiMocks.getSystemAIProvider.mockResolvedValue(provider('system'))
    apiMocks.listSystemAIPrompts.mockResolvedValue({
      items: prompts('system'),
      total: 1,
    })
    apiMocks.getProjectAIProvider.mockImplementation(
      async (projectId: string) => provider(projectId)
    )
    apiMocks.listProjectAIPrompts.mockImplementation(
      async (projectId: string) => ({ items: prompts(projectId), total: 1 })
    )
    apiMocks.listProjectMembers.mockResolvedValue({ items: [], total: 0 })
  })

  it('keeps archived project configuration reachable but disables every mutation', async () => {
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)
    const projectSelect = await screen.findByLabelText('Project provider scope')

    expect(
      await within(projectSelect).findByRole('option', {
        name: 'Archived project — Archived',
      })
    ).toBeInTheDocument()
    await user.selectOptions(projectSelect, archivedProject.id)

    expect(
      await screen.findByText('Archived project settings are read-only')
    ).toBeInTheDocument()
    expect(
      await screen.findByDisplayValue('Provider project-archived')
    ).toBeDisabled()
    expect(
      screen.getByDisplayValue('System prompt project-archived')
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Save project provider' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Test project provider' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Save project prompt page_chat' })
    ).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Save project provider' })
    )
    expect(apiMocks.updateProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.testProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.updateProjectAIPrompt).not.toHaveBeenCalled()
  })

  it('does not load or expose project configuration to readers', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject],
      total: 1,
    })
    apiMocks.listProjectMembers.mockResolvedValue({
      items: [
        {
          project_id: activeProject.id,
          user_id: reader.id,
          role: 1,
          status: 1,
          added_by: 'super-admin',
          created_at: timestamp,
          updated_at: timestamp,
        },
      ],
      total: 1,
    })
    const screen = renderSettings(reader)

    expect(
      await screen.findByText('Project AI configuration is restricted')
    ).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Provider project-active')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('System prompt project-active')
    ).not.toBeInTheDocument()
    expect(apiMocks.getProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.listProjectAIPrompts).not.toHaveBeenCalled()
    expect(apiMocks.getSystemAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.listSystemAIPrompts).not.toHaveBeenCalled()
  })

  it('never displays the previous project provider while the next one loads', async () => {
    const projectB = project('project-b', 'Project B', 1)
    const projectBProvider = deferred<AIProviderDTO>()
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject, projectB],
      total: 2,
    })
    apiMocks.getProjectAIProvider.mockImplementation((projectId: string) =>
      projectId === projectB.id
        ? projectBProvider.promise
        : Promise.resolve(provider(projectId))
    )
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)
    const projectSelect = await screen.findByLabelText('Project provider scope')

    expect(
      await screen.findByDisplayValue('Provider project-active')
    ).toBeInTheDocument()
    await user.selectOptions(projectSelect, projectB.id)

    expect(
      await screen.findByText('Loading project AI settings…')
    ).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Provider project-active')
    ).not.toBeInTheDocument()

    projectBProvider.resolve(provider(projectB.id))
    expect(
      await screen.findByDisplayValue('Provider project-b')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('Loading project AI settings…')
      ).not.toBeInTheDocument()
    )
  })

  it('tests the effective system fallback without an empty project payload', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject],
      total: 1,
    })
    apiMocks.getProjectAIProvider.mockResolvedValue({
      api_key_set: false,
      enabled: false,
      temperature: 0.2,
      timeout_ms: 30000,
      max_output_tokens: 1000,
    })
    apiMocks.testProjectAIProvider.mockResolvedValue({
      ok: true,
      content: 'System fallback reached.',
    })
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)

    expect(
      await screen.findByText(
        'Project override: not configured. AI can use the enabled system provider fallback.'
      )
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Test project provider' })
    )

    await waitFor(() =>
      expect(apiMocks.testProjectAIProvider).toHaveBeenCalledWith(
        activeProject.id,
        undefined
      )
    )
    expect(
      await screen.findByText('System fallback reached.')
    ).toBeInTheDocument()
  })

  it('requires an API key before the first provider override can be saved', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject],
      total: 1,
    })
    apiMocks.getProjectAIProvider.mockResolvedValue({
      api_key_set: false,
      enabled: false,
      temperature: 0.2,
      timeout_ms: 30000,
      max_output_tokens: 1000,
    })
    const screen = renderSettings(superAdmin)

    expect(await screen.findByLabelText('Project API key')).toBeRequired()
  })

  it('reports system query and save failures without showing an empty state', async () => {
    apiMocks.getSystemAIProvider.mockRejectedValueOnce(
      new Error('System provider unavailable')
    )
    apiMocks.listSystemAIPrompts.mockRejectedValueOnce(
      new Error('System prompts unavailable')
    )
    const screen = renderSettings(superAdmin)

    expect(
      await screen.findByText('System AI provider could not be loaded')
    ).toBeInTheDocument()
    expect(
      await screen.findByText('AI prompts could not be loaded')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('No AI prompt templates returned.')
    ).not.toBeInTheDocument()
  })

  it('preserves provider values and reports a failed save', async () => {
    apiMocks.updateSystemAIProvider.mockRejectedValueOnce(
      new Error('Provider persistence failed')
    )
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)
    const model = await screen.findByLabelText('Model', {
      selector: '#system-ai-provider-model',
    })

    await user.clear(model)
    await user.type(model, 'gpt-unsaved')
    await user.click(
      screen.getByRole('button', { name: 'Save system provider' })
    )

    expect(
      await screen.findByText('AI settings were not saved')
    ).toBeInTheDocument()
    expect(screen.getByText(/Provider persistence failed/)).toBeInTheDocument()
    expect(model).toHaveValue('gpt-unsaved')
  })

  it('preserves prompt values and reports a failed save', async () => {
    apiMocks.updateSystemAIPrompt.mockRejectedValueOnce(
      new Error('Prompt persistence failed')
    )
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)
    const prompt = await screen.findByLabelText('System prompt', {
      selector: '#system-page_chat-system-prompt',
    })

    await user.clear(prompt)
    await user.type(prompt, 'Unsaved system prompt')
    await user.click(
      screen.getByRole('button', { name: 'Save system prompt page_chat' })
    )

    expect(
      await screen.findByText('AI settings were not saved')
    ).toBeInTheDocument()
    expect(screen.getByText(/Prompt persistence failed/)).toBeInTheDocument()
    expect(prompt).toHaveValue('Unsaved system prompt')
  })

  it('coalesces rapid provider and prompt saves while each request is pending', async () => {
    const providerSave = deferred<AIProviderDTO>()
    const promptSave = deferred<AIPromptTemplateDTO>()
    apiMocks.updateSystemAIProvider.mockReturnValueOnce(providerSave.promise)
    apiMocks.updateSystemAIPrompt.mockReturnValueOnce(promptSave.promise)
    const screen = renderSettings(superAdmin)
    const providerButton = await screen.findByRole('button', {
      name: 'Save system provider',
    })
    const promptButton = screen.getByRole('button', {
      name: 'Save system prompt page_chat',
    })
    const providerForm = providerButton.closest('form')
    const promptForm = promptButton.closest('form')
    if (!providerForm || !promptForm)
      throw new Error('missing AI settings form')

    fireEvent.submit(providerForm)
    fireEvent.submit(providerForm)
    fireEvent.submit(promptForm)
    fireEvent.submit(promptForm)

    await waitFor(() => {
      expect(apiMocks.updateSystemAIProvider).toHaveBeenCalledOnce()
      expect(apiMocks.updateSystemAIPrompt).toHaveBeenCalledOnce()
    })
    await act(async () => {
      providerSave.resolve(provider('system'))
      promptSave.resolve(prompts('system')[0]!)
      await Promise.all([providerSave.promise, promptSave.promise])
    })
  })

  it('does not show a late project save error after switching projects', async () => {
    const projectB = project('project-b', 'Project B', 1)
    const save = deferred<AIProviderDTO>()
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject, projectB],
      total: 2,
    })
    apiMocks.updateProjectAIProvider.mockReturnValueOnce(save.promise)
    const user = userEvent.setup()
    const screen = renderSettings(superAdmin)
    const saveButton = await screen.findByRole('button', {
      name: 'Save project provider',
    })

    await user.click(saveButton)
    await waitFor(() =>
      expect(apiMocks.updateProjectAIProvider).toHaveBeenCalledWith(
        activeProject.id,
        expect.any(Object)
      )
    )
    await user.selectOptions(
      screen.getByLabelText('Project provider scope'),
      projectB.id
    )
    await screen.findByDisplayValue('Provider project-b')
    await act(async () => {
      save.reject(new Error('Project A save failed'))
      await save.promise.catch(() => undefined)
    })
    expect(screen.queryByText(/Project A save failed/)).not.toBeInTheDocument()
  })
})

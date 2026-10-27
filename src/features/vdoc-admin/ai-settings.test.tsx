import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { selectOption } from '@/test/select-option'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
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
  revealSystemAIProviderKey: vi.fn(),
  revealProjectAIProviderKey: vi.fn(),
  listSystemAIProviderModels: vi.fn(),
  listProjectAIProviderModels: vi.fn(),
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
  can_access_audit: true,
  status: 1,
}

const reader: AuthUser = {
  id: 'reader',
  email: 'reader@example.com',
  name: 'Reader',
  is_super_admin: false,
  can_access_audit: false,
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

async function renderSettings(
  user: AuthUser,
  scope: 'system' | 'project' = 'project'
) {
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
  const screen = render(wrap(<AISettingsPanel user={user} />))
  if (user.is_super_admin && scope === 'project') {
    await userEvent.click(screen.getByRole('tab', { name: 'Project override' }))
  }
  return screen
}

describe('AISettingsPanel project boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject, archivedProject],
      total: 2,
    })
    apiMocks.getSystemAIProvider.mockResolvedValue(provider('system'))
    apiMocks.listSystemAIProviderModels.mockResolvedValue({
      models: ['gpt-test', 'remote-system-model'],
    })
    apiMocks.listProjectAIProviderModels.mockResolvedValue({
      models: ['gpt-test', 'remote-project-model'],
    })
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

  it('reveals a saved key only on request and never submits it as a replacement', async () => {
    apiMocks.revealSystemAIProviderKey.mockResolvedValue({
      api_key: 'synthetic-saved-secret',
    })
    apiMocks.updateSystemAIProvider.mockResolvedValue(provider('system'))
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const key = await screen.findByLabelText('System API key')
    expect(key).toHaveValue('••••••••')
    expect(key).toHaveAttribute('type', 'password')
    expect(apiMocks.revealSystemAIProviderKey).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Show API key' }))
    await waitFor(() => expect(key).toHaveValue('synthetic-saved-secret'))
    expect(key).toHaveAttribute('type', 'text')
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    await screen.findByRole('option', { name: 'remote-system-model' })
    expect(apiMocks.listSystemAIProviderModels).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ api_key: expect.anything() }),
      expect.anything()
    )
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Hide API key' }))
    expect(key).toHaveValue('••••••••')
    await user.click(
      screen.getByRole('button', { name: 'Save system provider' })
    )
    await waitFor(() =>
      expect(apiMocks.updateSystemAIProvider).toHaveBeenCalled()
    )
    expect(
      apiMocks.updateSystemAIProvider.mock.calls[0][0].api_key
    ).toBeUndefined()
  })

  it('aborts a pending key reveal when replacing credentials', async () => {
    const pending = deferred<{ api_key: string }>()
    apiMocks.revealSystemAIProviderKey.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const key = await screen.findByLabelText('System API key')
    await user.click(screen.getByRole('button', { name: 'Show API key' }))
    const signal = apiMocks.revealSystemAIProviderKey.mock.calls[0][0]
      .signal as AbortSignal
    await user.click(screen.getByRole('button', { name: 'Replace key' }))
    expect(signal.aborted).toBe(true)
    await user.type(key, 'new-synthetic-key')
    await act(async () =>
      pending.resolve({ api_key: 'stale-synthetic-secret' })
    )
    expect(key).toHaveValue('new-synthetic-key')
    expect(key).toHaveAttribute('type', 'password')
  })

  it('uses Responses for new configuration and resets temperature without submitting', async () => {
    apiMocks.getSystemAIProvider.mockResolvedValue({
      api_key_set: false,
      enabled: false,
    })
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const slider = await screen.findByRole('slider', { name: 'Temperature' })
    expect(screen.getByLabelText('API mode')).toHaveValue('responses')
    expect(slider).toHaveValue('0.2')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(slider).toHaveValue('0')
    fireEvent.change(slider, { target: { value: '1.3' } })
    await user.click(
      screen.getByRole('button', { name: 'Reset temperature to 0.2' })
    )
    expect(slider).toHaveValue('0.2')
    expect(apiMocks.updateSystemAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.testSystemAIProvider).not.toHaveBeenCalled()
  })

  it('loads remote models with saved credentials and still saves a manually entered model', async () => {
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const model = await screen.findByRole('textbox', { name: 'Model' })
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    await user.click(
      await screen.findByRole('option', { name: 'remote-system-model' })
    )
    expect(model).toHaveValue('remote-system-model')
    expect(model).toHaveFocus()
    expect(apiMocks.listSystemAIProviderModels).toHaveBeenCalledWith(
      { base_url: 'https://api.openai.example', timeout_ms: 30000 },
      { signal: expect.any(AbortSignal) }
    )
    expect(apiMocks.updateSystemAIProvider).not.toHaveBeenCalled()
    await user.clear(model)
    await user.type(model, 'my-private-model')
    await user.click(
      screen.getByRole('button', { name: 'Save system provider' })
    )
    expect(apiMocks.updateSystemAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'my-private-model' })
    )
  })

  it('keeps custom model entry available when remote discovery fails', async () => {
    apiMocks.listSystemAIProviderModels.mockRejectedValueOnce(
      new Error('Unsupported models API')
    )
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const model = await screen.findByRole('textbox', { name: 'Model' })
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    await screen.findByText(/Could not load models/)
    await user.keyboard('{Escape}')
    expect(model).toHaveValue('gpt-test')
    await user.clear(model)
    await user.type(model, 'custom-despite-no-list')
    await user.click(
      screen.getByRole('button', { name: 'Save system provider' })
    )
    expect(apiMocks.updateSystemAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-despite-no-list' })
    )
  })

  it('uses project-scoped model discovery and preserves the model until a choice is made', async () => {
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin)
    await selectOption(
      screen.getByRole('combobox', { name: 'Project provider scope' }),
      activeProject.id
    )
    const model = await screen.findByRole('textbox', { name: 'Model' })
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    const option = await screen.findByRole('option', {
      name: 'remote-project-model',
    })
    expect(model).toHaveValue('gpt-test')
    expect(apiMocks.listProjectAIProviderModels).toHaveBeenCalledWith(
      activeProject.id,
      { base_url: 'https://api.openai.example', timeout_ms: 30000 },
      { signal: expect.any(AbortSignal) }
    )
    expect(apiMocks.listSystemAIProviderModels).not.toHaveBeenCalled()
    await user.click(option)
    expect(model).toHaveValue('remote-project-model')
  })

  it('aborts and ignores a late model list after the connection changes', async () => {
    const old = deferred<{ models: string[] }>()
    apiMocks.listSystemAIProviderModels.mockReturnValueOnce(old.promise)
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    await screen.findByRole('textbox', { name: 'Model' })
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    await waitFor(() =>
      expect(apiMocks.listSystemAIProviderModels).toHaveBeenCalledTimes(1)
    )
    const signal = apiMocks.listSystemAIProviderModels.mock.calls[0][1]
      .signal as AbortSignal
    await user.keyboard('{Escape}')
    const url = screen.getByRole('textbox', { name: 'Base URL' })
    await user.clear(url)
    await user.type(url, 'https://new-provider.example')
    await user.click(screen.getByRole('button', { name: 'Replace key' }))
    await user.type(screen.getByLabelText('System API key'), 'new-test-key')
    expect(signal.aborted).toBe(true)
    await act(async () => old.resolve({ models: ['stale-old-provider-model'] }))
    await user.click(
      screen.getByRole('button', { name: 'Browse provider models' })
    )
    await screen.findByRole('option', { name: 'remote-system-model' })
    expect(
      screen.queryByRole('option', { name: 'stale-old-provider-model' })
    ).not.toBeInTheDocument()
    expect(apiMocks.listSystemAIProviderModels).toHaveBeenLastCalledWith(
      {
        base_url: 'https://new-provider.example',
        api_key: 'new-test-key',
        timeout_ms: 30000,
      },
      { signal: expect.any(AbortSignal) }
    )
  })

  it('groups each scope and preserves provider and prompt drafts when switching scopes', async () => {
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin, 'system')
    const systemModel = await screen.findByLabelText('Model', {
      selector: '#system-ai-provider-model',
    })
    const systemPrompt = await screen.findByLabelText('System prompt', {
      selector: '#system-page_chat-system-prompt',
    })
    await user.clear(systemModel)
    await user.type(systemModel, 'unsaved-system-model')
    await user.clear(systemPrompt)
    await user.type(systemPrompt, 'Unsaved system instructions')
    expect(
      screen.getByRole('button', { name: 'Save system provider' })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Save project provider' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Project override' }))
    const projectModel = await screen.findByLabelText('Model', {
      selector: '#project-ai-provider-model',
    })
    const projectPrompt = await screen.findByLabelText('System prompt', {
      selector: '#project-page_chat-system-prompt',
    })
    await user.clear(projectModel)
    await user.type(projectModel, 'unsaved-project-model')
    await user.clear(projectPrompt)
    await user.type(projectPrompt, 'Unsaved project instructions')
    expect(
      screen.getByRole('button', { name: 'Save project provider' })
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Save system provider' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'System defaults' }))
    expect(systemModel).toHaveValue('unsaved-system-model')
    expect(systemPrompt).toHaveValue('Unsaved system instructions')
    expect(systemModel).toBeVisible()
    expect(projectModel).not.toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'Project override' }))
    expect(projectModel).toHaveValue('unsaved-project-model')
    expect(projectPrompt).toHaveValue('Unsaved project instructions')
    expect(apiMocks.updateSystemAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.updateProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.updateSystemAIPrompt).not.toHaveBeenCalled()
    expect(apiMocks.updateProjectAIPrompt).not.toHaveBeenCalled()
  })

  it('keeps archived project configuration reachable but disables every mutation', async () => {
    const user = userEvent.setup()
    const screen = await renderSettings(superAdmin)
    const projectSelect = await screen.findByLabelText('Project provider scope')

    await user.click(projectSelect)
    const archivedOption = await screen.findByRole('option', {
      name: 'Archived project — Archived',
    })
    expect(archivedOption).toBeInTheDocument()
    await user.click(archivedOption)

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

  it('does not select an archived project implicitly when no active project exists', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [archivedProject],
      total: 1,
    })

    const screen = await renderSettings(superAdmin)
    const projectSelect = await screen.findByLabelText('Project provider scope')

    expect(projectSelect).toHaveValue('')
    await userEvent.click(projectSelect)
    expect(
      await screen.findByRole('option', {
        name: 'Archived project — Archived',
      })
    ).toBeInTheDocument()
    expect(apiMocks.getProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.listProjectAIPrompts).not.toHaveBeenCalled()
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
    const screen = await renderSettings(reader)

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
    expect(
      screen.queryByRole('tab', { name: 'System defaults' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Project override' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(apiMocks.getSystemAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.listSystemAIPrompts).not.toHaveBeenCalled()
  })

  it('does not grant project AI management through a disabled admin membership', async () => {
    apiMocks.listProjects.mockResolvedValue({
      items: [activeProject],
      total: 1,
    })
    apiMocks.listProjectMembers.mockResolvedValue({
      items: [
        {
          project_id: activeProject.id,
          user_id: reader.id,
          role: 3,
          status: 2,
          added_by: 'super-admin',
          created_at: timestamp,
          updated_at: timestamp,
        },
      ],
      total: 1,
    })

    const screen = await renderSettings(reader)

    expect(
      await screen.findByText('Project AI configuration is restricted')
    ).toBeInTheDocument()
    expect(apiMocks.getProjectAIProvider).not.toHaveBeenCalled()
    expect(apiMocks.listProjectAIPrompts).not.toHaveBeenCalled()
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
    const screen = await renderSettings(superAdmin)
    const projectSelect = await screen.findByLabelText('Project provider scope')

    expect(
      await screen.findByDisplayValue('Provider project-active')
    ).toBeInTheDocument()
    await selectOption(projectSelect, projectB.id, user)

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
    const screen = await renderSettings(superAdmin)

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
    const screen = await renderSettings(superAdmin)

    expect(await screen.findByLabelText('Project API key')).toBeRequired()
  })

  it('reports system query and save failures without showing an empty state', async () => {
    apiMocks.getSystemAIProvider.mockRejectedValueOnce(
      new Error('System provider unavailable')
    )
    apiMocks.listSystemAIPrompts.mockRejectedValueOnce(
      new Error('System prompts unavailable')
    )
    const screen = await renderSettings(superAdmin, 'system')

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
    const screen = await renderSettings(superAdmin, 'system')
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
    const screen = await renderSettings(superAdmin, 'system')
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
    const screen = await renderSettings(superAdmin, 'system')
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
    const screen = await renderSettings(superAdmin)
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
    await selectOption(
      screen.getByLabelText('Project provider scope'),
      projectB.id,
      user
    )
    await screen.findByDisplayValue('Provider project-b')
    await act(async () => {
      save.reject(new Error('Project A save failed'))
      await save.promise.catch(() => undefined)
    })
    expect(screen.queryByText(/Project A save failed/)).not.toBeInTheDocument()
  })
})

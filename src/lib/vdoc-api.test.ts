import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { clearCookies } from '@/test-utils/cookies'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import {
  approveDraft,
  createAIChatSession,
  getIdentity,
  getSystemAIProvider,
  getAISummary,
  listSystemAIPrompts,
  listUsers,
  rejectDraft,
  regenerateAISummary,
  resolveApiBaseUrl,
  requestDraftChanges,
  sendAIChatMessage,
  submitDraft,
  testProjectAIProvider,
  updateProjectAIPrompt,
  updateSystemAIProvider,
  unwrapEnvelope,
  unwrapListEnvelope,
  vdocApi,
  type AIProviderDTO,
  type DraftDTO,
  type VdocApiError,
  type VdocEnvelope,
} from './vdoc-api'

const originalAdapter = vdocApi.defaults.adapter
const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

const sampleUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Vdoc Admin',
  is_super_admin: true,
  status: 1,
}

describe('vdoc-api', () => {
  beforeEach(() => {
    clearCookies()
    useAuthStore.getState().auth.reset()
    vdocApi.defaults.adapter = originalAdapter
    window.__VDOC_ADMIN_CONFIG__ = undefined
  })

  afterEach(() => {
    window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
    vi.unstubAllEnvs()
  })

  it('prefers runtime config over Vite env and normalizes trailing slash', () => {
    vi.stubEnv('VITE_VDOC_API_BASE_URL', 'https://vite-api.example.test')
    window.__VDOC_ADMIN_CONFIG__ = {
      apiBaseUrl: 'https://runtime-api.example.test///',
    }

    expect(resolveApiBaseUrl()).toBe('https://runtime-api.example.test')
  })

  it('uses Vite env when runtime config is absent and normalizes trailing slash', () => {
    vi.stubEnv('VITE_VDOC_API_BASE_URL', 'https://vite-api.example.test/')

    expect(resolveApiBaseUrl()).toBe('https://vite-api.example.test')
  })

  it('sends the raw Vdoc JWT in the Authorization header', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: sampleUser,
    })
    useAuthStore.getState().auth.setAccessToken('raw.jwt.token')

    await expect(getIdentity()).resolves.toEqual(sampleUser)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('/api/v1/private/identity/me')
    expect(headerValue(requests[0]?.headers, 'Authorization')).toBe(
      'raw.jwt.token'
    )
  })

  it('does not send Authorization when no token is present', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: sampleUser,
    })

    await expect(getIdentity()).resolves.toEqual(sampleUser)

    expect(headerValue(requests[0]?.headers, 'Authorization')).toBeUndefined()
  })

  it('throws VdocApiError for non-OK envelopes', async () => {
    await expect(
      unwrapEnvelope(
        Promise.resolve({
          data: {
            code: 401,
            status: 'UNAUTHENTICATED',
            message: 'session expired',
            timestamp: 1,
          },
        })
      )
    ).rejects.toMatchObject({
      name: 'VdocApiError',
      code: 401,
      status: 'UNAUTHENTICATED',
      message: 'session expired',
    } satisfies Partial<VdocApiError>)
  })

  it('unwraps ReturnOkWithTotal envelopes into items and total', async () => {
    await expect(
      unwrapListEnvelope(
        Promise.resolve({
          data: {
            code: 200,
            status: 'OK',
            timestamp: 1,
            total: 12,
            detail: [sampleUser],
          },
        })
      )
    ).resolves.toEqual({ items: [sampleUser], total: 12 })
  })

  it('uses the real system users endpoint through the list helper', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      total: 1,
      detail: [sampleUser],
    })
    useAuthStore.getState().auth.setAccessToken('admin.jwt')

    await expect(listUsers()).resolves.toEqual({
      items: [sampleUser],
      total: 1,
    })

    expect(requests[0]?.url).toBe('/api/v1/private/system/users')
    expect(headerValue(requests[0]?.headers, 'Authorization')).toBe('admin.jwt')
  })

  it('submits drafts without a request body', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, draftEnvelope())

    await expect(
      submitDraft('project-1', 'document-1', 'draft-1')
    ).resolves.toMatchObject({
      id: 'draft-1',
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/drafts/draft-1/submit'
    )
    expect(requests[0]?.data).toBeUndefined()
  })

  it('sends review comments when approving drafts', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, draftEnvelope())

    await approveDraft('project-1', 'document-1', 'draft-1', {
      comment: 'Looks good after content review.',
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/drafts/draft-1/approve'
    )
    expect(requests[0]?.data).toBe(
      JSON.stringify({ comment: 'Looks good after content review.' })
    )
  })

  it('sends review comments when requesting changes', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, draftEnvelope())

    await requestDraftChanges('project-1', 'document-1', 'draft-1', {
      comment: 'Please add the missing agent setup section.',
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/drafts/draft-1/request-changes'
    )
    expect(requests[0]?.data).toBe(
      JSON.stringify({ comment: 'Please add the missing agent setup section.' })
    )
  })

  it('sends review comments when rejecting drafts', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, draftEnvelope())

    await rejectDraft('project-1', 'document-1', 'draft-1', {
      comment: 'Rejecting until the source branch is corrected.',
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/drafts/draft-1/reject'
    )
    expect(requests[0]?.data).toBe(
      JSON.stringify({
        comment: 'Rejecting until the source branch is corrected.',
      })
    )
  })

  it('reads masked system AI providers without exposing raw API keys', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const provider: AIProviderDTO = {
      id: 'provider-1',
      scope: 'system',
      name: 'OpenAI compatible',
      base_url: 'https://ai.example.test',
      model: 'gpt-test',
      api_mode: 'chat_completions',
      api_key_set: true,
      api_key_last4: '1234',
      enabled: true,
    }
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: provider,
    })

    const result = await getSystemAIProvider()

    expect(requests[0]?.url).toBe('/api/v1/private/ai/provider')
    expect(result.api_key_set).toBe(true)
    expect('api_key' in result).toBe(false)
  })

  it('updates system AI providers with OpenAI-compatible mode settings', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: {
        api_key_set: true,
        enabled: true,
      },
    })

    await updateSystemAIProvider({
      name: 'OpenAI compatible',
      base_url: 'https://ai.example.test',
      model: 'gpt-test',
      api_mode: 'responses',
      api_key: 'sk-secret-1234',
      enabled: true,
    })

    expect(requests[0]?.url).toBe('/api/v1/private/ai/provider')
    expect(requests[0]?.method).toBe('put')
    expect(requests[0]?.data).toBe(
      JSON.stringify({
        name: 'OpenAI compatible',
        base_url: 'https://ai.example.test',
        model: 'gpt-test',
        api_mode: 'responses',
        api_key: 'sk-secret-1234',
        enabled: true,
      })
    )
  })

  it('tests project AI providers against the project scoped endpoint', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: { ok: true, content: 'Provider reached.' },
    })

    await testProjectAIProvider('project-1', {
      name: 'Project provider',
      base_url: 'https://project-ai.example.test',
      model: 'gpt-project',
      api_mode: 'chat_completions',
      api_key: 'sk-project-1234',
      enabled: true,
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/ai/provider/test'
    )
    expect(requests[0]?.method).toBe('post')
  })

  it('lists and updates AI prompt templates', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const prompt = {
      prompt_key: 'diff_change_summary',
      system_prompt: 'Explain diffs only.',
      user_prompt_template: 'Context: {{context}}',
      enabled: true,
    }
    vdocApi.defaults.adapter = async (config) => {
      requests.push(config)
      return {
        data:
          config.method === 'get'
            ? {
                code: 200,
                status: 'OK',
                timestamp: 1,
                total: 1,
                detail: [prompt],
              }
            : {
                code: 200,
                status: 'OK',
                timestamp: 1,
                detail: {
                  ...prompt,
                  id: 'prompt-1',
                  scope: 'project',
                  project_id: 'project-1',
                  created_by: 'user-1',
                  updated_by: 'user-1',
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                },
              },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } satisfies AxiosResponse<VdocEnvelope<unknown>>
    }

    await expect(listSystemAIPrompts()).resolves.toEqual({
      items: [prompt],
      total: 1,
    })
    await updateProjectAIPrompt('project-1', 'diff_change_summary', prompt)

    expect(requests[0]?.url).toBe('/api/v1/private/ai/prompts')
    expect(requests[1]?.url).toBe(
      '/api/v1/private/projects/project-1/ai/prompts/diff_change_summary'
    )
    expect(requests[1]?.data).toBe(JSON.stringify(prompt))
  })

  it('uses AI summary endpoints for page-scoped summaries', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: aiSummaryEnvelopeDetail(),
    })

    await getAISummary({
      projectId: 'project-1',
      documentId: 'document-1',
      ownerType: 'diff',
      ownerId: 'diff-1',
    })
    await regenerateAISummary({
      projectId: 'project-1',
      documentId: 'document-1',
      ownerType: 'version',
      ownerId: 'version-1',
    })

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/diffs/diff-1/ai-summary'
    )
    expect(requests[1]?.url).toBe(
      '/api/v1/private/projects/project-1/documents/document-1/versions/version-1/ai-summary/regenerate'
    )
    expect(requests[1]?.method).toBe('post')
    expect(requests[1]?.data).toBeUndefined()
  })

  it('creates AI chat sessions and sends scoped messages', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: {
        id: 'message-1',
        session_id: 'session-1',
        role: 'assistant',
        content: 'Scoped answer.',
        created_at: '2026-01-01T00:00:00Z',
      },
    })

    await createAIChatSession('project-1', {
      document_id: 'document-1',
      context_type: 'draft',
      context_id: 'draft-1',
      title: 'Draft chat',
    })
    await sendAIChatMessage('project-1', 'session-1', 'What changed?')

    expect(requests[0]?.url).toBe(
      '/api/v1/private/projects/project-1/ai/chat-sessions'
    )
    expect(requests[0]?.data).toBe(
      JSON.stringify({
        document_id: 'document-1',
        context_type: 'draft',
        context_id: 'draft-1',
        title: 'Draft chat',
      })
    )
    expect(requests[1]?.url).toBe(
      '/api/v1/private/projects/project-1/ai/chat-sessions/session-1/messages'
    )
    expect(requests[1]?.data).toBe(JSON.stringify({ content: 'What changed?' }))
  })
})

function draftEnvelope(): VdocEnvelope<DraftDTO> {
  return {
    code: 200,
    status: 'OK',
    timestamp: 1,
    detail: {
      id: 'draft-1',
      project_id: 'project-1',
      document_id: 'document-1',
      branch_id: 'branch-1',
      version_name: 'v1',
      changelog: 'Initial draft',
      document_format: 1,
      source_type: 1,
      status: 2,
      created_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  }
}

function aiSummaryEnvelopeDetail() {
  return {
    id: 'summary-1',
    project_id: 'project-1',
    document_id: 'document-1',
    owner_type: 'diff',
    owner_id: 'diff-1',
    prompt_key: 'diff_change_summary',
    status: 'succeeded',
    content: 'AI summary.',
    generated_by: 'user-1',
    generated_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function jsonEnvelopeAdapter<T>(
  requests: InternalAxiosRequestConfig[],
  envelope: VdocEnvelope<T>
): AxiosAdapter {
  return async (config) => {
    requests.push(config)
    return {
      data: envelope,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } satisfies AxiosResponse<VdocEnvelope<T>>
  }
}

function headerValue(
  headers: InternalAxiosRequestConfig['headers'] | undefined,
  name: string
) {
  return headers?.get?.(name)
}

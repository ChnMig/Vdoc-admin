import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAIChatSession,
  listAIChatSessions,
  sendAIChatMessage,
  type AIChatMessageDTO,
  type AIChatSessionDTO,
  type AIChatSessionDetailDTO,
  type AIChatSessionPayload,
  type AISummaryDTO,
  type AISummaryTarget,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { AIContextPanel } from './ai-panels'

const apiMocks = vi.hoisted(() => ({
  createAIChatSession: vi.fn(),
  getAIChatSession: vi.fn(),
  getAISummary: vi.fn(),
  listAIChatSessions: vi.fn(),
  regenerateAISummary: vi.fn(),
  sendAIChatMessage: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vdoc-api')>()
  return {
    ...actual,
    createAIChatSession: apiMocks.createAIChatSession,
    getAIChatSession: apiMocks.getAIChatSession,
    getAISummary: apiMocks.getAISummary,
    listAIChatSessions: apiMocks.listAIChatSessions,
    regenerateAISummary: apiMocks.regenerateAISummary,
    sendAIChatMessage: apiMocks.sendAIChatMessage,
  }
})

const createdAt = '2026-01-01T00:00:00Z'

const targetA = {
  projectId: 'project-1',
  documentId: 'document-1',
  ownerType: 'version',
  ownerId: 'version-1',
} satisfies AISummaryTarget

const targetB = {
  ...targetA,
  ownerId: 'version-2',
} satisfies AISummaryTarget

const chatMessagesBySession = new Map<string, AIChatMessageDTO[]>()

function renderPanel(
  target: AISummaryTarget,
  permissions: { interactive?: boolean; canRegenerate?: boolean } = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const elementForTarget = (nextTarget: AISummaryTarget) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AIContextPanel target={nextTarget} {...permissions} />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(elementForTarget(target))

  return {
    ...screen,
    rerenderTarget: (nextTarget: AISummaryTarget) =>
      screen.rerender(elementForTarget(nextTarget)),
  }
}

function summaryForTarget(target: AISummaryTarget) {
  return {
    id: `summary-${target.ownerId}`,
    project_id: target.projectId,
    document_id: target.documentId,
    owner_type: target.ownerType,
    owner_id: target.ownerId,
    prompt_key: 'summary.default',
    status: 'ready',
    content: `Summary for ${target.ownerId}`,
    generated_by: 'user-1',
    generated_at: createdAt,
    updated_at: createdAt,
  } satisfies AISummaryDTO
}

function chatSessionFor(projectId: string, payload: AIChatSessionPayload) {
  return {
    id: `session-${payload.context_id}`,
    project_id: projectId,
    document_id: payload.document_id,
    context_type: payload.context_type,
    context_id: payload.context_id,
    title: payload.title ?? `AI chat for ${payload.context_type}`,
    created_by: 'user-1',
    created_at: createdAt,
    updated_at: createdAt,
  } satisfies AIChatSessionDTO
}

function chatSessionDetail(projectId: string, sessionId: string) {
  const contextId = sessionId.replace('session-', '')
  return {
    session: {
      id: sessionId,
      project_id: projectId,
      document_id: 'document-1',
      context_type: 'version',
      context_id: contextId,
      title: `AI chat for version ${contextId}`,
      created_by: 'user-1',
      created_at: createdAt,
      updated_at: createdAt,
    },
    messages: chatMessagesBySession.get(sessionId) ?? [],
  } satisfies AIChatSessionDetailDTO
}

function messageForSession(sessionId: string, content: string) {
  const contextId = sessionId.replace('session-', '')
  return {
    id: `message-${contextId}`,
    session_id: sessionId,
    role: 'assistant',
    content: `answer for ${contextId}: ${content}`,
    created_at: createdAt,
  } satisfies AIChatMessageDTO
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('AIContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatMessagesBySession.clear()
    apiMocks.getAISummary.mockImplementation(async (target: AISummaryTarget) =>
      summaryForTarget(target)
    )
    apiMocks.regenerateAISummary.mockImplementation(
      async (target: AISummaryTarget) => summaryForTarget(target)
    )
    apiMocks.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    apiMocks.createAIChatSession.mockImplementation(
      async (projectId: string, payload: AIChatSessionPayload) =>
        chatSessionFor(projectId, payload)
    )
    apiMocks.getAIChatSession.mockImplementation(
      async (projectId: string, sessionId: string) =>
        chatSessionDetail(projectId, sessionId)
    )
    apiMocks.sendAIChatMessage.mockImplementation(
      async (_projectId: string, sessionId: string, content: string) => {
        const message = messageForSession(sessionId, content)
        chatMessagesBySession.set(sessionId, [message])
        return message
      }
    )
  })

  it('resets chat session and local messages when the target owner changes', async () => {
    const user = userEvent.setup()
    const screen = renderPanel(targetA)

    expect(await screen.findByText('Summary for version-1')).toBeInTheDocument()
    await user.type(screen.getByLabelText('AI chat message'), 'Target A')
    await user.click(screen.getByRole('button', { name: 'Send AI message' }))

    await waitFor(() =>
      expect(sendAIChatMessage).toHaveBeenCalledWith(
        'project-1',
        'session-version-1',
        'Target A'
      )
    )
    expect(createAIChatSession).toHaveBeenCalledWith('project-1', {
      document_id: 'document-1',
      context_type: 'version',
      context_id: 'version-1',
      title: 'AI chat for version version-1',
    })
    expect(
      await screen.findByText('answer for version-1: Target A')
    ).toBeInTheDocument()

    screen.rerenderTarget(targetB)

    expect(await screen.findByText('Summary for version-2')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('answer for version-1: Target A')
      ).not.toBeInTheDocument()
    )
    await user.type(screen.getByLabelText('AI chat message'), 'Target B')
    await user.click(screen.getByRole('button', { name: 'Send AI message' }))

    await waitFor(() =>
      expect(createAIChatSession).toHaveBeenCalledWith('project-1', {
        document_id: 'document-1',
        context_type: 'version',
        context_id: 'version-2',
        title: 'AI chat for version version-2',
      })
    )
    expect(sendAIChatMessage).toHaveBeenLastCalledWith(
      'project-1',
      'session-version-2',
      'Target B'
    )
    expect(sendAIChatMessage).not.toHaveBeenCalledWith(
      'project-1',
      'session-version-1',
      'Target B'
    )
  })

  it('renders skipped summary status and backend error when content is unavailable', async () => {
    apiMocks.getAISummary.mockResolvedValueOnce({
      ...summaryForTarget(targetA),
      status: 'skipped',
      content: undefined,
      error_message: 'Provider is not configured for this project.',
    } satisfies AISummaryDTO)

    const screen = renderPanel(targetA)

    expect(
      await screen.findByText('AI summary status: Skipped')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Provider is not configured for this project.')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('No AI summary has been generated yet.')
    ).not.toBeInTheDocument()
  })

  it('renders the empty state when the backend has no summary yet', async () => {
    apiMocks.getAISummary.mockResolvedValueOnce(null)

    const screen = renderPanel(targetA)

    expect(
      await screen.findByText('No AI summary has been generated yet.')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('AI chat message')).toBeEnabled()
  })

  it('renders an in-flight summary as pending', async () => {
    apiMocks.getAISummary.mockResolvedValueOnce({
      ...summaryForTarget(targetA),
      status: 'pending',
      content: undefined,
      error_message: undefined,
    } satisfies AISummaryDTO)

    const screen = renderPanel(targetA)

    expect(
      await screen.findByText('AI summary status: Pending')
    ).toBeInTheDocument()
  })

  it('preserves a failed chat message and clears it only after success', async () => {
    const user = userEvent.setup()
    apiMocks.sendAIChatMessage
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockImplementationOnce(
        async (_projectId: string, sessionId: string, content: string) =>
          messageForSession(sessionId, content)
      )
    const screen = renderPanel(targetA)
    const message = await screen.findByLabelText('AI chat message')

    await user.type(message, 'Please keep this prompt')
    await user.click(screen.getByRole('button', { name: 'Send AI message' }))
    await waitFor(() =>
      expect(apiMocks.sendAIChatMessage).toHaveBeenCalledOnce()
    )
    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument()
    expect(message).toHaveValue('Please keep this prompt')

    await user.click(screen.getByRole('button', { name: 'Send AI message' }))
    await waitFor(() => expect(message).toHaveValue(''))
  })

  it('coalesces rapid first-message submissions into one session and one send', async () => {
    const sessionCreation = deferred<AIChatSessionDTO>()
    apiMocks.createAIChatSession.mockReturnValueOnce(sessionCreation.promise)
    const screen = renderPanel(targetA)
    const message = await screen.findByLabelText('AI chat message')
    fireEvent.change(message, { target: { value: 'Only send once' } })
    const form = message.closest('form')
    if (!form) throw new Error('missing chat form')

    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() =>
      expect(apiMocks.createAIChatSession).toHaveBeenCalledOnce()
    )
    expect(apiMocks.sendAIChatMessage).not.toHaveBeenCalled()
    sessionCreation.resolve(
      chatSessionFor(targetA.projectId, {
        document_id: targetA.documentId,
        context_type: targetA.ownerType,
        context_id: targetA.ownerId,
        title: 'AI chat for version version-1',
      })
    )

    await waitFor(() =>
      expect(apiMocks.sendAIChatMessage).toHaveBeenCalledOnce()
    )
    expect(apiMocks.sendAIChatMessage).toHaveBeenCalledWith(
      'project-1',
      'session-version-1',
      'Only send once'
    )
  })

  it('restores the newest existing chat session after a refresh', async () => {
    const existing = chatSessionFor('project-1', {
      document_id: 'document-1',
      context_type: 'version',
      context_id: 'version-1',
      title: 'Earlier discussion',
    })
    chatMessagesBySession.set(existing.id, [
      messageForSession(existing.id, 'Recovered history'),
    ])
    apiMocks.listAIChatSessions.mockResolvedValue({
      items: [existing],
      total: 1,
    })
    const screen = renderPanel(targetA)

    expect(await screen.findByText('Earlier discussion')).toBeInTheDocument()
    expect(
      await screen.findByText('answer for version-1: Recovered history')
    ).toBeInTheDocument()
    expect(listAIChatSessions).toHaveBeenCalledWith(targetA)
    expect(apiMocks.createAIChatSession).not.toHaveBeenCalled()
  })

  it('keeps archived AI history readable and disables new work', async () => {
    const existing = chatSessionFor('project-1', {
      document_id: 'document-1',
      context_type: 'version',
      context_id: 'version-1',
      title: 'Archived discussion',
    })
    chatMessagesBySession.set(existing.id, [
      messageForSession(existing.id, 'Archived answer'),
    ])
    apiMocks.listAIChatSessions.mockResolvedValue({
      items: [existing],
      total: 1,
    })
    const user = userEvent.setup()
    const screen = renderPanel(targetA, {
      interactive: false,
      canRegenerate: false,
    })

    expect(await screen.findByText('Summary for version-1')).toBeInTheDocument()
    expect(
      await screen.findByText('answer for version-1: Archived answer')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('AI chat message')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Regenerate AI summary' })
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Send AI message' }))
    expect(apiMocks.createAIChatSession).not.toHaveBeenCalled()
    expect(apiMocks.sendAIChatMessage).not.toHaveBeenCalled()
    expect(apiMocks.regenerateAISummary).not.toHaveBeenCalled()
  })

  it('renders failed summary status and backend error when content is blank', async () => {
    apiMocks.getAISummary.mockResolvedValueOnce({
      ...summaryForTarget(targetA),
      status: 'failed',
      content: '   ',
      error_message: 'OpenAI returned an authentication error.',
    } satisfies AISummaryDTO)

    const screen = renderPanel(targetA)

    expect(
      await screen.findByText('AI summary status: Failed')
    ).toBeInTheDocument()
    expect(
      screen.getByText('OpenAI returned an authentication error.')
    ).toBeInTheDocument()
    expect(screen.queryByText('   ')).not.toBeInTheDocument()
  })
})

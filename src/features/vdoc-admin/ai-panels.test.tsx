import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAIChatSession,
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

function renderPanel(target: AISummaryTarget) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const elementForTarget = (nextTarget: AISummaryTarget) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AIContextPanel target={nextTarget} />
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
})

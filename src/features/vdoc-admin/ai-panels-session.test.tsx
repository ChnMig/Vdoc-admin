import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { bindQueryCacheToAuth } from '@/lib/auth-query-cache'
import { LanguageProvider } from '@/context/language-provider'
import { AIContextPanel } from './ai-panels'

const api = vi.hoisted(() => ({
  createAIChatSession: vi.fn(),
  getAIChatSession: vi.fn(),
  getAISummary: vi.fn(),
  listAIChatSessions: vi.fn(),
  regenerateAISummary: vi.fn(),
  sendAIChatMessage: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const target = {
  projectId: 'private-project-a',
  documentId: 'doc-a',
  ownerType: 'version' as const,
  ownerId: 'version-a',
}
const summary = {
  id: 'summary-a',
  project_id: target.projectId,
  document_id: target.documentId,
  owner_type: target.ownerType,
  owner_id: target.ownerId,
  prompt_key: 'summary.default',
  // The production regenerate endpoint returns queued state, not generated text.
  status: 'pending',
  generated_by: 'alice',
  generated_at: '2026-09-29T00:00:00Z',
  updated_at: '2026-09-29T00:00:00Z',
}
afterEach(() => {
  act(() => useAuthStore.getState().auth.reset())
  vi.clearAllMocks()
})

it.each([
  'sign-out',
  'switch-user',
  'same-token session',
  'unmount',
  'same-session control',
])(
  'binds summary intent to its originating session before dispatch: %s',
  async (scenario) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const unbind = bindQueryCacheToAuth(client)
    const user = {
      id: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      status: 1,
      is_super_admin: false,
      can_access_audit: false,
    }
    act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.regenerateAISummary.mockResolvedValue(summary)
    const view = render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AIContextPanel target={target} />
        </LanguageProvider>
      </QueryClientProvider>
    )
    try {
      const button = await view.findByRole('button', {
        name: 'Regenerate AI summary',
      })
      await act(async () => {
        // MutationObserver dispatches after the synchronous click callback.
        fireEvent.click(button)
        if (scenario === 'sign-out') useAuthStore.getState().auth.reset()
        if (scenario === 'switch-user')
          useAuthStore
            .getState()
            .auth.setSession({ ...user, id: 'bob' }, 'bob-token')
        if (scenario === 'same-token session')
          useAuthStore.getState().auth.setSession(user, 'alice-token')
        if (scenario === 'unmount') view.unmount()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      if (scenario === 'same-session control')
        expect(api.regenerateAISummary).toHaveBeenCalledWith(target)
      else expect(api.regenerateAISummary).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      unbind()
      client.clear()
    }
  }
)

it.each(['switch-user', 'same-token session', 'same-session control'])(
  'keeps delayed summary errors inside their originating session: %s',
  async (scenario) => {
    const mutationError = vi.fn()
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false, onError: mutationError },
      },
    })
    const unbind = bindQueryCacheToAuth(client)
    const user = {
      id: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      status: 1,
      is_super_admin: false,
      can_access_audit: false,
    }
    act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    let fail!: (error: Error) => void
    api.regenerateAISummary.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        })
    )
    const view = render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AIContextPanel target={target} />
        </LanguageProvider>
      </QueryClientProvider>
    )
    try {
      fireEvent.click(
        await view.findByRole('button', { name: 'Regenerate AI summary' })
      )
      await waitFor(() =>
        expect(api.regenerateAISummary).toHaveBeenCalledOnce()
      )
      if (scenario === 'switch-user')
        act(() =>
          useAuthStore
            .getState()
            .auth.setSession({ ...user, id: 'bob' }, 'bob-token')
        )
      if (scenario === 'same-token session')
        act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
      await act(async () => {
        fail(new Error('Private Alice summary failure'))
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      if (scenario === 'same-session control') {
        expect(mutationError).toHaveBeenCalledOnce()
        expect(
          view.getByText('Private Alice summary failure')
        ).toBeInTheDocument()
      } else {
        expect(mutationError).not.toHaveBeenCalled()
        expect(
          view.queryByText('Private Alice summary failure')
        ).not.toBeInTheDocument()
      }
    } finally {
      view.unmount()
      unbind()
      client.clear()
    }
  }
)

it.each([
  'sign-out',
  'switch-user',
  'same-token session',
  'same-session control',
])(
  'keeps an in-flight AI mutation inside its originating session: %s',
  async (scenario) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const unbind = bindQueryCacheToAuth(client)
    const user = {
      id: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      status: 1,
      is_super_admin: false,
      can_access_audit: false,
    }
    act(() => {
      useAuthStore.getState().auth.setUser(user)
      useAuthStore.getState().auth.setAccessToken('alice-token')
    })
    let finish!: (value: typeof summary) => void
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.regenerateAISummary.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const view = render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AIContextPanel target={target} />
        </LanguageProvider>
      </QueryClientProvider>
    )
    try {
      await waitFor(() => expect(api.getAISummary).toHaveBeenCalled())
      const button = view
        .getAllByRole('button')
        .find((button) => /regenerat|重新生成/i.test(button.textContent ?? ''))
      expect(
        button,
        'the actual regenerate-summary action must exist'
      ).toBeDefined()
      fireEvent.click(button!)
      await waitFor(() =>
        expect(api.regenerateAISummary).toHaveBeenCalledOnce()
      )
      // Leaving the page is normal during logout; TanStack mutation callbacks still settle.
      view.unmount()
      if (scenario === 'same-token session') {
        act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
        expect(client.getQueryData(['ai-summary', target])).toBeUndefined()
      } else if (scenario !== 'same-session control') {
        act(() => useAuthStore.getState().auth.reset())
        expect(client.getQueryData(['ai-summary', target])).toBeUndefined()
        if (scenario === 'switch-user')
          act(() => {
            useAuthStore
              .getState()
              .auth.setUser({ ...user, id: 'bob', name: 'Bob' })
            useAuthStore.getState().auth.setAccessToken('bob-token')
          })
      }
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      await act(async () => {
        finish(summary)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      const cached = client.getQueryData(['ai-summary', target])
      if (scenario === 'same-session control') {
        expect(cached).toEqual(summary)
        expect(invalidate).toHaveBeenCalledOnce()
      } else {
        expect(
          cached,
          'old AI task metadata must not repopulate the signed-out/new-account cache'
        ).toBeUndefined()
        expect(invalidate).not.toHaveBeenCalled()
      }
    } finally {
      view.unmount()
      unbind()
      client.clear()
    }
  }
)

it.each(['creation', 'reply'])(
  'ignores a delayed AI %s failure after the account changes',
  async (stage) => {
    const mutationError = vi.fn()
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false, onError: mutationError },
      },
    })
    const unbind = bindQueryCacheToAuth(client)
    const user = {
      id: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      status: 1,
      is_super_admin: false,
      can_access_audit: false,
    }
    act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
    let fail!: (error: Error) => void
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.getAIChatSession.mockResolvedValue({ messages: [] })
    const request = new Promise((_resolve, reject) => {
      fail = reject
    })
    api.createAIChatSession.mockImplementation(() =>
      stage === 'creation' ? request : Promise.resolve({ id: 'session-a' })
    )
    api.sendAIChatMessage.mockReturnValue(request)
    const view = render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AIContextPanel target={target} />
        </LanguageProvider>
      </QueryClientProvider>
    )
    try {
      const input = await view.findByLabelText('AI chat message')
      fireEvent.change(input, { target: { value: 'Private Alice prompt' } })
      fireEvent.submit(input.closest('form')!)
      await waitFor(() =>
        expect(
          stage === 'creation' ? api.createAIChatSession : api.sendAIChatMessage
        ).toHaveBeenCalledOnce()
      )
      act(() =>
        useAuthStore
          .getState()
          .auth.setSession({ ...user, id: 'bob' }, 'bob-token')
      )
      await act(async () => {
        fail(new Error('Private Alice provider error'))
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(mutationError).not.toHaveBeenCalled()
      expect(
        view.queryByText('Private Alice provider error')
      ).not.toBeInTheDocument()
    } finally {
      view.unmount()
      unbind()
      client.clear()
    }
  }
)

it.each(
  ['creation', 'reply'].flatMap((stage) =>
    [
      'sign-out',
      'switch-user',
      'same-token session',
      'unmount',
      'target-switch',
      'same-session control',
    ].map((scenario) => ({ stage, scenario }))
  )
)(
  'keeps delayed AI $stage inside its originating session: $scenario',
  async ({ stage, scenario }) => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const unbind = bindQueryCacheToAuth(client)
    const user = {
      id: 'alice',
      name: 'Alice',
      email: 'alice@example.test',
      status: 1,
      is_super_admin: false,
      can_access_audit: false,
    }
    act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
    let finishCreation!: (value: { id: string }) => void
    const message = {
      id: 'message-a',
      session_id: 'session-a',
      role: 'assistant',
      content: 'Private Alice response',
      created_at: '2026-10-05T00:00:00Z',
    }
    let finishReply!: (value: typeof message) => void
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.getAIChatSession.mockResolvedValue({ messages: [] })
    if (stage === 'creation') {
      api.createAIChatSession.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishCreation = resolve
          })
      )
      api.sendAIChatMessage.mockResolvedValue(message)
    } else {
      api.createAIChatSession.mockResolvedValue({ id: 'session-a' })
      api.sendAIChatMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishReply = resolve
          })
      )
    }
    const panel = (ownerId = target.ownerId) => (
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AIContextPanel target={{ ...target, ownerId }} />
        </LanguageProvider>
      </QueryClientProvider>
    )
    const view = render(panel())
    try {
      const input = await view.findByLabelText('AI chat message')
      fireEvent.change(input, { target: { value: 'Private Alice prompt' } })
      fireEvent.submit(input.closest('form')!)
      await waitFor(() =>
        expect(api.createAIChatSession).toHaveBeenCalledOnce()
      )
      if (stage === 'reply')
        await waitFor(() =>
          expect(api.sendAIChatMessage).toHaveBeenCalledOnce()
        )
      if (scenario === 'unmount') view.unmount()
      if (scenario === 'target-switch') view.rerender(panel('version-b'))
      if (scenario === 'sign-out')
        act(() => useAuthStore.getState().auth.reset())
      if (scenario === 'switch-user')
        act(() =>
          useAuthStore
            .getState()
            .auth.setSession({ ...user, id: 'bob' }, 'bob-token')
        )
      if (scenario === 'same-token session')
        act(() => useAuthStore.getState().auth.setSession(user, 'alice-token'))
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      await act(async () => {
        if (stage === 'creation') finishCreation({ id: 'session-a' })
        else finishReply(message)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      if (scenario === 'same-session control') {
        expect(api.sendAIChatMessage).toHaveBeenCalledWith(
          target.projectId,
          'session-a',
          'Private Alice prompt'
        )
        expect(
          await view.findByText('Private Alice response')
        ).toBeInTheDocument()
        expect(input).toHaveValue('')
      } else {
        if (stage === 'creation')
          expect(api.sendAIChatMessage).not.toHaveBeenCalled()
        else expect(api.sendAIChatMessage).toHaveBeenCalledOnce()
        expect(invalidate).not.toHaveBeenCalled()
        expect(
          view.queryByText('Private Alice response')
        ).not.toBeInTheDocument()
      }
    } finally {
      view.unmount()
      unbind()
      client.clear()
    }
  }
)

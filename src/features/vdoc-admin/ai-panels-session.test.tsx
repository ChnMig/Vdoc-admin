import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { bindQueryCacheToAuth } from '@/lib/auth-query-cache'
import { LanguageProvider } from '@/context/language-provider'
import { AIContextPanel } from './ai-panels'

const api = vi.hoisted(() => ({
  getAISummary: vi.fn(),
  listAIChatSessions: vi.fn(),
  regenerateAISummary: vi.fn(),
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

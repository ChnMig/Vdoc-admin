import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { UserAuthForm } from '@/features/auth/sign-in/components/user-auth-form'
import { bindQueryCacheToAuth } from './auth-query-cache'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), login: vi.fn() }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ href: '/projects' }),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  login: mocks.login,
}))

afterEach(() => {
  act(() => useAuthStore.getState().auth.reset())
  vi.clearAllMocks()
})

it.each(['reset', 'resetAccessToken'] as const)(
  'clears private data when authentication expires through %s',
  (action) => {
    const client = new QueryClient()
    const unbind = bindQueryCacheToAuth(client)
    try {
      useAuthStore.getState().auth.setAccessToken('expired-session')
      client.setQueryData(['ai-chat-sessions'], ['private conversation'])
      useAuthStore.getState().auth[action]()
      expect(client.getQueryData(['ai-chat-sessions'])).toBeUndefined()
    } finally {
      unbind()
      client.clear()
    }
  }
)

it('cancels an old request even when its transport ignores AbortSignal', async () => {
  const client = new QueryClient()
  const unbind = bindQueryCacheToAuth(client)
  let finishOldRequest!: (value: string[]) => void
  const fetchOldProjects = vi.fn(
    () =>
      new Promise<string[]>((resolve) => {
        finishOldRequest = resolve
      })
  )
  try {
    useAuthStore.getState().auth.setAccessToken('session-a')
    const pending = client
      .fetchQuery({
        queryKey: ['projects'],
        queryFn: fetchOldProjects,
      })
      .catch(() => undefined)
    useAuthStore.getState().auth.setAccessToken('session-b')
    client.setQueryData(['projects'], ['project-b'])
    finishOldRequest(['project-a'])
    await pending
    expect(client.getQueryData(['projects'])).toEqual(['project-b'])
  } finally {
    unbind()
    client.clear()
  }
})

it('clears data for an identity change but retains it for a same-user profile refresh', () => {
  const client = new QueryClient()
  const unbind = bindQueryCacheToAuth(client)
  const user = {
    id: 'user-a',
    name: 'A',
    email: 'a@example.test',
    is_super_admin: false,
    can_access_audit: false,
    status: 1,
  }
  try {
    useAuthStore.getState().auth.setUser(user)
    client.setQueryData(['projects'], ['project-a'])
    useAuthStore.getState().auth.setUser({ ...user, name: 'Renamed A' })
    expect(client.getQueryData(['projects'])).toEqual(['project-a'])
    useAuthStore.getState().auth.setUser({ ...user, id: 'user-b' })
    expect(client.getQueryData(['projects'])).toBeUndefined()
  } finally {
    unbind()
    client.clear()
  }
})

it('does not reuse account A project data after real sign-out and account B sign-in', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10 * 1000 } },
  })
  const unbind = bindQueryCacheToAuth(queryClient)
  const userA = {
    id: 'audit-user-a',
    name: 'A',
    email: 'a@example.test',
    is_super_admin: false,
    can_access_audit: false,
    status: 1,
  }
  const userB = {
    ...userA,
    id: 'audit-user-b',
    name: 'B',
    email: 'b@example.test',
  }
  const privateProjects = {
    items: [
      { id: 'audit-project-a', name: 'Only account A may see this project' },
    ],
    total: 1,
  }
  const accountBProjects = { items: [], total: 0 }
  useAuthStore.getState().auth.setUser(userA)
  useAuthStore.getState().auth.setAccessToken('audit-token-a')
  queryClient.setQueryData(['projects'], privateProjects)
  mocks.login.mockResolvedValue({ user: userB, token: 'audit-token-b' })
  const user = userEvent.setup()
  const signOut = render(
    <QueryClientProvider client={queryClient}>
      <SignOutDialog open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
  try {
    await user.click(signOut.getByRole('button', { name: /^Sign out$/i }))
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    signOut.unmount()
    const signIn = render(
      <QueryClientProvider client={queryClient}>
        <UserAuthForm redirectTo='/projects' />
      </QueryClientProvider>
    )
    await user.type(signIn.getByLabelText(/^Email$/i), userB.email)
    await user.type(signIn.getByLabelText(/^Password$/i), 'audit-password')
    await user.click(signIn.getByRole('button', { name: /^Sign in to Vdoc$/i }))
    await waitFor(() =>
      expect(useAuthStore.getState().auth.user?.id).toBe(userB.id)
    )
    const fetchAccountBProjects = vi.fn().mockResolvedValue(accountBProjects)
    const nextProjects = await queryClient.fetchQuery({
      queryKey: ['projects'],
      queryFn: fetchAccountBProjects,
    })
    expect(fetchAccountBProjects).toHaveBeenCalledOnce()
    expect(
      nextProjects,
      'account B receives cached account A projects without making an authenticated B request'
    ).toEqual(accountBProjects)
  } finally {
    unbind()
    queryClient.clear()
    act(() => useAuthStore.getState().auth.reset())
  }
})

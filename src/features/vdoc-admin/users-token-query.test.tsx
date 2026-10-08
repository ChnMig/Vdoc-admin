import type { ReactNode } from 'react'
import { AxiosError } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageProvider } from '@/context/language-provider'
import { UsersPage } from './users-page'

const api = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listUserMCPTokens: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
vi.mock('./page-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./page-shared')>()),
  PageChrome: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))
const user = {
  id: 'admin',
  email: 'admin@example.test',
  name: 'Admin',
  status: 1,
  is_super_admin: true,
  can_access_audit: true,
}
const otherUser = { ...user, id: 'other', email: 'other@example.test' }
const token = {
  id: 'token-active',
  name: 'Existing agent token',
  status: 1,
  expires_at: '2099-01-01T00:00:00Z',
}
let client: QueryClient
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}
beforeEach(() => {
  useAuthStore.getState().auth.setSession(user, 'synthetic-session')
  api.listUsers.mockResolvedValue({ items: [user, otherUser], total: 2 })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
  document.cookie = 'vdoc-admin-language=; Max-Age=0; Path=/'
  vi.resetAllMocks()
})
async function page() {
  const view = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <UsersPage />
      </LanguageProvider>
    </QueryClientProvider>
  )
  await view.findByRole('button', { name: user.email })
  return view
}
describe('user token query state', () => {
  it('requests no tokens until a user is selected', async () => {
    const view = await page()
    expect(view.getByText('No user tokens selected')).toBeInTheDocument()
    expect(api.listUserMCPTokens).not.toHaveBeenCalled()
  })

  it('shows loading for the selected user without a false empty count', async () => {
    const pending = deferred<unknown>()
    api.listUserMCPTokens.mockReturnValue(pending.promise)
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    expect(await view.findByRole('status')).toHaveTextContent(
      'Loading backend data'
    )
    expect(view.getAllByText(user.email)).toHaveLength(2)
    expect(view.queryByText('No user tokens selected')).not.toBeInTheDocument()
    expect(view.queryByText('Total: 0')).not.toBeInTheDocument()
    await act(async () => pending.resolve({ items: [token], total: 1 }))
    expect(await view.findByText(token.name)).toBeInTheDocument()
    expect(view.queryByText('Loading backend data...')).not.toBeInTheDocument()
  })

  it('reports the token query failure and retries the same selected user', async () => {
    api.listUserMCPTokens.mockRejectedValueOnce(
      new AxiosError('Network Error', 'ERR_NETWORK')
    )
    api.listUserMCPTokens.mockResolvedValueOnce({ items: [token], total: 1 })
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    expect(await view.findByText('Network Error')).toBeInTheDocument()
    expect(view.getAllByText(user.email)).toHaveLength(2)
    expect(view.queryByText('No user tokens selected')).not.toBeInTheDocument()
    expect(view.queryByText('Total: 0')).not.toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Try again' }))
    expect(await view.findByText(token.name)).toBeInTheDocument()
    expect(api.listUserMCPTokens).toHaveBeenCalledTimes(2)
    expect(api.listUserMCPTokens).toHaveBeenLastCalledWith(
      'admin',
      expect.anything()
    )
    expect(view.queryByText('Network Error')).not.toBeInTheDocument()
  })

  it('distinguishes a successful empty list from no selected user', async () => {
    api.listUserMCPTokens.mockResolvedValue({ items: [], total: 0 })
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    expect(
      await view.findByText(`No MCP tokens have been issued for ${user.email}.`)
    ).toBeInTheDocument()
    expect(view.queryByText('No user tokens selected')).not.toBeInTheDocument()
    expect(view.getByText('Total: 0')).toBeInTheDocument()
  })

  it('preserves a known token list after a background failure', async () => {
    api.listUserMCPTokens.mockResolvedValueOnce({ items: [token], total: 1 })
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    expect(await view.findByText(token.name)).toBeInTheDocument()
    api.listUserMCPTokens.mockRejectedValueOnce(
      new AxiosError('Network Error', 'ERR_NETWORK')
    )
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['user-mcp-tokens', 'admin'] })
    })
    expect(await view.findByText('Network Error')).toBeInTheDocument()
    expect(view.getByText(token.name)).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })

  it('keeps a late token list out of another selected user', async () => {
    const pending = deferred<unknown>()
    api.listUserMCPTokens.mockImplementation((id: string) =>
      id === 'admin'
        ? pending.promise
        : Promise.resolve({ items: [], total: 0 })
    )
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    await waitFor(() =>
      expect(api.listUserMCPTokens).toHaveBeenCalledWith(
        'admin',
        expect.anything()
      )
    )
    fireEvent.click(view.getByRole('button', { name: otherUser.email }))
    expect(
      await view.findByText(
        `No MCP tokens have been issued for ${otherUser.email}.`
      )
    ).toBeInTheDocument()
    await act(async () => pending.resolve({ items: [token], total: 1 }))
    expect(view.queryByText(token.name)).not.toBeInTheDocument()
  })

  it('renders the selected-user empty status in Chinese', async () => {
    document.cookie = 'vdoc-admin-language=zh-CN; Path=/'
    api.listUserMCPTokens.mockResolvedValue({ items: [], total: 0 })
    const view = await page()
    fireEvent.click(view.getByRole('button', { name: user.email }))
    expect(
      await view.findByText(`${user.email} 尚未签发 MCP 令牌。`)
    ).toBeInTheDocument()
  })
})

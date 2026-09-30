import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MCPTokenDTO } from '@/lib/vdoc-api'
import { MCPTokensPage } from './mcptokens-page'

const api = vi.hoisted(() => ({
  listMCPTokens: vi.fn(),
  listMCPUsage: vi.fn(),
  getMCPToken: vi.fn(),
  createMCPToken: vi.fn(),
  revokeMCPToken: vi.fn(),
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

const token: MCPTokenDTO = {
  id: 'token-local',
  user_id: 'user-local',
  name: 'Local synthesized agent',
  scopes: [1],
  status: 1,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}
const secret = `vdoc_${'d'.repeat(48)}`
type TokenList = { items: MCPTokenDTO[]; total: number }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function TokenRouteHarness() {
  const [tokenId, setTokenId] = useState<string>()
  return (
    <MCPTokensPage
      search={tokenId ? { token_id: tokenId } : {}}
      onSearchChange={(patch) => setTokenId(patch.token_id)}
    />
  )
}

function setup() {
  const user = userEvent.setup()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const screen = render(
    <QueryClientProvider client={client}>
      <TokenRouteHarness />
    </QueryClientProvider>
  )
  return { user, client, screen }
}

async function refresh(client: QueryClient) {
  await act(async () => {
    await client.refetchQueries({ queryKey: ['mcp-tokens'] })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listMCPTokens.mockResolvedValue({ items: [token], total: 1 })
  api.listMCPUsage.mockResolvedValue({ items: [], total: 0 })
  api.getMCPToken.mockResolvedValue({ ...token, token: secret })
  api.revokeMCPToken.mockResolvedValue({ ...token, status: 2 })
})

describe('MCPTokensPage refreshed secret lifecycle', () => {
  it.each([
    ['revoked', [{ ...token, status: 2 }]],
    ['expired status', [{ ...token, status: 3 }]],
    ['elapsed expiry', [{ ...token, expires_at: '2020-01-01T00:00:00Z' }]],
    ['deleted', []],
  ] as const)(
    'clears a revealed %s token and cannot restore its secret from later lists',
    async (_label, items) => {
      const { user, client, screen } = setup()
      await user.click(await screen.findByRole('button', { name: 'View' }))
      await waitFor(() =>
        expect(screen.container.textContent).toContain(secret)
      )

      api.listMCPTokens.mockResolvedValue({ items, total: items.length })
      await user.click(
        screen.getByRole('button', { name: 'Refresh connection evidence' })
      )
      await waitFor(() =>
        expect(screen.container.textContent).not.toContain(secret)
      )
      expect(
        screen.queryByRole('button', { name: 'Copy token' })
      ).not.toBeInTheDocument()
      expect(screen.container.textContent).toContain('<YOUR_ACTIVE_VDOC_TOKEN>')
      if (items.length) {
        expect(screen.container.textContent).toContain(
          `"status": ${items[0].status}`
        )
      } else {
        expect(screen.queryByText('Token details')).not.toBeInTheDocument()
      }

      api.listMCPTokens.mockResolvedValue({ items: [token], total: 1 })
      await refresh(client)
      expect(screen.container.textContent).not.toContain(secret)
    }
  )

  it('keeps an active secret while refreshing its latest lifecycle metadata', async () => {
    const { user, client, screen } = setup()
    await user.click(await screen.findByRole('button', { name: 'View' }))
    await waitFor(() => expect(screen.container.textContent).toContain(secret))
    api.listMCPTokens.mockResolvedValue({
      items: [
        {
          ...token,
          name: 'Renamed agent',
          last_used_at: '2026-09-20T00:00:00Z',
        },
      ],
      total: 1,
    })

    await refresh(client)

    expect(screen.container.textContent).toContain(secret)
    expect(screen.container.textContent).toContain('"name": "Renamed agent"')
    expect(screen.container.textContent).toContain(
      '"last_used_at": "2026-09-20T00:00:00Z"'
    )
  })

  it('does not treat a pending or failed list refresh as deletion', async () => {
    const pending = deferred<TokenList>()
    const { user, client, screen } = setup()
    await user.click(await screen.findByRole('button', { name: 'View' }))
    await waitFor(() => expect(screen.container.textContent).toContain(secret))
    api.listMCPTokens.mockReturnValueOnce(pending.promise)
    await user.click(
      screen.getByRole('button', { name: 'Refresh connection evidence' })
    )
    expect(screen.container.textContent).toContain(secret)
    expect(
      screen.getByRole('button', { name: 'Refresh connection evidence' })
    ).toBeDisabled()
    await act(async () => {
      pending.resolve({ items: [token], total: 1 })
      await pending.promise
    })
    api.listMCPTokens.mockRejectedValueOnce(
      new Error('Temporary network failure')
    )
    await refresh(client)
    expect(screen.container.textContent).toContain(secret)
    expect(screen.container.textContent).toContain('Temporary network failure')
  })

  it.each([
    ['revocation', [{ ...token, status: 2 }]],
    ['expiry', [{ ...token, status: 3 }]],
    ['deletion', []],
  ] as const)(
    'rejects a late reveal after a list refresh confirms %s',
    async (_label, items) => {
      const reveal = deferred<MCPTokenDTO>()
      api.getMCPToken.mockReturnValueOnce(reveal.promise)
      const { user, client, screen } = setup()
      await user.click(await screen.findByRole('button', { name: 'View' }))
      api.listMCPTokens.mockResolvedValue({ items, total: items.length })
      await refresh(client)

      await act(async () => {
        reveal.resolve({ ...token, token: secret })
        await reveal.promise
      })

      expect(screen.container.textContent).not.toContain(secret)
      expect(
        screen.queryByRole('button', { name: 'Copy token' })
      ).not.toBeInTheDocument()
    }
  )

  it('accepts a pending reveal when the refreshed list still confirms an active token', async () => {
    const reveal = deferred<MCPTokenDTO>()
    api.getMCPToken.mockReturnValueOnce(reveal.promise)
    const { user, client, screen } = setup()
    await user.click(await screen.findByRole('button', { name: 'View' }))
    api.listMCPTokens.mockResolvedValue({
      items: [{ ...token, name: 'Current server name' }],
      total: 1,
    })
    await refresh(client)
    await act(async () => {
      reveal.resolve({ ...token, token: secret })
      await reveal.promise
    })

    await waitFor(() => expect(screen.container.textContent).toContain(secret))
    expect(screen.container.textContent).toContain(
      '"name": "Current server name"'
    )
  })

  it.each([2, 3])(
    'redacts a reveal response that already has inactive status %s',
    async (status) => {
      api.getMCPToken.mockResolvedValue({ ...token, token: secret, status })
      const { user, screen } = setup()
      await user.click(await screen.findByRole('button', { name: 'View' }))

      await waitFor(() =>
        expect(screen.container.textContent).toContain(`"status": ${status}`)
      )
      expect(screen.container.textContent).not.toContain(secret)
    }
  )

  it('ignores a late copy result after revocation, even if the token later becomes active', async () => {
    const copy = deferred<void>()
    const { user, client, screen } = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockReturnValueOnce(copy.promise)
    await user.click(await screen.findByRole('button', { name: 'View' }))
    await user.click(await screen.findByRole('button', { name: 'Copy token' }))
    api.listMCPTokens.mockResolvedValue({
      items: [{ ...token, status: 2 }],
      total: 1,
    })
    await refresh(client)
    api.listMCPTokens.mockResolvedValue({ items: [token], total: 1 })
    await refresh(client)
    await user.click(screen.getByRole('button', { name: 'View' }))
    await waitFor(() => expect(screen.container.textContent).toContain(secret))

    await act(async () => {
      copy.resolve()
      await copy.promise
    })

    expect(screen.queryByText('Token copied.')).not.toBeInTheDocument()
  })

  it('redacts a same-page revoke response even if it includes plaintext', async () => {
    api.revokeMCPToken.mockResolvedValue({ ...token, token: secret, status: 2 })
    const { user, screen } = setup()
    await user.click(await screen.findByRole('button', { name: 'View' }))
    await waitFor(() => expect(screen.container.textContent).toContain(secret))
    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Revoke',
      })
    )
    await waitFor(() =>
      expect(api.revokeMCPToken).toHaveBeenCalledWith(token.id)
    )
    expect(screen.container.textContent).not.toContain(secret)
  })

  it('preserves a newly created secret through an older in-flight list request', async () => {
    const pending = deferred<TokenList>()
    const newToken = { ...token, id: 'token-new', name: 'New agent' }
    api.createMCPToken.mockResolvedValue({ ...newToken, token: secret })
    const { user, client, screen } = setup()
    await screen.findByRole('button', { name: 'View' })
    api.listMCPTokens.mockReturnValueOnce(pending.promise)
    await user.click(
      screen.getByRole('button', { name: 'Refresh connection evidence' })
    )
    api.listMCPTokens.mockResolvedValue({ items: [token, newToken], total: 2 })
    await user.type(screen.getByLabelText('Name'), newToken.name)
    await user.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(screen.container.textContent).toContain(secret))

    await act(async () => {
      pending.resolve({ items: [token], total: 1 })
      await pending.promise
    })
    await refresh(client)

    expect(screen.container.textContent).toContain(secret)
    expect(screen.container.textContent).toContain('"id": "token-new"')
  })

  it('cancels a list started during creation before accepting a new token without cached list data', async () => {
    const secondList = deferred<TokenList>()
    const creation = deferred<MCPTokenDTO>()
    const newToken = { ...token, id: 'token-new', name: 'New agent' }
    api.listMCPTokens.mockRejectedValueOnce(
      new Error('Initial network failure')
    )
    api.createMCPToken.mockReturnValueOnce(creation.promise)
    const { user, screen } = setup()
    await screen.findByText('Initial network failure')
    await user.type(screen.getByLabelText('Name'), newToken.name)
    await user.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(api.createMCPToken).toHaveBeenCalledOnce())
    api.listMCPTokens.mockReturnValueOnce(secondList.promise)
    await user.click(
      screen.getByRole('button', { name: 'Refresh connection evidence' })
    )
    await waitFor(() => expect(api.listMCPTokens).toHaveBeenCalledTimes(2))
    api.listMCPTokens.mockResolvedValue({ items: [token, newToken], total: 2 })

    await act(async () => {
      creation.resolve({ ...newToken, token: secret })
      await creation.promise
    })
    await waitFor(() => expect(screen.container.textContent).toContain(secret))
    await act(async () => {
      secondList.resolve({ items: [token], total: 1 })
      await secondList.promise
    })

    await waitFor(() =>
      expect(screen.container.textContent).toContain('"id": "token-new"')
    )
    expect(screen.container.textContent).toContain(secret)
  })

  it.each([
    ['revoked', { status: 2 }, false],
    ['expired status', { status: 3 }, false],
    ['elapsed expiry', { expires_at: '2020-01-01T00:00:00Z' }, false],
    ['active control', { status: 1 }, true],
    ['absent control', null, true],
  ] as const)(
    'checks known %s list evidence before accepting a late creation response',
    async (_label, lifecycle, shouldReveal) => {
      const creation = deferred<MCPTokenDTO>()
      const newToken = { ...token, id: 'token-new', name: 'New agent' }
      const listedToken = lifecycle ? { ...newToken, ...lifecycle } : null
      api.createMCPToken.mockReturnValueOnce(creation.promise)
      const { user, client, screen } = setup()
      await screen.findByRole('button', { name: 'View' })
      await user.type(screen.getByLabelText('Name'), newToken.name)
      await user.click(screen.getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(api.createMCPToken).toHaveBeenCalledOnce())

      // The server has committed creation, but this POST response is delayed.
      // A later GET can already contain lifecycle changes from another client.
      api.listMCPTokens.mockResolvedValueOnce({
        items: listedToken ? [token, listedToken] : [token],
        total: listedToken ? 2 : 1,
      })
      await refresh(client)
      api.listMCPTokens.mockRejectedValue(new Error('Later refresh failed'))
      await act(async () => {
        creation.resolve({ ...newToken, token: secret })
        await creation.promise
      })
      await screen.findByText('Later refresh failed')

      expect(screen.container.textContent).toContain('"id": "token-new"')
      if (shouldReveal) {
        expect(screen.container.textContent).toContain(secret)
        expect(screen.getByRole('button', { name: 'Copy token' })).toBeEnabled()
      } else {
        expect(screen.container.textContent).not.toContain(secret)
        expect(
          screen.queryByRole('button', { name: 'Copy token' })
        ).not.toBeInTheDocument()
        expect(screen.container.textContent).toContain(
          '<YOUR_ACTIVE_VDOC_TOKEN>'
        )
        expect(screen.container.textContent).toContain(
          `"status": ${listedToken?.status}`
        )
        if (listedToken?.expires_at) {
          expect(screen.container.textContent).toContain(
            `"expires_at": "${listedToken.expires_at}"`
          )
        }
      }
    }
  )
})

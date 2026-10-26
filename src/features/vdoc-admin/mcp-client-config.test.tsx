import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MCPClientConfig } from './mcp-client-config'
import { vdocMcpSource } from './page-utils'

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

beforeEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = undefined
})

afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
})

it.each(['release', 'beta'] as const)(
  'clears a revealed %s token in both client formats when the selection is cleared',
  async (releaseChannel) => {
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel }
    const user = userEvent.setup()
    const { container, rerender } = render(
      <MCPClientConfig
        baseUrl='http://127.0.0.1:8080'
        token='temporary-test-secret'
      />
    )
    expect(screen.getByRole('tab', { name: 'Codex' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(container.textContent).toContain(
      `[mcp_servers.${releaseChannel === 'beta' ? 'vdoc_beta' : 'vdoc'}]`
    )
    expect(container.textContent).toContain('temporary-test-secret')
    await user.click(screen.getByRole('tab', { name: 'Cursor' }))
    expect(container.textContent).toContain('mcpServers')
    expect(container.textContent).toContain('temporary-test-secret')
    rerender(<MCPClientConfig baseUrl='http://127.0.0.1:8080' />)
    expect(container.textContent).not.toContain('temporary-test-secret')
    await user.click(screen.getByRole('tab', { name: 'Codex' }))
    expect(container.textContent).not.toContain('temporary-test-secret')
    expect(container.textContent).toContain('<YOUR_ACTIVE_VDOC_TOKEN>')
  }
)

it('preserves the pinned release client configurations when the channel is absent', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <MCPClientConfig baseUrl='https://api.example.test' token='release-token' />
  )
  expect(container.querySelector('pre')?.textContent).toBe(
    `[mcp_servers.vdoc]
command = "npx"
args = ["--yes", ${JSON.stringify(vdocMcpSource)}]
startup_timeout_sec = 60
tool_timeout_sec = 180

[mcp_servers.vdoc.env]
VDOC_BASE_URL = "https://api.example.test"
VDOC_MCP_TOKEN = "release-token"`
  )
  await user.click(screen.getByRole('tab', { name: 'Cursor' }))
  expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toEqual(
    {
      mcpServers: {
        vdoc: {
          command: 'npx',
          args: ['--yes', vdocMcpSource],
          env: {
            VDOC_BASE_URL: 'https://api.example.test',
            VDOC_MCP_TOKEN: 'release-token',
          },
        },
      },
    }
  )
})

it('uses the isolated beta adapter and retains this environment URL and token in both clients', async () => {
  window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'beta' }
  const user = userEvent.setup()
  const { container } = render(
    <MCPClientConfig
      baseUrl='https://beta-api.example.test'
      token='beta-token'
    />
  )
  expect(container.querySelector('pre')?.textContent).toContain(
    '[mcp_servers.vdoc_beta]'
  )
  expect(container.querySelector('pre')?.textContent).toContain(
    'command = "<ABSOLUTE_BETA_MCP_PATH>"'
  )
  expect(container.querySelector('pre')?.textContent).not.toContain('npx')
  expect(container.querySelector('pre')?.textContent).not.toContain(
    vdocMcpSource
  )
  expect(container.querySelector('pre')?.textContent).toContain(
    'VDOC_BASE_URL = "https://beta-api.example.test"'
  )
  expect(container.querySelector('pre')?.textContent).toContain(
    'VDOC_MCP_TOKEN = "beta-token"'
  )
  expect(container.textContent).toContain(
    'absolute command path printed by the installer'
  )
  expect(container.textContent).toContain('~/.local/share/vdoc/mcp/beta')
  await user.click(screen.getByRole('tab', { name: 'Cursor' }))
  expect(JSON.parse(container.querySelector('pre')?.textContent ?? '')).toEqual(
    {
      mcpServers: {
        vdoc_beta: {
          command: '<ABSOLUTE_BETA_MCP_PATH>',
          env: {
            VDOC_BASE_URL: 'https://beta-api.example.test',
            VDOC_MCP_TOKEN: 'beta-token',
          },
        },
      },
    }
  )
})

it.each(['release', 'beta'] as const)(
  'offers private Claude Code configuration for %s alongside the other clients',
  async (releaseChannel) => {
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel }
    const screen = render(
      <MCPClientConfig
        baseUrl='https://vdoc.example.test'
        token='fixture-token'
      />
    )
    await userEvent
      .setup()
      .click(screen.getByRole('tab', { name: 'Claude Code' }))
    const code = screen.container.querySelector('pre')!.textContent!
    const server =
      JSON.parse(code).mcpServers[
        releaseChannel === 'beta' ? 'vdoc_beta' : 'vdoc'
      ]
    expect(server.env).toEqual({
      VDOC_BASE_URL: 'https://vdoc.example.test',
      VDOC_MCP_TOKEN: 'fixture-token',
    })
    expect(server.command).toBe(
      releaseChannel === 'beta' ? '<ABSOLUTE_BETA_MCP_PATH>' : 'npx'
    )
    expect(screen.getAllByText(/~\/.claude.json/).length).toBeGreaterThan(0)
  }
)

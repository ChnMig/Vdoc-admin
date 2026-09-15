import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { MCPClientConfig } from './mcp-client-config'

it('clears a revealed token in both client formats when the selection is cleared', async () => {
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
  expect(container.textContent).toContain('[mcp_servers.vdoc]')
  expect(container.textContent).toContain('temporary-test-secret')
  await user.click(screen.getByRole('tab', { name: 'Cursor' }))
  expect(container.textContent).toContain('mcpServers')
  expect(container.textContent).toContain('temporary-test-secret')
  rerender(<MCPClientConfig baseUrl='http://127.0.0.1:8080' />)
  expect(container.textContent).not.toContain('temporary-test-secret')
  await user.click(screen.getByRole('tab', { name: 'Codex' }))
  expect(container.textContent).not.toContain('temporary-test-secret')
  expect(container.textContent).toContain('<YOUR_ACTIVE_VDOC_TOKEN>')
})

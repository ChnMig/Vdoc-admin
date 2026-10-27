import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { vdocMcpReleaseVersion } from './page-utils'
import { SkillPage } from './skill-page'

vi.mock('./page-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./page-shared')>()),
  PageChrome: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

beforeEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = undefined
})

afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
})

it('preserves the existing pinned release package and personal Skill installation', () => {
  const { container } = render(<SkillPage />)
  const install = container.querySelector('pre')?.textContent ?? ''
  expect(install).toContain(`VDOC_MCP_VERSION=${vdocMcpReleaseVersion}`)
  expect(install).toContain('VDOC_SKILL_DIR="$HOME/.agents/skills/vdoc"')
  expect(install).toContain('shasum -a 256 -c SHA256SUMS')
  expect(install).toContain(
    'npm install --global "$VDOC_MCP_PACKAGE_DIR/vdoc-mcp-$VDOC_MCP_VERSION.tgz"'
  )
  expect(install).toContain(
    'vdoc-mcp skill install --directory "$VDOC_SKILL_DIR"'
  )
  expect(install).not.toContain('install-channel.mjs')
  expect(install).not.toContain('--channel beta')
  expect(
    screen.getByRole('region', { name: 'Let AI install, update, or uninstall' })
  ).toHaveTextContent(
    'Read https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v0.3.17-beta.19/docs/public/skill-install.md and install the Vdoc Skill in the current project using the release channel.'
  )
})

it('requires a reviewed installer release tag and verifies it before installing beta in a separate prefix and project Skill directory', () => {
  window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'beta' }
  const { container } = render(<SkillPage />)
  const install = container.querySelector('pre')?.textContent ?? ''
  expect(install).toContain('set -eu')
  expect(install).toContain(
    `VDOC_MCP_INSTALLER_TAG='v${vdocMcpReleaseVersion}'`
  )
  expect(install).toContain('releases/download/$VDOC_MCP_INSTALLER_TAG')
  expect(install).not.toContain(`VDOC_MCP_VERSION=${vdocMcpReleaseVersion}`)
  expect(install).toContain(
    'curl -fsSL "$VDOC_MCP_RELEASE/install-channel.mjs"'
  )
  expect(install).toContain(
    'curl -fsSL "$VDOC_MCP_RELEASE/install-channel.mjs.sha256"'
  )
  const verifyIndex = install.indexOf(
    'shasum -a 256 -c install-channel.mjs.sha256'
  )
  const runIndex = install.indexOf(
    'node "$VDOC_MCP_INSTALLER_DIR/install-channel.mjs" --channel beta'
  )
  expect(verifyIndex).toBeGreaterThan(-1)
  expect(runIndex).toBeGreaterThan(verifyIndex)
  expect(install).toContain(
    'VDOC_BETA_MCP_PREFIX="$HOME/.local/share/vdoc/mcp/beta"'
  )
  expect(install).toContain('--prefix "$VDOC_BETA_MCP_PREFIX"')
  expect(install).toContain('VDOC_SKILL_DIR="$PWD/.agents/skills/vdoc"')
  expect(install).toContain(
    '"$VDOC_BETA_MCP_PREFIX/node_modules/.bin/vdoc-mcp" skill install --directory "$VDOC_SKILL_DIR"'
  )
  expect(install).not.toContain('npm install --global')
  expect(install).not.toContain('$HOME/.agents/skills/vdoc')
  expect(container.textContent).toContain(
    'Run these commands from a separate beta project'
  )
  expect(container.textContent).toContain(
    'pinned reviewed Release that includes install-channel.mjs and install-channel.mjs.sha256'
  )
  expect(container.textContent).toContain('[mcp_servers.vdoc_beta]')
  expect(screen.getByRole('tab', { name: 'Codex' })).toBeInTheDocument()
  expect(
    screen.getByRole('region', { name: 'Let AI install, update, or uninstall' })
  ).toHaveTextContent(
    'Read https://raw.githubusercontent.com/ChnMig/Vdoc-site/refs/tags/v0.3.17-beta.19/docs/public/skill-install.md and install the Vdoc Skill in the current project using the beta channel.'
  )
})

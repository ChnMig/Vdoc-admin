// @vitest-environment node
import { spawnSync } from 'node:child_process'
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanupSecretWorkspace,
  createSecretWorkspace,
  outputContainsRegisteredSecret,
  registerCapabilitySecret,
} from './secret-safety.mjs'

let parentDirectory: string | undefined

afterEach(async () => {
  if (parentDirectory !== undefined) {
    await cleanupSecretWorkspace(parentDirectory)
    parentDirectory = undefined
  }
})

describe('Playwright secret safety', () => {
  it('creates a mode-0600 registry and removes its private workspace', async () => {
    parentDirectory = await mkdtemp(join(tmpdir(), 'vdoc-secret-test-'))
    const workspace = await createSecretWorkspace(parentDirectory)

    expect((await stat(workspace.registryPath)).mode & 0o777).toBe(0o600)
    expect((await stat(workspace.outputPath)).mode & 0o777).toBe(0o600)

    await cleanupSecretWorkspace(workspace.directory)
    await expect(stat(workspace.directory)).rejects.toThrow()
  })

  it('detects registered capability text without returning the secret', async () => {
    parentDirectory = await mkdtemp(join(tmpdir(), 'vdoc-secret-test-'))
    const workspace = await createSecretWorkspace(parentDirectory)
    const secret = `vdoc_share_${'c'.repeat(48)}`
    await registerCapabilitySecret(workspace.registryPath, secret)
    await writeFile(workspace.outputPath, `test output ${secret}`, 'utf8')

    expect(await outputContainsRegisteredSecret(workspace)).toBe(true)
    expect(await readFile(workspace.registryPath, 'utf8')).toBe(`${secret}\n`)
  })

  it('fails closed when registry permissions are widened', async () => {
    parentDirectory = await mkdtemp(join(tmpdir(), 'vdoc-secret-test-'))
    const workspace = await createSecretWorkspace(parentDirectory)
    await chmod(workspace.registryPath, 0o644)

    await expect(
      registerCapabilitySecret(
        workspace.registryPath,
        `vdoc_share_${'d'.repeat(48)}`
      )
    ).rejects.toThrow('Secret registry permissions are invalid')
  })

  it('suppresses registered marker output and cleans the wrapper workspace', async () => {
    parentDirectory = await mkdtemp(join(tmpdir(), 'vdoc-secret-test-'))
    const marker = `vdoc_share_${'e'.repeat(48)}`

    const result = spawnSync(
      process.execPath,
      [
        'scripts/run-playwright.mjs',
        '--project=live-capability-text',
        '--grep=registered marker probe',
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          TMPDIR: parentDirectory,
          PLAYWRIGHT_ADMIN_BASE_URL: 'http://127.0.0.1:4173',
          VDOC_PLAYWRIGHT_TEST_MARKER: marker,
        },
      }
    )

    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain(marker)
    expect(result.stderr).toBe(
      'Playwright output contained registered capability data.\n'
    )
    expect(
      (await readdir(parentDirectory)).filter((name) =>
        name.startsWith('vdoc-playwright-')
      )
    ).toEqual([])
  })
})

import { createWriteStream } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { finished } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import {
  cleanupSecretWorkspace,
  clearClipboard,
  createSecretWorkspace,
  outputContainsRegisteredSecret,
} from '../tests/browser/support/secret-safety.mjs'

const workspace = await createSecretWorkspace()
const playwrightArguments = process.argv.slice(2).filter((value) => value !== '--')
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const localPlaywright = join(
  repositoryRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
)
let exitCode = 1

try {
  const output = createWriteStream(workspace.outputPath, {
    flags: 'a',
    mode: 0o600,
  })
  await access(localPlaywright)
  const child = spawn(
    localPlaywright,
    ['test', '--reporter=line', ...playwrightArguments],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        VDOC_PLAYWRIGHT_SECRET_REGISTRY: workspace.registryPath,
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    }
  )
  child.stdout.pipe(output, { end: false })
  child.stderr.pipe(output, { end: false })
  exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
  output.end()
  await finished(output)

  if (await outputContainsRegisteredSecret(workspace)) {
    process.stderr.write('Playwright output contained registered capability data.\n')
    exitCode = 1
  } else {
    process.stdout.write(await readFile(workspace.outputPath, 'utf8'))
  }
} finally {
  clearClipboard()
  await cleanupSecretWorkspace(workspace.directory)
}

process.exitCode = exitCode

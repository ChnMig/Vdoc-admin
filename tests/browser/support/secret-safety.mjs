import {
  appendFile,
  chmod,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const capabilityPattern = /^vdoc_share_[0-9a-f]{48}$/

export async function createSecretWorkspace(parentDirectory = tmpdir()) {
  const directory = await mkdtemp(join(parentDirectory, 'vdoc-playwright-'))
  await chmod(directory, 0o700)
  const registryPath = join(directory, 'secrets.txt')
  const outputPath = join(directory, 'output.txt')
  await createPrivateFile(registryPath)
  await createPrivateFile(outputPath)
  return { directory, registryPath, outputPath }
}

export async function registerCapabilitySecret(registryPath, secret) {
  if (!capabilityPattern.test(secret)) {
    throw new TypeError('Capability secret format is invalid')
  }
  if (((await stat(registryPath)).mode & 0o777) !== 0o600) {
    throw new TypeError('Secret registry permissions are invalid')
  }
  await appendFile(registryPath, `${secret}\n`, { encoding: 'utf8', mode: 0o600 })
}

export async function outputContainsRegisteredSecret(workspace) {
  const [registry, output] = await Promise.all([
    readFile(workspace.registryPath, 'utf8'),
    readFile(workspace.outputPath, 'utf8'),
  ])
  return registry
    .split('\n')
    .filter((secret) => secret.length > 0)
    .some((secret) => output.includes(secret))
}

export async function cleanupSecretWorkspace(directory) {
  await rm(directory, { recursive: true, force: true })
}

export function clearClipboard() {
  const commands =
    process.platform === 'darwin'
      ? [['pbcopy']]
      : process.platform === 'win32'
        ? [['clip']]
        : [['wl-copy', '--clear'], ['xclip', '-selection', 'clipboard']]

  for (const [command, ...args] of commands) {
    const result = spawnSync(command, args, {
      input: '',
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'ignore'],
    })
    if (result.status === 0) return
  }
}

async function createPrivateFile(path) {
  const handle = await open(path, 'wx', 0o600)
  await handle.close()
}

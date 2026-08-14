import { expect, test } from '@playwright/test'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

test('secret-bearing project disables retained browser artifacts', ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe('chromium')
  expect(testInfo.project.name).toBe('live-capability-text')
  expect(testInfo.project.use.screenshot).toBe('off')
  expect(testInfo.project.use.trace).toBe('off')
  expect(testInfo.project.use.video).toBe('off')
  expect(testInfo.project.use.acceptDownloads).toBe(false)
})

test('registered marker probe', async () => {
  const marker = process.env['VDOC_PLAYWRIGHT_TEST_MARKER']
  const registryPath = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
  if (marker === undefined || registryPath === undefined) {
    test.skip()
    return
  }

  await registerCapabilitySecret(registryPath, marker)
  process.stdout.write(marker)
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  documentId,
  installRepository,
  projectId,
} from '../support/repository-workflow'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

const png = readFileSync(
  new URL('../../../public/images/vdoc-logo.png', import.meta.url)
)
const assetId = createHash('sha256').update(png).digest('hex')
const reference = `vdoc-asset:${assetId}`
const path = `/api/v1/private/projects/${projectId}/documents/${documentId}/images`

for (const width of [1440, 390]) {
  test(`managed images upload, save and render without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    let uploads = 0
    await page.route(`**${path}**`, async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        expect(Buffer.from(body.content_base64, 'base64')).toEqual(png)
        expect(body.filename).toBe('diagram.png')
        uploads++
        return route.fulfill({
          json: {
            code: 200,
            status: 'OK',
            description: '',
            timestamp: 0,
            detail: {
              asset_id: assetId,
              reference,
              filename: body.filename,
              content_type: 'image/png',
              byte_length: png.length,
              width: 256,
              height: 256,
            },
          },
        })
      }
      expect(route.request().url()).toContain(assetId)
      return route.fulfill({ contentType: 'image/png', body: png })
    })
    await api.open()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const content = page.getByRole('textbox', { name: 'Content', exact: true })
    await content.fill('# Image guide\n\nBefore  after.\n')
    await content.evaluate((element: HTMLTextAreaElement) => {
      const cursor = element.value.indexOf(' after.')
      element.focus()
      element.setSelectionRange(cursor, cursor)
    })
    await page.getByLabel('Choose document images').setInputFiles({
      name: 'diagram.png',
      mimeType: 'image/png',
      buffer: png,
    })
    await expect(content).toHaveValue(
      `# Image guide\n\nBefore ![diagram.png](${reference}) after.\n`
    )
    expect(uploads).toBe(1)
    const editorAccessibility = await new AxeBuilder({ page })
      .include('form')
      .analyze()
    expect(editorAccessibility.violations).toEqual([])
    await page.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByRole('img', { name: 'diagram.png' })).toBeVisible()
    await page.getByRole('button', { name: 'Edit source', exact: true }).click()
    await page
      .getByRole('button', { name: 'Save version', exact: true })
      .click()
    const image = page.getByRole('img', { name: 'diagram.png' })
    await expect(image).toBeVisible()
    await expect(image).toHaveJSProperty('naturalWidth', 256)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    const accessibility = await new AxeBuilder({ page })
      .include('[data-document-content]')
      .analyze()
    expect(accessibility.violations).toEqual([])
    expect(api.unexpected).toEqual([])
    await page.screenshot({
      path: `.artifacts/markdown-images-${width}.png`,
      fullPage: true,
    })
  })
}

test('a reader renders twenty managed images and blocks remote tracking images', async ({
  page,
}) => {
  const api = await installRepository(page)
  api.bodies
    .get(api.initial.id)!
    .set(
      documentId,
      '# Images\n\n' +
        Array.from(
          { length: 20 },
          (_, index) => `![Image ${index}](${reference})`
        ).join('\n\n') +
        '\n\n![remote](https://tracking.example.test/image.png)'
    )
  const remote = [] as string[]
  await page.route('https://tracking.example.test/**', (route) => {
    remote.push(route.request().url())
    return route.abort()
  })
  await page.route(`**${path}/${assetId}`, (route) =>
    route.fulfill({ contentType: 'image/png', body: png })
  )
  await api.open()
  await expect(page.locator('[data-document-content] img')).toHaveCount(20)
  await expect(
    page.locator('[data-document-content] img').first()
  ).toHaveJSProperty('naturalWidth', 256)
  expect(remote).toEqual([])
  expect(api.unexpected).toEqual([])
})

test('password-protected share images use the unlock proof and the pinned version', async ({
  page,
}) => {
  const registry = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
  if (!registry) throw new Error('The Playwright secret registry is required.')
  const shareId = 'a'.repeat(32)
  const versionId = 'c'.repeat(32)
  const secret = `vdoc_share_${'b'.repeat(48)}`
  const proof = 'image-test-unlock-proof'
  await registerCapabilitySecret(registry, secret)
  let imageRequests = 0
  let unlocked = false
  await page.route('**/api/v1/open/document-shares/**', async (route) => {
    const request = route.request()
    expect(request.headers()['authorization'] === `VdocShare ${secret}`).toBe(
      true
    )
    expect(request.headers()['cookie']).toBeUndefined()
    expect(new URL(request.url()).search).toBe('')
    const pathname = new URL(request.url()).pathname
    const respond = (detail: unknown, code = 200, status = 'OK') =>
      route.fulfill({
        json: { code, status, description: '', timestamp: 0, detail },
      })
    if (pathname.endsWith('/unlock')) {
      expect(request.method()).toBe('POST')
      expect(request.postDataJSON().password === 'test-image-password').toBe(
        true
      )
      unlocked = true
      return respond({
        unlock_proof: proof,
        expires_at: '2099-01-01T00:00:00Z',
      })
    }
    if (!unlocked) return respond(null, 401, 'PASSWORD_REQUIRED')
    expect(request.headers()['x-vdoc-share-unlock'] === proof).toBe(true)
    if (pathname.includes('/images/')) {
      expect(
        pathname.endsWith(`/versions/${versionId}/images/${assetId}`)
      ).toBe(true)
      imageRequests++
      return route.fulfill({ contentType: 'image/png', body: png })
    }
    if (pathname.endsWith('/content'))
      return respond({
        version_id: versionId,
        content: `# Protected image\n\n![Private diagram](${reference})`,
      })
    return respond({
      document_name: 'Protected image',
      document_type: 2,
      version_scope: 3,
      current_version: {
        id: versionId,
        version_name: 'main.1',
        published_at: '2026-11-01T00:00:00Z',
      },
    })
  })
  await page.goto(`/share/${shareId}#${secret}`)
  await expect(
    page.getByRole('button', { name: 'Unlock document' })
  ).toBeVisible()
  expect(imageRequests).toBe(0)
  await page
    .getByLabel('Share password', { exact: true })
    .fill('test-image-password')
  await page.getByRole('button', { name: 'Unlock document' }).click()
  await expect(
    page.getByRole('img', { name: 'Private diagram' })
  ).toHaveJSProperty('naturalWidth', 256)
  expect(imageRequests).toBeGreaterThan(0)
  expect(new URL(page.url()).hash).toBe('')
  const browserStorage = await page.evaluate(() =>
    JSON.stringify([
      Object.entries(localStorage),
      Object.entries(sessionStorage),
    ])
  )
  expect(
    browserStorage.includes(secret) || browserStorage.includes(proof)
  ).toBe(false)
})

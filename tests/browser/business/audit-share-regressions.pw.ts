import { expect, test, type Route } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-expose-headers': 'Content-Disposition',
}

async function envelope(route: Route, detail: unknown, extra = {}) {
  await route.fulfill({
    status: 200,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      description: 'OK',
      timestamp: 1,
      detail,
      ...extra,
    }),
  })
}

for (const width of [1280, 390]) {
  test(`global audit selection survives filters and pagination at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'vdoc_admin_access_token',
        'audit-regression-session'
      )
    )
    const requests: Record<string, string>[] = []
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers })
      const url = new URL(request.url())
      if (url.pathname.endsWith('/identity/me')) {
        return envelope(route, {
          id: 'super',
          email: 'super@example.test',
          name: 'Super',
          is_super_admin: true,
          can_access_audit: true,
          status: 1,
        })
      }
      if (url.pathname.endsWith('/projects')) {
        return envelope(
          route,
          [
            { id: 'project-a', name: 'Project A', status: 1 },
            { id: 'project-b', name: 'Project B', status: 1 },
          ],
          { total: 2 }
        )
      }
      if (url.pathname.endsWith('/audit-logs')) {
        const query = Object.fromEntries(url.searchParams.entries())
        requests.push(query)
        return envelope(
          route,
          [
            {
              id: `audit-${requests.length}`,
              action: `${query.project_id ?? 'global'}.${query.cursor ? 'older' : 'latest'}`,
              project_id: query.project_id,
              resource_type: 'document',
              metadata: { result: 'success' },
              created_at: '2026-09-30T00:00:00Z',
            },
          ],
          { total: 1, next_cursor: query.cursor ? undefined : 'older-page' }
        )
      }
      return envelope(route, [], { total: 0 })
    })
    await page.goto('/audit')
    const selector = page.getByLabel('Project', { exact: true })
    await expect(selector).toHaveValue('project-a')
    await expect.poll(() => requests.at(-1)?.project_id).toBe('project-a')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect.poll(() => requests.at(-1)?.cursor).toBe('older-page')
    await selector.selectOption('')
    await expect(selector).toHaveValue('')
    await expect(page.getByText('global.latest', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Previous', exact: true })
    ).toBeDisabled()
    await page.getByLabel('Action', { exact: true }).fill('document.updated')
    await expect.poll(() => requests.at(-1)?.action).toBe('document.updated')
    expect(requests.at(-1)?.project_id).toBeUndefined()
    await expect(selector).toHaveValue('')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect.poll(() => requests.at(-1)?.cursor).toBe('older-page')
    expect(requests.at(-1)?.project_id).toBeUndefined()
    await selector.selectOption('project-b')
    await expect.poll(() => requests.at(-1)?.project_id).toBe('project-b')
    expect(requests.at(-1)?.cursor).toBeUndefined()
    await expect(selector).toHaveValue('project-b')
    await writeFile(
      testInfo.outputPath('audit-requests.json'),
      JSON.stringify({ width, requests }, null, 2)
    )
    await page.screenshot({
      path: testInfo.outputPath(`audit-${width}.png`),
      fullPage: true,
    })
  })
}

test.describe('public share original downloads', () => {
  test.use({ acceptDownloads: true })
  for (const [filename, mimeType, content] of [
    [
      'api.yaml',
      'application/yaml; charset=utf-8',
      'openapi: 3.0.3\ninfo:\n  title: API\n',
    ],
    ['api.json', 'application/json; charset=utf-8', '{"openapi":"3.0.3"}'],
    ['guide.md', 'text/markdown; charset=utf-8', '# Guide\n\nOriginal bytes.'],
  ]) {
    test(`downloads ${filename} with the backend token filename`, async ({
      page,
    }, testInfo) => {
      const registryPath = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
      if (registryPath === undefined)
        throw new Error('The Playwright secret registry is required.')
      const shareId = 'a'.repeat(32)
      const versionId = 'c'.repeat(32)
      const secret = `vdoc_share_${'b'.repeat(48)}`
      await registerCapabilitySecret(registryPath, secret)
      await page.route('**/api/v1/open/document-shares/**', async (route) => {
        const request = route.request()
        if (request.method() === 'OPTIONS')
          return route.fulfill({ status: 204, headers })
        expect(
          request.headers()['authorization'] === `VdocShare ${secret}`
        ).toBe(true)
        const path = new URL(request.url()).pathname
        if (path.endsWith('/download'))
          return route.fulfill({
            status: 200,
            headers: {
              ...headers,
              'Content-Disposition': `attachment; filename=${filename}`,
              'Content-Type': mimeType,
            },
            body: content,
          })
        if (path.endsWith('/content'))
          return envelope(route, { version_id: versionId, content })
        return envelope(route, {
          document_name: 'Download regression',
          document_type: filename.endsWith('.md') ? 2 : 1,
          version_scope: 1,
          current_version: {
            id: versionId,
            version_name: 'v1',
            published_at: '2026-09-30T00:00:00Z',
          },
        })
      })
      await page.goto(`/share/${shareId}#${secret}`)
      await expect.poll(() => new URL(page.url()).hash.length).toBe(0)
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download original' }).click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe(filename)
      const path = await download.path()
      if (path === null)
        throw new Error('The browser download did not complete.')
      expect(await readFile(path, 'utf8')).toBe(content)
      await writeFile(
        testInfo.outputPath('download-evidence.json'),
        JSON.stringify(
          {
            filename: download.suggestedFilename(),
            mimeType,
            bytes: Buffer.byteLength(content),
            fragmentErased: true,
          },
          null,
          2
        )
      )
      await download.delete()
    })
  }
})

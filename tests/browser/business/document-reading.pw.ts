import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

const projectId = 'reader-project'
const documentId = 'reader-document'
const branchId = 'reader-main'
const versionId = 'd'.repeat(32)
const publicationId = 'e'.repeat(32)
const timestamp = '2026-10-26T08:00:00Z'
const source =
  '# Reading guide\r\n\r\n## Getting started\r\n\r\nRead **the original source** and keep its spacing.  \r\n\r\n## Version history\r\n\r\n- Stable and beta stay separate.\r\n- 草稿审核通过后发布。\r\n\r\n### Next steps\r\n\r\nUse the document tools to explore versions.\r\n'
const version = {
  id: versionId,
  project_id: projectId,
  document_id: documentId,
  branch_id: branchId,
  draft_id: 'historical-draft',
  version_name: '1.0.0',
  status: 1,
  document_format: 3,
  source_type: 1,
  published_by: 'reader-user',
  published_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
}
const draft = {
  id: 'submitted-draft',
  revision: 'r1',
  review_revision: 'review1',
  project_id: projectId,
  document_id: documentId,
  branch_id: branchId,
  version_name: '1.1.0',
  status: 2,
  document_format: 3,
  source_type: 1,
  created_by: 'reader-user',
  created_at: timestamp,
  updated_at: timestamp,
}
const responseHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'Authorization, Content-Type, X-Vdoc-Share-Unlock',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': 'Content-Disposition',
}
async function ok(route: Route, detail: unknown, extra = {}) {
  await route.fulfill({
    status: 200,
    headers: responseHeaders,
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      description: 'OK',
      detail,
      timestamp: 1,
      ...extra,
    }),
  })
}
async function privateFixture(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem('vdoc_admin_access_token', 'reader-fixture-session')
  )
  let published = false
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: responseHeaders })
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/identity/me'))
      return ok(route, {
        id: 'reader-user',
        email: 'reader@example.test',
        name: 'Reader',
        is_super_admin: true,
        can_access_audit: true,
        status: 1,
      })
    if (path.endsWith('/projects'))
      return ok(
        route,
        [
          {
            id: projectId,
            team_id: 'reader-team',
            team_name: 'Documentation',
            name: 'Reading project',
            status: 1,
          },
        ],
        { total: 1 }
      )
    if (path.endsWith('/documents'))
      return ok(
        route,
        [
          {
            id: documentId,
            project_id: projectId,
            name: 'Reading guide',
            document_type: 2,
            file_name: 'guide.md',
            relative_path: 'guide.md',
            status: 1,
            latest_version_id: published ? publicationId : versionId,
            latest_draft_id: draft.id,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
        { total: 1 }
      )
    if (path.endsWith('/branches'))
      return ok(
        route,
        [
          {
            id: branchId,
            document_id: documentId,
            name: 'main',
            is_default: true,
            kind: 1,
            status: 1,
          },
        ],
        { total: 1 }
      )
    if (path.endsWith('/approve')) {
      published = true
      return ok(route, {
        ...version,
        id: publicationId,
        draft_id: draft.id,
        version_name: draft.version_name,
      })
    }
    if (path.endsWith('/drafts'))
      return ok(
        route,
        [
          {
            ...draft,
            status: published ? 5 : 2,
            ...(published ? { published_at: timestamp } : {}),
          },
        ],
        { total: 1 }
      )
    if (path.includes('/drafts/') && path.includes('/content/'))
      return ok(route, {
        draft: {
          ...draft,
          status: published ? 5 : 2,
          review_revision: published ? '' : draft.review_revision,
          ...(published ? { published_at: timestamp } : {}),
        },
        content: source,
        owner_type: 'draft',
        owner_id: draft.id,
        kind: 'raw',
        content_kind: 'raw',
        hash: 'fixture',
      })
    if (path.endsWith('/versions'))
      return ok(
        route,
        published
          ? [
              {
                ...version,
                id: publicationId,
                draft_id: draft.id,
                version_name: draft.version_name,
              },
              version,
            ]
          : [version],
        { total: published ? 2 : 1 }
      )
    if (path.includes('/versions/') && path.includes('/content/'))
      return ok(route, {
        content: source,
        owner_type: 'version',
        owner_id: path.includes(publicationId) ? publicationId : versionId,
        kind: 'raw',
        content_kind: 'raw',
        hash: 'fixture',
      })
    if (path.includes('/versions/'))
      return ok(
        route,
        path.endsWith(publicationId)
          ? {
              ...version,
              id: publicationId,
              draft_id: draft.id,
              version_name: draft.version_name,
            }
          : version
      )
    if (path.endsWith('/activity'))
      return ok(
        route,
        [
          {
            id: 'log-new',
            action: 'document_version.publish',
            resource_id: versionId,
            branch_id: branchId,
            branch_name: 'main',
            version_name: '1.0.0',
            created_at: timestamp,
          },
          {
            id: 'log-old',
            action: 'contract_draft.submit',
            resource_id: draft.id,
            branch_id: branchId,
            branch_name: 'main',
            version_name: '1.0.0',
            created_at: '2026-10-26T07:00:00Z',
          },
        ],
        { total: 2 }
      )
    if (path.endsWith('/overview'))
      return ok(route, {
        version_count: 1,
        endpoint_count: 0,
        latest_version: version,
        published_branch_ids: [branchId],
        has_reviewed_draft: true,
        raw_size_bytes: source.length,
        raw_line_count: 20,
      })
    return ok(route, [], { total: 0 })
  })
}

test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
  acceptDownloads: true,
})

test('a first-time share follows the browser language and retains an explicit choice', async ({
  browser,
  baseURL,
}, info) => {
  const context = await browser.newContext({
    baseURL,
    locale: 'zh-CN',
    colorScheme: 'dark',
    viewport: { width: 390, height: 900 },
  })
  try {
    const page = await context.newPage()
    const secret = `vdoc_share_${'c'.repeat(48)}`
    await registerCapabilitySecret(
      process.env.VDOC_PLAYWRIGHT_SECRET_REGISTRY!,
      secret
    )
    const sharePath = `/share/${'f'.repeat(32)}#${secret}`
    await page.route('**/api/v1/open/document-shares/**', async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers: responseHeaders })
      if (new URL(route.request().url()).pathname.endsWith('/content'))
        return ok(route, { version_id: versionId, content: source })
      return ok(route, {
        document_name: 'Reading guide',
        document_type: 2,
        version_scope: 1,
        current_version: {
          id: versionId,
          version_name: '1.0.0',
          published_at: timestamp,
        },
      })
    })
    await page.goto(sharePath)
    await expect(page.getByRole('button', { name: '下载源文件' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(
      page.getByRole('heading', { name: 'Getting started' })
    ).toBeVisible()
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === 'vdoc-admin-language'
      )
    ).toBeUndefined()
    await page.screenshot({
      path: info.outputPath('browser-language-zh-dark.png'),
      fullPage: true,
    })
    await page.getByRole('button', { name: '语言：中文' }).click()
    await page.getByRole('menuitem', { name: '英文', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Download source' })
    ).toBeVisible()
    await page.goto('about:blank')
    await page.goto(sharePath)
    await expect(
      page.getByRole('button', { name: 'Download source' })
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(
      page.getByRole('heading', { name: 'Getting started' })
    ).toBeVisible()
  } finally {
    await context.close()
  }
})

for (const width of [1280, 390]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shared reader at ${width}px in ${theme} mode`, async ({
      page,
      context,
    }, info) => {
      const channel = theme === 'light' ? 'beta' : 'release'
      await page.addInitScript((releaseChannel) => {
        window.__VDOC_ADMIN_CONFIG__ = {
          ...window.__VDOC_ADMIN_CONFIG__,
          releaseChannel,
        }
      }, channel)
      const shareId = 'a'.repeat(32)
      const secret = `vdoc_share_${'b'.repeat(48)}`
      await registerCapabilitySecret(
        process.env.VDOC_PLAYWRIGHT_SECRET_REGISTRY!,
        secret
      )
      await page.setViewportSize({ width, height: 900 })
      await context.addCookies([
        { name: 'vite-ui-theme', value: theme, url: 'http://127.0.0.1:4173' },
      ])
      await page.route('**/api/v1/open/document-shares/**', async (route) => {
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({ status: 204, headers: responseHeaders })
        const path = new URL(route.request().url()).pathname
        if (path.endsWith('/download'))
          return route.fulfill({
            status: 200,
            contentType: 'text/markdown;charset=utf-8',
            headers: {
              ...responseHeaders,
              'content-disposition': 'attachment; filename="guide.md"',
            },
            body: source,
          })
        if (path.endsWith('/content'))
          return ok(route, { version_id: versionId, content: source })
        return ok(route, {
          document_name: 'Reading guide',
          document_type: 2,
          version_scope: 1,
          current_version: {
            id: versionId,
            version_name: '1.0.0',
            published_at: timestamp,
          },
        })
      })
      await page.goto(`/share/${shareId}#${secret}`)
      await expect(
        page.getByRole('heading', { name: 'Getting started' })
      ).toBeVisible()
      await expect(page).not.toHaveURL(/#vdoc_share_/)
      await expect(page.locator('header img').first()).toHaveAttribute(
        'src',
        channel === 'beta'
          ? '/images/vdoc-logo-beta.png'
          : '/images/vdoc-logo.png'
      )
      await expect(page.getByText('Beta', { exact: true })).toHaveCount(
        channel === 'beta' ? 1 : 0
      )
      const repository = page.getByRole('link', { name: 'Open Vdoc on GitHub' })
      await expect(repository).toHaveAttribute(
        'href',
        'https://github.com/ChnMig/Vdoc'
      )
      await expect(repository).toHaveAttribute('referrerpolicy', 'no-referrer')

      const body = page.locator('[data-document-content]')
      if (width < 1024)
        await page.getByRole('button', { name: 'On this page' }).click()
      await expect(
        page.getByRole('link', { name: 'Version history', exact: true }).last()
      ).toBeVisible()
      if (width < 1024)
        await page
          .getByRole('link', { name: 'Getting started', exact: true })
          .last()
          .click()
      await page.getByRole('button', { name: 'Copy content' }).click()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        source
      )
      const downloaded = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download source' }).click()
      const file = await downloaded
      expect(await readFile((await file.path())!, 'utf8')).toBe(source)
      await file.delete()
      await page.getByRole('button', { name: 'Switch to source' }).click()
      await expect(body.locator('pre')).toHaveText(source)
      await page.getByRole('button', { name: 'Switch to preview' }).click()
      await page.getByRole('button', { name: 'Language: English' }).click()
      await page.getByRole('menuitem', { name: 'Chinese', exact: true }).click()
      await expect(
        page.locator('[data-slot="dropdown-menu-content"]')
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: '下载源文件' })
      ).toBeVisible()
      await expect(page.locator('html')).toHaveClass(
        new RegExp(`\\b${theme}\\b`)
      )
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      const a11y = await new AxeBuilder({ page }).analyze()
      expect(a11y.violations).toEqual([])
      await page.screenshot({
        path: info.outputPath(`share-${width}-${theme}-zh.png`),
        fullPage: true,
      })
    })
  }
  test(`private reader actions, activity and approved draft history at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await privateFixture(page)
    let loads = 0
    page.on('load', () => loads++)
    await page.goto(`/documents/${documentId}?project_id=${projectId}`)
    await expect(
      page.getByRole('heading', { name: 'Getting started' })
    ).toBeVisible()
    const loaded = loads
    await page.getByRole('button', { name: 'Copy content' }).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      source
    )
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download source' }).click()
    const file = await downloaded
    expect(file.suggestedFilename()).toBe('guide.md')
    expect(await readFile((await file.path())!, 'utf8')).toBe(source)
    await file.delete()
    await page.getByRole('button', { name: 'Activity', exact: true }).click()
    await expect(
      page.getByText('Version published', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Submitted for review', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Back to preview', exact: true })
      .click()
    await page.getByRole('button', { name: 'Edit draft', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Approve', exact: true })
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Approve', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`version_id=${publicationId}`))
    await expect(
      page.getByRole('heading', { name: 'Getting started' })
    ).toBeVisible()
    await expect(
      page.getByText(
        'The selected branch or revision is unavailable. Choose another branch or revision.'
      )
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit draft', exact: true }).click()
    await page.getByRole('tab', { name: 'Draft history', exact: true }).click()
    await expect(
      page.getByRole('columnheader', { name: 'Created at' })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Published at' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'View', exact: true }).click()
    await expect(
      page.getByText('Selected draft is read-only', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Review note' })
    ).toHaveCount(0)
    await expect(
      page.getByText(
        'The selected branch or revision is unavailable. Choose another branch or revision.'
      )
    ).toHaveCount(0)
    expect(loads).toBe(loaded)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: info.outputPath(`private-${width}-history.png`),
      fullPage: true,
    })
  })
}

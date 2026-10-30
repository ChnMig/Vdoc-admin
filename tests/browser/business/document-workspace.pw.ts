import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  projectId,
  documentId,
  mainBranchId,
  releaseBranchId,
  latestId,
  historicalId,
  mainDraftId,
  releaseDraftId,
  installWorkspace,
  chooseWorkspaceOption,
  openDocument,
  showFiles,
  closeMobileFiles,
  openTool,
} from '../support/document-workspace'
import { installUnimportedRepository } from '../support/repository-workflow'

const evidenceDirectory = resolve(
  '../.artifacts/document-workspace-interactions-20261025-beta10/regression'
)
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
})

test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([])
})

async function assertNoPageOverflow(page: Page) {
  const { viewport, content } = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(content).toBeLessThanOrEqual(viewport)
}

async function assertReadingColumns(page: Page, width: number) {
  const files = page.getByRole('complementary', { name: 'Files', exact: true })
  const reader = page.locator('[data-document-page] main#content')
  const tools = page.getByRole('complementary', {
    name: 'On this page',
    exact: true,
  })
  await expect(reader).toBeVisible()
  if (width >= 1280) {
    await expect(files).toBeVisible()
    await expect(tools).toBeVisible()
    const [fileBounds, readerBounds, toolBounds] = await Promise.all([
      files.boundingBox(),
      reader.boundingBox(),
      tools.boundingBox(),
    ])
    expect(fileBounds).not.toBeNull()
    expect(readerBounds).not.toBeNull()
    expect(toolBounds).not.toBeNull()
    expect(readerBounds!.x).toBeGreaterThanOrEqual(
      fileBounds!.x + fileBounds!.width
    )
    expect(toolBounds!.x).toBeGreaterThanOrEqual(
      readerBounds!.x + readerBounds!.width
    )
    expect(readerBounds!.width).toBeGreaterThan(600)
    expect(toolBounds!.width).toBeGreaterThanOrEqual(200)
  } else {
    await expect(files).toHaveCount(0)
    await expect(tools).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Show files', exact: true })
    ).toBeVisible()
    expect((await reader.boundingBox())?.width).toBe(width)
  }
}

async function capture(page: Page, name: string, width: number) {
  await mkdir(evidenceDirectory, { recursive: true })
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur()
    window.scrollTo(0, 0)
    return document.fonts.ready
  })
  await assertNoPageOverflow(page)
  await page.screenshot({
    path: resolve(evidenceDirectory, `${name}-${width}.png`),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
}

test('Markdown icon switching retains the reading mode and mobile outline through document tools', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const api = await installWorkspace(page)
  await openDocument(page)
  const reader = page.locator('[data-document-reading-pane]')
  const readerNode = await reader.elementHandle()
  const toggle = page.getByRole('button', {
    name: /^Switch to (source|preview)$/,
  })
  await expect(toggle).toBeEnabled()
  const initialUrl = page.url()
  const requests = api.requests.filter((request) =>
    request.path.endsWith('/content/raw')
  ).length
  const previewIcon = await toggle.locator('svg').innerHTML()
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Switch to preview')
  await expect(toggle).toBeFocused()
  expect(await toggle.locator('svg').innerHTML()).not.toBe(previewIcon)
  await expect(reader.locator('pre')).toContainText(
    '# Integration handbook 2.4'
  )
  expect(page.url()).toBe(initialUrl)

  await openTool(page, 'Versions')
  await page
    .getByRole('button', { name: 'Back to preview', exact: true })
    .click()
  await expect(toggle).toHaveAccessibleName('Switch to preview')
  expect(
    await reader.evaluate((node, retained) => node === retained, readerNode)
  ).toBe(true)
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Switch to source')
  await expect(
    reader.getByRole('heading', { name: 'Release checklist', exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'On this page', exact: true }).click()
  const outline = page.getByRole('dialog', {
    name: 'On this page',
    exact: true,
  })
  await expect(
    outline.getByRole('link', { name: 'Release checklist', exact: true })
  ).toBeVisible()
  await expect(
    outline.getByRole('link', { name: 'Integration handbook', exact: true })
  ).toHaveCount(0)
  expect(
    api.requests.filter((request) => request.path.endsWith('/content/raw'))
  ).toHaveLength(requests)
  expect(api.unexpected).toEqual([])
})

for (const width of [1440, 1920, 390]) {
  test(`document reading preserves exact revision and folder selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await openDocument(page)
    await assertReadingColumns(page, width)
    const tree = await showFiles(page)
    const iconPaths: string[] = []
    for (const [fileName, typeName] of [
      [/platform\.yaml/, 'OpenAPI'],
      [/integration\.md/, 'Markdown'],
      [/operations\.txt/, 'TXT'],
    ] as const) {
      const file = tree.getByRole('button', { name: fileName })
      await expect(file).toHaveAccessibleName(new RegExp(typeName))
      const icon = file.locator('svg').first()
      await expect(icon).toBeVisible()
      iconPaths.push(await icon.innerHTML())
    }
    expect(new Set(iconPaths).size).toBe(3)
    await closeMobileFiles(page)
    await capture(page, 'content-current', width)
    await showFiles(page)
    await tree
      .getByRole('button', { name: 'Collapse guides', exact: true })
      .click()
    await expect(
      tree.getByRole('button', { name: /integration\.md/ })
    ).toHaveCount(0)
    expect(new URL(page.url()).pathname).toBe(`/documents/${documentId}`)
    await tree
      .getByRole('button', { name: 'Expand guides', exact: true })
      .click()
    await expect(
      tree.getByRole('button', { name: /integration\.md/ })
    ).toHaveAttribute('aria-current', 'page')
    await closeMobileFiles(page)
    await expect(
      page.getByRole('heading', {
        name: 'Integration handbook 2.4',
        exact: true,
      })
    ).toBeVisible()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Version', exact: true }),
      historicalId
    )
    await expect(
      page.getByRole('heading', {
        name: 'Historical handbook 2.3',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Integration handbook 2.4',
        exact: true,
      })
    ).toHaveCount(0)
    await capture(page, 'content-historical', width)
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Content state', exact: true }),
      'draft'
    )
    await expect(
      page.getByRole('heading', {
        name: 'Main branch working draft',
        exact: true,
      })
    ).toBeVisible()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Branch', exact: true }),
      releaseBranchId
    )
    await expect(
      page.getByRole('heading', {
        name: 'Release branch working draft',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: 'Draft', exact: true })
    ).toHaveAttribute('value', releaseDraftId)
    await capture(page, 'content-draft', width)
    expect(api.unexpected).toEqual([])
    await writeFile(
      resolve(evidenceDirectory, `reading-requests-${width}.json`),
      JSON.stringify(api.requests, null, 2)
    )
  })

  test(`legacy publication sharing requires the repository workflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page, 'zh-CN')
    await page.goto(
      `/documents/${documentId}?team_id=workspace-team&project_id=${projectId}&version_id=${historicalId}`
    )
    await expect(
      page.getByRole('heading', {
        name: 'Historical handbook 2.3',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByText('旧历史快照仅供读取。新的修改通过项目分支和提交保存。')
    ).toBeVisible()
    for (const name of ['分享', '编辑草稿', '文档设置'])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        0
      )
    await expect(
      page.getByRole('button', { name: '打开项目仓库', exact: true })
    ).toBeVisible()
    expect(api.requests.filter((request) => request.method === 'POST')).toEqual(
      []
    )
    expect(api.unexpected).toEqual([])
  })

  test(`document tools, custom branches and AI use the selected revision at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await openDocument(page)
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Version', exact: true }),
      historicalId
    )
    await openTool(page, 'Versions')
    await expect(
      page.getByRole('heading', { name: 'Versions', exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('tab', { name: 'Diffs', exact: true })
    ).toHaveCount(0)
    await openTool(page, 'Diffs')
    await expect(
      page.getByRole('combobox', { name: 'From version', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: 'To version', exact: true })
    ).toBeVisible()
    await capture(page, 'tools-diffs', width)
    await page
      .getByRole('button', { name: 'Search versions', exact: true })
      .click()
    const sourcePages = page.getByRole('navigation', {
      name: 'Source version pages',
    })
    const sourceDraftPages = page.getByRole('navigation', {
      name: 'Source draft pages',
    })
    await expect(
      sourcePages.getByText('Published versions', { exact: true })
    ).toBeVisible()
    await expect(
      sourceDraftPages.getByText('Drafts', { exact: true })
    ).toBeVisible()
    await expect(sourcePages.getByRole('button')).toHaveCount(0)
    await expect(sourceDraftPages.getByRole('button')).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Target draft pages' })
    ).toBeVisible()
    await assertNoPageOverflow(page)
    await page
      .getByLabel('Search source versions')
      .locator('..')
      .locator('..')
      .locator('..')
      .screenshot({
        path: test.info().outputPath(`diff-search-${width}.png`),
        animations: 'disabled',
      })
    await page
      .getByRole('button', { name: 'Search versions', exact: true })
      .click()
    await openTool(page, 'Document AI')
    await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${historicalId}.`, {
        exact: true,
      })
    ).toBeVisible()
    await page.getByRole('tab', { name: 'AI chat', exact: true }).click()
    await page
      .getByLabel('AI chat message', { exact: true })
      .fill('Explain the selected historical release.')
    await page
      .getByRole('button', { name: 'Send AI message', exact: true })
      .click()
    await expect(
      page.getByText('This answer uses the selected document revision.', {
        exact: false,
      })
    ).toBeVisible()
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' &&
          request.path.endsWith('/ai/chat-sessions')
      )?.body
    ).toMatchObject({
      document_id: documentId,
      context_type: 'document',
      context_id: documentId,
    })
    expect(
      api.requests.some(
        (request) =>
          request.path.endsWith('/ai/chat-sessions') &&
          request.query.context_id === documentId
      )
    ).toBe(true)
    await capture(page, 'ai-historical', width)
    await page
      .getByRole('button', { name: 'Close document AI', exact: true })
      .click()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Content state', exact: true }),
      'draft'
    )
    await expect(
      page.getByRole('combobox', { name: 'Content state', exact: true })
    ).toHaveAttribute('value', 'draft')
    await expect(
      page.getByRole('heading', {
        name: 'Main branch working draft',
        exact: true,
      })
    ).toBeVisible()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Branch', exact: true }),
      releaseBranchId
    )
    await expect(
      page.getByRole('heading', {
        name: 'Release branch working draft',
        exact: true,
      })
    ).toBeVisible()
    await openTool(page, 'Document AI')
    await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${releaseDraftId}.`, {
        exact: true,
      })
    ).toBeVisible()
    expect(
      api.requests.some(
        (request) =>
          request.path.endsWith('/ai/chat-sessions') &&
          request.query.context_type === 'document' &&
          request.query.context_id === documentId
      )
    ).toBe(true)
    await capture(page, 'ai-draft', width)
    await page
      .getByRole('button', { name: 'Close document AI', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Document settings', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Create branch', exact: true })
    ).toHaveCount(0)
    expect(api.unexpected).toEqual([])
    await writeFile(
      resolve(evidenceDirectory, `tools-ai-requests-${width}.json`),
      JSON.stringify(api.requests, null, 2)
    )
  })

  test(`hierarchy opens a standalone document and returns without a navigation loop at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await installUnimportedRepository(page, projectId)
    await openDocument(page)
    await expect(page.locator('[data-document-page]')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Teams and projects', exact: true })
    ).toHaveCount(0)
    await showFiles(page)
    await page
      .getByRole('button', { name: 'Back to workspace', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/documents\\?`))
    await expect(
      page.getByRole('heading', { name: 'Workspace', exact: true })
    ).toBeVisible()
    await expect(page.locator('[data-document-page]')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.get('document_id')).toBeNull()
    await capture(page, 'workspace-hierarchy', width)
    await page.getByRole('button', { name: 'guides', exact: true }).click()
    await page
      .getByRole('button', { name: 'Integration handbook', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?`))
    await expect(
      page.getByRole('button', {
        name: 'Import existing documents',
        exact: true,
      })
    ).toBeVisible()
    await page.goBack()
    await expect(
      page.getByRole('heading', { name: 'Workspace', exact: true })
    ).toBeVisible()
    await expect(page.locator('[data-document-page]')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(new URL(page.url()).pathname).toBe('/documents')
    expect(api.unexpected).toEqual([])
  })

  test(`outline links locate document sections within the reader at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page, 'en', 'admin', true)
    await openDocument(page)
    if (width === 390)
      await page
        .getByRole('button', { name: 'On this page', exact: true })
        .click()
    const outline = page.getByRole('navigation', {
      name: 'On this page',
      exact: true,
    })
    const link = outline.getByRole('link', {
      name: 'Release checklist',
      exact: true,
    })
    await expect(link).toBeVisible()
    await link.click()
    if (width === 390)
      await expect(
        page.getByRole('dialog', { name: 'On this page', exact: true })
      ).toHaveCount(0)
    const reader = page.locator('[data-document-reading-pane]')
    const target = reader.getByRole('heading', {
      name: 'Release checklist',
      exact: true,
    })
    await expect
      .poll(() => reader.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(100)
    await expect
      .poll(async () => {
        const targetBox = await target.boundingBox()
        const readerBox = await reader.boundingBox()
        return Boolean(
          targetBox &&
          readerBox &&
          targetBox.y >= readerBox.y &&
          targetBox.y + targetBox.height <= readerBox.y + readerBox.height
        )
      })
      .toBe(true)
    await expect(
      page.getByRole('combobox', { name: 'Version', exact: true })
    ).toHaveAttribute('value', latestId)
    await capture(page, 'outline-section', width)
    expect(api.unexpected).toEqual([])
  })

  test(`legacy saved draft remains fixed while using AI at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await page.goto(
      `/documents/${documentId}?team_id=workspace-team&project_id=${projectId}&branch_id=${mainBranchId}&content_mode=draft&draft_id=${mainDraftId}`
    )
    await expect(
      page.getByRole('heading', {
        name: 'Main branch working draft',
        exact: true,
      })
    ).toBeVisible()
    for (const name of ['Edit draft', 'Update', 'Approve'])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        0
      )
    await expect(page.locator('textarea[name=content]')).toHaveCount(0)
    await openTool(page, 'Document AI')
    await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${mainDraftId}.`, {
        exact: true,
      })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Close document AI', exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: 'Main branch working draft',
        exact: true,
      })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get('draft_id')).toBe(mainDraftId)
    expect(
      api.requests.filter((request) =>
        ['POST', 'PATCH', 'DELETE'].includes(request.method)
      )
    ).toEqual([])
    expect(api.unexpected).toEqual([])
  })

  test(`reader can inspect exact revisions and AI without management actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page, 'en', 'reader')
    await openDocument(page)
    await showFiles(page)
    await expect(
      page.getByRole('button', { name: 'New document', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'New folder', exact: true })
    ).toHaveCount(0)
    await closeMobileFiles(page)
    for (const name of [
      'Share',
      'Edit draft',
      'Document settings',
      'Manage branches',
    ])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(
        0
      )
    await capture(page, 'reader-current', width)
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Version', exact: true }),
      historicalId
    )
    await expect(
      page.getByRole('heading', {
        name: 'Historical handbook 2.3',
        exact: true,
      })
    ).toBeVisible()
    await openTool(page, 'Document AI')
    await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${historicalId}.`, {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Regenerate AI summary', exact: true })
    ).toBeDisabled()
    await page.getByRole('tab', { name: 'AI chat', exact: true }).click()
    await page
      .getByLabel('AI chat message', { exact: true })
      .fill('Summarize this historical release.')
    await page
      .getByRole('button', { name: 'Send AI message', exact: true })
      .click()
    await expect(
      page.getByText('This answer uses the selected document revision.', {
        exact: false,
      })
    ).toBeVisible()
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' &&
          request.path.endsWith('/ai/chat-sessions')
      )?.body
    ).toMatchObject({
      document_id: documentId,
      context_type: 'document',
      context_id: documentId,
    })
    expect(
      api.requests.some(
        (request) =>
          request.path === '/api/v1/private/teams' ||
          request.path === '/api/v1/private/users'
      )
    ).toBe(false)
    await capture(page, 'reader-ai', width)
    expect(api.unexpected).toEqual([])
  })
}

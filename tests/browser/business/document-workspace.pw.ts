import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { selectOption } from '../helpers/select-option'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

const evidenceDirectory = resolve(
  '.artifacts/document-workspace-redesign-20261025'
)
const projectId = 'workspace-project'
const documentId = 'workspace-handbook'
const mainBranchId = 'branch-main'
const releaseBranchId = 'branch-release'
const latestId = 'a'.repeat(32)
const historicalId = 'b'.repeat(32)
const releaseId = 'c'.repeat(32)
const mainDraftId = 'draft-main'
const releaseDraftId = 'draft-release'
const timestamp = '2026-10-25T08:00:00Z'
const basePath = `/api/v1/private/projects/${projectId}/documents/${documentId}`
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const document = {
  id: documentId,
  project_id: projectId,
  folder_id: 'folder-guides',
  name: 'Integration handbook',
  file_name: 'integration.md',
  relative_path: 'guides/integration.md',
  document_type: 2,
  status: 1,
  workflow_state: 'published',
  has_draft: true,
  latest_version_id: latestId,
  latest_draft_id: mainDraftId,
  created_at: timestamp,
  updated_at: timestamp,
}

const branch = {
  id: mainBranchId,
  document_id: documentId,
  name: 'main',
  kind: 1,
  is_default: true,
  is_protected: true,
  status: 1,
  created_at: timestamp,
  updated_at: timestamp,
}

const versions = [
  { id: latestId, branch_id: mainBranchId, version_name: '2.4.0' },
  { id: historicalId, branch_id: mainBranchId, version_name: '2.3.0' },
  { id: releaseId, branch_id: releaseBranchId, version_name: '3.0.0-rc.1' },
].map((version) => ({
  ...version,
  project_id: projectId,
  document_id: documentId,
  document_format: 3,
  source_type: 1,
  status: 1,
  changelog: 'Reviewed integration guidance',
  published_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
}))

const drafts = [
  { id: mainDraftId, branch_id: mainBranchId, version_name: '2.5.0-draft' },
  {
    id: releaseDraftId,
    branch_id: releaseBranchId,
    version_name: '3.0.0-draft',
  },
].map((draft) => ({
  ...draft,
  project_id: projectId,
  document_id: documentId,
  revision: `revision-${draft.id}`,
  document_format: 3,
  source_type: 1,
  status: 1,
  changelog: 'Saved draft for editorial review',
  created_at: timestamp,
  updated_at: timestamp,
}))

const contentById: Record<string, string> = {
  [latestId]:
    '# Integration handbook 2.4\n\nUse this reviewed guide to connect the workspace to your service.\n\n## Authentication\n\nCreate a project credential and send it with each API request.\n\n## Release checklist\n\n1. Validate the request schema.\n2. Review the saved draft.\n3. Publish an immutable version.\n\nThe published release remains stable while new drafts evolve.',
  [historicalId]:
    '# Historical handbook 2.3\n\nThis immutable historical revision uses the legacy credential flow.\n\n## Migration\n\nCompare the previous release with version 2.4 before upgrading.',
  [releaseId]:
    '# Release candidate handbook\n\nThis release branch documents the upcoming integration contract.',
  [mainDraftId]:
    '# Main branch working draft\n\nThis saved draft adds the new retry policy and remains private.',
  [releaseDraftId]:
    '# Release branch working draft\n\nThis exact saved draft describes the upcoming webhook contract.',
}

type ApiRequest = {
  method: string
  path: string
  query: Record<string, string>
  body?: Record<string, unknown>
}

async function envelope(route: Route, detail: unknown, total?: number) {
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
      ...(total === undefined ? {} : { total }),
    }),
  })
}

async function installWorkspace(page: Page, language = 'en') {
  const requests: ApiRequest[] = []
  const unexpected: string[] = []
  const branches = [
    branch,
    {
      ...branch,
      id: releaseBranchId,
      name: 'release/2026',
      is_default: false,
      is_protected: false,
    },
  ]
  await page.addInitScript((locale) => {
    sessionStorage.setItem(
      'vdoc_admin_access_token',
      'synthetic-workspace-session'
    )
    document.cookie = `vdoc-admin-language=${locale}; path=/`
  }, language)
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : undefined
    requests.push({
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      ...(body === undefined ? {} : { body }),
    })
    if (path.endsWith('/identity/me'))
      return envelope(route, {
        id: 'workspace-admin',
        name: 'Documentation admin',
        email: 'admin@example.test',
        is_super_admin: true,
        status: 1,
      })
    if (path === '/api/v1/private/projects')
      return envelope(
        route,
        [
          {
            id: projectId,
            team_id: 'workspace-team',
            team_name: 'Documentation team',
            name: 'Developer platform',
            status: 1,
          },
        ],
        1
      )
    if (path === `/api/v1/private/projects/${projectId}/folders`)
      return envelope(
        route,
        [
          {
            id: 'folder-guides',
            project_id: projectId,
            parent_id: null,
            name: 'guides',
            path: 'guides',
          },
        ],
        1
      )
    if (path === `/api/v1/private/projects/${projectId}/documents`)
      return envelope(
        route,
        [
          document,
          {
            ...document,
            id: 'workspace-openapi',
            name: 'Platform API',
            file_name: 'platform.yaml',
            relative_path: 'guides/platform.yaml',
            document_type: 1,
          },
          {
            ...document,
            id: 'workspace-text',
            name: 'Operations notes',
            file_name: 'operations.txt',
            relative_path: 'guides/operations.txt',
            document_type: 3,
          },
        ],
        3
      )
    if (path === `${basePath}/branches` && method === 'GET')
      return envelope(route, branches, branches.length)
    if (path === `${basePath}/branches` && method === 'POST') {
      const created = {
        ...branch,
        id: 'branch-custom',
        ...body,
        is_default: false,
        is_protected: false,
      }
      branches.push(created)
      return envelope(route, created)
    }
    if (path === `${basePath}/versions`) {
      const items = versions.filter(
        (version) =>
          !url.searchParams.get('branch_id') ||
          version.branch_id === url.searchParams.get('branch_id')
      )
      return envelope(route, items, items.length)
    }
    if (path === `${basePath}/drafts`) {
      const items = drafts.filter(
        (draft) =>
          !url.searchParams.get('branch_id') ||
          draft.branch_id === url.searchParams.get('branch_id')
      )
      return envelope(route, items, items.length)
    }
    const version = versions.find(
      (version) => path === `${basePath}/versions/${version.id}`
    )
    if (version) return envelope(route, version)
    const contentMatch = path.match(
      /\/(versions|drafts)\/([^/]+)\/content\/raw$/
    )
    if (contentMatch) {
      const id = contentMatch[2]
      return envelope(route, {
        owner_type: contentMatch[1] === 'versions' ? 'version' : 'draft',
        owner_id: id,
        content: contentById[id],
        content_kind: 'markdown',
        kind: 'raw',
        hash: `synthetic-${id}`,
        ...(contentMatch[1] === 'drafts'
          ? { draft: drafts.find((draft) => draft.id === id) }
          : {}),
      })
    }
    if (path === `${basePath}/overview`)
      return envelope(route, {
        version_count: 3,
        endpoint_count: 0,
        latest_version: versions[0],
        published_branch_ids: [mainBranchId, releaseBranchId],
        raw_line_count: 16,
        raw_size_bytes: 490,
      })
    if (path === `${basePath}/shares` && method === 'GET')
      return envelope(route, [], 0)
    if (path === `${basePath}/shares` && method === 'POST') {
      const registryPath = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
      if (!registryPath)
        throw new Error('The Playwright secret registry is required.')
      const secret = `vdoc_share_${'d'.repeat(48)}`
      await registerCapabilitySecret(registryPath, secret)
      return envelope(route, {
        secret,
        share: {
          id: 'e'.repeat(32),
          project_id: projectId,
          document_id: documentId,
          ...body,
          status: 1,
          password_protected: false,
          created_at: timestamp,
          updated_at: timestamp,
        },
      })
    }
    if (path === `${basePath}/diffs`) return envelope(route, [], 0)
    if (path.endsWith('/ai-summary')) {
      const ownerId = path.split('/').at(-2)
      return envelope(route, {
        id: `summary-${ownerId}`,
        status: 'ready',
        content: `Summary for exact revision ${ownerId}.`,
      })
    }
    if (path === `/api/v1/private/projects/${projectId}/ai/chat-sessions`) {
      if (method === 'POST')
        return envelope(route, { id: 'chat-exact-revision', ...body })
      return envelope(route, [], 0)
    }
    if (path.endsWith('/chat-exact-revision/messages'))
      return envelope(route, {
        id: 'assistant-answer',
        session_id: 'chat-exact-revision',
        role: 'assistant',
        content: 'This answer uses the selected document revision.',
      })
    if (path.endsWith('/chat-exact-revision'))
      return envelope(route, { id: 'chat-exact-revision', messages: [] })
    unexpected.push(`${method} ${path}`)
    await route.fulfill({
      status: 404,
      headers,
      body: 'Unexpected synthetic API request',
    })
  })
  return { requests, unexpected }
}

async function chooseWorkspaceOption(trigger: Locator, value: string) {
  const page = trigger.page()
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(
    0
  )
  await selectOption(trigger, value)
  await expect(trigger).toHaveAttribute('value', value)
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(
    0
  )
}

async function openDocument(page: Page) {
  await page.goto(`/documents/?team_id=workspace-team&project_id=${projectId}`)
  const tree = page.getByRole('navigation', { name: 'Files', exact: true })
  await tree.getByRole('button', { name: 'Expand guides', exact: true }).click()
  await tree.getByRole('button', { name: /integration\.md/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Integration handbook 2.4', exact: true })
  ).toBeVisible()
  return tree
}

async function assertNoPageOverflow(page: Page) {
  const { viewport, content } = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(content).toBeLessThanOrEqual(viewport)
}

async function capture(page: Page, name: string, width: number) {
  await mkdir(evidenceDirectory, { recursive: true })
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible())
    await dialog.getByRole('heading').first().click()
  else await page.getByRole('heading', { level: 1 }).first().click()
  await page.evaluate(() => {
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

for (const width of [1440, 390]) {
  test(`document reading preserves exact revision and folder selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    const tree = await openDocument(page)
    const iconPaths: string[] = []
    for (const [fileName, typeName] of [
      [/platform\.yaml/, 'OpenAPI'],
      [/integration\.md/, 'Markdown'],
      [/operations\.txt/, 'TXT'],
    ] as const) {
      const file = tree.getByRole('button', { name: fileName })
      await expect(file).toContainText(typeName)
      const icon = file.locator('svg').first()
      await expect(icon).toBeVisible()
      iconPaths.push(await icon.innerHTML())
    }
    expect(new Set(iconPaths).size).toBe(3)
    await capture(page, 'content-current', width)
    await tree
      .getByRole('button', { name: 'Collapse guides', exact: true })
      .click()
    await expect(
      tree.getByRole('button', { name: /integration\.md/ })
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', {
        name: 'Integration handbook 2.4',
        exact: true,
      })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get('document_id')).toBe(documentId)
    await tree
      .getByRole('button', { name: 'Expand guides', exact: true })
      .click()
    await expect(
      tree.getByRole('button', { name: /integration\.md/ })
    ).toHaveAttribute('aria-current', 'page')
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
    if (width === 390)
      await page
        .getByRole('button', { name: 'Hide files', exact: true })
        .click()
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

  test(`share dialog pins current version and localizes aligned expiry fields at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page, 'zh-CN')
    await page.goto(
      `/documents/?team_id=workspace-team&project_id=${projectId}&document_id=${documentId}&branch_id=${mainBranchId}&version_id=${historicalId}`
    )
    await expect(
      page.getByRole('heading', {
        name: 'Historical handbook 2.3',
        exact: true,
      })
    ).toBeVisible()
    await page.getByRole('button', { name: '分享', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByText('分享当前版本', { exact: true })
    ).toBeVisible()
    await expect(dialog.getByText('2.3.0', { exact: true })).toBeVisible()
    await expect(
      dialog.getByText('当前已发布版本', { exact: true })
    ).toBeVisible()
    const expiry = dialog.locator('#share-expiry')
    await expect(expiry).toHaveText('3 个月')
    await expiry.click()
    for (const name of ['1 个月', '3 个月', '6 个月', '1 年', '永久有效'])
      await expect(
        page.getByRole('option', { name, exact: true })
      ).toBeVisible()
    await page.getByRole('option', { name: '6 个月', exact: true }).click()
    const expiryBounds = await expiry.boundingBox()
    const passwordBounds = await dialog
      .locator('#share-password-admin')
      .boundingBox()
    expect(expiryBounds).not.toBeNull()
    expect(passwordBounds).not.toBeNull()
    if (width === 1440)
      expect(Math.abs(expiryBounds!.y - passwordBounds!.y)).toBeLessThanOrEqual(
        1
      )
    else
      expect(passwordBounds!.y).toBeGreaterThan(
        expiryBounds!.y + expiryBounds!.height
      )
    await capture(page, 'share-localized', width)
    await dialog.locator('button[type="submit"]').click()
    await expect
      .poll(
        () =>
          api.requests.filter(
            (request) =>
              request.method === 'POST' && request.path === `${basePath}/shares`
          ).length
      )
      .toBe(1)
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' && request.path === `${basePath}/shares`
      )?.body
    ).toEqual({
      branch_id: mainBranchId,
      version_scope: 3,
      version_id: historicalId,
      expiry_preset: '6_months',
      password: '',
    })
    expect(api.unexpected).toEqual([])
    await writeFile(
      resolve(evidenceDirectory, `share-request-${width}.json`),
      JSON.stringify(
        api.requests.filter((request) => request.method === 'POST'),
        null,
        2
      )
    )
  })

  test(`document tools, custom branches and AI use the selected revision at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await openDocument(page)
    if (width === 390)
      await page
        .getByRole('button', { name: 'Hide files', exact: true })
        .click()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Version', exact: true }),
      historicalId
    )
    await page.getByRole('tab', { name: 'Document tools', exact: true }).click()
    const toolTabs = page
      .getByRole('tabpanel', { name: 'Document tools', exact: true })
      .getByRole('tablist')
      .first()
    await expect(
      toolTabs.getByRole('tab', { name: 'Versions', exact: true })
    ).toBeVisible()
    await toolTabs.getByRole('tab', { name: 'Diffs', exact: true }).click()
    await expect(
      page.getByRole('combobox', { name: 'From version', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: 'To version', exact: true })
    ).toBeVisible()
    await capture(page, 'tools-diffs', width)
    await page.getByRole('tab', { name: 'Document AI', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${historicalId}.`, {
        exact: true,
      })
    ).toBeVisible()
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
      context_type: 'version',
      context_id: historicalId,
    })
    expect(
      api.requests.some(
        (request) =>
          request.path.endsWith('/ai/chat-sessions') &&
          request.query.context_id === historicalId
      )
    ).toBe(true)
    await capture(page, 'ai-historical', width)
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
    await page.getByRole('tab', { name: 'Document AI', exact: true }).click()
    await expect(
      page.getByText(`Summary for exact revision ${releaseDraftId}.`, {
        exact: true,
      })
    ).toBeVisible()
    expect(
      api.requests.some(
        (request) =>
          request.path.endsWith('/ai/chat-sessions') &&
          request.query.context_type === 'draft' &&
          request.query.context_id === releaseDraftId
      )
    ).toBe(true)
    await capture(page, 'ai-draft', width)
    await page
      .getByRole('button', { name: 'Manage branches', exact: true })
      .click()
    await expect(
      page.getByRole('tab', { name: 'Manage branches', exact: true })
    ).toHaveAttribute('data-state', 'active')
    await page
      .getByRole('button', { name: 'Create branch', exact: true })
      .click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Name', { exact: true })
      .fill('feature/webhook-contract')
    await dialog
      .getByLabel('Description', { exact: true })
      .fill('Custom branch for webhook documentation')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText('feature/webhook-contract', { exact: true })
    ).toBeVisible()
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' && request.path === `${basePath}/branches`
      )?.body
    ).toEqual({
      name: 'feature/webhook-contract',
      description: 'Custom branch for webhook documentation',
    })
    await capture(page, 'settings-branches', width)
    expect(api.unexpected).toEqual([])
    await writeFile(
      resolve(evidenceDirectory, `tools-ai-requests-${width}.json`),
      JSON.stringify(api.requests, null, 2)
    )
  })
}

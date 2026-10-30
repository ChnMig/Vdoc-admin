import { expect, test, type Page, type Route } from '@playwright/test'
import { selectOption } from '../helpers/select-option'
import {
  installRepository,
  installUnimportedRepository,
  projectId as repositoryProjectId,
} from '../support/repository-workflow'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

const adminToken = 'business-workflow-session'
const adminUserId = 'user-admin'
const projectId = 'project-closure'
const documentId = 'document-handbook'
const branchId = 'branch-main'
const editableDraftId = 'draft-editable'
const submittedDraftId = 'draft-submitted'
const latestVersionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const previousVersionId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const timestamp = '2026-08-14T08:00:00Z'

const adminUser = {
  id: adminUserId,
  email: 'admin@example.test',
  name: 'Closure Admin',
  is_super_admin: true,
  status: 1,
  created_at: timestamp,
  updated_at: timestamp,
}

const project = {
  id: projectId,
  team_id: 'team-closure',
  team_name: 'Documentation team',
  name: 'Closure Project',
  description: 'End-to-end workflow fixtures',
  status: 1,
  created_by: adminUserId,
  created_at: timestamp,
  updated_at: timestamp,
}

const document = {
  id: documentId,
  project_id: projectId,
  name: 'Closure Handbook',
  document_type: 2,
  relative_path: 'guides/closure.md',
  file_name: 'closure.md',
  folder_id: 'folder-guides',
  workflow_state: 'published',
  has_draft: true,
  latest_version_id: latestVersionId,
  latest_draft_id: editableDraftId,
  description: 'Published workflow handbook',
  status: 1,
  created_by: adminUserId,
  created_at: timestamp,
  updated_at: timestamp,
}

const branch = {
  id: branchId,
  document_id: documentId,
  name: 'main',
  kind: 1,
  description: 'Published branch',
  is_default: true,
  is_protected: true,
  status: 1,
  created_by: adminUserId,
  created_at: timestamp,
  updated_at: timestamp,
}

const editableDraft = {
  id: editableDraftId,
  revision: 'revision-1',
  project_id: projectId,
  document_id: documentId,
  branch_id: branchId,
  version_name: '1.9.0-draft',
  changelog: 'Still being edited',
  document_format: 3,
  source_type: 1,
  status: 1,
  created_by: adminUserId,
  created_at: timestamp,
  updated_at: timestamp,
}

const submittedDraft = {
  review_revision: 'review-1',
  ...editableDraft,
  id: submittedDraftId,
  version_name: '2.0.0',
  changelog: 'Ready for review',
  status: 2,
  submitted_at: timestamp,
}

const latestVersion = {
  id: latestVersionId,
  project_id: projectId,
  document_id: documentId,
  branch_id: branchId,
  version_name: '2.0.0',
  changelog: 'Current release',
  document_format: 3,
  source_type: 1,
  draft_id: submittedDraftId,
  status: 1,
  published_by: adminUserId,
  published_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
}

const previousVersion = {
  ...latestVersion,
  id: previousVersionId,
  version_name: '1.8.0',
  changelog: 'Previous release',
  draft_id: 'draft-previous',
  published_at: '2026-08-01T08:00:00Z',
}

function responseHeaders() {
  return {
    'access-control-allow-headers':
      'Authorization, Content-Type, X-Vdoc-Share-Unlock',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
  }
}

async function fulfillOptions(route: Route) {
  await route.fulfill({ status: 204, headers: responseHeaders() })
}

async function fulfillEnvelope(
  route: Route,
  detail: unknown,
  options: { readonly total?: number; readonly status?: number } = {}
) {
  await route.fulfill({
    status: options.status ?? 200,
    contentType: 'application/json',
    headers: responseHeaders(),
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      description: 'OK',
      timestamp: Date.now(),
      detail,
      ...(options.total === undefined ? {} : { total: options.total }),
    }),
  })
}

async function fulfillError(
  route: Route,
  code: number,
  status: string,
  description: string
) {
  await route.fulfill({
    status: code,
    contentType: 'application/json',
    headers: responseHeaders(),
    body: JSON.stringify({
      code,
      status,
      description,
      timestamp: Date.now(),
    }),
  })
}

async function installAdminSession(page: Page) {
  await page.addInitScript(
    ({ key, token }) => window.sessionStorage.setItem(key, token),
    { key: 'vdoc_admin_access_token', token: adminToken }
  )
}

async function openWorkspaceFile(
  page: Page,
  view: 'content' | 'versions' | 'diffs' = 'content'
) {
  await page.goto(
    `/documents/${documentId}?team_id=${project.team_id}&project_id=${projectId}&version_id=${latestVersionId}`
  )
  await expect(
    page.getByRole('heading', { name: document.name, exact: true })
  ).toBeVisible()
  if (view !== 'content') await openWorkspaceTool(page, view)
}

async function openWorkspaceTool(page: Page, view: 'versions' | 'diffs') {
  await page
    .getByRole('navigation', { name: 'Document tools', exact: true })
    .getByRole('button', {
      name: view === 'diffs' ? 'Diffs' : 'Versions',
      exact: true,
    })
    .click()
}

async function installAdminApi(
  page: Page,
  onApprove?: (request: {
    readonly path: string
    readonly body: unknown
  }) => void
) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const path = url.pathname

    if (method === 'OPTIONS') {
      await fulfillOptions(route)
      return
    }
    if (request.headers()['authorization'] !== adminToken) {
      throw new Error('Admin API request did not carry the active session.')
    }
    if (method === 'GET' && path === '/api/v1/private/identity/me') {
      await fulfillEnvelope(route, adminUser)
      return
    }
    if (method === 'GET' && path === '/api/v1/private/projects') {
      await fulfillEnvelope(route, [project], { total: 1 })
      return
    }
    if (method === 'GET' && path === '/api/v1/private/teams') {
      await fulfillEnvelope(
        route,
        [
          {
            id: project.team_id,
            name: project.team_name,
            created_by: adminUserId,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
        { total: 1 }
      )
      return
    }
    if (
      method === 'GET' &&
      path === `/api/v1/private/projects/${projectId}/folders`
    ) {
      await fulfillEnvelope(
        route,
        [
          {
            id: 'folder-guides',
            project_id: projectId,
            parent_id: null,
            name: 'guides',
            path: 'guides',
            created_by: adminUserId,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
        { total: 1 }
      )
      return
    }
    if (
      method === 'GET' &&
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/overview`
    ) {
      await fulfillEnvelope(route, {
        version_count: 2,
        endpoint_count: 0,
        latest_version: latestVersion,
        published_branch_ids: [branchId],
        has_reviewed_draft: true,
        raw_size_bytes: 120,
        raw_line_count: 5,
      })
      return
    }
    if (
      method === 'GET' &&
      path === `/api/v1/private/projects/${projectId}/documents`
    ) {
      await fulfillEnvelope(route, [document], { total: 1 })
      return
    }
    if (
      method === 'GET' &&
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/branches`
    ) {
      await fulfillEnvelope(route, [branch], { total: 1 })
      return
    }
    if (
      method === 'GET' &&
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts`
    ) {
      await fulfillEnvelope(route, [editableDraft, submittedDraft], {
        total: 2,
      })
      return
    }
    if (
      method === 'GET' &&
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/versions`
    ) {
      await fulfillEnvelope(route, [latestVersion, previousVersion], {
        total: 2,
      })
      return
    }
    if (
      method === 'GET' &&
      (path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${submittedDraftId}/content/raw` ||
        path ===
          `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${editableDraftId}/content/raw`)
    ) {
      const draft = path.includes(submittedDraftId)
        ? submittedDraft
        : editableDraft
      await fulfillEnvelope(route, {
        owner_type: 'draft',
        owner_id: draft.id,
        kind: 'raw',
        content_kind: 'markdown',
        draft,
        content:
          draft.id === submittedDraftId
            ? '# Submitted handbook'
            : '# Editable handbook',
        hash: 'draft-hash',
      })
      return
    }
    const versionContent = path.match(
      new RegExp(
        `^/api/v1/private/projects/${projectId}/documents/${documentId}/versions/(${latestVersionId}|${previousVersionId})/content/raw$`
      )
    )
    if (method === 'GET' && versionContent) {
      const versionId = versionContent[1]
      const content =
        versionId === latestVersionId
          ? '# Release Notes\n\nRead [internal details](./internal.md) or [public docs](https://docs.example.test/vdoc).'
          : '# Previous Notes\n\nThe earlier reviewed release remains readable.'
      await fulfillEnvelope(route, {
        owner_type: 'version',
        owner_id: versionId,
        kind: 'raw',
        content_kind: 'markdown',
        content,
        hash: `${versionId}-hash`,
      })
      return
    }
    if (method === 'GET' && path.endsWith('/ai-summary')) {
      await fulfillEnvelope(route, null)
      return
    }
    if (
      method === 'GET' &&
      (path.endsWith('/shares') || path.endsWith('/diffs'))
    ) {
      await fulfillEnvelope(route, [], { total: 0 })
      return
    }
    if (
      method === 'GET' &&
      (path.endsWith(`/versions/${latestVersionId}`) ||
        path.endsWith(`/versions/${previousVersionId}`))
    ) {
      await fulfillEnvelope(
        route,
        path.endsWith(latestVersionId) ? latestVersion : previousVersion
      )
      return
    }
    if (
      method === 'GET' &&
      path === `/api/v1/private/projects/${projectId}/ai/chat-sessions`
    ) {
      await fulfillEnvelope(route, [], { total: 0 })
      return
    }
    if (
      method === 'POST' &&
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${submittedDraftId}/approve`
    ) {
      onApprove?.({ path, body: request.postDataJSON() })
      await fulfillEnvelope(route, latestVersion)
      return
    }

    throw new Error(`Unexpected Admin API request: ${method} ${path}`)
  })
}

for (const width of [1280, 390]) {
  test(`client configuration stays inside its card at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await installAdminSession(page)
    await installAdminApi(page)
    await page.goto('/skill/')
    for (const client of ['Codex', 'Cursor']) {
      await page.getByRole('tab', { name: client, exact: true }).click()
      const panel = page.getByRole('tabpanel')
      await expect(panel).toBeVisible()
      expect(
        await panel.evaluate((element) => {
          const card = element.closest('[data-slot="card"]')
          if (!card) return false
          return (
            element.getBoundingClientRect().right <=
            card.getBoundingClientRect().right
          )
        })
      ).toBe(true)
      expect(
        await panel
          .locator('p')
          .first()
          .evaluate((element) => {
            return element.scrollWidth <= element.clientWidth
          })
      ).toBe(true)
    }
  })

  test(`workspace lists documents before loading committed content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await installRepository(page)
    await page.goto(
      `/documents?team_id=commit-team&project_id=${repositoryProjectId}&repository_branch_id=repo-work`
    )
    const files = page.getByRole('tabpanel', { name: 'Documents', exact: true })
    await expect(
      files.getByRole('button', { name: 'Shared guide', exact: true })
    ).toBeVisible()
    expect(
      api.requests.some((request) => request.path.endsWith('/content'))
    ).toBe(false)
    await files
      .getByRole('button', { name: 'Shared guide', exact: true })
      .click()
    await expect(
      page.getByText('Original saved body.', { exact: true })
    ).toBeVisible()
    expect(
      new Set(
        api.requests
          .filter((request) => request.path.endsWith('/content'))
          .map((request) => request.path)
      ).size
    ).toBe(1)
    expect(
      api.requests.some(
        (request) =>
          request.path.endsWith('/overview') ||
          request.path.endsWith('/versions') ||
          request.path.endsWith('/drafts')
      )
    ).toBe(false)
    expect(api.unexpected).toEqual([])
  })
}

test('diff version pagination retains selected historical versions', async ({
  page,
}) => {
  await installAdminSession(page)
  await installAdminApi(page)
  const offsets: string[] = []
  await page.route('**/versions?*', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await fulfillOptions(route)
      return
    }
    const params = new URL(route.request().url()).searchParams
    expect(params.get('page_size')).toBe('50')
    offsets.push(params.get('offset') ?? '0')
    const offset = Number(params.get('offset') ?? '0')
    await fulfillEnvelope(
      route,
      Array.from({ length: 50 }, (_, i) => ({
        ...latestVersion,
        id: (offset + i + 1).toString(16).padStart(32, '0'),
        version_name: `release-${offset + i + 1}`,
      })),
      { total: 100 }
    )
  })
  await page.goto(
    `/diffs/?project_id=${projectId}&document_id=${documentId}&from_version_id=${previousVersionId}&to_version_id=${latestVersionId}`
  )
  const from = page.getByLabel('From version', { exact: true })
  await expect(from).toHaveAttribute('value', previousVersionId)
  await page
    .getByRole('button', { name: 'Search versions', exact: true })
    .click()
  const sourcePages = page.getByRole('navigation', {
    name: 'Source version pages',
    exact: true,
  })
  const targetPages = page.getByRole('navigation', {
    name: 'Target version pages',
    exact: true,
  })
  await sourcePages.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => offsets.includes('50')).toBe(true)
  await expect(
    sourcePages.getByRole('button', { name: 'Previous', exact: true })
  ).toBeEnabled()
  await expect(
    targetPages.getByRole('button', { name: 'Previous', exact: true })
  ).toBeDisabled()
  await expect(from).toHaveAttribute('value', previousVersionId)
  await expect(page.getByLabel('To version', { exact: true })).toHaveAttribute(
    'value',
    latestVersionId
  )
  await targetPages.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(
    targetPages.getByRole('button', { name: 'Previous', exact: true })
  ).toBeEnabled()
  await expect(from).toHaveAttribute('value', previousVersionId)
  await expect(page.getByLabel('To version', { exact: true })).toHaveAttribute(
    'value',
    latestVersionId
  )
})

test('a comparison completed after document navigation stays in its original history', async ({
  page,
}) => {
  await installAdminSession(page)
  await installAdminApi(page)
  await installUnimportedRepository(page, projectId)
  const otherDocument = {
    ...document,
    id: 'document-other',
    name: 'Other Handbook',
    file_name: 'other.md',
    relative_path: 'guides/other.md',
    workflow_state: 'empty',
    has_draft: false,
    latest_version_id: null,
    latest_draft_id: null,
  }
  const result = {
    id: 'cccccccccccccccccccccccccccccccc',
    document_id: documentId,
    from_version_id: previousVersionId,
    to_version_id: latestVersionId,
    diff_status: 1,
    summary: {
      added_endpoints: 0,
      removed_endpoints: 0,
      modified_endpoints: 0,
      breaking_changes: 0,
    },
    items: [],
    created_at: timestamp,
    updated_at: timestamp,
  }
  let releaseComparison!: () => void
  const comparisonGate = new Promise<void>((resolve) => {
    releaseComparison = resolve
  })
  let comparisonStarted = false
  let comparisonFinished = false
  const documentPath = `/api/v1/private/projects/${projectId}/documents`
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    if (method === 'POST' && path === `${documentPath}/${documentId}/diffs`) {
      comparisonStarted = true
      await comparisonGate
      comparisonFinished = true
      await fulfillEnvelope(route, result)
      return
    }
    if (method === 'GET' && path === documentPath) {
      await fulfillEnvelope(route, [document, otherDocument], { total: 2 })
      return
    }
    if (method === 'GET' && path === `${documentPath}/${documentId}/diffs`) {
      await fulfillEnvelope(route, comparisonFinished ? [result] : [], {
        total: comparisonFinished ? 1 : 0,
      })
      return
    }
    if (
      method === 'GET' &&
      path === `${documentPath}/${documentId}/diffs/${result.id}`
    ) {
      await fulfillEnvelope(route, result)
      return
    }
    if (
      method === 'GET' &&
      path === `${documentPath}/${documentId}/diffs/${result.id}/summary`
    ) {
      await fulfillEnvelope(route, result.summary)
      return
    }
    if (
      method === 'GET' &&
      path.startsWith(`${documentPath}/${otherDocument.id}/`)
    ) {
      await fulfillEnvelope(route, [], { total: 0 })
      return
    }
    await route.fallback()
  })
  await page.goto(
    `/diffs/?project_id=${projectId}&document_id=${documentId}&from_version_id=${previousVersionId}&to_version_id=${latestVersionId}`
  )
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect.poll(() => comparisonStarted).toBe(true)
  const tree = page.getByRole('navigation', { name: 'Files', exact: true })
  const otherFile = tree.getByRole('button', { name: /other\.md/ })
  await otherFile.click()
  await expect(
    page.getByRole('button', { name: 'Import existing documents', exact: true })
  ).toBeVisible()
  const switchedUrl = page.url()
  const response = page.waitForResponse(
    (value) =>
      value.request().method() === 'POST' &&
      value.url().endsWith(`/${documentId}/diffs`)
  )
  releaseComparison()
  await response
  await expect(page).toHaveURL(switchedUrl)
  await expect(
    page.getByRole('button', { name: 'Import existing documents', exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('Linked entity is unavailable', { exact: true })
  ).toHaveCount(0)
  await page.goto(
    `/diffs/?project_id=${projectId}&document_id=${documentId}&from_version_id=${previousVersionId}&to_version_id=${latestVersionId}`
  )
  await openWorkspaceTool(page, 'diffs')
  await page
    .getByRole('tab', { name: 'Stored diff history', exact: true })
    .click()
  const history = page.getByText(
    `${previousVersion.version_name} → ${latestVersion.version_name}`,
    { exact: true }
  )
  await expect(history).toBeVisible()
  await history.click()
  await expect(page).toHaveURL(new RegExp(`diff_id=${result.id}`))
})

test('version history opens reviewed Markdown and keeps relative links inert', async ({
  page,
}) => {
  await installAdminSession(page)
  await installAdminApi(page)

  await openWorkspaceFile(page, 'versions')
  const versionSelect = page.getByLabel('Version', { exact: true })
  await expect(versionSelect).toHaveAttribute('value', latestVersionId)
  const history = page.getByRole('region', { name: 'Versions', exact: true })
  await expect(history).toBeVisible()
  await expect(history.locator('article')).toHaveCount(0)
  await history
    .getByRole('button', { name: latestVersion.version_name, exact: true })
    .click()
  await expect(history).toBeHidden()
  const markdown = page.getByRole('main').locator('article')
  await expect(
    markdown.getByRole('heading', { name: 'Release Notes' })
  ).toBeVisible()
  await expect(
    markdown.getByRole('link', { name: 'public docs' })
  ).toHaveAttribute('href', 'https://docs.example.test/vdoc')
  await expect(
    markdown.getByRole('link', { name: 'internal details' })
  ).toHaveCount(0)
  await expect(
    markdown.getByText(/Read internal details or public docs/)
  ).toBeVisible()

  await openWorkspaceTool(page, 'versions')
  await history
    .getByRole('button', { name: previousVersion.version_name, exact: true })
    .click()
  await expect(history).toBeHidden()
  await expect(versionSelect).toHaveAttribute('value', previousVersionId)
  const historicalReader = page.getByRole('main').locator('article')
  await expect(
    historicalReader.getByRole('heading', { name: 'Previous Notes' })
  ).toBeVisible()
  await expect(
    historicalReader.getByRole('heading', { name: 'Release Notes' })
  ).toHaveCount(0)
})

test('public share erases the fragment, unlocks, and switches history', async ({
  page,
}) => {
  const registryPath = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
  if (registryPath === undefined) {
    throw new Error('The Playwright secret registry is required.')
  }
  const shareId = '11111111111111111111111111111111'
  const secret = `vdoc_share_${'2'.repeat(48)}`
  const password = 'closure-pass-2026'
  const unlockProof = 'proof-for-business-workflow'
  let unlockBodyMatched = false
  let unlockProofObserved = false
  await registerCapabilitySecret(registryPath, secret)

  await page.route('**/api/v1/open/document-shares/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const path = url.pathname

    if (method === 'OPTIONS') {
      await fulfillOptions(route)
      return
    }
    if (request.headers()['authorization'] !== `VdocShare ${secret}`) {
      throw new Error('Public share authorization was missing or malformed.')
    }
    if (request.headers()['referer']?.includes(secret)) {
      throw new Error('The capability fragment leaked through the referrer.')
    }

    const sharePath = `/api/v1/open/document-shares/${shareId}`
    if (method === 'POST' && path === `${sharePath}/unlock`) {
      unlockBodyMatched =
        (request.postDataJSON() as { readonly password?: unknown }).password ===
        password
      await fulfillEnvelope(route, {
        unlock_proof: unlockProof,
        expires_at: '2026-08-14T09:00:00Z',
      })
      return
    }

    const requestProof = request.headers()['x-vdoc-share-unlock']
    if (
      method === 'GET' &&
      path === sharePath &&
      requestProof !== unlockProof
    ) {
      await fulfillError(
        route,
        401,
        'PASSWORD_REQUIRED',
        'A share password is required.'
      )
      return
    }
    if (requestProof === unlockProof) unlockProofObserved = true
    if (method === 'GET' && path === sharePath) {
      await fulfillEnvelope(route, {
        document_name: 'Closure Handbook',
        document_type: 2,
        version_scope: 2,
        current_version: {
          id: latestVersionId,
          version_name: '2.0.0',
          changelog: 'Current release',
          published_at: timestamp,
        },
      })
      return
    }
    if (method === 'GET' && path === `${sharePath}/versions`) {
      await fulfillEnvelope(route, [
        {
          id: latestVersionId,
          version_name: '2.0.0',
          changelog: 'Current release',
          published_at: timestamp,
        },
        {
          id: previousVersionId,
          version_name: '1.8.0',
          changelog: 'Previous release',
          published_at: '2026-08-01T08:00:00Z',
        },
      ])
      return
    }
    if (
      method === 'GET' &&
      path === `${sharePath}/versions/${latestVersionId}/content`
    ) {
      await fulfillEnvelope(route, {
        version_id: latestVersionId,
        content: '# Current Handbook\n\nThe approved facts are available.',
      })
      return
    }
    if (
      method === 'GET' &&
      path === `${sharePath}/versions/${previousVersionId}/content`
    ) {
      await fulfillEnvelope(route, {
        version_id: previousVersionId,
        content: '# Previous Handbook\n\nHistorical facts remain readable.',
      })
      return
    }

    throw new Error(`Unexpected public share request: ${method} ${path}`)
  })

  await page.goto(`/share/${shareId}#${secret}`)
  await expect.poll(() => new URL(page.url()).hash.length).toBe(0)
  const capabilityPersisted = await page.evaluate((value) => {
    const storageValues = [window.localStorage, window.sessionStorage].flatMap(
      (storage) =>
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index)
          return key === null ? '' : (storage.getItem(key) ?? '')
        })
    )
    return [...storageValues, document.cookie].some((entry) =>
      entry.includes(value)
    )
  }, secret)
  expect(capabilityPersisted).toBe(false)

  const passwordInput = page.getByLabel('Share password', { exact: true })
  await expect(passwordInput).toBeVisible()
  await passwordInput.fill(password)
  await page.getByRole('button', { name: 'Unlock document' }).click()

  await expect(
    page.getByRole('heading', { name: 'Current Handbook' })
  ).toBeVisible()
  const versionSelect = page.getByLabel('Version', { exact: true })
  await expect(versionSelect).toHaveAttribute('value', latestVersionId)
  await selectOption(versionSelect, previousVersionId)
  await expect(
    page.getByRole('heading', { name: 'Previous Handbook' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Current Handbook' })
  ).toHaveCount(0)
  expect(unlockBodyMatched).toBe(true)
  expect(unlockProofObserved).toBe(true)
})

for (const size of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test(`diff history pagination loads details outside the page on ${size.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await installAdminSession(page)
    await installAdminApi(page)
    const selected = {
      id: 'diff-selected',
      document_id: documentId,
      from_version_id: previousVersionId,
      to_version_id: latestVersionId,
      diff_status: 1,
      summary: {
        added_endpoints: 0,
        removed_endpoints: 0,
        modified_endpoints: 1,
        breaking_changes: 0,
      },
      items: [
        {
          id: 'manual',
          change_type: 7,
          severity: 2,
          message: 'Schema compatibility requires manual review',
          is_breaking: false,
          must_handle: true,
          sort_order: 1,
        },
      ],
      created_at: timestamp,
      updated_at: timestamp,
    }
    const offsets: string[] = []
    await page.route('**/diffs?*', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await fulfillOptions(route)
        return
      }
      const params = new URL(route.request().url()).searchParams
      expect(params.get('page_size')).toBe('50')
      const offset = Number(params.get('offset') ?? '0')
      offsets.push(String(offset))
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: `history-${offset + i}`,
        document_id: documentId,
        from_version_id: previousVersionId,
        to_version_id: latestVersionId,
        diff_status: 1,
        created_at: timestamp,
        updated_at: timestamp,
      }))
      await fulfillEnvelope(route, rows, { total: 120 })
    })
    await page.route('**/diffs/diff-selected', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await fulfillOptions(route)
        return
      }
      await fulfillEnvelope(route, selected)
    })
    await page.route('**/diffs/diff-selected/summary', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await fulfillOptions(route)
        return
      }
      await fulfillEnvelope(route, selected.summary)
    })
    await page.goto(
      `/diffs/?project_id=${projectId}&document_id=${documentId}&diff_id=diff-selected`
    )
    await expect(
      page.getByLabel('From version', { exact: true })
    ).toHaveAttribute('value', previousVersionId)
    await page
      .getByRole('button', { name: 'Review semantic changes', exact: true })
      .click()
    await expect(
      page
        .getByText('Schema compatibility requires manual review', {
          exact: true,
        })
        .first()
    ).toBeVisible()
    await page
      .getByRole('tab', { name: 'Stored diff history', exact: true })
      .click()
    await page
      .getByRole('navigation', { name: 'Diff history pages' })
      .getByRole('button', { name: 'Next', exact: true })
      .click()
    await expect.poll(() => offsets.includes('50')).toBe(true)
    await expect(
      page.getByLabel('From version', { exact: true })
    ).toHaveAttribute('value', previousVersionId)
    await page.getByRole('tab', { name: 'Diff result', exact: true }).click()
    await page
      .getByRole('button', { name: 'Review semantic changes', exact: true })
      .click()
    await expect(
      page
        .getByText('Schema compatibility requires manual review', {
          exact: true,
        })
        .first()
    ).toBeVisible()
    await page
      .getByRole('tab', { name: 'Stored diff history', exact: true })
      .click()
    await page
      .getByRole('navigation', { name: 'Diff history pages' })
      .scrollIntoViewIfNeeded()
    await page.screenshot({
      path: `../.artifacts/project-optimization-20260928/diffs-after-${size.name}.png`,
    })
  })
}

for (const width of [1280, 390]) {
  test(`exact contract numbers survive API decoding and render at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await installAdminSession(page)
    await installAdminApi(page)
    const responsesJSON =
      '{"200":{"content":{"application/json":{"schema":{"enum":[9007199254740993,0.123456789012345678901,1e131071,1e-16383,"9007199254740993"]}}}}}'
    const endpoint = {
      id: 'endpoint-precision',
      version_id: latestVersionId,
      method: 'GET',
      path: '/precision',
      operation_id: 'exactNumbers',
      deprecated: false,
      hash: 'exact-hash',
      created_at: timestamp,
      updated_at: timestamp,
      responses: 'RAW_RESPONSES',
      json_preview: { responses: responsesJSON },
    }
    const diff = {
      id: 'diff-precision',
      document_id: documentId,
      from_version_id: previousVersionId,
      to_version_id: latestVersionId,
      diff_status: 1,
      summary: {
        added_endpoints: 0,
        removed_endpoints: 0,
        modified_endpoints: 1,
        breaking_changes: 1,
        document_format: 1,
      },
      items: [
        {
          id: 'number-change',
          change_type: 7,
          severity: 3,
          method: 'GET',
          path: '/precision',
          message: 'Schema constraint changed',
          is_breaking: true,
          must_handle: true,
          sort_order: 1,
          old_value: 'RAW_OLD',
          new_value: 'RAW_NEW',
          old_value_json: '9007199254740992',
          new_value_json: '9007199254740993',
        },
      ],
      created_at: timestamp,
      updated_at: timestamp,
    }
    await page.route('**/api/v1/private/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() === 'OPTIONS') {
        await fulfillOptions(route)
        return
      }
      if (path.endsWith('/documents')) {
        await fulfillEnvelope(
          route,
          [{ ...document, document_type: 1, relative_path: 'api.json' }],
          { total: 1 }
        )
        return
      }
      if (path.endsWith('/versions')) {
        await fulfillEnvelope(
          route,
          [
            { ...latestVersion, document_format: 1 },
            { ...previousVersion, document_format: 1 },
          ],
          { total: 2 }
        )
        return
      }
      if (path.endsWith(`/versions/${latestVersionId}`)) {
        await fulfillEnvelope(route, { ...latestVersion, document_format: 1 })
        return
      }
      if (path.endsWith('/endpoints')) {
        await fulfillEnvelope(route, [endpoint], { total: 1 })
        return
      }
      if (path.endsWith('/content/raw')) {
        await fulfillEnvelope(route, {
          owner_type: 'version',
          owner_id: latestVersionId,
          kind: 'raw',
          content_kind: 'openapi',
          content: '{}',
          hash: 'content-hash',
        })
        return
      }
      if (
        path.endsWith('/diffs/diff-precision') ||
        path.endsWith('/endpoints/endpoint-precision')
      ) {
        const detail = path.endsWith('/diffs/diff-precision') ? diff : endpoint
        const body = JSON.stringify({ code: 200, status: 'OK', detail })
          .replace('"RAW_OLD"', '9007199254740992')
          .replace('"RAW_NEW"', '9007199254740993')
          .replace('"RAW_RESPONSES"', responsesJSON)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: responseHeaders(),
          body,
        })
        return
      }
      await route.fallback()
    })
    await page.goto(
      `/diffs/?project_id=${projectId}&document_id=${documentId}&diff_id=diff-precision`
    )
    await page
      .getByRole('button', { name: 'Review semantic changes', exact: true })
      .click()
    await expect(
      page.locator('pre').filter({ hasText: /^9007199254740992$/ })
    ).toBeVisible()
    await expect(
      page.locator('pre').filter({ hasText: /^9007199254740993$/ })
    ).toBeVisible()
    await page
      .locator('article')
      .filter({ hasText: '9007199254740993' })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('exact-diff.png') })
    await page.goto(
      `/versions/?project_id=${projectId}&document_id=${documentId}&version_id=${latestVersionId}&endpoint_id=endpoint-precision`
    )
    await expect(page).toHaveURL(
      new RegExp(`/documents/${documentId}\\?.*workspace_view=content`)
    )
    await expect(
      page.getByRole('tab', { name: 'OpenAPI endpoints', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Version', { exact: true })).toHaveAttribute(
      'value',
      latestVersionId
    )
    const preview = page
      .locator('pre')
      .filter({ hasText: '0.123456789012345678901' })
    await expect(preview).toBeVisible()
    await expect(preview).toHaveText(responsesJSON)
    await expect(preview).not.toContainText('9007199254740992')
    await preview.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('exact-endpoint.png') })
    await page.getByRole('tab', { name: 'Source', exact: true }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.has('endpoint_id'))
      .toBe(false)
    await expect(
      page.getByRole('tab', { name: 'Source', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await page
      .getByRole('tab', { name: 'OpenAPI endpoints', exact: true })
      .click()
    await page
      .getByRole('tabpanel', { name: 'OpenAPI endpoints', exact: true })
      .getByRole('button', { name: /\/precision/ })
      .click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('endpoint_id'))
      .toBe('endpoint-precision')
    await expect(preview).toHaveText(responsesJSON)
  })
}

// Mutable draft saves and approval are retired. Legacy URLs must preserve the
// selected snapshot without exposing writes; commit/review replacements are
// covered by repository-workflow.pw.ts.
for (const width of [1280, 390]) {
  for (const draftId of [editableDraftId, submittedDraftId]) {
    test(`legacy saved draft ${draftId} is read-only at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await installAdminSession(page)
      await installAdminApi(page)
      const writes: string[] = []
      page.on('request', (request) => {
        if (['POST', 'PATCH', 'DELETE'].includes(request.method()))
          writes.push(new URL(request.url()).pathname)
      })
      await page.goto(
        `/drafts?project_id=${projectId}&document_id=${documentId}&draft_id=${draftId}&content_mode=draft`
      )
      await expect(
        page.getByText(
          'Legacy snapshots are read-only. Save new changes through project branches and commits.'
        )
      ).toBeVisible()
      await expect(
        page.getByRole('heading', {
          name:
            draftId === submittedDraftId
              ? 'Submitted handbook'
              : 'Editable handbook',
          exact: true,
        })
      ).toBeVisible()
      for (const name of [
        'Edit draft',
        'Update',
        'Submit',
        'Approve',
        'Reject',
        'Publish',
      ])
        await expect(
          page.getByRole('button', { name, exact: true })
        ).toHaveCount(0)
      await expect(
        page.getByRole('textbox', { name: 'Review note', exact: true })
      ).toHaveCount(0)
      expect(writes).toEqual([])
    })
  }
}

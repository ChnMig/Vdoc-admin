import { expect, test, type Page, type Route } from '@playwright/test'
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
  project_id: projectId,
  document_id: documentId,
  branch_id: branchId,
  version_name: '1.9.0-draft',
  changelog: 'Still being edited',
  document_format: 2,
  source_type: 1,
  status: 1,
  created_by: adminUserId,
  created_at: timestamp,
  updated_at: timestamp,
}

const submittedDraft = {
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
  document_format: 2,
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
      path ===
        `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${submittedDraftId}/content/raw`
    ) {
      await fulfillEnvelope(route, {
        owner_type: 'draft',
        owner_id: submittedDraftId,
        kind: 'raw',
        content_kind: 'markdown',
        content: '# Submitted handbook',
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
  test(`document overview uses one statistics request at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await installAdminSession(page)
    await installAdminApi(page)
    const paths: string[] = []
    page.on('request', (request) => paths.push(new URL(request.url()).pathname))
    await page.goto('/documents/')
    await expect(page.getByText('120 B', { exact: true })).toBeVisible()
    expect(paths.filter((path) => path.endsWith('/overview'))).toHaveLength(1)
    expect(
      paths.some(
        (path) =>
          path.endsWith('/versions') ||
          path.includes('/content/') ||
          path.endsWith('/endpoints')
      )
    ).toBe(false)
    await expect(page.getByLabel('Document', { exact: true })).toHaveValue(
      documentId
    )
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
  await expect(from).toHaveValue(previousVersionId)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => offsets.includes('50')).toBe(true)
  await expect(from).toHaveValue(previousVersionId)
  await expect(page.getByLabel('To version', { exact: true })).toHaveValue(
    latestVersionId
  )
})

test('a comparison completed after document navigation stays in its original history', async ({
  page,
}) => {
  await installAdminSession(page)
  await installAdminApi(page)
  const otherDocument = {
    ...document,
    id: 'document-other',
    name: 'Other Handbook',
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
  const documentSelect = page.getByLabel('Document', { exact: true })
  await documentSelect.selectOption(otherDocument.id)
  await expect(documentSelect).toHaveValue(otherDocument.id)
  await expect(page.getByLabel('From version', { exact: true })).toHaveValue('')
  const switchedUrl = page.url()
  const response = page.waitForResponse(
    (value) =>
      value.request().method() === 'POST' &&
      value.url().endsWith(`/${documentId}/diffs`)
  )
  releaseComparison()
  await response
  await expect(page).toHaveURL(switchedUrl)
  await expect(documentSelect).toHaveValue(otherDocument.id)
  await expect(
    page.getByText('Linked entity is unavailable', { exact: true })
  ).toHaveCount(0)
  await documentSelect.selectOption(documentId)
  const history = page.getByText(
    `${previousVersion.version_name} → ${latestVersion.version_name}`,
    { exact: true }
  )
  await expect(history).toBeVisible()
  await history.click()
  await expect(page).toHaveURL(new RegExp(`diff_id=${result.id}`))
})

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`draft conflict preserves edits and supports both resolutions at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    await installAdminSession(page)
    await installAdminApi(page)
    let serverContent = '# Original draft'
    await page.route(
      `**/drafts/${editableDraftId}/content/raw`,
      async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await fulfillOptions(route)
          return
        }
        await fulfillEnvelope(route, {
          owner_type: 'draft',
          owner_id: editableDraftId,
          kind: 'raw',
          content_kind: 'markdown',
          content: serverContent,
          hash: serverContent,
        })
      }
    )
    await page.goto('/drafts/')
    const draftSelect = page.getByLabel('Draft', { exact: true })
    await draftSelect.selectOption(editableDraftId)
    const content = page.getByLabel('Content', { exact: true })
    await expect(content).toHaveValue('# Original draft')
    await content.fill('# Local edits to retain')
    await page.clock.install()
    const refetch = async (nextContent: string) => {
      serverContent = nextContent
      await page.clock.fastForward(11_000)
      await draftSelect.selectOption('')
      await draftSelect.selectOption(editableDraftId)
      await expect(
        page.getByText('This draft changed on the server')
      ).toBeVisible()
    }
    await refetch('# Updated server draft')
    await expect(content).toHaveValue('# Local edits to retain')
    const update = page.getByRole('button', { name: 'Update', exact: true })
    await expect(update).toBeDisabled()
    const editor = page.locator('[data-slot="card"]').filter({ has: content })
    await editor.scrollIntoViewIfNeeded()
    await editor.screenshot({
      path: testInfo.outputPath(`draft-conflict-${viewport.width}.png`),
    })
    expect(
      await editor.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1
      )
    ).toBe(true)
    await page
      .getByRole('button', { name: 'Keep my edits', exact: true })
      .click()
    await expect(content).toHaveValue('# Local edits to retain')
    await expect(update).toBeEnabled()
    await expect(
      page.getByText('This draft changed on the server')
    ).toBeHidden()
    await refetch('# Latest server draft')
    await page
      .getByRole('button', {
        name: 'Discard edits and load server version',
        exact: true,
      })
      .click()
    await expect(content).toHaveValue('# Latest server draft')
    await expect(update).toBeEnabled()
    await expect(
      page.getByText('This draft changed on the server')
    ).toBeHidden()
  })
}

test('draft review confirms and approves the selected submitted draft', async ({
  page,
}) => {
  let approvedRequest:
    { readonly path: string; readonly body: unknown } | undefined
  await installAdminSession(page)
  await installAdminApi(page, (request) => {
    approvedRequest = request
  })

  await page.goto('/drafts/')
  const draftSelect = page.getByLabel('Draft', { exact: true })
  await expect(draftSelect).toBeVisible()
  await draftSelect.selectOption(submittedDraftId)

  const reviewNote = page.getByLabel('Review note', { exact: true })
  await expect(reviewNote).toBeEnabled()
  await reviewNote.fill('Reviewed against the release checklist.')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()

  const dialog = page.getByRole('alertdialog')
  await expect(
    dialog.getByRole('heading', { name: 'Publish 2.0.0?' })
  ).toBeVisible()
  await expect(dialog).toContainText('immutable published version')
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()

  await expect(dialog).toBeHidden()
  await expect
    .poll(() => approvedRequest)
    .toEqual({
      path: `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${submittedDraftId}/approve`,
      body: { comment: 'Reviewed against the release checklist.' },
    })
})

test('versions route renders reviewed Markdown and keeps relative links inert', async ({
  page,
}) => {
  await installAdminSession(page)
  await installAdminApi(page)

  await page.goto('/versions/')
  const versionSelect = page.getByLabel('Version', { exact: true })
  await expect(versionSelect).toHaveValue(latestVersionId)
  const markdown = page.locator('article')
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

  await versionSelect.selectOption(previousVersionId)
  await expect(
    markdown.getByRole('heading', { name: 'Previous Notes' })
  ).toBeVisible()
  await expect(
    markdown.getByRole('heading', { name: 'Release Notes' })
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
  await expect(versionSelect).toHaveValue(latestVersionId)
  await versionSelect.selectOption(previousVersionId)
  await expect(
    page.getByRole('heading', { name: 'Previous Handbook' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Current Handbook' })
  ).toHaveCount(0)
  expect(unlockBodyMatched).toBe(true)
  expect(unlockProofObserved).toBe(true)
})

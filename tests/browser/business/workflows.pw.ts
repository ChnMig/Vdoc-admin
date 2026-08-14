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
        'SHARE_PASSWORD_REQUIRED',
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

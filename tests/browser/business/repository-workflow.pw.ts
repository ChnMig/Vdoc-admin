import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { RepositoryCommit } from '../../../src/lib/repository-api'
import { selectOption } from '../helpers/select-option'
import {
  documentId,
  installRepository,
  mainId,
  projectId,
  repositoryPath,
  workId,
} from '../support/repository-workflow'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

async function tool(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Commit', exact: true })
    .getByRole('button', { name, exact: true })
    .click()
}
async function save(
  page: Page,
  action = () =>
    page.getByRole('button', { name: 'Save and commit', exact: true }).click()
) {
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/repository\/branches\/[^/]+\/commits$/.test(
        new URL(response.url()).pathname
      )
  )
  await action()
  const saved = await response
  expect(saved.status()).toBe(200)
  const input = saved.request().postDataJSON()
  expect(input).not.toHaveProperty('version_name')
  expect(input).not.toHaveProperty('id')
  const body = await saved.json()
  expect(body.detail.id).toMatch(/^[a-f0-9]{64}$/)
  return body.detail as RepositoryCommit
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
}

for (const width of [1440, 390]) {
  test(`successive saves retain immutable history and compare fixed commits at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page, { pageSize: 2 })
    await api.open()
    await expect(
      page.getByText('Original saved body.', { exact: true })
    ).toBeVisible()
    await tool(page, 'Edit')
    await expect(page.getByRole('textbox', { name: /version/i })).toHaveCount(0)
    await page
      .getByRole('textbox', { name: 'Content', exact: true })
      .fill('# Shared guide\n\nFirst browser save.\n')
    await page
      .getByRole('textbox', { name: 'Commit message (optional)', exact: true })
      .fill('First browser save')
    const first = await save(page)
    await expect(
      page.getByText('First browser save.', { exact: true })
    ).toBeVisible()
    await tool(page, 'Edit')
    await page
      .getByRole('textbox', { name: 'Content', exact: true })
      .fill('# Shared guide\n\nSecond browser save.\n')
    await page
      .getByRole('textbox', { name: 'Commit message (optional)', exact: true })
      .fill('Second browser save')
    const second = await save(page)
    expect(second.parent_ids).toEqual([first.id])
    expect(second.id).not.toBe(first.id)
    await expect(
      page.getByText('Second browser save.', { exact: true })
    ).toBeVisible()
    expect(api.bodies.get(api.initial.id)?.get(documentId)).toBe(
      api.initialBody
    )
    await tool(page, 'Commit history')
    await expect(
      page.getByRole('main').getByText('First browser save', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByRole('main')
        .getByText('Second browser save', { exact: true })
        .filter({ visible: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Next page', exact: true }).click()
    await expect(
      page
        .getByText('Initial server commit', { exact: true })
        .filter({ visible: true })
    ).toBeVisible()
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Open', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`commit_id=${api.initial.id}`))
    await expect(
      page.getByText('Original saved body.', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Latest commit', exact: true })
      .click()
    await tool(page, 'Compare')
    await selectOption(
      page.getByRole('combobox', { name: 'Source commit', exact: true }),
      first.id
    )
    await page
      .getByRole('button', { name: 'Compare commits', exact: true })
      .click()
    await expect(page.getByRole('table')).toContainText('First browser save.')
    await expect(page.getByRole('table')).toContainText('Second browser save.')
    expect(
      api.requests.findLast((request) => request.path.endsWith('/comparisons'))
        ?.body
    ).toEqual({
      from_commit_id: first.id,
      to_commit_id: second.id,
      document_id: documentId,
    })
    await noOverflow(page)
    expect(api.unexpected).toEqual([])
  })

  test(`stale save retains edits and saves on a new branch at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    await api.open()
    await tool(page, 'Edit')
    const editor = page.getByRole('textbox', { name: 'Content', exact: true })
    await editor.fill('# Shared guide\n\nPreserve this local change.\n')
    const concurrent = api.advance()
    await page
      .getByRole('button', { name: 'Save and commit', exact: true })
      .click()
    await expect(
      page.getByText(
        'The branch changed after editing started. Your changes are preserved. Compare the commits or save your work on a new branch.'
      )
    ).toBeVisible()
    await expect(editor).toHaveValue(
      '# Shared guide\n\nPreserve this local change.\n'
    )
    await page
      .getByRole('button', {
        name: 'Save changes on a new branch',
        exact: true,
      })
      .click()
    const dialog = page.getByRole('dialog', { name: 'New branch', exact: true })
    await dialog
      .getByRole('textbox', { name: 'Branch name', exact: true })
      .fill('recovery/local-change')
    const recovered = await save(page, () =>
      dialog
        .getByRole('button', { name: 'Save and commit', exact: true })
        .click()
    )
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText('Preserve this local change.', { exact: true })
    ).toBeVisible()
    expect(recovered.parent_ids).toEqual([api.initial.id])
    expect(
      api.branches.find((branch) => branch.id === workId)?.head_commit_id
    ).toBe(concurrent.id)
    expect(
      api.requests.filter(
        (request) =>
          request.method === 'POST' &&
          request.path.endsWith(`/${workId}/commits`)
      )
    ).toHaveLength(1)
    await noOverflow(page)
    expect(api.unexpected).toEqual([])
  })

  test(`retrying a lost save response reuses its idempotency key at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    await api.open()
    await tool(page, 'Edit')
    await page
      .getByRole('textbox', { name: 'Content', exact: true })
      .fill('# Shared guide\n\nRetry this exact content.\n')
    api.loseSaveResponse()
    await page
      .getByRole('button', { name: 'Save and commit', exact: true })
      .click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Backend request failed' })
    ).toBeVisible()
    const saved = await save(page)
    await expect(
      page.getByText('Retry this exact content.', { exact: true })
    ).toBeVisible()
    const attempts = api.requests.filter(
      (request) =>
        request.method === 'POST' && request.path.endsWith(`/${workId}/commits`)
    )
    expect(attempts).toHaveLength(2)
    expect(attempts[0].body).toEqual(attempts[1].body)
    expect(api.commits.size).toBe(2)
    expect(saved.parent_ids).toEqual([api.initial.id])
    expect(api.unexpected).toEqual([])
  })

  test(`editing keeps local input across tools and uploads an atomic file set at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    await api.open()
    await tool(page, 'Edit')
    const editor = page.getByRole('textbox', { name: 'Content', exact: true })
    await editor.fill('# Shared guide\n\nAtomic local edit.\n')
    await tool(page, 'Read')
    await expect(
      page.getByText('Original saved body.', { exact: true })
    ).toBeVisible()
    await tool(page, 'Edit')
    await expect(editor).toHaveValue('# Shared guide\n\nAtomic local edit.\n')
    await page.locator('input[type=file]').setInputFiles([
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Literal <script>text</script>\r\n'),
      },
      {
        name: 'second.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('# Another file\n'),
      },
    ])
    await expect(
      page.getByText('Changed files: 3', { exact: true })
    ).toBeVisible()
    const saved = await save(page)
    expect(saved.files).toHaveLength(3)
    expect(
      api.requests.filter(
        (request) =>
          request.method === 'POST' &&
          request.path.endsWith(`/${workId}/commits`)
      )
    ).toHaveLength(1)
    expect(
      api.bodies
        .get(saved.id)
        ?.get(
          saved.files.find((file) => file.relative_path === 'notes.txt')!
            .document_id
        )
    ).toBe('Literal <script>text</script>\r\n')
    const note = saved.files.find((file) => file.relative_path === 'notes.txt')!
    await page.goto(
      `/documents/${note.document_id}?project_id=${projectId}&repository_branch_id=${workId}&commit_id=${saved.id}`
    )
    await expect(
      page.getByText('Literal <script>text</script>', { exact: true })
    ).toBeVisible()
    await expect(page.locator('main script')).toHaveCount(0)
    await noOverflow(page)
    expect(api.unexpected).toEqual([])
  })

  test(`new file upload receives server identifiers without a version field at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    await api.open()
    await expect(
      page.getByText('Original saved body.', { exact: true })
    ).toBeVisible()
    const newDocument = page.getByRole('button', {
      name: 'New document',
      exact: true,
    })
    if (!(await newDocument.isVisible()))
      await page
        .getByRole('button', { name: 'Show files', exact: true })
        .click()
    await newDocument.click()
    const dialog = page.getByRole('dialog', {
      name: 'New document',
      exact: true,
    })
    await selectOption(
      dialog.getByRole('combobox', { name: 'Type', exact: true }),
      '2'
    )
    await dialog
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill('Uploaded guide')
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'uploaded.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Uploaded guide\n\nUploaded exact bytes.\n'),
    })
    await expect(dialog.getByRole('textbox', { name: /version/i })).toHaveCount(
      0
    )
    const commit = await save(page, () =>
      dialog.getByRole('button', { name: 'Create', exact: true }).click()
    )
    const file = commit.files.find((file) =>
      file.relative_path.endsWith('uploaded.md')
    )!
    expect(file.document_id).toMatch(/^server-document-/)
    await expect(page).toHaveURL(
      new RegExp(`/documents/${file.document_id}\\?`)
    )
    await expect(
      page.getByText('Uploaded exact bytes.', { exact: true })
    ).toBeVisible()
    expect(
      api.requests.filter(
        (request) =>
          request.method === 'POST' &&
          request.path === `/api/v1/private/projects/${projectId}/documents`
      )
    ).toEqual([])
    await noOverflow(page)
    expect(api.unexpected).toEqual([])
  })

  test(`publishing generates a release and sharing stays pinned to it at ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const api = await installRepository(page)
    await api.open()
    await tool(page, 'Releases')
    await expect(page.getByRole('textbox', { name: /version/i })).toHaveCount(0)
    await page
      .getByRole('button', {
        name: 'Review and publish this commit',
        exact: true,
      })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', {
        name: 'Review and publish this commit',
        exact: true,
      })
      .click()
    await expect(page.getByText(/^r-20261030-/)).toBeVisible()
    expect(api.releases[0].commit_id).toBe(api.initial.id)
    const shareId = 'e'.repeat(32),
      secret = `vdoc_share_${'f'.repeat(48)}`
    await registerCapabilitySecret(
      process.env.VDOC_PLAYWRIGHT_SECRET_REGISTRY!,
      secret
    )
    const share = {
      id: shareId,
      project_id: projectId,
      document_id: documentId,
      release_id: api.releases[0].id,
      status: 1,
      password_protected: true,
      created_by: 'commit-admin',
      created_at: '2026-10-30T08:00:00Z',
      updated_at: '2026-10-30T08:00:00Z',
    }
    const sharePath = `${repositoryPath}/releases/${api.releases[0].id}/documents/${documentId}/shares`
    const writes: Record<string, unknown>[] = []
    let created = false
    await page.route(`**${sharePath}**`, async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname
      let detail: unknown
      if (request.method() === 'GET') detail = created ? [share] : []
      else if (path.endsWith('/revoke')) {
        share.status = 2
        detail = share
      } else {
        if (request.postData()) writes.push(request.postDataJSON())
        created = true
        detail = { share, secret }
      }
      await route.fulfill({
        json: {
          code: 200,
          status: 'OK',
          timestamp: 1,
          detail,
          ...(Array.isArray(detail) ? { total: detail.length } : {}),
        },
      })
    })
    await page
      .getByRole('button', { name: 'Share release', exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'Share release',
      exact: true,
    })
    await selectOption(
      dialog.getByRole('combobox', { name: 'Expires after', exact: true }),
      '6_months'
    )
    await dialog
      .getByLabel('Access password (optional)', { exact: true })
      .fill('temporary-fixture-password')
    await dialog
      .getByRole('button', { name: 'Create share link', exact: true })
      .click()
    await expect(
      dialog.getByRole('textbox', { name: 'Share link', exact: true })
    ).toHaveValue(new RegExp(`/share/${shareId}#`))
    expect(writes).toEqual([
      { expiry_preset: '6_months', password: 'temporary-fixture-password' },
    ])
    await dialog.getByRole('button', { name: 'Copy link', exact: true }).click()
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain(`/share/${shareId}#`)
    await dialog.getByRole('button', { name: 'Revoke', exact: true }).click()
    await dialog
      .getByRole('button', { name: 'Confirm revocation', exact: true })
      .click()
    await expect(dialog.getByText('Revoked', { exact: true })).toBeVisible()
    await expect(
      dialog.getByRole('textbox', { name: 'Share link', exact: true })
    ).toHaveCount(0)
    api.advance()
    expect(api.releases[0].commit_id).toBe(api.initial.id)
    await noOverflow(page)
    expect(api.unexpected).toEqual([])
  })
}

test('merge review previews the real candidate and invalidates approval after a branch changes', async ({
  page,
}) => {
  const api = await installRepository(page)
  api.advance(workId, '# Shared guide\n\nSource value=1\n')
  api.advance(mainId, '# Shared guide\n\nTarget value=1\n')
  await api.open()
  await tool(page, 'Merge requests')
  await page
    .getByRole('textbox', { name: 'Title (optional)', exact: true })
    .fill('Review both branch edits')
  await page.getByRole('button', { name: 'Request merge', exact: true }).click()
  await page
    .getByRole('button', { name: 'Review merge candidate', exact: true })
    .click()
  await page.getByText('Read candidate content', { exact: true }).click()
  await expect(
    page
      .getByText('Target value=1', { exact: true })
      .filter({ visible: true })
      .last()
  ).toBeVisible()
  await expect(
    page
      .getByText('Source value=1', { exact: true })
      .filter({ visible: true })
      .last()
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Approve this snapshot', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Merge approved snapshot', exact: true })
  ).toBeVisible()
  api.advance()
  await page
    .getByRole('button', { name: 'Refresh', exact: true })
    .first()
    .click()
  await expect(
    page.getByText(
      'A branch changed. Create a new review for the current commits.'
    )
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Merge approved snapshot', exact: true })
  ).toHaveCount(0)
  expect(api.requests.some((request) => request.path.endsWith('/merge'))).toBe(
    false
  )
  expect(api.unexpected).toEqual([])
})

test('AI and subscriptions send fixed commit references and preserve event activity', async ({
  page,
}) => {
  const api = await installRepository(page)
  const latest = api.advance()
  await api.open()
  await tool(page, 'AI')
  await page
    .getByRole('textbox', {
      name: 'Question or analysis instructions (optional)',
      exact: true,
    })
    .fill('Explain the changes between these two saves.')
  await page
    .getByRole('button', { name: 'Analyze this commit', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Fixed commit analysis', exact: true })
  ).toBeVisible()
  expect(
    api.requests.find(
      (request) =>
        request.method === 'POST' && request.path.endsWith('/ai/analyses')
    )?.body
  ).toMatchObject({
    from_commit_id: api.initial.id,
    to_commit_id: latest.id,
    document_id: documentId,
    message: 'Explain the changes between these two saves.',
  })
  await tool(page, 'Activity & subscriptions')
  await expect(
    page.getByText('commit.created', { exact: true }).first()
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Create subscription', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Create subscription',
    exact: true,
  })
  await dialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Release notifications')
  await dialog.getByLabel('Current branch only (work)', { exact: true }).check()
  await dialog.getByLabel('Current document only', { exact: true }).check()
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Release notifications' })
  ).toBeVisible()
  expect(api.subscriptions[0]).toMatchObject({
    kind: 'in_app',
    event_types: ['release.published'],
    branch_id: workId,
    document_id: documentId,
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true })
  ).toBeVisible()
  expect(api.subscriptions[0].paused).toBe(true)
  expect(api.unexpected).toEqual([])
})

test('legacy content requires explicit import before committing', async ({
  page,
}) => {
  const api = await installRepository(page, { importRequired: true })
  await api.open()
  const button = page.getByRole('button', {
    name: 'Import existing documents',
    exact: true,
  })
  await expect(button).toBeVisible()
  await tool(page, 'Edit')
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Save and commit', exact: true })
  ).toBeDisabled()
  expect(api.requests.some((request) => request.method === 'POST')).toBe(false)
  await button.click()
  await expect(button).toHaveCount(0)
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Create a branch to edit', exact: true })
    .click()
  const branchDialog = page.getByRole('dialog', {
    name: 'New branch',
    exact: true,
  })
  await branchDialog
    .getByRole('textbox', { name: 'Branch name', exact: true })
    .fill('work/imported-content')
  await branchDialog
    .getByRole('button', { name: 'New branch', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toHaveValue('# Shared guide\n\nOriginal saved body.\n')
  expect(
    api.requests.filter(
      (request) =>
        request.method === 'POST' && request.path.endsWith('/bootstrap')
    )
  ).toHaveLength(1)
  expect(api.unexpected).toEqual([])
})

test('reader permissions hide commit, publication and subscription mutations', async ({
  page,
}) => {
  const api = await installRepository(page, { reader: true })
  await api.open()
  await expect(
    page.getByText('Original saved body.', { exact: true })
  ).toBeVisible()
  await expect(
    page
      .getByRole('navigation', { name: 'Commit', exact: true })
      .getByRole('button', { name: 'Edit', exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'New branch', exact: true })
  ).toHaveCount(0)
  await tool(page, 'Releases')
  await expect(
    page.getByRole('button', {
      name: 'Review and publish this commit',
      exact: true,
    })
  ).toHaveCount(0)
  await tool(page, 'Activity & subscriptions')
  await expect(
    page.getByRole('button', { name: 'Create subscription', exact: true })
  ).toHaveCount(0)
  expect(api.requests.some((request) => request.method === 'POST')).toBe(false)
  const a11y = await new AxeBuilder({ page })
    .include('main#content')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(a11y.violations).toEqual([])
  expect(api.unexpected).toEqual([])
})

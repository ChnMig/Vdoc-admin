import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import type { RepositoryCommit } from '../../../src/lib/repository-api'
import { selectOption } from '../helpers/select-option'
import {
  documentId,
  installRepository,
  mainId,
  projectId,
  projectRepositoryPath,
  workId,
} from '../support/repository-workflow'
import { registerCapabilitySecret } from '../support/secret-safety.mjs'

async function tool(page: Page, name: string) {
  await expect(page.locator('[data-document-page]')).toBeVisible()
  if (name === 'Edit' || name === 'Read') {
    await page
      .getByRole('button', {
        name: name === 'Read' ? 'Back to preview' : 'Edit',
        exact: true,
      })
      .click()
    return
  }
  const nav = page.getByRole('navigation', {
    name: 'Document tools',
    exact: true,
  })
  if (await nav.isVisible()) {
    await nav.getByRole('button', { name, exact: true }).click()
  } else {
    await page
      .getByRole('button', { name: 'Document tools', exact: true })
      .click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
}
async function save(
  page: Page,
  action = () =>
    page.getByRole('button', { name: 'Save version', exact: true }).click()
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
    await tool(page, 'Version history')
    await expect(
      page
        .locator('.document-tool-sidebar')
        .getByText('First browser save', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .locator('.document-tool-sidebar')
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
      .locator('.document-tool-sidebar')
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
      .getByRole('button', { name: 'Save version', exact: true })
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
      dialog.getByRole('button', { name: 'Save version', exact: true }).click()
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
      .getByRole('button', { name: 'Save version', exact: true })
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

  test(`editing retains input across tools and imports only the current document at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installRepository(page)
    await api.open()
    await tool(page, 'Edit')
    const editor = page.getByRole('textbox', { name: 'Content', exact: true })
    await editor.fill('# Shared guide\n\nKeep this edit.\n')
    await tool(page, 'Read')
    await tool(page, 'Edit')
    await expect(editor).toHaveValue('# Shared guide\n\nKeep this edit.\n')
    await page.locator('input[type=file]').setInputFiles({
      name: 'wrong.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Wrong type'),
    })
    await expect(
      page.getByText(
        'Choose one file with the same document type. To add a document, use New document.'
      )
    ).toBeVisible()
    await expect(editor).toHaveValue('# Shared guide\n\nKeep this edit.\n')
    await page.locator('input[type=file]').setInputFiles({
      name: 'replacement.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Imported body\n\nLiteral <script>text</script>\n'),
    })
    const saved = await save(page)
    expect(saved.files).toHaveLength(1)
    expect(saved.files[0].document_id).toBe(documentId)
    expect(saved.files[0].relative_path).toBe('guides/shared.md')
    expect(api.bodies.get(saved.id)?.get(documentId)).toBe(
      '# Imported body\n\nLiteral <script>text</script>\n'
    )
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
    await expect(
      dialog.getByRole('textbox', { name: 'Initial branch', exact: true })
    ).toHaveValue('main')
    await dialog
      .getByRole('textbox', { name: 'Initial branch', exact: true })
      .fill('dev')
    const response = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === `${projectRepositoryPath}/documents`
    )
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    const created = (await (await response).json()).detail
    const commit = created.commit as RepositoryCommit
    expect(commit.version_name).toBe('dev.1')
    expect(created.branch.is_protected).toBe(false)
    expect(
      api.branches.find((branch) => branch.id === workId)?.head_commit_id
    ).toBe(api.initial.id)
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
    await page.getByRole('button', { name: 'Share', exact: true }).click()
    const unpublished = page.getByRole('dialog', { name: 'Share', exact: true })
    await expect(unpublished).toContainText('has not been published')
    expect(api.releases).toHaveLength(0)
    expect(
      api.requests.some(
        (request) =>
          request.method === 'POST' && request.path.endsWith('/releases')
      )
    ).toBe(false)
    await unpublished
      .getByRole('button', { name: 'Review before sharing', exact: true })
      .click()
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
    await expect(
      page
        .locator('.document-tool-sidebar')
        .getByText('main.1', { exact: true })
    ).toBeVisible()
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
    const sharePath = `${projectRepositoryPath}/releases/${api.releases[0].id}/documents/${documentId}/shares`
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
    await page.getByRole('button', { name: 'Share', exact: true }).click()
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
  await page.getByRole('tab', { name: 'Version analysis', exact: true }).click()
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
    page.getByText('Version saved', { exact: true }).first()
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
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Release notifications' })
  ).toBeVisible()
  expect(api.subscriptions[0]).toMatchObject({
    kind: 'in_app',
    event_types: ['release.published'],
    branch_id: workId,
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Resume', exact: true })
  ).toBeVisible()
  expect(api.subscriptions[0].paused).toBe(true)
  expect(api.unexpected).toEqual([])
})

test('protected document branches preserve their review requirement', async ({
  page,
}) => {
  const api = await installRepository(page)
  await api.open()
  await selectOption(
    page.getByRole('combobox', { name: 'Document branch', exact: true }),
    mainId
  )
  await tool(page, 'Edit')
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Create a branch to edit', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'New branch', exact: true })
  await dialog
    .getByRole('textbox', { name: 'Branch name', exact: true })
    .fill('dev')
  await dialog.getByRole('button', { name: 'New branch', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Content', exact: true })
  ).toBeEnabled()
  expect(api.requests.filter((r) => r.path.endsWith('/bootstrap'))).toEqual([])
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
    page.getByRole('button', { name: 'Edit', exact: true })
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

for (const width of [1440, 390]) {
  test(`document layout keeps reading, outline, tools and assistant independent at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 960 })
    const api = await installRepository(page)
    const body =
      '# Shared guide\n\n' +
      Array.from(
        { length: 18 },
        (_, index) =>
          `## Section ${index + 1}\n\n${'Read and edit this document without losing your place. '.repeat(12)}\n`
      ).join('\n')
    api.bodies.get(api.initial.id)!.set(documentId, body)
    await api.open()
    const reader = page.locator('[data-document-reading-pane]')
    await expect(
      reader.getByRole('heading', { name: 'Section 18', exact: true })
    ).toBeAttached()
    await expect(
      page.getByRole('navigation', { name: 'Commit', exact: true })
    ).toHaveCount(0)
    await expect(
      page.locator('[data-document-page] > [role=tablist]')
    ).toHaveCount(0)
    const rail = page.getByRole('navigation', {
      name: 'Document tools',
      exact: true,
    })
    if (width >= 1280) {
      await expect(rail).toBeVisible()
      const bounds = (await rail.boundingBox())!
      expect(bounds.width).toBeLessThan(60)
      expect(bounds.x).toBeGreaterThan(width - 65)
      await expect(
        page.getByRole('complementary', { name: 'On this page' })
      ).toBeVisible()
      await expect
        .poll(async () =>
          Math.round(
            (await page.locator('.document-tool-sidebar').boundingBox())!.width
          )
        )
        .toBe(240)
      await page
        .getByRole('complementary', { name: 'On this page' })
        .getByRole('link', { name: 'Section 8', exact: true })
        .click()
    } else {
      await expect(rail).not.toBeVisible()
      await tool(page, 'On this page')
      const outline = page.getByRole('dialog', {
        name: 'On this page',
        exact: true,
      })
      await outline
        .getByRole('link', { name: 'Section 8', exact: true })
        .click()
      await expect(outline).not.toBeVisible()
    }
    await expect
      .poll(() => reader.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(300)
    await expect
      .poll(async () => {
        const heading = await reader
          .getByRole('heading', { name: 'Section 8', exact: true })
          .boundingBox()
        return Math.round(heading!.y - (await reader.boundingBox())!.y)
      })
      .toBe(32)
    // Use a settled position so assertions are independent of smooth-scroll timing.
    await reader.evaluate((element) =>
      element.scrollTo({ top: 500, behavior: 'instant' })
    )
    await tool(page, 'Version history')
    await expect(reader).toBeVisible()
    await page
      .getByRole('button', { name: 'Close sidebar', exact: true })
      .click()
    await expect(reader).toBeVisible()
    await expect
      .poll(() => reader.evaluate((element) => element.scrollTop))
      .toBe(500)
    await tool(page, 'AI')
    const assistant = page.locator('.document-tool-sidebar')
    await expect(assistant).toBeVisible()
    await expect(reader).toBeVisible()
    if (width >= 1280) {
      expect(
        await assistant.evaluate((element) => element.matches(':modal'))
      ).toBe(false)
      await expect
        .poll(async () =>
          Math.round(
            (await page.locator('.document-tool-sidebar').boundingBox())!.width
          )
        )
        .toBe(384)
      // Measure both edges in one frame after the dock's grid transition.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const reading = document
              .querySelector('[data-document-reading-pane]')!
              .getBoundingClientRect()
            const assistant = document
              .querySelector('.document-tool-sidebar')!
              .getBoundingClientRect()
            return reading.right - assistant.left
          })
        )
        .toBeLessThanOrEqual(1)
    } else {
      await expect(assistant).toHaveAttribute('aria-modal', 'true')
    }
    const question = assistant.getByRole('textbox', {
      name: 'AI chat message',
      exact: true,
    })
    await question.fill('Keep this unsent question while I read.')
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`document-assistant-${width}.png`),
    })
    await assistant
      .getByRole('button', { name: 'Close sidebar', exact: true })
      .click()
    await expect(assistant).not.toBeVisible()
    if (width >= 1280)
      await expect(
        rail.getByRole('button', { name: 'AI', exact: true })
      ).toBeFocused()
    else
      await expect(
        page.getByRole('button', { name: 'Document tools', exact: true })
      ).toBeFocused()
    await tool(page, 'AI')
    await expect(question).toHaveValue(
      'Keep this unsent question while I read.'
    )
    await assistant
      .getByRole('button', { name: 'Close sidebar', exact: true })
      .click()
    await tool(page, 'Edit')
    const editor = page.getByRole('textbox', { name: 'Content', exact: true })
    await editor.fill(body + '\nUncommitted edit.')
    await tool(page, 'Version history')
    await page
      .getByRole('button', { name: 'Close sidebar', exact: true })
      .click()
    await expect(editor).toHaveValue(body + '\nUncommitted edit.')
    await tool(page, 'Read')
    await reader.evaluate((element) =>
      element.scrollTo({ top: 0, behavior: 'instant' })
    )
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath(`document-reading-${width}.png`),
    })
    await noOverflow(page)
    const a11y = await new AxeBuilder({ page })
      .include('[data-document-page]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(a11y.violations).toEqual([])
    expect(api.unexpected).toEqual([])
  })
}

test('sidebar retains its DOM, input and focus across expansion, resize and competing forms', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  const api = await installRepository(page)
  await api.open()
  await tool(page, 'AI')
  const assistant = page.locator('.document-tool-sidebar')
  const question = assistant.getByRole('textbox', {
    name: 'AI chat message',
    exact: true,
  })
  await question.fill('A question that survives resizing.')
  await question.evaluate((element) =>
    element.setAttribute('data-original-input', 'true')
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(assistant).toHaveAttribute('aria-modal', 'true')
  await expect(question).toBeFocused()
  await expect(question).toHaveAttribute('data-original-input', 'true')
  await expect(question).toHaveValue('A question that survives resizing.')
  await question.press('Escape')
  await expect(assistant).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Document tools', exact: true })
  ).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 960 })
  await tool(page, 'AI')
  await assistant
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click()
  await expect(assistant).toHaveAttribute('aria-modal', 'true')
  await expect(question).toHaveAttribute('data-original-input', 'true')
  await assistant
    .getByRole('button', { name: 'Collapse sidebar', exact: true })
    .click()
  await expect(assistant).not.toHaveAttribute('aria-modal')
  await page.getByRole('button', { name: 'New branch', exact: true }).click()
  const branchDialog = page.getByRole('dialog', {
    name: 'New branch',
    exact: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(branchDialog).toBeVisible()
  await expect(assistant).toHaveAttribute('inert', '')
  await branchDialog
    .getByRole('textbox', { name: 'Branch name', exact: true })
    .fill('draft')
  await branchDialog
    .getByRole('textbox', { name: 'Branch name', exact: true })
    .press('Escape')
  await expect(branchDialog).not.toBeVisible()
  await expect(assistant).toBeVisible()
  await expect(question).toHaveValue('A question that survives resizing.')
  await noOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('assistant-resized-mobile.png'),
  })
  expect(api.unexpected).toEqual([])
})

test('all tools expand in place and document chat retains history, drafts and answers', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  const api = await installRepository(page)
  await api.open()
  const sidebar = page.locator('.document-tool-sidebar')
  const reader = page.locator('[data-document-reading-pane]')
  await tool(page, 'AI')
  const message = sidebar.getByRole('textbox', {
    name: 'AI chat message',
    exact: true,
  })
  await expect(
    sidebar.getByText('Your earlier document discussion is still here.')
  ).toBeVisible()
  await message.fill('Explain main.1')
  await sidebar
    .getByRole('button', { name: 'Send AI message', exact: true })
    .click()
  await expect(
    sidebar.getByText(/The document contains the saved branch versions/)
  ).toBeVisible()
  await message.fill('Unsent follow-up')
  await message.evaluate((element) =>
    element.setAttribute('data-retained', 'true')
  )
  const url = page.url()
  const contentReads = api.requests.filter((request) =>
    request.path.includes('/content/')
  ).length
  await expect
    .poll(async () => Math.round((await sidebar.boundingBox())!.width))
    .toBe(384)
  await expect
    .poll(async () => Math.round((await reader.boundingBox())!.width))
    .toBe(736)
  const readerWidth = (await reader.boundingBox())!.width
  const small = (await sidebar.boundingBox())!
  for (let count = 0; count < 3; count++) {
    await sidebar
      .getByRole('button', { name: 'Expand sidebar', exact: true })
      .click()
    await expect
      .poll(async () => (await sidebar.boundingBox())!.width)
      .toBeGreaterThan(small.width + 200)
    expect((await sidebar.boundingBox())!.x).toBeLessThan(small.x)
    expect((await reader.boundingBox())!.width).toBeCloseTo(readerWidth, 0)
    await expect(message).toHaveValue('Unsent follow-up')
    await expect(message).toHaveAttribute('data-retained', 'true')
    await sidebar
      .getByRole('button', { name: 'Collapse sidebar', exact: true })
      .click()
    await expect
      .poll(async () => Math.round((await sidebar.boundingBox())!.width))
      .toBe(Math.round(small.width))
  }
  expect(page.url()).toBe(url)
  expect(
    api.requests.filter((request) => request.path.includes('/content/')).length
  ).toBe(contentReads)
  await sidebar
    .getByRole('tab', { name: 'Version analysis', exact: true })
    .click()
  await sidebar
    .getByRole('textbox', {
      name: 'Question or analysis instructions (optional)',
      exact: true,
    })
    .fill('Keep analysis instructions')
  for (const name of [
    'Version history',
    'Compare',
    'Merge requests',
    'Releases',
    'Activity & subscriptions',
    'On this page',
  ]) {
    await tool(page, name)
    await expect(reader).toBeVisible()
    await sidebar
      .getByRole('button', { name: 'Expand sidebar', exact: true })
      .click()
    await expect(sidebar).toHaveAttribute('data-expanded', 'true')
    await sidebar
      .getByRole('button', { name: 'Collapse sidebar', exact: true })
      .click()
    await noOverflow(page)
  }
  await tool(page, 'AI')
  await expect(
    sidebar.getByRole('textbox', {
      name: 'Question or analysis instructions (optional)',
      exact: true,
    })
  ).toHaveValue('Keep analysis instructions')
  await sidebar.getByRole('tab', { name: 'Chat', exact: true }).click()
  await expect(message).toHaveValue('Unsent follow-up')
  await expect(message).toHaveAttribute('data-retained', 'true')
  await sidebar
    .getByRole('button', { name: 'Send AI message', exact: true })
    .click()
  await expect(
    sidebar.getByText(/The document contains the saved branch versions/)
  ).toHaveCount(2)
  await sidebar
    .getByRole('button', { name: 'Expand sidebar', exact: true })
    .click()
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('expanded-chat.png'),
  })
  expect(api.unexpected).toEqual([])
})

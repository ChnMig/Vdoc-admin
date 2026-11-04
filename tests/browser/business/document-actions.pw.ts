import { expect, test } from '@playwright/test'
import type { RepositoryDocument } from '../../../src/lib/repository-api'
import {
  documentId,
  installRepository,
  mainId,
  projectId,
  projectRepositoryPath,
} from '../support/repository-workflow'

for (const width of [1280, 390]) {
  test(`document rename, move and delete remain usable at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width, height: 900 })
    const repository = await installRepository(page)
    const documents: RepositoryDocument[] = [
      {
        id: documentId,
        project_id: projectId,
        name: 'Shared guide',
        document_type: 2,
        relative_path: 'guides/shared.md',
        file_name: 'shared.md',
        folder_id: 'guides',
        default_branch_id: mainId,
        default_branch_name: 'main',
        status: 1,
        created_by: 'commit-admin',
        created_at: '',
        updated_at: '',
      },
    ]
    const writes: { method: string; body?: Record<string, unknown> }[] = []
    let failRename = true
    let failDelete = true
    const ok = (detail: unknown) => ({
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail,
      ...(Array.isArray(detail) ? { total: detail.length } : {}),
    })
    await page.route(`**/projects/${projectId}/folders`, (route) =>
      route.fulfill({
        json: ok([
          {
            id: 'guides',
            project_id: projectId,
            name: 'guides',
            path: 'guides',
            parent_id: null,
          },
          {
            id: 'archive',
            project_id: projectId,
            name: 'Archive',
            path: 'Archive',
            parent_id: null,
          },
        ]),
      })
    )
    await page.route(`**/projects/${projectId}/documents`, (route) =>
      route.fulfill({ json: ok(documents) })
    )
    await page.route(`**${projectRepositoryPath}/documents`, (route) =>
      route.fulfill({ json: ok(documents) })
    )
    await page.route(
      `**${projectRepositoryPath}/documents/${documentId}`,
      async (route) => {
        const method = route.request().method()
        const body = route.request().postData()
          ? (route.request().postDataJSON() as Record<string, unknown>)
          : undefined
        writes.push({ method, ...(body ? { body } : {}) })
        if (
          (method === 'PATCH' && failRename) ||
          (method === 'DELETE' && failDelete)
        ) {
          if (method === 'PATCH') failRename = false
          else failDelete = false
          return route.fulfill({
            status: 409,
            json: {
              code: 409,
              status: 'ABORTED',
              description: 'Please retry this operation.',
              timestamp: 1,
            },
          })
        }
        if (method === 'DELETE') {
          documents.splice(0)
          return route.fulfill({ json: ok({ deleted: true }) })
        }
        Object.assign(documents[0], body)
        documents[0].file_name = documents[0].relative_path?.split('/').pop()
        documents[0].folder_id = documents[0].relative_path?.includes('/')
          ? documents[0].relative_path.startsWith('Archive/')
            ? 'archive'
            : 'guides'
          : null
        return route.fulfill({ json: ok(documents[0]) })
      }
    )
    await page.goto(
      `/documents?team_id=commit-team&project_id=${projectId}&folder_id=guides`
    )
    const openMenu = async (name = 'Updated guide') => {
      await page
        .getByRole('button', { name: `Document actions: ${name}`, exact: true })
        .click()
    }
    await openMenu('Shared guide')
    await page
      .getByRole('menuitem', { name: 'Rename document', exact: true })
      .click()
    const rename = page.getByRole('dialog', {
      name: 'Rename document',
      exact: true,
    })
    await rename
      .getByRole('textbox', { name: 'Document title', exact: true })
      .fill('Updated guide')
    await rename
      .getByRole('textbox', { name: 'File name', exact: true })
      .fill('updated.md')
    await rename.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(rename.getByRole('alert')).toContainText(
      'Please retry this operation.'
    )
    await expect(
      rename.getByRole('textbox', { name: 'File name', exact: true })
    ).toHaveValue('updated.md')
    await rename.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(rename).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Updated guide', exact: true })
    ).toBeVisible()
    await openMenu()
    await page
      .getByRole('menuitem', { name: 'Move document', exact: true })
      .click()
    const move = page.getByRole('dialog', {
      name: 'Move document',
      exact: true,
    })
    await move.getByRole('treeitem', { name: 'Archive', exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await page.screenshot({
      path: `.artifacts/workspace-quality/list-move-${width}.png`,
    })
    await move
      .getByRole('button', { name: 'Move document', exact: true })
      .click()
    await expect(move).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Updated guide', exact: true })
    ).toHaveCount(0)
    expect(documents[0].relative_path).toBe('Archive/updated.md')
    await repository.open()
    await expect(page.locator('[data-document-page]')).toContainText(
      'Original saved body.'
    )
    if (width === 390)
      await page
        .getByRole('button', { name: 'Show files', exact: true })
        .click()
    await openMenu()
    await page
      .getByRole('menuitem', { name: 'Move document', exact: true })
      .click()
    await move
      .getByRole('treeitem', { name: 'Project root', exact: true })
      .click()
    await move
      .getByRole('button', { name: 'Move document', exact: true })
      .click()
    await expect(move).not.toBeVisible()
    expect(documents[0].relative_path).toBe('updated.md')
    await openMenu()
    await expect(page.getByRole('menu')).toHaveCSS('opacity', '1')
    await page.screenshot({
      path: `.artifacts/workspace-quality/reader-menu-${width}.png`,
    })
    await page
      .getByRole('menuitem', { name: 'Delete document', exact: true })
      .click()
    const deletion = page.getByRole('alertdialog')
    await expect(deletion).toContainText(
      'all its public shares will stop working'
    )
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(writes.filter((write) => write.method === 'DELETE')).toHaveLength(0)
    await openMenu()
    await page
      .getByRole('menuitem', { name: 'Delete document', exact: true })
      .click()
    await deletion
      .getByRole('button', { name: 'Delete document', exact: true })
      .click()
    await expect(deletion.getByRole('alert')).toContainText(
      'Please retry this operation.'
    )
    await page.screenshot({
      path: `.artifacts/workspace-quality/delete-retry-${width}.png`,
    })
    await deletion
      .getByRole('button', { name: 'Delete document', exact: true })
      .click()
    await expect(deletion).not.toBeVisible()
    await expect(page).toHaveURL(/\/documents\?/)
    await expect(
      page.getByRole('button', { name: 'Updated guide', exact: true })
    ).toHaveCount(0)
    expect(documents).toHaveLength(0)
    expect(writes).toEqual([
      {
        method: 'PATCH',
        body: { name: 'Updated guide', relative_path: 'guides/updated.md' },
      },
      {
        method: 'PATCH',
        body: { name: 'Updated guide', relative_path: 'guides/updated.md' },
      },
      { method: 'PATCH', body: { relative_path: 'Archive/updated.md' } },
      { method: 'PATCH', body: { relative_path: 'updated.md' } },
      { method: 'DELETE' },
      { method: 'DELETE' },
    ])
    expect(repository.unexpected).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}

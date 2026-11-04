import { expect, test } from '@playwright/test'
import type { DocumentFolderDTO } from '../../../src/lib/vdoc-api'
import { selectOption } from '../helpers/select-option'
import { installRepository, projectId } from '../support/repository-workflow'

for (const width of [1280, 390]) {
  test(`reader keeps the open document while managing folders at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const repository = await installRepository(page)
    const folders: DocumentFolderDTO[] = [
      {
        id: 'reader-archive',
        project_id: projectId,
        name: 'Archive',
        path: 'Archive',
        parent_id: null,
      },
    ]
    const writes: { method: string; body: Record<string, unknown> }[] = []
    await page.route(`**/projects/${projectId}/folders`, async (route) => {
      const method = route.request().method()
      let detail: unknown = folders
      if (method !== 'GET') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        writes.push({ method, body })
        if (method === 'POST') {
          detail = {
            id: 'reader-empty',
            project_id: projectId,
            name: String(body.name),
            path: `${body.parent_path}/${body.name}`,
            parent_id: null,
          } satisfies DocumentFolderDTO
          folders.push(detail as DocumentFolderDTO)
        } else {
          const index = folders.findIndex((folder) => folder.path === body.path)
          expect(index).toBeGreaterThanOrEqual(0)
          if (method === 'DELETE') {
            folders.splice(index, 1)
            detail = { deleted: true }
          } else {
            const folder = folders[index]
            const parent = String(
              body.parent_path ?? folder.path.split('/').slice(0, -1).join('/')
            )
            folder.name = String(body.name ?? folder.name)
            folder.path = [parent, folder.name].filter(Boolean).join('/')
            detail = folder
          }
        }
      }
      await route.fulfill({
        json: { code: 200, status: 'OK', timestamp: 1, detail },
      })
    })
    await repository.open()
    await expect(page.locator('[data-document-page]')).toContainText(
      'Original saved body.'
    )
    if (width === 390)
      await page
        .getByRole('button', { name: 'Show files', exact: true })
        .click()
    const files = page.locator('#workspace-files')
    await files
      .getByRole('button', { name: /^(Expand|Collapse) guides$/ })
      .click()
    await expect(
      files.getByRole('button', { name: 'Delete folder', exact: true })
    ).toBeDisabled()
    await files.getByRole('button', { name: 'New folder', exact: true }).click()
    const create = page.getByRole('dialog', { name: 'New folder', exact: true })
    await create
      .getByRole('textbox', { name: 'Folder name', exact: true })
      .fill('Empty')
    await create
      .getByRole('button', { name: 'Create folder', exact: true })
      .click()
    await expect(create).not.toBeVisible()
    expect(writes[0]).toEqual({
      method: 'POST',
      body: { parent_path: 'guides', name: 'Empty' },
    })
    await files
      .getByRole('button', { name: 'Rename folder', exact: true })
      .click()
    const rename = page.getByRole('dialog', {
      name: 'Rename folder',
      exact: true,
    })
    await rename
      .getByRole('textbox', { name: 'Folder name', exact: true })
      .fill('Notes')
    await rename.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(rename).not.toBeVisible()
    expect(writes[1]).toEqual({
      method: 'PATCH',
      body: { path: 'guides/Empty', name: 'Notes' },
    })
    await files
      .getByRole('button', { name: 'Move folder', exact: true })
      .click()
    const move = page.getByRole('dialog', { name: 'Move folder', exact: true })
    await selectOption(
      move.getByRole('combobox', { name: 'Destination folder' }),
      'folder:Archive'
    )
    await move.getByRole('button', { name: 'Move folder', exact: true }).click()
    await expect(move).not.toBeVisible()
    expect(writes[2]).toEqual({
      method: 'PATCH',
      body: { path: 'guides/Notes', parent_path: 'Archive' },
    })
    await files
      .getByRole('button', { name: /^(Expand|Collapse) Archive$/ })
      .click()
    await expect(
      files.getByRole('button', { name: /^(Expand|Collapse) Notes$/ })
    ).toBeVisible()
    await files
      .getByRole('button', { name: /^(Expand|Collapse) Notes$/ })
      .click()
    await files
      .getByRole('group', { name: 'Folder actions', exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({
      path: `.artifacts/entity-lists/reader-folders-${width}.png`,
    })
    await files
      .getByRole('button', { name: 'Delete folder', exact: true })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete folder', exact: true })
      .click()
    await expect(page.getByRole('alertdialog')).not.toBeVisible()
    expect(writes[3]).toEqual({
      method: 'DELETE',
      body: { path: 'Archive/Notes' },
    })
    await expect(
      files.getByRole('button', { name: /^(Expand|Collapse) Notes$/ })
    ).toHaveCount(0)
    if (width === 390)
      await page
        .getByRole('dialog', { name: 'Files', exact: true })
        .getByRole('button', { name: 'Close', exact: true })
        .click()
    await expect(page.locator('[data-document-page]')).toContainText(
      'Original saved body.'
    )
    await expect(page).toHaveURL(/\/documents\/commit-document\?/)
    expect(repository.unexpected).toEqual([])
  })
}

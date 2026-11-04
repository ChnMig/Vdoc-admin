import { expect, test } from '@playwright/test'
import type { DocumentFolderDTO } from '../../../src/lib/vdoc-api'
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
    const reader = page.locator('[data-document-page]')
    await expect(reader).toContainText('Original saved body.')
    const files = page.locator('#workspace-files')
    const showFiles = async () => {
      if (width === 390)
        await page
          .getByRole('button', { name: 'Show files', exact: true })
          .click()
    }
    const closeFiles = async () => {
      if (width === 390)
        await page
          .getByRole('dialog', { name: 'Files', exact: true })
          .getByRole('button', { name: 'Close', exact: true })
          .click()
    }
    const folderMenu = async (action: string) => {
      await page
        .getByRole('button', { name: 'More actions', exact: true })
        .click()
      await page
        .getByRole('menuitem', { name: 'Folder actions', exact: true })
        .click()
      await page.getByRole('menuitem', { name: action, exact: true }).click()
    }
    await showFiles()
    // Management controls are separate from folder navigation, including on touch screens.
    await expect(
      files.getByRole('button', { name: 'New folder', exact: true })
    ).toHaveCount(0)
    await expect(
      files.getByRole('button', { name: 'New document', exact: true })
    ).toHaveCount(0)
    await files
      .getByRole('button', { name: 'Folder actions: guides', exact: true })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'Delete folder', exact: true })
    ).toBeDisabled()
    await page.keyboard.press('Escape')
    await closeFiles()
    await page
      .getByRole('button', { name: 'More actions', exact: true })
      .click()
    await page.screenshot({
      animations: 'disabled',
      path: `.artifacts/workspace-quality/reader-actions-${width}.png`,
    })
    await page
      .getByRole('menuitem', { name: 'New folder', exact: true })
      .click()
    const create = page.getByRole('dialog', { name: 'New folder', exact: true })
    await expect(
      create.getByRole('textbox', { name: 'Folder name', exact: true })
    ).toBeFocused()
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
    await folderMenu('Rename folder')
    const rename = page.getByRole('dialog', {
      name: 'Rename folder',
      exact: true,
    })
    await expect(
      rename.getByRole('textbox', { name: 'Folder name', exact: true })
    ).toBeFocused()
    await rename
      .getByRole('textbox', { name: 'Folder name', exact: true })
      .fill('Notes')
    await rename.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(rename).not.toBeVisible()
    expect(writes[1]).toEqual({
      method: 'PATCH',
      body: { path: 'guides/Empty', name: 'Notes' },
    })
    await folderMenu('Move folder')
    const move = page.getByRole('dialog', { name: 'Move folder', exact: true })
    await expect(
      move.getByRole('treeitem', { name: 'guides/Notes', exact: true })
    ).toHaveAttribute('aria-disabled', 'true')
    await move.getByRole('treeitem', { name: 'Archive', exact: true }).click()
    await expect(
      move.getByRole('treeitem', { name: 'Archive', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await move.getByRole('button', { name: 'Move folder', exact: true }).click()
    await expect(move).not.toBeVisible()
    expect(writes[2]).toEqual({
      method: 'PATCH',
      body: { path: 'guides/Notes', parent_path: 'Archive' },
    })
    await expect(reader).toContainText('Original saved body.')
    await showFiles()
    await files
      .getByRole('button', { name: /^(Expand|Collapse) Archive$/ })
      .click()
    await expect(
      files.getByRole('button', { name: /^(Expand|Collapse) Notes$/ })
    ).toBeVisible()
    await files
      .getByRole('button', { name: 'Folder actions: Notes', exact: true })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'Delete folder', exact: true })
    ).toBeEnabled()
    await page.screenshot({
      animations: 'disabled',
      path: `.artifacts/workspace-quality/reader-folder-menu-${width}.png`,
    })
    await page
      .getByRole('menuitem', { name: 'Delete folder', exact: true })
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
    await closeFiles()
    await expect(reader).toContainText('Original saved body.')
    await expect(page).toHaveURL(/\/documents\/commit-document\?/)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    expect(repository.unexpected).toEqual([])
  })
}

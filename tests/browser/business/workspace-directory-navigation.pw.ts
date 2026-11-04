import { expect, test } from '@playwright/test'
import type { DocumentFolderDTO } from '../../../src/lib/vdoc-api'
import { installRepository, projectId } from '../support/repository-workflow'

for (const { width, reducedMotion } of [
  { width: 1280, reducedMotion: false },
  { width: 390, reducedMotion: false },
  { width: 390, reducedMotion: true },
]) {
  test(`directory tree, breadcrumbs and local refresh at ${width}px${reducedMotion ? ' with reduced motion' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' })
    const api = await installRepository(page)
    const destination =
      'Archive/2026/Release notes and migration references for the documentation team'
    const paths = [
      'guides',
      'guides/Source',
      'guides/Source/Subfolder',
      'Archive',
      'Archive/2026',
      destination,
    ]
    const folders: DocumentFolderDTO[] = paths.map((path) => ({
      id: path,
      project_id: projectId,
      name: path.split('/').pop()!,
      path,
      parent_id: path.includes('/')
        ? path.split('/').slice(0, -1).join('/')
        : null,
    }))
    let folderReads = 0
    const writes: Record<string, unknown>[] = []
    await page.route(`**/projects/${projectId}/folders`, async (route) => {
      let detail: unknown = folders
      if (route.request().method() === 'GET') folderReads++
      else {
        const body = route.request().postDataJSON() as {
          path: string
          parent_path: string
        }
        writes.push(body)
        const source = folders.find((folder) => folder.path === body.path)!
        const newPath = `${body.parent_path}/${source.name}`
        for (const folder of folders) {
          if (
            folder.path === body.path ||
            folder.path.startsWith(`${body.path}/`)
          )
            folder.path = newPath + folder.path.slice(body.path.length)
        }
        source.parent_id =
          folders.find((folder) => folder.path === body.parent_path)?.id ?? null
        detail = source
      }
      await route.fulfill({
        json: { code: 200, status: 'OK', timestamp: 1, detail },
      })
    })
    await page.goto(
      `/documents?team_id=commit-team&project_id=${projectId}&folder_id=guides`
    )
    const breadcrumb = page.getByRole('navigation', {
      name: 'Current location',
      exact: true,
    })
    await expect(
      breadcrumb.getByRole('button', { name: 'guides', exact: true })
    ).toHaveAttribute('aria-current', 'location')
    const filter = page.getByRole('textbox', {
      name: 'Search files',
      exact: true,
    })
    await filter.fill('Source')
    await page
      .getByRole('button', { name: 'Collapse Commit team', exact: true })
      .click()
    const readsBefore = folderReads
    const requestCount = api.requests.length
    await page
      .getByRole('button', { name: 'Refresh current folder', exact: true })
      .click()
    await expect.poll(() => folderReads).toBe(readsBefore + 1)
    await expect(
      page.getByRole('button', { name: 'Refresh current folder', exact: true })
    ).toBeEnabled()
    await expect(filter).toHaveValue('Source')
    await expect(
      page.getByRole('button', { name: 'Expand Commit team', exact: true })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      api.requests.slice(requestCount).map((request) => request.path)
    ).toEqual([`/api/v1/private/projects/${projectId}/repository/documents`])
    await filter.clear()
    await page
      .getByRole('button', { name: 'Folder actions: Source', exact: true })
      .click()
    await expect(
      page.getByRole('menuitem', { name: 'Delete folder', exact: true })
    ).toBeDisabled()
    await page
      .getByRole('menuitem', { name: 'Move folder', exact: true })
      .click()
    const move = page.getByRole('dialog', { name: 'Move folder', exact: true })
    const source = move.getByRole('treeitem', {
      name: 'guides/Source',
      exact: true,
    })
    await expect(source).toHaveAttribute('aria-disabled', 'true')
    await source.focus()
    await page.keyboard.press('ArrowRight')
    await expect(
      move.getByRole('treeitem', {
        name: 'guides/Source/Subfolder',
        exact: true,
      })
    ).toHaveAttribute('aria-disabled', 'true')
    await source.focus()
    await page.keyboard.press('Enter')
    await expect(
      move.getByRole('treeitem', { name: 'guides', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    const archive = move.getByRole('treeitem', { name: 'Archive', exact: true })
    await archive.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(
      move.getByRole('treeitem', { name: 'Archive/2026', exact: true })
    ).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(
      move.getByRole('treeitem', { name: destination, exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      move.getByRole('navigation', { name: 'Selected location', exact: true })
    ).toContainText(
      'Release notes and migration references for the documentation team'
    )
    await page.screenshot({
      animations: 'disabled',
      path: `.artifacts/workspace-quality/folder-tree-${width}${reducedMotion ? '-reduced' : ''}.png`,
    })
    expect(
      await move.evaluate((node) => node.scrollWidth <= node.clientWidth)
    ).toBe(true)
    await move.getByRole('button', { name: 'Move folder', exact: true }).click()
    await expect(move).not.toBeVisible()
    expect(writes).toEqual([
      { path: 'guides/Source', parent_path: destination },
    ])
    await expect(
      page.getByRole('button', { name: 'Source', exact: true })
    ).toHaveCount(0)
    await breadcrumb
      .getByRole('button', { name: 'Commit workspace', exact: true })
      .click()
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await page.getByRole('button', { name: '2026', exact: true }).click()
    await page
      .getByRole('button', {
        name: 'Release notes and migration references for the documentation team',
        exact: true,
      })
      .click()
    await page.getByRole('button', { name: 'Source', exact: true }).click()
    await expect(
      breadcrumb.getByRole('button', { name: 'Source', exact: true })
    ).toHaveAttribute('aria-current', 'location')
    await breadcrumb
      .getByRole('button', { name: 'Archive', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Archive', exact: true })
    ).toBeVisible()
    await page.screenshot({
      animations: 'disabled',
      path: `.artifacts/workspace-quality/directory-breadcrumb-${width}${reducedMotion ? '-reduced' : ''}.png`,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    expect(api.unexpected).toEqual([])
  })
}

for (const width of [1280, 390]) {
  for (const operation of ['delete', 'move'] as const) {
    test(`inferred directory remains selected after its last document is ${operation} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      const api = await installRepository(page)
      const documents = [
        {
          id: 'commit-document',
          project_id: projectId,
          name: 'Last document',
          document_type: 2,
          relative_path: 'alpha/beta/a.md',
          file_name: 'a.md',
          folder_id: null,
          status: 1,
          default_branch_id: 'repo-main',
          default_branch_name: 'main',
        },
      ]
      let storedFolders: DocumentFolderDTO[] = []
      const ok = (detail: unknown) => ({
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail,
      })
      let folderReads = 0
      await page.route(`**/projects/${projectId}/folders`, async (route) => {
        folderReads++
        await route.fulfill({ json: ok(storedFolders) })
      })
      await page.route(
        `**/projects/${projectId}/repository/documents`,
        (route) => route.fulfill({ json: ok(documents) })
      )
      await page.route(
        `**/projects/${projectId}/repository/documents/commit-document`,
        async (route) => {
          storedFolders = [
            {
              id: 'persistent-alpha-uuid',
              project_id: projectId,
              name: 'alpha',
              path: 'alpha',
              parent_id: null,
              created_by: 'admin',
              created_at: '',
              updated_at: '',
            },
            {
              id: 'persistent-beta-uuid',
              project_id: projectId,
              name: 'beta',
              path: 'alpha/beta',
              parent_id: 'persistent-alpha-uuid',
              created_by: 'admin',
              created_at: '',
              updated_at: '',
            },
          ]
          if (operation === 'delete') {
            expect(route.request().method()).toBe('DELETE')
            documents.splice(0)
            await route.fulfill({ json: ok({ deleted: true }) })
          } else {
            expect(route.request().method()).toBe('PATCH')
            expect(route.request().postDataJSON()).toEqual({
              relative_path: 'a.md',
            })
            documents[0].relative_path = 'a.md'
            await route.fulfill({ json: ok(documents[0]) })
          }
        }
      )
      await page.goto(
        `/documents?team_id=commit-team&project_id=${projectId}&folder_id=repository-folder:alpha/beta`
      )
      await page
        .getByRole('button', {
          name: 'Document actions: Last document',
          exact: true,
        })
        .click()
      const action =
        operation === 'delete' ? 'Delete document' : 'Move document'
      await page.getByRole('menuitem', { name: action, exact: true }).click()
      if (operation === 'delete')
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: action, exact: true })
          .click()
      else {
        const move = page.getByRole('dialog', { name: action, exact: true })
        await move
          .getByRole('treeitem', { name: 'Project root', exact: true })
          .click()
        await move.getByRole('button', { name: action, exact: true }).click()
      }
      await expect.poll(() => folderReads).toBeGreaterThanOrEqual(2)
      const refresh = page.getByRole('button', {
        name: 'Refresh current folder',
        exact: true,
      })
      await expect(refresh).toBeEnabled()
      await refresh.click()
      await expect(refresh).toBeEnabled()
      await expect(
        page.getByRole('heading', { name: 'beta', exact: true })
      ).toBeVisible()
      const breadcrumb = page.getByRole('navigation', {
        name: 'Current location',
        exact: true,
      })
      await expect(
        breadcrumb.getByRole('button', { name: 'beta', exact: true })
      ).toHaveAttribute('aria-current', 'location')
      await expect(
        page.getByRole('button', { name: 'Last document', exact: true })
      ).toHaveCount(0)
      expect(new URL(page.url()).searchParams.get('folder_id')).toBe(
        'repository-folder:alpha/beta'
      )
      await page.screenshot({
        animations: 'disabled',
        path: `.artifacts/workspace-quality/inferred-folder-${operation}-${width}.png`,
      })
      await breadcrumb
        .getByRole('button', { name: 'alpha', exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: 'beta', exact: true })
      ).toBeVisible()
      await page.getByRole('button', { name: 'beta', exact: true }).click()
      await expect(
        breadcrumb.getByRole('button', { name: 'beta', exact: true })
      ).toHaveAttribute('aria-current', 'location')
      expect(api.unexpected).toEqual([])
    })
  }
}

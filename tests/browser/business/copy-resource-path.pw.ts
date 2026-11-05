import { expect, test } from '@playwright/test'
import type { RepositoryDocument } from '../../../src/lib/repository-api'
import type { DocumentFolderDTO } from '../../../src/lib/vdoc-api'
import {
  documentId,
  installRepository,
  mainId,
  projectId,
  projectRepositoryPath,
} from '../support/repository-workflow'

for (const width of [1280, 390]) {
  for (const reader of [false, true]) {
    test(`copies scoped locations from navigation, rows and reader at ${width}px as ${reader ? 'reader' : 'admin'}`, async ({
      page,
      context,
    }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width, height: 900 })
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      const api = await installRepository(page, { reader })
      const parent = '版本变更'
      const directory = `${parent}/feat-1.11`
      const filePath = `${directory}/前端接口.md`
      const scope = {
        team_id: 'commit-team',
        team_name: '研发团队',
        project_id: projectId,
        project_name: '文档工程/协作平台',
      }
      const ok = (detail: unknown) => ({
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail,
      })
      const folders: DocumentFolderDTO[] = [parent, directory].map((path) => ({
        id: path,
        project_id: projectId,
        name: path.split('/').pop()!,
        path,
        parent_id: path === parent ? null : parent,
      }))
      const document: RepositoryDocument = {
        id: documentId,
        project_id: projectId,
        name: '前端接口.md',
        relative_path: filePath,
        file_name: '前端接口.md',
        default_branch_id: mainId,
        default_branch_name: 'main',
        document_type: 2,
        status: 1,
        created_by: 'commit-admin',
        created_at: '',
        updated_at: '',
      }
      api.initial.files[0].relative_path = filePath
      api.initial.files[0].name = document.name
      await page.route('**/api/v1/private/projects', (route) =>
        route.fulfill({
          json: ok([
            {
              id: projectId,
              team_id: scope.team_id,
              team_name: scope.team_name,
              name: scope.project_name,
              status: 1,
            },
          ]),
        })
      )
      await page.route('**/api/v1/private/teams', (route) =>
        route.fulfill({
          json: ok([{ id: scope.team_id, name: scope.team_name }]),
        })
      )
      await page.route(`**/projects/${projectId}/folders`, (route) =>
        route.fulfill({ json: ok(folders) })
      )
      for (const path of [
        `/api/v1/private/projects/${projectId}/documents`,
        `${projectRepositoryPath}/documents`,
      ])
        await page.route(`**${path}`, (route) =>
          route.fulfill({ json: ok([document]) })
        )
      const copied = async () =>
        JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
      await page.goto(
        `/documents?team_id=commit-team&project_id=${projectId}&folder_id=${encodeURIComponent(`repository-folder:${parent}`)}`
      )
      const breadcrumb = page.getByRole('navigation', {
        name: 'Current location',
        exact: true,
      })
      await expect(
        breadcrumb.getByRole('button', { name: parent, exact: true })
      ).toBeVisible()
      for (const button of await breadcrumb.getByRole('button').all()) {
        await expect(button.locator('svg')).toHaveCount(1)
        await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      }
      await page
        .getByRole('button', { name: 'Copy current folder path', exact: true })
        .click()
      expect(await copied()).toEqual({ ...scope, path: parent })
      await expect(
        page.getByText('Path and project copied', { exact: true })
      ).toBeVisible()
      await page
        .getByRole('button', { name: 'Folder actions: feat-1.11', exact: true })
        .click()
      if (reader)
        await expect(
          page.getByRole('menuitem', { name: 'Delete folder', exact: true })
        ).toHaveCount(0)
      await page
        .getByRole('menuitem', { name: 'Copy path', exact: true })
        .click()
      expect(await copied()).toEqual({ ...scope, path: directory })
      await page.getByRole('button', { name: 'feat-1.11', exact: true }).click()
      await page
        .getByRole('button', {
          name: `${reader ? 'More actions' : 'Document actions'}: ${document.name}`,
          exact: true,
        })
        .click()
      await page
        .getByRole('menuitem', { name: 'Copy path', exact: true })
        .click()
      const expectedFile = {
        ...scope,
        document_id: documentId,
        relative_path: filePath,
      }
      expect(await copied()).toEqual(expectedFile)
      await page.mouse.move(0, 0)
      await page.screenshot({
        animations: 'disabled',
        path: `.artifacts/workspace-quality/scoped-path-directory-${width}-${reader ? 'reader' : 'admin'}.png`,
      })
      await page
        .getByRole('button', { name: document.name, exact: true })
        .click()
      await expect(page.locator('[data-document-page]')).toContainText(
        'Original saved body.'
      )
      await page
        .getByRole('button', { name: 'More actions', exact: true })
        .click()
      await page
        .getByRole('menuitem', { name: 'Copy path', exact: true })
        .click()
      expect(await copied()).toEqual(expectedFile)
      if (width === 390)
        await page
          .getByRole('button', { name: 'Show files', exact: true })
          .click()
      const files = page.locator('#workspace-files')
      await files
        .getByRole('button', {
          name: `${reader ? 'More actions' : 'Document actions'}: ${document.name}`,
          exact: true,
        })
        .click()
      await page
        .getByRole('menuitem', { name: 'Copy path', exact: true })
        .click()
      expect(await copied()).toEqual(expectedFile)
      await files
        .getByRole('button', { name: 'Folder actions: feat-1.11', exact: true })
        .click()
      await page
        .getByRole('menuitem', { name: 'Copy path', exact: true })
        .click()
      expect(await copied()).toEqual({ ...scope, path: directory })
      expect(
        api.requests.filter(
          (request) => !['GET', 'OPTIONS'].includes(request.method)
        )
      ).toEqual([])
      expect(api.unexpected).toEqual([])
      if ((width === 1280 && !reader) || (width === 390 && reader)) {
        await page.addInitScript(() => {
          document.cookie = 'vdoc-admin-language=zh-CN; path=/'
        })
        await page.emulateMedia({
          colorScheme: 'dark',
          reducedMotion: 'reduce',
        })
        await page.goto(
          `/documents?team_id=commit-team&project_id=${projectId}&folder_id=${encodeURIComponent(`repository-folder:${directory}`)}`
        )
        await page
          .getByRole('button', { name: '复制当前目录路径', exact: true })
          .click()
        expect(await copied()).toEqual({ ...scope, path: directory })
        await page.mouse.move(0, 0)
        await page.screenshot({
          animations: 'disabled',
          path: `.artifacts/workspace-quality/scoped-path-directory-${width}-zh-dark-reduced.png`,
        })
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        ).toBe(true)
      }
    })
  }
}

test('does not copy the root while a selected folder is still loading', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await installRepository(page)
  let releaseFolders!: () => void
  const ready = new Promise<void>((resolve) => {
    releaseFolders = resolve
  })
  await page.route(`**/projects/${projectId}/folders`, async (route) => {
    await ready
    await route.fulfill({
      json: {
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail: [
          {
            id: 'pending-folder',
            project_id: projectId,
            parent_id: null,
            name: 'Empty folder',
            path: 'Empty folder',
          },
        ],
      },
    })
  })
  await page.goto(
    `/documents?team_id=commit-team&project_id=${projectId}&folder_id=pending-folder`
  )
  const copy = page.getByRole('button', {
    name: 'Copy current folder path',
    exact: true,
  })
  await expect(copy).toBeDisabled()
  releaseFolders()
  await expect(copy).toBeEnabled()
  await copy.click()
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
  ).toMatchObject({ project_id: projectId, path: 'Empty folder' })
})

test('identical team, project and file names retain distinct copied project IDs', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const api = await installRepository(page)
  const scopes = [
    { project_id: projectId, team_id: 'commit-team', document_id: documentId },
    {
      project_id: 'second-project',
      team_id: 'second-team',
      document_id: 'second-document',
    },
  ]
  const ok = (detail: unknown) => ({
    code: 200,
    status: 'OK',
    timestamp: 1,
    detail,
  })
  await page.route('**/api/v1/private/projects', (route) =>
    route.fulfill({
      json: ok(
        scopes.map((scope) => ({
          id: scope.project_id,
          team_id: scope.team_id,
          team_name: 'Same team',
          name: 'Same project',
          status: 1,
        }))
      ),
    })
  )
  await page.route('**/api/v1/private/teams', (route) =>
    route.fulfill({
      json: ok(
        scopes.map((scope) => ({ id: scope.team_id, name: 'Same team' }))
      ),
    })
  )
  for (const scope of scopes) {
    await page.route(`**/projects/${scope.project_id}/folders`, (route) =>
      route.fulfill({
        json: ok([
          {
            id: 'guides',
            project_id: scope.project_id,
            parent_id: null,
            name: 'guides',
            path: 'guides',
          },
        ]),
      })
    )
    await page.route(
      `**/projects/${scope.project_id}/repository/documents`,
      (route) =>
        route.fulfill({
          json: ok([
            {
              id: scope.document_id,
              project_id: scope.project_id,
              name: 'Same file',
              document_type: 2,
              relative_path: 'guides/shared.md',
              file_name: 'shared.md',
              status: 1,
              default_branch_id: mainId,
              default_branch_name: 'main',
            },
          ]),
        })
    )
  }
  for (const scope of scopes) {
    await page.goto(
      `/documents?team_id=${scope.team_id}&project_id=${scope.project_id}&folder_id=repository-folder:guides`
    )
    await page
      .getByRole('button', { name: 'Document actions: Same file', exact: true })
      .click()
    await page.getByRole('menuitem', { name: 'Copy path', exact: true }).click()
    expect(
      JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
    ).toEqual({
      ...scope,
      team_name: 'Same team',
      project_name: 'Same project',
      relative_path: 'guides/shared.md',
    })
    await page
      .getByRole('navigation', { name: 'Current location', exact: true })
      .getByRole('button', { name: 'Same project', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Copy current folder path', exact: true })
      .click()
    const root = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText())
    )
    expect(root).toMatchObject({
      project_id: scope.project_id,
      team_id: scope.team_id,
      path: '',
    })
    expect(root).not.toHaveProperty('document_id')
  }
  expect(api.unexpected).toEqual([])
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Route } from '@playwright/test'

const admin = {
  id: 'admin',
  email: 'admin@example.test',
  name: 'Admin',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
}
async function envelope(route: Route, detail: unknown) {
  await route.fulfill({
    status: 200,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail,
      total: Array.isArray(detail) ? detail.length : undefined,
    }),
  })
}

for (const width of [1280, 390]) {
  test(`selected user token errors remain recoverable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'vdoc_admin_access_token',
        'query-ownership-fixture'
      )
    )
    let tokenRequests = 0
    await page.route('**/api/v1/**', async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers })
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/identity/me')) return envelope(route, admin)
      if (path.endsWith('/system/users')) return envelope(route, [admin])
      if (path.endsWith('/users/admin/mcp-tokens')) {
        tokenRequests += 1
        if (tokenRequests === 1) {
          return route.fulfill({
            status: 403,
            headers,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 403,
              status: 'FORBIDDEN',
              description: 'Token list unavailable',
            }),
          })
        }
        return envelope(route, [])
      }
      return envelope(route, [])
    })
    await page.goto('/users')
    await page.getByRole('button', { name: admin.email, exact: true }).click()
    await expect(
      page.getByText('Request failed with status code 403', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('No user tokens selected', { exact: true })
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(
      page.getByText(`No MCP tokens have been issued for ${admin.email}.`, {
        exact: true,
      })
    ).toBeVisible()
    expect(tokenRequests).toBe(2)
    await expect(
      page.getByText('Request failed with status code 403', { exact: true })
    ).toHaveCount(0)
    expect(
      (await new AxeBuilder({ page }).include('main#content').analyze())
        .violations
    ).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })

  test(`member edits belong to the selected project at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'vdoc_admin_access_token',
        'member-ownership-fixture'
      )
    )
    let releaseAdd!: () => void
    const addPending = new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    const additions: { project: string; role: number }[] = []
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      if (request.method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers })
      const path = new URL(request.url()).pathname
      if (path.endsWith('/identity/me')) return envelope(route, admin)
      if (path.endsWith('/system/users'))
        return envelope(route, [
          admin,
          {
            ...admin,
            id: 'candidate',
            email: 'candidate@example.test',
            is_super_admin: false,
          },
        ])
      if (path.endsWith('/projects'))
        return envelope(route, [
          { id: 'a', name: 'Project A', status: 1 },
          { id: 'b', name: 'Project B', status: 1 },
        ])
      if (/\/projects\/(a|b)\/members$/.test(path)) {
        const project = path.includes('/a/') ? 'a' : 'b'
        if (request.method() === 'POST') {
          additions.push({ project, role: request.postDataJSON().role })
          await addPending
          return envelope(route, {
            project_id: project,
            user_id: 'candidate',
            role: 2,
            status: 1,
          })
        }
        return envelope(route, [
          {
            project_id: project,
            user_id: 'project-admin',
            user_email: 'project-admin@example.test',
            role: 3,
            status: 1,
            user_status: 1,
          },
          {
            project_id: project,
            user_id: 'existing',
            user_email: 'existing@example.test',
            role: 2,
            status: 1,
            user_status: 1,
          },
        ])
      }
      return envelope(route, [])
    })
    await page.goto('/projects')
    const project = page.getByLabel('Project', { exact: true })
    const role = () => page.getByLabel('Role', { exact: true })
    await expect(project).toHaveValue('a')
    await page
      .getByLabel('Role: existing@example.test', { exact: true })
      .selectOption('1')
    await project.selectOption('b')
    await expect(
      page.getByLabel('Role: existing@example.test', { exact: true })
    ).toHaveValue('2')
    await project.selectOption('a')
    await page.getByLabel('User', { exact: true }).selectOption('candidate')
    await role().selectOption('2')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect.poll(() => additions.length).toBe(1)
    await project.selectOption('b')
    await page.getByLabel('User', { exact: true }).selectOption('candidate')
    await role().selectOption('3')
    releaseAdd()
    await expect(
      page.getByRole('button', { name: 'Add', exact: true })
    ).toBeEnabled()
    await expect(role()).toHaveValue('3')
    await expect(page.getByLabel('User', { exact: true })).toHaveValue(
      'candidate'
    )
    expect(additions).toEqual([{ project: 'a', role: 2 }])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}

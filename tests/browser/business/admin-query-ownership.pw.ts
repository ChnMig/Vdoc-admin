import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Route } from '@playwright/test'
import { selectOption } from '../helpers/select-option'

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
    const selectedUser = {
      ...admin,
      email: 'operations.administrator.with.a.long.address@example.test',
    }
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
      if (path.endsWith('/system/users')) return envelope(route, [selectedUser])
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
    await expect(
      page.getByText('Selected user MCP tokens', { exact: true })
    ).toHaveCount(0)
    const viewTokens = page.getByRole('button', {
      name: 'View tokens',
      exact: true,
    })
    await viewTokens.click()
    await expect(viewTokens).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByText('Request failed with status code 403', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('No user tokens selected', { exact: true })
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(
      page.getByText(
        `No MCP tokens have been issued for ${selectedUser.email}.`,
        {
          exact: true,
        }
      )
    ).toBeVisible()
    expect(tokenRequests).toBe(2)
    await expect(
      page.getByText('Request failed with status code 403', { exact: true })
    ).toHaveCount(0)
    const tokenCard = page
      .getByText('Selected user MCP tokens', { exact: true })
      .locator('xpath=ancestor::*[@data-slot="card"][1]')
    const hideTokens = page.getByRole('button', {
      name: 'Hide tokens',
      exact: true,
    })
    for (const tokenWidth of width === 390 ? [390, 320] : [width]) {
      await page.setViewportSize({ width: tokenWidth, height: 900 })
      const bounds = await tokenCard.evaluate((card) => {
        const action = card.querySelector('button')!
        const header = card.querySelector('[data-slot="card-header"]')!
        const description = card.querySelector(
          '[data-slot="card-description"]'
        )!
        const cardBox = card.getBoundingClientRect()
        const actionBox = action.getBoundingClientRect()
        return {
          actionInsideCard:
            actionBox.left >= cardBox.left &&
            actionBox.right <= cardBox.right &&
            actionBox.top >= cardBox.top &&
            actionBox.bottom <= cardBox.bottom,
          headerFits: header.scrollWidth <= header.clientWidth,
          descriptionFits: description.scrollWidth <= description.clientWidth,
        }
      })
      expect(bounds, `token header fits its card at ${tokenWidth}px`).toEqual({
        actionInsideCard: true,
        headerFits: true,
        descriptionFits: true,
      })
      await hideTokens.click({ trial: true })
    }
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: 'Hide tokens', exact: true }).click()
    await expect(viewTokens).toHaveAttribute('aria-pressed', 'false')
    await expect(
      page.getByText('Selected user MCP tokens', { exact: true })
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
    await expect(project).toHaveAttribute('value', 'a')
    await selectOption(
      page.getByLabel('Role: existing@example.test', { exact: true }),
      '1'
    )
    await selectOption(project, 'b')
    await expect(
      page.getByLabel('Role: existing@example.test', { exact: true })
    ).toHaveAttribute('value', '2')
    await selectOption(project, 'a')
    await expect(page.getByLabel('User', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add member', exact: true })
    await selectOption(page.getByLabel('User', { exact: true }), 'candidate')
    await selectOption(role(), '2')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect.poll(() => additions.length).toBe(1)
    await selectOption(role(), '3')
    releaseAdd()
    await expect(
      page.getByRole('button', { name: 'Add', exact: true })
    ).toBeEnabled()
    await expect(role()).toHaveAttribute('value', '3')
    await expect(page.getByLabel('User', { exact: true })).toHaveAttribute(
      'value',
      'candidate'
    )
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await selectOption(project, 'b')
    await page.getByRole('button', { name: 'Add member', exact: true }).click()
    await expect(page.getByLabel('User', { exact: true })).toHaveAttribute(
      'value',
      ''
    )
    await expect(role()).toHaveAttribute('value', '1')
    expect(additions).toEqual([{ project: 'a', role: 2 }])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
  })
}

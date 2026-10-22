import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type Route } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const evidenceRoot = resolve(
  repositoryRoot,
  process.env['VDOC_ENTITY_LIST_EVIDENCE_DIR'] || '.artifacts/entity-lists'
)
const timestamp = '2026-10-22T08:00:00Z'
const session = 'entity-list-fixture-session'
const rootPath = '/api/v1/private'
const projectId = 'list-project'
const documentId = 'list-document'
const documentPath = `${rootPath}/projects/${projectId}/documents`
const branchPath = `${documentPath}/${documentId}/branches`
const syntheticSecret = 'synthetic-entity-list-token-capability'

type Resource = Record<string, unknown> & { id: string; name: string }
type FixtureOptions = {
  regular?: boolean
  language?: 'en' | 'zh-CN'
  beforeCreate?: (route: Route) => Promise<boolean>
}

async function envelope(route: Route, detail: unknown) {
  await route.fulfill({
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    },
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail,
      ...(Array.isArray(detail) ? { total: detail.length } : {}),
    }),
  })
}

async function fixture(page: Page, options: FixtureOptions = {}) {
  await page.addInitScript(
    ({ sessionValue, language }) => {
      window.sessionStorage.setItem('vdoc_admin_access_token', sessionValue)
      document.cookie = `vdoc-admin-language=${language}; path=/`
    },
    { sessionValue: session, language: options.language ?? 'en' }
  )
  await page.route(
    /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
    (route) => route.abort()
  )
  const admin = {
    id: 'list-admin',
    email: 'admin@example.test',
    name: 'List Admin',
    status: 1,
    is_super_admin: !options.regular,
    can_access_audit: !options.regular,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const base = {
    created_by: admin.id,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const lists: Record<string, Resource[]> = {
    [`${rootPath}/teams`]: [
      {
        ...base,
        id: 'list-team',
        name: 'Documentation team',
        description: 'Team description is visible without an input.',
      },
    ],
    [`${rootPath}/projects`]: [
      {
        ...base,
        id: projectId,
        name: 'Documentation workspace',
        team_id: 'list-team',
        description: 'A list-first project workspace',
        status: 1,
      },
    ],
    [`${rootPath}/system/users`]: [
      admin,
      {
        ...base,
        id: 'list-writer',
        name: 'Project writer',
        email: 'writer.with.a.long.address@example.test',
        is_super_admin: false,
        status: 1,
      },
    ],
    [documentPath]: [
      {
        ...base,
        id: documentId,
        project_id: projectId,
        name: 'Published handbook',
        document_type: 2,
        relative_path: 'guides/handbook.md',
        description: 'Document description',
        status: 1,
      },
    ],
    [branchPath]: [
      {
        ...base,
        id: 'list-branch',
        document_id: documentId,
        name: 'main',
        description: 'Main environment branch',
        kind: 1,
        is_default: true,
        is_protected: true,
        status: 1,
      },
    ],
    [`${rootPath}/mcp-tokens`]: [
      {
        id: 'list-token',
        user_id: admin.id,
        name: 'Documentation agent',
        scopes: [1],
        status: 1,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
  }
  const reads: Record<string, number> = {}
  const writes: {
    path: string
    method: string
    body: Record<string, unknown>
  }[] = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (method === 'OPTIONS') return envelope(route, null)
    if (path === `${rootPath}/identity/me`) return envelope(route, admin)
    if (method === 'GET') {
      reads[path] = (reads[path] ?? 0) + 1
      if (lists[path]) return envelope(route, lists[path])
      if (path.endsWith('/overview'))
        return envelope(route, {
          version_count: 0,
          endpoint_count: 0,
          latest_version: null,
          published_branch_ids: [],
          has_reviewed_draft: false,
          raw_size_bytes: 0,
          raw_line_count: 0,
        })
      if (path.endsWith('/members'))
        return envelope(route, [
          {
            project_id: projectId,
            user_id: admin.id,
            user_email: admin.email,
            user_name: admin.name,
            user_status: 1,
            role: options.regular ? 1 : 3,
            status: 1,
            ...base,
          },
        ])
      if (path.endsWith('/member-candidates')) return envelope(route, [])
      if (
        path.endsWith('/shares') ||
        path.endsWith('/mcp-usage') ||
        path.includes('/mcp-tokens/')
      )
        return envelope(route, [])
      return envelope(route, [])
    }
    const body = request.postDataJSON() as Record<string, unknown>
    writes.push({ path, method, body })
    if (method === 'POST' && lists[path]) {
      if (options.beforeCreate && (await options.beforeCreate(route))) return
      const next: Resource = {
        ...base,
        ...body,
        id: `created-${writes.length}`,
        name: String(body.name),
        status: 1,
        project_id: projectId,
        document_id: documentId,
        is_default: false,
        is_protected: false,
        kind: 1,
        user_id: admin.id,
        scopes: body.scopes ?? [1],
      }
      lists[path].push(next)
      return envelope(
        route,
        path.endsWith('/mcp-tokens')
          ? { ...next, token: syntheticSecret }
          : next
      )
    }
    if (method === 'PATCH') {
      const listPath = path.slice(0, path.lastIndexOf('/'))
      const id = path.slice(path.lastIndexOf('/') + 1)
      const item = lists[listPath]?.find((resource) => resource.id === id)
      if (item) {
        Object.assign(item, body)
        return envelope(route, item)
      }
    }
    throw new Error(`Unhandled fixture request: ${method} ${path}`)
  })
  return { reads, writes, lists }
}

async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
}

async function evidencePath(filename: string) {
  await mkdir(evidenceRoot, { recursive: true })
  return resolve(evidenceRoot, filename)
}

async function saveScreenshot(page: Page, filename: string) {
  await page.screenshot({
    path: await evidencePath(filename),
    fullPage: false,
  })
}

const cases = [
  {
    route: '/teams',
    trigger: 'Create team',
    label: 'Documentation team',
    edit: 'Edit team',
  },
  {
    route: '/projects',
    trigger: 'Create project',
    label: 'Documentation workspace',
    edit: 'Edit project',
  },
  { route: '/users', trigger: 'Create user', label: 'admin@example.test' },
  {
    route: '/documents',
    trigger: 'Create document',
    label: 'Published handbook',
    edit: 'Edit document',
  },
  {
    route: '/mcp-tokens',
    trigger: 'Create MCP token',
    label: 'Documentation agent',
  },
]

test('entity pages open labeled create/edit dialogs from read-only lists', async ({
  page,
}) => {
  await fixture(page)
  for (const item of cases) {
    await page.goto(item.route)
    await expect(
      page.getByRole('table').filter({ hasText: item.label }).first()
    ).toBeVisible()
    await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0)
    const trigger = page.getByRole('button', {
      name: item.trigger,
      exact: true,
    })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: item.trigger, exact: true })
    await expect(dialog.getByLabel('Name', { exact: true })).toBeVisible()
    await dialog.getByLabel('Name', { exact: true }).fill('Discard this draft')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(
      page.getByRole('dialog').getByLabel('Name', { exact: true })
    ).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    if (item.edit) {
      const row = page.getByRole('row').filter({ hasText: item.label }).first()
      await expect(row.locator('input')).toHaveCount(0)
      await row.getByRole('button', { name: 'Edit', exact: true }).click()
      const edit = page.getByRole('dialog', { name: item.edit, exact: true })
      await expect(edit.getByLabel('Name', { exact: true })).toHaveValue(
        item.label
      )
      await expect(
        edit.getByLabel('Description', { exact: true })
      ).toBeVisible()
      await edit.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
    await noPageOverflow(page)
  }
  await page.goto('/documents')
  await page.getByRole('button', { name: 'Create branch', exact: true }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Create branch' })
      .getByLabel('Name', { exact: true })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  const branchRow = page
    .getByRole('row')
    .filter({ hasText: 'Main environment branch' })
  await expect(branchRow.locator('input')).toHaveCount(0)
  await branchRow.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(
    page
      .getByRole('dialog', { name: 'Edit branch' })
      .getByLabel('Default branch', { exact: true })
  ).toBeChecked()
  await page.keyboard.press('Escape')
})

test('creation errors retain input and success refreshes list; pending keeps focus protected', async ({
  page,
}) => {
  let requestCount = 0
  let finishRequest: (() => void) | undefined
  const { reads, writes } = await fixture(page, {
    beforeCreate: async (route) => {
      requestCount++
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 400,
            status: 'INVALID_ARGUMENT',
            description: 'The synthetic team name is already used.',
            timestamp: 1,
          }),
        })
        return true
      }
      await new Promise<void>((resolve) => {
        finishRequest = resolve
      })
      return false
    },
  })
  await page.goto('/teams')
  await page.getByRole('button', { name: 'Create team', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create team' })
  await dialog.getByLabel('Name', { exact: true }).fill('New team')
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('New team description')
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toContainText('The synthetic team name is already used.')
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue(
    'New team'
  )
  const beforeReads = reads[`${rootPath}/teams`]
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true })
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Create', exact: true })
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  expect(
    await dialog.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true)
  finishRequest?.()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('row').filter({ hasText: 'New team description' })
  ).toBeVisible()
  expect(reads[`${rootPath}/teams`]).toBeGreaterThan(beforeReads)
})

for (const width of [1280, 768, 640, 390]) {
  test(`Chinese project list and single-column form fit at ${width}px`, async ({
    page,
  }) => {
    await fixture(page, { language: 'zh-CN' })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/projects')
    await expect(
      page.getByRole('table').filter({ hasText: 'Documentation workspace' })
    ).toBeVisible()
    await noPageOverflow(page)
    if (width === 1280) await saveScreenshot(page, 'projects-list-1280.png')
    await page.getByRole('button', { name: '创建项目', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '创建项目' })
    await expect(
      dialog.getByLabel('首个项目管理员', { exact: true })
    ).toBeVisible()
    const geometry = await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const controls = Array.from(
        element.querySelectorAll('select, input')
      ).map((control) => {
        const rect = control.getBoundingClientRect()
        const id = control.id
        const label = Array.from(element.querySelectorAll('label'))
          .find((item) => item.htmlFor === id)
          ?.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          labelBottom: label?.bottom,
          labelLeft: label?.left,
        }
      })
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: innerWidth,
        height: innerHeight,
        controls,
      }
    })
    expect(geometry.left).toBeGreaterThanOrEqual(0)
    expect(geometry.top).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(width)
    expect(geometry.bottom).toBeLessThanOrEqual(900)
    for (const control of geometry.controls) {
      expect(control.left).toBeGreaterThanOrEqual(geometry.left)
      expect(control.right).toBeLessThanOrEqual(geometry.right)
      expect(Math.abs(control.left - (control.labelLeft ?? 0))).toBeLessThan(1)
      expect(control.top - (control.labelBottom ?? 0)).toBeGreaterThanOrEqual(6)
      expect(control.top - (control.labelBottom ?? 0)).toBeLessThanOrEqual(10)
    }
    const a11y = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(a11y.violations).toEqual([])
    await noPageOverflow(page)
    if (width === 1280 || width === 390)
      await saveScreenshot(page, `project-dialog-${width}.png`)
    await writeFile(
      await evidencePath(`project-layout-${width}.json`),
      JSON.stringify(
        { width, geometry, axeViolations: a11y.violations, result: 'passed' },
        null,
        2
      )
    )
  })
}

test('document/branch/user/token creation returns to updated lists', async ({
  page,
}) => {
  await fixture(page)
  const flows = [
    {
      route: '/users',
      title: 'Create user',
      name: 'Created writer',
      fill: async () => {
        await page
          .getByRole('dialog')
          .getByLabel('Email', { exact: true })
          .fill('created@example.test')
        await page
          .getByRole('dialog')
          .getByLabel('Password', { exact: true })
          .fill('synthetic-password-123')
      },
    },
    {
      route: '/projects',
      title: 'Create project',
      name: 'Created workspace',
      fill: async () => {
        await page
          .getByRole('dialog')
          .getByLabel('Team', { exact: true })
          .selectOption('list-team')
      },
    },
    {
      route: '/documents',
      title: 'Create document',
      name: 'Created handbook',
      fill: async () => {
        await page
          .getByRole('dialog')
          .getByLabel('Relative path', { exact: true })
          .fill('created.md')
      },
    },
    {
      route: '/documents',
      title: 'Create branch',
      name: 'preview',
      fill: async () => {},
    },
    {
      route: '/mcp-tokens',
      title: 'Create MCP token',
      name: 'Created agent',
      fill: async () => {},
    },
  ]
  for (const flow of flows) {
    await page.goto(flow.route)
    await page.getByRole('button', { name: flow.title, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: flow.title })
    await dialog.getByLabel('Name', { exact: true }).fill(flow.name)
    await flow.fill()
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByRole('row').filter({ hasText: flow.name }).first()
    ).toBeVisible()
  }
  expect(
    await page
      .locator('main')
      .evaluate(
        (element, secret) => element.textContent?.includes(secret),
        syntheticSecret
      )
  ).toBe(true)
})

test('readers see project and document lists without create/edit actions', async ({
  page,
}) => {
  await fixture(page, { regular: true })
  for (const route of ['/projects', '/documents']) {
    await page.goto(route)
    await expect(page.getByRole('table').first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Create (project|document|branch)$/ })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Edit', exact: true })
    ).toHaveCount(0)
  }
})

test('teams list capture contains readable metadata and discrete actions', async ({
  page,
}) => {
  await fixture(page, { language: 'zh-CN' })
  await page.goto('/teams')
  await expect(
    page.getByRole('row').filter({ hasText: 'Documentation team' })
  ).toBeVisible()
  await saveScreenshot(page, 'teams-list-1280.png')
})

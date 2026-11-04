import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

async function fixture(page: Page, superAdmin = true) {
  let days = 30
  const created: Array<{ name: string; scopes: number[] }> = []
  await page.addInitScript(() => {
    sessionStorage.setItem('vdoc_admin_access_token', 'retention-ui-synthetic')
    if (!document.cookie.includes('vdoc-admin-language=')) {
      document.cookie = 'vdoc-admin-language=zh-CN; path=/'
    }
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    }
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    const path = new URL(request.url()).pathname
    let detail: unknown = []
    if (path.endsWith('/identity/me'))
      detail = {
        id: 'synthetic-admin',
        name: '测试管理员',
        email: 'admin@example.test',
        is_super_admin: superAdmin,
        can_access_audit: true,
        status: 1,
      }
    if (path.endsWith('/system/audit-retention')) {
      if (request.method() === 'PUT')
        days = request.postDataJSON().audit_retention_days
      detail = { audit_retention_days: days }
    }
    if (path.endsWith('/mcp-tokens') && request.method() === 'POST') {
      const input = request.postDataJSON()
      created.push(input)
      detail = {
        ...input,
        id: 'synthetic-token',
        user_id: 'synthetic-admin',
        status: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }
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
  })
  return { created }
}

for (const width of [1440, 390]) {
  test(`global retention and unified MCP permissions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const { created } = await fixture(page)
    const directory = resolve('.artifacts/impeccable/audit-retention')
    await mkdir(directory, { recursive: true })
    const size = width === 1440 ? 'desktop' : 'mobile'
    await page.goto('/settings')
    await page.getByRole('tab', { name: '全局配置' }).click()
    const input = page.getByLabel('保留天数')
    await expect(input).toHaveValue('30')
    await expect(
      page.getByRole('button', { name: '保存保留设置' })
    ).toBeDisabled()
    await page.screenshot({
      path: resolve(directory, `${size}.png`),
      fullPage: true,
      animations: 'disabled',
    })
    await input.fill('1')
    await page.getByRole('tab', { name: '账号', exact: true }).click()
    await page.getByRole('tab', { name: '全局配置' }).click()
    await expect(input).toHaveValue('1')
    await input.fill('1.5')
    await page.getByRole('button', { name: '保存保留设置' }).click()
    await expect(page.getByRole('alert')).toContainText('请输入 0–36500 的整数')
    await input.fill('0')
    await expect(page.getByText(/保存为 0 后/)).toBeVisible()
    await page.screenshot({
      path: resolve(directory, `${size}-zero.png`),
      fullPage: true,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: '保存保留设置' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '已对所有用户和项目生效' })
    ).toBeVisible()
    await expect(input).toHaveValue('0')
    await page.reload()
    await page.getByRole('tab', { name: '全局配置' }).click()
    await expect(input).toHaveValue('0')
    const auditAxe = await new AxeBuilder({ page })
      .include('#audit-retention-title')
      .include('section[aria-labelledby="audit-retention-title"]')
      .analyze()
    expect(auditAxe.violations).toEqual([])
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)

    await page.evaluate(() => {
      document.cookie = 'vdoc-admin-language=en; path=/'
    })
    await page.reload()
    await page.getByRole('tab', { name: 'Global', exact: true }).click()
    await page.getByLabel('Retention (days)').fill('1')
    await page.getByRole('button', { name: 'Save retention' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Saved for all users' })
    ).toContainText('under the new policy')
    await page.screenshot({
      path: resolve(directory, `${size}-saved-en.png`),
      fullPage: true,
      animations: 'disabled',
    })
    await page.evaluate(() => {
      document.cookie = 'vdoc-admin-language=zh-CN; path=/'
    })

    await page.goto('/mcp-tokens')
    await page.getByRole('button', { name: '创建 MCP 令牌' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('checkbox')).toHaveCount(2)
    await expect(
      dialog.getByRole('checkbox', { name: '读取文档' })
    ).toBeChecked()
    await dialog.getByRole('checkbox', { name: '写入文档' }).check()
    await dialog.getByLabel('名称', { exact: true }).fill('测试文档助手')
    await page.screenshot({
      path: resolve(directory, `${size}-mcp.png`),
      fullPage: true,
      animations: 'disabled',
    })
    const mcpAxe = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze()
    expect(mcpAxe.violations).toEqual([])
    await dialog.getByRole('button', { name: '创建', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(created).toEqual([
      { name: '测试文档助手', scopes: [1, 2, 3, 4], expires_at: null },
    ])
  })
}

test('members cannot see global configuration', async ({ page }) => {
  await fixture(page, false)
  await page.goto('/settings')
  await expect(
    page.getByRole('tab', { name: '账号', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: '全局配置' })).toHaveCount(0)
})

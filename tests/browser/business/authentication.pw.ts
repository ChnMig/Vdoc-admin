import { expect, test } from '@playwright/test'

for (const [name, password] of [
  ['Chinese', '密码密码'],
  ['emoji', '🔐🔑🗝'],
]) {
  test(`sign-in accepts a 12-byte ${name} password`, async ({ page }) => {
    const credentials: unknown[] = []
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      }
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      const path = new URL(request.url()).pathname
      const isLogin = path === '/api/v1/open/auth/login'
      if (isLogin) credentials.push(request.postDataJSON())
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          status: 'OK',
          timestamp: 1,
          detail: isLogin
            ? {
                token: 'utf8-browser-test-session',
                user: {
                  id: 'utf8-user',
                  email: 'utf8@example.test',
                  name: 'UTF-8 User',
                  is_super_admin: false,
                  can_access_audit: false,
                  status: 1,
                },
              }
            : { registration_enabled: true },
        }),
      })
    })
    await page.goto('/sign-in?redirect=%2Fterms')
    await page.getByLabel('Email', { exact: true }).fill('utf8@example.test')
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in to Vdoc' }).click()
    await expect(page).toHaveURL(/\/terms\/?$/)
    expect(credentials).toEqual([{ email: 'utf8@example.test', password }])
    expect(
      await page.evaluate(() =>
        window.sessionStorage.getItem('vdoc_admin_access_token')
      )
    ).toBe('utf8-browser-test-session')
  })
}

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

for (const width of [1280, 390]) {
  test(`users page preserves credentials, keyboard navigation and offline fonts at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route(
      /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
      (route) => route.abort()
    )
    await page.addInitScript(() =>
      window.sessionStorage.setItem(
        'vdoc_admin_access_token',
        'users-browser-fixture'
      )
    )
    const admin = {
      id: 'admin',
      email: 'admin@example.test',
      name: 'Admin',
      is_super_admin: true,
      can_access_audit: true,
      status: 1,
    }
    const submissions: { password: string }[] = []
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
      }
      if (request.method() === 'OPTIONS')
        return route.fulfill({ status: 204, headers })
      const path = new URL(request.url()).pathname
      let detail: unknown = []
      if (path.endsWith('/identity/me')) detail = admin
      else if (path.endsWith('/system/users') && request.method() === 'GET')
        detail = [admin]
      else if (path.endsWith('/system/users') && request.method() === 'POST') {
        const payload = request.postDataJSON()
        submissions.push(payload)
        detail = { ...admin, ...payload, id: 'created', is_super_admin: false }
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
    await page.goto('/users')
    await expect(
      page.getByText('admin@example.test', { exact: true }).last()
    ).toBeVisible()
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    const main = page.locator('main#content')
    await expect(main).toHaveCount(1)
    await expect(main).toBeFocused()
    await page.keyboard.press('Tab')
    expect(
      await main.evaluate((el) => el.contains(document.activeElement))
    ).toBe(true)

    await page.getByLabel('Email', { exact: true }).fill('new@example.test')
    await page.getByLabel('Name', { exact: true }).fill('New user')
    const password = page.getByLabel('Password', { exact: true })
    for (const raw of [' password123456 ', '\u00a0password123456\u00a0']) {
      await password.fill(raw)
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(page.locator('[data-slot="alert-description"]')).toHaveText(
        'Use 12–72 UTF-8 bytes with no leading or trailing whitespace.'
      )
      expect(submissions).toHaveLength(0)
      await expect(password).toHaveValue(raw)
    }
    const valid = '密码 with internal spaces'
    await password.fill(valid)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect.poll(() => submissions.length).toBe(1)
    expect(submissions[0].password).toBe(valid)
    await expect(password).toHaveValue('')

    const a11y = await new AxeBuilder({ page })
      .withRules(['skip-link'])
      .analyze()
    expect(a11y.violations).toEqual([])
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const fontEvidence = []
    for (const font of ['inter', 'manrope']) {
      await page.evaluate((font) => {
        document.documentElement.classList.remove('font-inter', 'font-manrope')
        document.documentElement.classList.add(`font-${font}`)
      }, font)
      await page.evaluate(() => document.fonts.ready)
      const { root } = await cdp.send('DOM.getDocument')
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: 'h1',
      })
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', {
        nodeId,
      })
      const family = await page
        .locator('h1')
        .evaluate((el) => getComputedStyle(el).fontFamily)
      expect(family).toMatch(/, sans-serif$/)
      expect(fonts.length).toBeGreaterThan(0)
      expect(
        fonts.every(
          (value) =>
            !value.isCustomFont && !/Times|serif/i.test(value.familyName)
        )
      ).toBe(true)
      fontEvidence.push({ font, family, actualFonts: fonts })
    }
    await cdp.detach()
    await page.evaluate(() => {
      document.documentElement.classList.remove('font-manrope')
      document.documentElement.classList.add('font-inter')
      window.scrollTo(0, 0)
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await writeFile(
      testInfo.outputPath('evidence.json'),
      JSON.stringify(
        { width, fontEvidence, skipLinkViolations: a11y.violations },
        null,
        2
      )
    )
    await page.screenshot({
      path: testInfo.outputPath(`users-${width}.png`),
      fullPage: true,
    })
  })
}

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('token-free viewers remain safe and responsive', async ({ page }) => {
  await page.goto('/tests/browser/fixtures/viewers.html')

  await expect(
    page.getByRole('heading', { name: 'Public viewer fixtures' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Markdown document' })
  ).toBeVisible()
  await expect(page.getByText('openapi: 3.1.0')).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
  await expect(page.locator('script[data-unsafe-fixture]')).toHaveCount(0)

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
  }

  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

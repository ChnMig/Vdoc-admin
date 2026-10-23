import type { Locator } from '@playwright/test'

export async function selectOption(trigger: Locator, value: string) {
  const page = trigger.page()
  await trigger.and(page.getByRole('combobox')).click()
  const attributeValue = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\a ')
    .replace(/\r/g, '\\d ')
  await page
    .getByRole('option')
    .and(page.locator(`[data-value="${attributeValue}"]`))
    .click()
}

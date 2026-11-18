import { expect, test } from '@playwright/test'
import {
  installRepository,
  projectId,
  projectRepositoryPath,
} from '../support/repository-workflow'

for (const width of [1440, 390]) {
  test(`file search and failed catalog refresh recover in place at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await installRepository(page)
    let catalogUnavailable = false
    await page.route(`**${projectRepositoryPath}/documents`, async (route) => {
      if (!catalogUnavailable || route.request().method() !== 'GET')
        return route.fallback()
      return route.fulfill({
        json: {
          code: 403,
          status: 'FORBIDDEN',
          description: 'Document catalog access is unavailable.',
          timestamp: 1,
        },
      })
    })
    await page.goto(`/documents?team_id=commit-team&project_id=${projectId}`)
    const folder = page.getByRole('button', { name: 'guides', exact: true })
    const search = page.getByRole('textbox', {
      name: 'Search files',
      exact: true,
    })
    await expect(folder).toBeVisible()
    await search.fill('missing-document')
    await expect(
      page.getByText('No files or folders match this search.', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Clear search', exact: true })
      .click()
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('')
    await expect(folder).toBeVisible()
    catalogUnavailable = true
    await page
      .getByRole('button', { name: 'Refresh current folder', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'Document catalog access is unavailable.'
    )
    await expect(folder).toHaveCount(0)
    catalogUnavailable = false
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await expect(folder).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(api.unexpected).toEqual([])
  })

  test(`reader retains its identity while loading and offers a local retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await installRepository(page)
    let releaseContent!: () => void
    const contentGate = new Promise<void>((resolve) => {
      releaseContent = resolve
    })
    let contentUnavailable = true
    await page.route(
      '**/repository/commits/*/documents/*/content',
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        await contentGate
        if (!contentUnavailable) return route.fallback()
        return route.fulfill({
          json: {
            code: 403,
            status: 'FORBIDDEN',
            description: 'Document content access is unavailable.',
            timestamp: 1,
          },
        })
      }
    )
    try {
      await api.open()
      const reader = page.locator('[data-document-reading-pane]')
      const edit = page.getByRole('button', { name: 'Edit', exact: true })
      await expect(
        reader.getByRole('heading', { name: 'Shared guide', exact: true })
      ).toBeVisible()
      await expect(
        reader.getByText('guides/shared.md', { exact: true })
      ).toBeVisible()
      await expect(reader.getByRole('status')).toBeVisible()
      await expect(edit).toBeDisabled()
      releaseContent()
      await expect(page.getByRole('alert')).toContainText(
        'Document content access is unavailable.'
      )
      await expect(edit).toBeDisabled()
      contentUnavailable = false
      await page.getByRole('button', { name: 'Retry', exact: true }).click()
      await expect(
        page.getByText('Original saved body.', { exact: true })
      ).toBeVisible()
      await expect(edit).toBeEnabled()
      await edit.click()
      await expect(
        page.getByRole('textbox', { name: 'Content', exact: true })
      ).toHaveValue(api.initialBody.replace(/\r\n/g, '\n'))
      if (width >= 1280)
        await expect(
          page.getByRole('complementary', { name: 'On this page', exact: true })
        ).not.toBeVisible()
      expect(api.unexpected).toEqual([])
    } finally {
      releaseContent()
    }
  })
}

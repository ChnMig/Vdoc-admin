import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import {
  documentId,
  releaseBranchId,
  latestId,
  releaseId,
  mainDraftId,
  releaseDraftId,
  basePath,
  installWorkspace,
  chooseWorkspaceOption,
  openDocument,
  openTool,
} from '../support/document-workspace'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

for (const width of [1280, 390]) {
  test(`draft and published source review and persistent document chat at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(
      (theme) => {
        document.cookie = `vite-ui-theme=${theme}; path=/`
      },
      width === 390 ? 'dark' : 'light'
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const api = await installWorkspace(page)
    await openDocument(page)
    await expect(
      page.getByRole('link', { name: 'Open Vdoc on GitHub' })
    ).toHaveAttribute('href', 'https://github.com/ChnMig/Vdoc')
    await openTool(page, 'Diffs')
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'From version', exact: true }),
      latestId
    )
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'To branch', exact: true }),
      releaseBranchId
    )
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'To version', exact: true }),
      `draft:${releaseDraftId}`
    )
    await page.getByRole('button', { name: 'Compare', exact: true }).click()
    const diff = page.locator('section[aria-label="Source diff"]')
    await expect(diff.getByRole('table')).toContainText(
      'Release branch working draft'
    )
    await expect(diff.getByRole('table')).toContainText(
      'Integration handbook 2.4'
    )
    await expect(page.getByText(/Draft content snapshot/)).toBeVisible()
    expect(
      api.requests.filter(
        (request) =>
          request.method === 'POST' && request.path === `${basePath}/diffs`
      )
    ).toHaveLength(0)
    await diff.getByRole('button', { name: 'Split', exact: true }).click()
    await expect(
      diff.getByRole('button', { name: 'Split', exact: true })
    ).toHaveAttribute('aria-pressed', 'true')
    await diff.getByRole('button', { name: 'Show full context' }).click()
    await expect(
      diff.getByRole('button', { name: 'Changes with context' })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
    ).toBe(true)
    await diff.screenshot({
      path: info.outputPath('source-diff.png'),
      animations: 'disabled',
    })
    const a11y = await new AxeBuilder({ page })
      .include('section[aria-label="Source diff"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(a11y.violations).toEqual([])

    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'From version', exact: true }),
      `draft:${mainDraftId}`
    )
    await expect(diff).toHaveCount(0)
    await page.getByRole('button', { name: 'Compare', exact: true }).click()
    await expect(diff.getByRole('table')).toContainText(
      'Main branch working draft'
    )
    await expect(diff.getByRole('table')).toContainText(
      'Release branch working draft'
    )
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'From version', exact: true }),
      latestId
    )
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'To version', exact: true }),
      releaseId
    )
    await page.getByRole('button', { name: 'Compare', exact: true }).click()
    await expect(diff.getByRole('table')).toContainText(
      'Release candidate handbook'
    )
    await expect(
      page.getByRole('button', { name: 'Review semantic changes' })
    ).toBeVisible()
    await expect(page.getByLabel('Review filter')).toHaveCount(0)

    await openTool(page, 'Document AI')
    const message = page.getByLabel('AI chat message', { exact: true })
    await message.fill('Compare the reviewed and draft webhook policies.')
    await page
      .getByRole('button', { name: 'Close document AI', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Back to preview', exact: true })
      .click()
    await chooseWorkspaceOption(
      page.getByRole('combobox', { name: 'Branch', exact: true }),
      releaseBranchId
    )
    await openTool(page, 'Document AI')
    await expect(message).toHaveValue(
      'Compare the reviewed and draft webhook policies.'
    )
    await page.getByRole('button', { name: 'Send AI message' }).click()
    await expect
      .poll(
        () =>
          api.requests.find(
            (request) =>
              request.method === 'POST' &&
              request.path.endsWith('/ai/chat-sessions')
          )?.body?.context_type
      )
      .toBe('document')
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' &&
          request.path.endsWith('/ai/chat-sessions')
      )?.body
    ).toMatchObject({ document_id: documentId, context_id: documentId })
    expect(api.unexpected).toEqual([])
    expect(errors).toEqual([])
    // Reading-branch changes never become a different chat target.
    expect(
      api.requests
        .filter(
          (request) =>
            request.method === 'GET' &&
            request.path.endsWith('/ai/chat-sessions')
        )
        .every((request) => request.query.context_id === documentId)
    ).toBe(true)
  })
}

for (const width of [1280, 390]) {
  test(`legacy source links do not expose new share writes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await installWorkspace(page)
    await openDocument(page)
    await expect(
      page.getByRole('button', { name: 'Share', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Open project repository', exact: true })
    ).toBeVisible()
    expect(
      api.requests.filter(
        (request) =>
          request.method === 'POST' && request.path.endsWith('/shares')
      )
    ).toEqual([])
  })
}

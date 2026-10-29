import { expect, test, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  basePath,
  chooseWorkspaceOption,
  closeMobileFiles,
  historicalId,
  installWorkspace,
  latestId,
  mainBranchId,
  openDocument,
  openTool,
  projectId,
  releaseBranchId,
  releaseDraftId,
  releaseId,
  showFiles,
} from '../support/document-workspace'

const evidenceDirectory = resolve(
  '..',
  '.artifacts/document-workspace-interactions-20261025-beta10'
)
const browserErrors = new WeakMap<Page, string[]>()
const screenshots: Array<{ file: string; sha256: string; width: number }> = []

test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
})

test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([])
})

test.afterAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true })
  await writeFile(
    resolve(evidenceDirectory, 'screenshots.json'),
    JSON.stringify(
      { captured_at: new Date().toISOString(), screenshots },
      null,
      2
    )
  )
})

async function capture(page: Page, name: string, width: number) {
  await mkdir(evidenceDirectory, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
  const file = `${name}-${width}.png`
  const path = resolve(evidenceDirectory, file)
  await page.screenshot({
    path,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  })
  screenshots.push({
    file,
    sha256: createHash('sha256')
      .update(await readFile(path))
      .digest('hex'),
    width,
  })
}

async function closeAssistant(page: Page) {
  await page
    .getByRole('button', { name: 'Close document AI', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Document AI', exact: true })
  ).toHaveCount(0)
}

async function backToContent(page: Page) {
  await page
    .getByRole('button', { name: 'Back to preview', exact: true })
    .click()
  await expect(page.locator('[data-document-reading-pane]')).toBeVisible()
}

test('tool navigation retains the reader DOM, scroll, revision and browser document', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page, 'en', 'admin', true)
  const documentRequests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'document')
      documentRequests.push(new URL(request.url()).pathname)
  })
  await openDocument(page)
  const reader = page.locator('[data-document-reading-pane]')
  const readerNode = await reader.elementHandle()
  await reader.evaluate((element) => {
    element.scrollTop = 480
  })
  const initialScroll = await reader.evaluate((element) => element.scrollTop)
  expect(initialScroll).toBeGreaterThan(300)
  const hardNavigationCount = documentRequests.length
  const contentRequests = api.requests.filter((request) =>
    request.path.endsWith('/content/raw')
  ).length
  for (const name of ['Versions', 'Diffs'] as const) {
    await openTool(page, name)
    await expect(reader).toBeHidden()
    expect(
      await reader.evaluate((node, retained) => node === retained, readerNode)
    ).toBe(true)
    await expect(
      page.getByRole('tab', {
        name: name === 'Versions' ? 'Diffs' : 'Versions',
        exact: true,
      })
    ).toHaveCount(0)
  }
  await backToContent(page)
  await expect(page.locator('main#content')).toBeFocused()
  expect(
    await reader.evaluate((node, retained) => node === retained, readerNode)
  ).toBe(true)
  expect(await reader.evaluate((element) => element.scrollTop)).toBe(
    initialScroll
  )
  expect(documentRequests).toHaveLength(hardNavigationCount)
  expect(
    api.requests.filter((request) => request.path.endsWith('/content/raw'))
  ).toHaveLength(contentRequests)
  await expect(
    page.getByRole('combobox', { name: 'Version', exact: true })
  ).toHaveAttribute('value', latestId)
  expect(api.unexpected).toEqual([])
})

test('workspace folders remain local and repeated folder clicks do not add history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page)
  await page.goto(`/documents?team_id=workspace-team&project_id=${projectId}`)
  const documentRequests: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'document')
      documentRequests.push(request.url())
  })
  const guides = page.getByRole('button', { name: 'guides', exact: true })
  await guides.click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('folder_id'))
    .toBe('folder-guides')
  const historyLength = await page.evaluate(() => history.length)
  const folderUrl = page.url()
  await guides.click()
  await guides.click()
  expect(page.url()).toBe(folderUrl)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await page.getByRole('button', { name: 'Up one folder', exact: true }).click()
  await page.getByRole('button', { name: 'reference', exact: true }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('folder_id'))
    .toBe('folder-reference')
  await page.goBack()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('folder_id'))
    .toBe('root')
  await page.goBack()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('folder_id'))
    .toBe('folder-guides')
  expect(documentRequests).toEqual([])
  expect(api.unexpected).toEqual([])
})

test('selecting the current document preserves its branch, draft and revision', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page)
  await page.goto(
    `/documents/workspace-handbook?team_id=workspace-team&project_id=${projectId}&branch_id=${releaseBranchId}&content_mode=draft&draft_id=${releaseDraftId}`
  )
  await expect(
    page.getByRole('heading', {
      name: 'Release branch working draft',
      exact: true,
    })
  ).toBeVisible()
  await openTool(page, 'Versions')
  const tree = await showFiles(page)
  const currentUrl = page.url()
  const historyLength = await page.evaluate(() => history.length)
  await tree
    .getByRole('button', { name: 'Collapse guides', exact: true })
    .click()
  await tree.getByRole('button', { name: 'Expand guides', exact: true }).click()
  expect(page.url()).toBe(currentUrl)
  expect(await page.evaluate(() => history.length)).toBe(historyLength)
  await tree.getByRole('button', { name: /integration\.md/ }).click()
  await expect(page.locator('[data-document-reading-pane]')).toBeVisible()
  await expect(
    page.getByRole('combobox', { name: 'Branch', exact: true })
  ).toHaveAttribute('value', releaseBranchId)
  await expect(
    page.getByRole('combobox', { name: 'Content state', exact: true })
  ).toHaveAttribute('value', 'draft')
  await expect(
    page.getByRole('combobox', { name: 'Draft', exact: true })
  ).toHaveAttribute('value', releaseDraftId)
  expect(new URL(page.url()).searchParams.get('draft_id')).toBe(releaseDraftId)
  expect(api.unexpected).toEqual([])
})

test('cross-branch comparison sends the ordered pair and reuses stored history', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page, 'en', 'admin', false, {
    archivedReleaseBranch: true,
  })
  await openDocument(page)
  await openTool(page, 'Diffs')
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'From branch', exact: true }),
    mainBranchId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'From version', exact: true }),
    historicalId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To branch', exact: true }),
    releaseBranchId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To version', exact: true }),
    releaseId
  )
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Stored diff loaded', exact: true })
  ).toBeDisabled()
  const comparisons = () =>
    api.requests.filter(
      (request) =>
        request.method === 'POST' && request.path === `${basePath}/diffs`
    )
  expect(comparisons().map((request) => request.body)).toEqual([
    { from_version_id: historicalId, to_version_id: releaseId },
  ])
  await capture(page, 'cross-branch-diff', 1440)
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To branch', exact: true }),
    mainBranchId
  )
  await expect(
    page.getByRole('combobox', { name: 'From version', exact: true })
  ).toHaveAttribute('value', historicalId)
  await expect(
    page.getByRole('combobox', { name: 'To version', exact: true })
  ).toHaveAttribute('value', '')
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To branch', exact: true }),
    releaseBranchId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To version', exact: true }),
    releaseId
  )
  await expect(
    page.getByRole('button', { name: 'Stored diff loaded', exact: true })
  ).toBeDisabled()
  expect(comparisons()).toHaveLength(1)
  await page
    .getByRole('tab', { name: 'Stored diff history', exact: true })
    .click()
  await page
    .getByRole('button')
    .filter({ hasText: '2.3.0 → 3.0.0-rc.1' })
    .click()
  await expect(
    page.getByRole('tab', { name: 'Diff result', exact: true })
  ).toHaveAttribute('data-state', 'active')
  await expect(
    page.getByRole('combobox', { name: 'From branch', exact: true })
  ).toHaveAttribute('value', mainBranchId)
  await expect(
    page.getByRole('combobox', { name: 'To branch', exact: true })
  ).toHaveAttribute('value', releaseBranchId)
  expect(comparisons()).toHaveLength(1)
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'From branch', exact: true }),
    releaseBranchId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'From version', exact: true }),
    releaseId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To branch', exact: true }),
    mainBranchId
  )
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'To version', exact: true }),
    historicalId
  )
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Stored diff loaded', exact: true })
  ).toBeDisabled()
  expect(comparisons().map((request) => request.body)).toEqual([
    { from_version_id: historicalId, to_version_id: releaseId },
    { from_version_id: releaseId, to_version_id: historicalId },
  ])
  expect(api.unexpected).toEqual([])
})

test('desktop AI docks beside reading and retains conversation, input and DOM across breakpoints', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page)
  await openDocument(page)
  await chooseWorkspaceOption(
    page.getByRole('combobox', { name: 'Version', exact: true }),
    historicalId
  )
  await openTool(page, 'Document AI')
  const dialog = page.getByRole('dialog', { name: 'Document AI', exact: true })
  await expect(dialog).toBeVisible()
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(
    false
  )
  const reader = page.locator('[data-document-reading-pane]')
  await expect(reader).toBeVisible()
  // 动画中的两块区域必须在同一帧测量，避免混用不同布局帧。
  await expect
    .poll(() =>
      page.evaluate(() => {
        const reading = document
          .querySelector('[data-document-reading-pane]')!
          .getBoundingClientRect()
        const panel = document
          .querySelector('dialog[open]')!
          .getBoundingClientRect()
        return panel.left - reading.right
      })
    )
    .toBeGreaterThanOrEqual(-1)
  const input = page.getByLabel('AI chat message', { exact: true })
  const inputNode = await input.elementHandle()
  await input.fill('Explain this historical release.')
  await page
    .getByRole('button', { name: 'Send AI message', exact: true })
    .click()
  await expect(
    page.getByText('This answer uses the selected document revision.', {
      exact: false,
    })
  ).toBeVisible()
  const unsent = 'Keep this question while I read another section.'
  await input.fill(unsent)
  await closeAssistant(page)
  await openTool(page, 'Document AI')
  await expect(input).toHaveValue(unsent)
  expect(
    await input.evaluate((node, retained) => node === retained, inputNode)
  ).toBe(true)
  await expect(
    page.getByText('This answer uses the selected document revision.', {
      exact: false,
    })
  ).toBeVisible()
  await capture(page, 'ai-docked', 1440)
  await page.setViewportSize({ width: 768, height: 1000 })
  await expect
    .poll(() => dialog.evaluate((element) => element.matches(':modal')))
    .toBe(true)
  expect(
    await input.evaluate((node, retained) => node === retained, inputNode)
  ).toBe(true)
  await expect(input).toHaveValue(unsent)
  await capture(page, 'ai-modal', 768)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect
    .poll(() => dialog.evaluate((element) => element.matches(':modal')))
    .toBe(false)
  expect(
    await input.evaluate((node, retained) => node === retained, inputNode)
  ).toBe(true)
  await expect(input).toHaveValue(unsent)
  expect(
    api.requests.filter(
      (request) =>
        request.method === 'POST' && request.path.endsWith('/ai/chat-sessions')
    )
  ).toHaveLength(1)
  expect(api.unexpected).toEqual([])
})

for (const width of [390, 768, 1440]) {
  test(`responsive reading, settings and accessible AI at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await installWorkspace(page)
    await openDocument(page)
    await closeMobileFiles(page)
    await capture(page, 'reading', width)
    await openTool(page, 'Document settings')
    await expect(
      page.getByRole('tab', { name: 'Document details', exact: true })
    ).toHaveAttribute('data-state', 'active')
    await expect(
      page.getByRole('button', { name: 'Manage branches', exact: true })
    ).toHaveCount(0)
    await page.getByRole('tab', { name: 'Branches', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Create branch', exact: true })
    ).toBeVisible()
    await openTool(page, 'Versions')
    await openTool(page, 'Document settings')
    await expect(
      page.getByRole('tab', { name: 'Branches', exact: true })
    ).toHaveAttribute('data-state', 'active')
    await page
      .getByRole('tab', { name: 'Document details', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Edit', exact: true })
    ).toBeVisible()
    await capture(page, 'settings', width)
    await backToContent(page)
    await openTool(page, 'Document AI')
    const dialog = page.getByRole('dialog', {
      name: 'Document AI',
      exact: true,
    })
    await expect(
      page.getByLabel('AI chat message', { exact: true })
    ).toBeVisible()
    if (width < 1280) {
      expect(
        await dialog.evaluate((element) => element.matches(':modal'))
      ).toBe(true)
      await page.getByLabel('AI chat message', { exact: true }).focus()
      for (let index = 0; index < 14; index++) {
        await page.keyboard.press('Tab')
        const focusState = await dialog.evaluate((element) => ({
          inside: element.contains(document.activeElement),
          active: document.activeElement?.outerHTML.slice(0, 200),
        }))
        expect(
          focusState,
          `Tab step ${index + 1}: ${focusState.active}`
        ).toMatchObject({ inside: true })
      }
      for (let index = 0; index < 14; index++) {
        await page.keyboard.press('Shift+Tab')
        expect(
          await dialog.evaluate((element) =>
            element.contains(document.activeElement)
          )
        ).toBe(true)
      }
      const backgroundClick = await page
        .getByRole('button', { name: 'Share', exact: true })
        .click({ trial: true, timeout: 350 })
        .then(() => true)
        .catch(() => false)
      expect(backgroundClick).toBe(false)
    }
    await capture(page, 'ai-responsive', width)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(
      page
        .getByRole('navigation', { name: 'Document tools', exact: true })
        .filter({ visible: true })
        .getByRole('button', { name: 'Document AI', exact: true })
    ).toBeFocused()
    expect(api.unexpected).toEqual([])
  })
}

test('reduced motion removes spatial transitions while retaining tool navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page)
  await openDocument(page)
  await openTool(page, 'Versions')
  const active = page.locator(
    '[data-document-tool-pane][data-pane-active="true"]'
  )
  await expect(active).toBeVisible()
  const motion = await active.evaluate((element) => ({
    transform: getComputedStyle(element).transform,
    transitionDuration: getComputedStyle(element).transitionDuration,
    animationDuration: getComputedStyle(element).animationDuration,
  }))
  expect(motion.transform).toBe('none')
  expect(
    motion.transitionDuration
      .split(',')
      .every((value) => Number.parseFloat(value) <= 0.001)
  ).toBe(true)
  expect(
    motion.animationDuration
      .split(',')
      .every((value) => Number.parseFloat(value) <= 0.08)
  ).toBe(true)
  await openTool(page, 'Document AI')
  await expect(
    page.getByLabel('AI chat message', { exact: true })
  ).toBeVisible()
  await closeAssistant(page)
  expect(api.unexpected).toEqual([])
})

test('mobile AI history and send shortcut stay interactive inside the native dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 })
  const api = await installWorkspace(page, 'en', 'admin', false, {
    chatHistory: true,
  })
  await openDocument(page)
  await openTool(page, 'Document AI')
  const dialog = page.getByRole('dialog', { name: 'Document AI', exact: true })
  const historyButton = dialog.getByRole('button', {
    name: 'Chat history',
    exact: true,
  })
  await expect(
    dialog.getByText('Reviewed integration policy', { exact: true })
  ).toBeVisible()
  await historyButton.click()
  await dialog
    .getByRole('textbox', { name: 'Search conversations', exact: true })
    .fill('Release')
  await expect(
    dialog.getByRole('button', { name: /Release upgrade plan/ })
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: /Reviewed integration policy/ })
  ).toHaveCount(0)
  await dialog.getByRole('button', { name: /Release upgrade plan/ }).click()
  await expect(
    dialog.getByText('Release upgrade plan', { exact: true })
  ).toBeVisible()
  await expect
    .poll(() =>
      api.requests.some((request) =>
        request.path.endsWith('/chat-history-upgrade')
      )
    )
    .toBe(true)
  await historyButton.click()
  await dialog
    .getByRole('button', { name: 'Back to conversation', exact: true })
    .click()
  await dialog
    .getByRole('combobox', { name: 'Send shortcut', exact: true })
    .click()
  await expect(
    page.getByRole('option', { name: 'Enter to send', exact: true })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await page.getByLabel('AI chat message', { exact: true }).focus()
  for (const shortcut of ['Control+k', 'Meta+k']) {
    await page.keyboard.press(shortcut)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(dialog).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(api.unexpected).toEqual([])
})

test('AI yields to document forms across the mobile breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const api = await installWorkspace(page)
  await openDocument(page)
  await openTool(page, 'Document AI')
  await page
    .getByLabel('AI chat message', { exact: true })
    .fill('Retain my question while editing document settings.')
  await openTool(page, 'Document settings')
  await page.getByRole('tab', { name: 'Branches', exact: true }).click()
  await page.getByRole('button', { name: 'Create branch', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Create branch', exact: true })
  await form
    .getByLabel('Name', { exact: true })
    .fill('feature/retained-local-branch')
  const formInput = await form
    .getByLabel('Name', { exact: true })
    .elementHandle()
  await page.setViewportSize({ width: 390, height: 1000 })
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue(
    'feature/retained-local-branch'
  )
  expect(
    await form
      .getByLabel('Name', { exact: true })
      .evaluate((node, retained) => node === retained, formInput)
  ).toBe(true)
  expect(
    await page
      .locator('dialog.document-assistant-panel')
      .evaluate((element) => element.matches(':modal'))
  ).toBe(false)
  await form.getByLabel('Name', { exact: true }).focus()
  await page.keyboard.type('-mobile')
  await expect(form.getByLabel('Name', { exact: true })).toHaveValue(
    'feature/retained-local-branch-mobile'
  )
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: 'Document AI', exact: true })
  ).toBeVisible()
  await expect(page.getByLabel('AI chat message', { exact: true })).toHaveValue(
    'Retain my question while editing document settings.'
  )
  expect(api.requests.filter((request) => request.method === 'POST')).toEqual(
    []
  )
  expect(api.unexpected).toEqual([])
})

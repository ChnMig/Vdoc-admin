import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import {
  installWorkspace,
  openDocument,
  openTool,
  projectId,
  documentId,
} from '../support/document-workspace'

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3sAAAAASUVORK5CYII='
const answer =
  '## Comparison\n\n**Reviewed facts**\n\n- Published content is reviewed.\n- Saved drafts can still change.\n\n```ts\nconst revision = "2.4.0"\n```\n\n| Source | State |\n| --- | --- |\n| 2.4.0 | Published |\n\n[Reference](https://example.test/docs)'

test('reasoning persists per conversation and new-chat default; title failure preserves the answer', async ({
  page,
}) => {
  await installWorkspace(page)
  const api = await installConversations(page)
  await openDocument(page)
  await openTool(page, 'Document AI')
  const reasoning = page.getByRole('combobox', {
    name: 'Reasoning',
    exact: true,
  })
  await expect(reasoning).toHaveAttribute('value', 'default')
  await reasoning.click()
  await page
    .getByRole('option', { name: 'Reasoning: high', exact: true })
    .click()
  await expect(reasoning).toHaveAttribute('value', 'high')
  expect(api.sessions[0].reasoning_effort).toBe('high')
  await page.reload()
  await openTool(page, 'Document AI')
  await expect(reasoning).toHaveAttribute('value', 'high')
  await page
    .getByRole('button', { name: 'New conversation', exact: true })
    .click()
  await expect(reasoning).toHaveAttribute('value', 'high')
  api.failNextTitle()
  const input = page.getByRole('textbox', {
    name: 'AI chat message',
    exact: true,
  })
  await input.fill('Provisional title remains readable')
  await input.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Comparison', exact: true })
  ).toBeVisible()
  await expect.poll(api.titleCalls).toBe(1)
  expect(api.sessions[0]).toMatchObject({
    title: 'Provisional title remains readable',
    reasoning_effort: 'high',
    title_generated: false,
  })
  api.failNextSettings()
  await reasoning.click()
  await page
    .getByRole('option', { name: 'Reasoning: off', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('Settings unavailable')
  await expect(reasoning).toHaveAttribute('value', 'high')
  await reasoning.click()
  await page
    .getByRole('option', { name: 'Reasoning: off', exact: true })
    .click()
  await expect(reasoning).toHaveAttribute('value', 'none')
  await input.fill('Follow up on the document')
  await input.press('Enter')
  await expect.poll(api.titleCalls).toBe(2)
  await expect(
    page
      .locator('[data-chat-title]')
      .filter({ hasText: 'Document integration and revisions' })
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'New conversation', exact: true })
    .click()
  await expect(reasoning).toHaveAttribute('value', 'none')
  await reasoning.click()
  await page
    .getByRole('option', { name: 'Reasoning: default', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'New conversation', exact: true })
    .click()
  await expect(reasoning).toHaveAttribute('value', 'default')
})

for (const viewport of [
  { width: 1440, height: 640 },
  { width: 390, height: 640 },
]) {
  test(`chat keeps composer and menus inside the viewport at ${viewport.width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport)
    await installWorkspace(page)
    const api = await installConversations(page)
    api.messages.set('earlier-discussion', [
      {
        id: 'long-user',
        session_id: 'earlier-discussion',
        role: 'user',
        content: '请帮我分析这份文档的发布流程。',
        created_at: '2026-10-29T00:00:00Z',
      },
      {
        id: 'long-answer',
        session_id: 'earlier-discussion',
        role: 'assistant',
        content: `${answer}\n\n${'Long explanation with document facts.\n\n'.repeat(50)}`,
        created_at: '2026-10-29T00:01:00Z',
      },
    ])
    await openDocument(page)
    await openTool(page, 'Document AI')
    const avatar = page.locator('[data-chat-avatar]').first()
    await expect(avatar).toBeHidden()
    await page
      .getByRole('button', { name: 'Expand AI workspace', exact: true })
      .click()
    const panel = page.getByRole('dialog', { name: 'Document AI', exact: true })
    if (viewport.width > 600) await expect(avatar).toBeVisible()
    else await expect(avatar).toBeHidden()
    await expect(panel.locator('time').first()).toHaveAttribute(
      'datetime',
      '2026-10-29T00:00:00Z'
    )
    const input = page.getByRole('textbox', {
      name: 'AI chat message',
      exact: true,
    })
    await input.fill('A long draft\n'.repeat(25))
    for (const name of ['Reasoning', 'Send shortcut']) {
      await page.getByRole('combobox', { name, exact: true }).click()
      const menu = page.getByRole('listbox')
      await expect(menu).toBeVisible()
      const bounds = await menu.boundingBox()
      const dialog = await panel.boundingBox()
      expect(bounds!.y).toBeGreaterThanOrEqual(dialog!.y)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
        dialog!.y + dialog!.height + 1
      )
      await page.keyboard.press('Escape')
    }
    const geometry = await panel.evaluate((dialog) => {
      const form = dialog.querySelector('form')!.getBoundingClientRect()
      const transcript = dialog.querySelector('[role=log]')!
      return {
        outerOverflow: dialog.scrollHeight - dialog.clientHeight,
        transcriptOverflow: transcript.scrollHeight - transcript.clientHeight,
        composerBottom: form.bottom,
        bottom: dialog.getBoundingClientRect().bottom,
      }
    })
    expect(geometry.outerOverflow).toBeLessThanOrEqual(1)
    expect(geometry.transcriptOverflow).toBeGreaterThan(0)
    expect(geometry.composerBottom).toBeLessThanOrEqual(geometry.bottom)
    await page.screenshot({
      path: info.outputPath(`ai-chat-short-${viewport.width}.png`),
      animations: 'disabled',
    })
  })
}

async function installConversations(page: Page) {
  let count = 0
  const requests: Array<{
    content: string
    attachments?: unknown[]
    retry_of?: string
  }> = []
  const messages = new Map<string, unknown[]>()
  const sessions = [
    {
      id: 'earlier-discussion',
      title: 'Earlier integration discussion',
      title_generated: true,
      reasoning_effort: '',
      project_id: projectId,
      document_id: documentId,
      context_type: 'document',
      context_id: documentId,
      created_by: 'workspace-admin',
      created_at: '2026-10-28T00:00:00Z',
      updated_at: '2026-10-28T00:00:00Z',
    },
  ]
  messages.set('earlier-discussion', [
    {
      id: 'earlier-answer',
      session_id: 'earlier-discussion',
      role: 'assistant',
      content: 'Earlier saved answer',
      created_at: '2026-10-28T00:00:00Z',
    },
  ])
  let failNext = false
  let failNextTitle = false
  let failNextSettings = false
  let titleCalls = 0
  await page.route(
    /\/ai\/chat-sessions(?:\/[^/?]+(?:\/(?:messages|title))?)?(?:\?.*)?$/,
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      let detail: unknown
      if (url.pathname.endsWith('/title')) {
        titleCalls++
        if (failNextTitle) {
          failNextTitle = false
          return route.fulfill({
            json: {
              code: 503,
              status: 'FAILED_PRECONDITION',
              description: 'Title unavailable',
              detail: null,
              timestamp: 1,
            },
          })
        }
        const session = sessions.find(
          (item) => item.id === url.pathname.split('/').at(-2)
        )!
        session.title = 'Document integration and revisions'
        session.title_generated = true
        detail = session
      } else if (request.method() === 'PATCH') {
        if (failNextSettings) {
          failNextSettings = false
          return route.fulfill({
            json: {
              code: 503,
              status: 'FAILED_PRECONDITION',
              description: 'Settings unavailable',
              detail: null,
              timestamp: 1,
            },
          })
        }
        const session = sessions.find(
          (item) => item.id === url.pathname.split('/').at(-1)
        )!
        session.reasoning_effort = request.postDataJSON().reasoning_effort
        detail = session
      } else if (url.pathname.endsWith('/messages')) {
        const sessionId = url.pathname.split('/').at(-2)!
        const payload = request.postDataJSON()
        requests.push(payload)
        if (failNext) {
          failNext = false
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              code: 503,
              status: 'FAILED_PRECONDITION',
              description: 'Temporary provider failure',
              detail: null,
              timestamp: 1,
            }),
          })
        }
        const reply = {
          id: `answer-${requests.length}`,
          session_id: sessionId,
          role: 'assistant',
          content: answer,
          reasoning: 'I checked the **published sources** and prior decisions.',
          retry_of: payload.retry_of,
          created_at: '2026-10-29T00:00:00Z',
        }
        messages.set(sessionId, [
          ...(messages.get(sessionId) ?? []),
          ...(payload.retry_of
            ? []
            : [
                {
                  ...reply,
                  id: `user-${requests.length}`,
                  role: 'user',
                  content: payload.content,
                  attachments: payload.attachments,
                },
              ]),
          reply,
        ])
        detail = reply
      } else if (url.pathname.endsWith('/chat-sessions')) {
        if (request.method() === 'POST') {
          const session = {
            ...sessions[0],
            ...request.postDataJSON(),
            id: `conversation-${++count}`,
            title_generated: false,
            updated_at: '2026-10-29T00:00:00Z',
          }
          sessions.unshift(session)
          messages.set(session.id, [])
          detail = session
        } else detail = sessions
      } else {
        const id = url.pathname.split('/').at(-1)!
        detail = {
          session: sessions.find((session) => session.id === id),
          messages: messages.get(id) ?? [],
        }
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          code: 200,
          status: 'OK',
          detail,
          total: sessions.length,
          timestamp: 1,
        }),
      })
    }
  )
  return {
    requests,
    sessions,
    messages,
    titleCalls: () => titleCalls,
    failNextTitle: () => {
      failNextTitle = true
    },
    failNextSettings: () => {
      failNextSettings = true
    },
    failNext: () => {
      failNext = true
    },
  }
}

for (const width of [1440, 390]) {
  test(`chat supports shortcuts, files, history, markdown and expansion at ${width}px`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await context.addCookies([
      {
        name: 'vite-ui-theme',
        value: width === 390 ? 'dark' : 'light',
        url: baseURL!,
      },
    ])
    await installWorkspace(page)
    const api = await installConversations(page)
    await openDocument(page)
    await openTool(page, 'Document AI')
    await expect(
      page.getByText('Earlier saved answer', { exact: true })
    ).toBeVisible()
    const input = page.getByRole('textbox', {
      name: 'AI chat message',
      exact: true,
    })
    const send = page.getByRole('button', {
      name: 'Send AI message',
      exact: true,
    })
    await expect(send).toBeDisabled()
    await page
      .getByRole('button', { name: 'New conversation', exact: true })
      .click()
    await expect(
      page.getByText('Earlier saved answer', { exact: true })
    ).toHaveCount(0)
    await input.fill('Explain the uploaded context')
    await input.press('Shift+Enter')
    await expect(input).toHaveValue('Explain the uploaded context\n')
    expect(api.requests).toHaveLength(0)
    await input.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent('compositionstart', { bubbles: true })
      )
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
          cancelable: true,
        })
      )
      element.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true })
      )
    })
    expect(api.requests).toHaveLength(0)
    await page
      .getByRole('combobox', { name: 'Send shortcut', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'Ctrl / ⌘ + Enter', exact: true })
      .click()
    await input.press('Enter')
    expect(api.requests).toHaveLength(0)
    await expect(input).toHaveValue('Explain the uploaded context\n\n')
    await page.locator('input[type=file]').setInputFiles({
      name: 'notes.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Extra context\nAn exact attached fact.'),
    })
    await expect(
      page.getByRole('button', { name: 'Remove notes.md', exact: true })
    ).toBeVisible()
    await input.evaluate((element, data) => {
      const transfer = new DataTransfer()
      transfer.items.add(
        new File(
          [Uint8Array.from(atob(data), (char) => char.charCodeAt(0))],
          'screenshot.png',
          { type: 'image/png' }
        )
      )
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        })
      )
    }, png)
    await expect(
      page.getByRole('img', { name: 'screenshot.png', exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Preview screenshot.png', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Preview screenshot.png', exact: true })
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'Preview screenshot.png', exact: true })
    ).toBeHidden()
    await expect(
      page.getByRole('dialog', { name: 'Document AI', exact: true })
    ).toBeVisible()
    await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
    await expect(input).toBeHidden()
    await page.getByRole('tab', { name: 'AI chat', exact: true }).click()
    await expect(input).toHaveValue('Explain the uploaded context\n\n')
    await expect(
      page.getByRole('button', { name: 'Remove screenshot.png', exact: true })
    ).toBeVisible()
    const panel = page.getByRole('dialog', { name: 'Document AI', exact: true })
    const before = await panel.boundingBox()
    await page
      .getByRole('button', { name: 'Expand AI workspace', exact: true })
      .click()
    await expect(panel).toHaveAttribute('aria-modal', 'true')
    if (width > 1280)
      await expect
        .poll(async () => (await panel.boundingBox())!.width)
        .toBeGreaterThan(before!.width * 2)
    await expect(input).toHaveValue('Explain the uploaded context\n\n')
    // The select's popup must stay usable inside the native modal top layer.
    await page
      .getByRole('combobox', { name: 'Send shortcut', exact: true })
      .click()
    await page.keyboard.press('Escape')
    await expect(panel).toBeVisible()
    await input.press('Control+Enter')
    await expect(input).toHaveValue('')
    expect(api.requests).toHaveLength(1)
    expect(api.requests[0].attachments).toHaveLength(2)
    expect(api.requests[0].attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'notes.md',
          media_type: 'text/plain',
          data: Buffer.from(
            '# Extra context\nAn exact attached fact.'
          ).toString('base64'),
        }),
        expect.objectContaining({
          name: 'screenshot.png',
          media_type: 'image/png',
          data: png,
        }),
      ])
    )
    await expect(
      page.getByRole('heading', { name: 'Comparison', exact: true })
    ).toBeVisible()
    await expect(
      page
        .locator('[data-chat-role=assistant] strong')
        .filter({ hasText: 'Reviewed facts' })
    ).toHaveText('Reviewed facts')
    await expect(page.getByRole('table')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Copy code', exact: true })
    ).toBeVisible()
    const accessibility = await new AxeBuilder({ page })
      .include('dialog.document-assistant-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    const positions = await page.evaluate(() => {
      const user = document
        .querySelector('[data-chat-role=user]')!
        .lastElementChild!.getBoundingClientRect()
      const assistant = document
        .querySelector('[data-chat-role=assistant]')!
        .lastElementChild!.getBoundingClientRect()
      return { user: user.x, assistant: assistant.x }
    })
    expect(positions.user).toBeGreaterThanOrEqual(positions.assistant)
    await page.screenshot({
      path: info.outputPath(`ai-chat-expanded-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
    await page
      .getByRole('button', { name: 'Collapse AI workspace', exact: true })
      .click()
    await input.fill('Unsent question in the first new conversation')
    await page
      .getByRole('button', { name: 'Chat history', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Search conversations', exact: true })
      .fill('Earlier')
    await page
      .getByRole('button', { name: /Earlier integration discussion/ })
      .click()
    await expect(
      page.getByText('Earlier saved answer', { exact: true })
    ).toBeVisible()
    await expect(input).toHaveValue('')
    await page
      .getByRole('button', { name: 'Chat history', exact: true })
      .click()
    await page
      .getByRole('button', { name: /Document integration and revisions/ })
      .click()
    await expect(input).toHaveValue(
      'Unsent question in the first new conversation'
    )
    await page
      .getByRole('button', { name: 'New conversation', exact: true })
      .click()
    await expect(input).toHaveValue('')
    await page.locator('input[type=file]').setInputFiles({
      name: 'not-supported.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('binary'),
    })
    await expect(page.getByRole('alert')).toContainText('Choose PNG')
    await page.locator('input[type=file]').setInputFiles({
      name: 'reference.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nTest reference'),
    })
    await expect(
      page.getByRole('button', { name: 'Remove reference.pdf', exact: true })
    ).toBeVisible()
    api.failNext()
    await send.click()
    await expect(page.getByRole('alert')).toContainText(
      'Your message and attachments are kept'
    )
    await expect(
      page.getByRole('button', { name: 'Remove reference.pdf', exact: true })
    ).toBeVisible()
    await send.click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(input).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Remove reference.pdf', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Download reference.pdf', exact: true })
    ).toBeVisible()
    expect(api.requests.at(-1)).toMatchObject({
      content: '',
      attachments: [expect.objectContaining({ name: 'reference.pdf' })],
    })
    await input.fill('Keep through closing and reopening')
    await page
      .getByRole('button', { name: 'Close document AI', exact: true })
      .click()
    await openTool(page, 'Document AI')
    await expect(input).toHaveValue('Keep through closing and reopening')
    await expect(
      page.getByRole('combobox', { name: 'Send shortcut', exact: true })
    ).toHaveAttribute('value', 'modifier')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.reload()
    await openTool(page, 'Document AI')
    await expect(
      page.getByRole('combobox', { name: 'Send shortcut', exact: true })
    ).toHaveAttribute('value', 'modifier')
    expect(errors).toEqual([])
  })
}

test('Chinese chat stays usable in a short mobile viewport and rejects invalid files', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 667 })
  await installWorkspace(page, 'zh-CN')
  const api = await installConversations(page)
  await page.goto(
    `/documents/${documentId}?team_id=workspace-team&project_id=${projectId}&content_mode=published`
  )
  await page.getByRole('button', { name: '文档 AI', exact: true }).click()
  await page.getByRole('button', { name: '新建对话', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'AI 聊天消息', exact: true })
  await input.fill('这份文档有哪些重点？')
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from([0xff, 0xfe]),
  })
  await expect(page.getByRole('alert')).toContainText('UTF-8')
  await expect(input).toHaveValue('这份文档有哪些重点？')
  await page.locator('input[type=file]').setInputFiles(
    Array.from({ length: 5 }, (_, index) => ({
      name: `${index}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('text'),
    }))
  )
  await expect(page.getByRole('alert')).toContainText('最多添加 4 个附件')
  await page.locator('input[type=file]').setInputFiles({
    name: '太大.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(101 * 1024, 'a'),
  })
  await expect(page.getByRole('alert')).toContainText('100 KB')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  expect(api.requests).toHaveLength(1)
  const bounds = await input.boundingBox()
  expect(bounds!.y + bounds!.height).toBeLessThan(667)
  await expect(
    page.getByRole('button', { name: '发送 AI 消息', exact: true })
  ).toBeInViewport()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: info.outputPath('ai-chat-chinese-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
})

for (const width of [1440, 390]) {
  test(`reasoning, regeneration and detailed recovery work at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 640 })
    await installWorkspace(page)
    const api = await installConversations(page)
    await openDocument(page)
    await openTool(page, 'Document AI')
    await page
      .getByRole('button', { name: 'New conversation', exact: true })
      .click()
    const input = page.getByRole('textbox', {
      name: 'AI chat message',
      exact: true,
    })
    await input.fill('Keep the deadline 2031-09-19')
    await input.press('Enter')
    const transcript = page.getByRole('log')
    await expect(transcript.locator('[data-chat-role=user]')).toHaveCount(1)
    const summary = transcript
      .locator('summary')
      .filter({ hasText: 'Reasoning summary' })
    await expect(summary).toBeVisible()
    await summary.click()
    await expect(
      transcript.getByText('published sources', { exact: true })
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Expand AI workspace', exact: true })
      .click()
    api.failNext()
    await page
      .getByRole('button', { name: 'Regenerate answer', exact: true })
      .click()
    await expect(page.getByRole('alert')).toContainText(
      'The previous answer is kept'
    )
    await expect(transcript.locator('[data-chat-role=user]')).toHaveCount(1)
    await expect(
      transcript.getByRole('heading', { name: 'Comparison' })
    ).toBeVisible()
    await page
      .getByRole('alert')
      .getByRole('button', { name: 'Retry', exact: true })
      .click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(transcript.locator('[data-chat-role=user]')).toHaveCount(1)
    await expect(
      transcript.getByRole('heading', { name: 'Comparison' })
    ).toHaveCount(1)
    expect(api.requests[1].retry_of).toBe('answer-1')
    expect(api.requests[2].retry_of).toBe('answer-1')
    await expect(input).toHaveValue('')
    await page.route(/\/ai\/chat-sessions\/[^/]+\/messages$/, async (route) => {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          'event: context\ndata: {"status":"compacting","summary_count":8}\n\n',
          'event: reasoning\ndata: {"delta":"Checking the deadline and constraints."}\n\n',
          'event: delta\ndata: {"delta":"An incomplete reply"}\n\n',
          'event: error\ndata: ' +
            JSON.stringify({
              code: 412,
              status: 'FAILED_PRECONDITION',
              message: 'The AI provider is rate limited.',
              trace_id: 'trace-fixture',
              detail: {
                ai_error: {
                  code: 'rate_limit',
                  message: 'The AI provider is rate limited.',
                  provider_message: 'Please reduce request frequency.',
                  retryable: true,
                  upstream_status: 429,
                  retry_after_seconds: 12,
                  provider_request_id: 'request-fixture',
                },
              },
            }) +
            '\n\n',
        ].join(''),
      })
    })
    await input.fill('Failed streaming follow-up')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toContainText('rate limited')
    await expect(
      transcript.getByText('An incomplete reply', { exact: true })
    ).toBeVisible()
    await expect(
      transcript.getByText('This reply is incomplete', { exact: false })
    ).toBeVisible()
    await expect(input).toHaveValue('Failed streaming follow-up')
    await page.getByText('Technical details', { exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('HTTP 429')
    await expect(page.getByRole('alert')).toContainText('request-fixture')
    const panel = page.getByRole('dialog', { name: 'Document AI', exact: true })
    expect(
      await panel.evaluate((node) => node.scrollHeight - node.clientHeight)
    ).toBeLessThanOrEqual(1)
    await expect(
      page.getByRole('button', { name: 'Send AI message', exact: true })
    ).toBeInViewport()
    await page.screenshot({
      path: info.outputPath(`ai-chat-recovery-${width}.png`),
      animations: 'disabled',
    })
  })
}

import { expect, test } from '@playwright/test'
import { createServer, type ServerResponse } from 'node:http'
import {
  installWorkspace,
  openDocument,
  openTool,
} from '../support/document-workspace'

// A real local HTTP response is required: route.fulfill buffers its whole body.
for (const width of [1280, 390]) {
  test(`chat renders HTTP stream chunks before completion and accepts JSON at ${width}px`, async ({
    page,
    context,
    baseURL,
  }, info) => {
    let pending: ServerResponse | undefined
    let mode: 'stream' | 'json' = 'stream'
    let requestHeaders: Record<string, string | string[] | undefined> = {}
    const savedMessage = {
      id: 'streamed-answer',
      session_id: 'chat-exact-revision',
      role: 'assistant',
      content: 'The complete saved answer replaces the temporary fragments.',
      created_at: '2026-10-28T00:00:00Z',
    }
    const envelope = (detail: unknown) =>
      JSON.stringify({ code: 200, status: 'OK', timestamp: 1, detail })
    const server = createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, Accept'
      )
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      request.resume()
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      requestHeaders = request.headers
      if (mode === 'json') {
        response.setHeader('Content-Type', 'application/json')
        response.end(
          envelope({
            ...savedMessage,
            id: 'json-answer',
            content: 'The non-streaming answer arrives complete.',
          })
        )
        return
      }
      pending = response
      response.setHeader('Content-Type', 'text/event-stream')
      response.setHeader('Cache-Control', 'no-store')
      response.flushHeaders()
      response.write(
        'event: delta\ndata: {"delta":"This text is visible while generation is still running."}\n\n'
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing local streaming server')
    const origin = `http://127.0.0.1:${address.port}`
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.setViewportSize({ width, height: 900 })
      await context.addCookies([
        {
          name: 'vite-ui-theme',
          value: width === 390 ? 'dark' : 'light',
          url: baseURL!,
        },
      ])
      await installWorkspace(page)
      await page.addInitScript(
        (url) =>
          Object.assign(window, { __VDOC_ADMIN_CONFIG__: { apiBaseUrl: url } }),
        origin
      )
      await page.route('**/ai/chat-sessions/*/messages', (route) =>
        route.continue()
      )
      await openDocument(page)
      await openTool(page, 'Document AI')
      const input = page.getByLabel('AI chat message', { exact: true })
      await input.fill('Explain the document progressively.')
      await page
        .getByRole('button', { name: 'Send AI message', exact: true })
        .click()
      await expect(
        page.getByText(
          'This text is visible while generation is still running.',
          { exact: false }
        )
      ).toBeVisible()
      await expect(
        page.getByText('Generating answer…', { exact: true })
      ).toBeVisible()
      expect(requestHeaders.accept).toBe('text/event-stream, application/json')
      expect(requestHeaders.authorization).toBe('synthetic-workspace-session')
      expect(pending?.writableEnded).toBe(false)
      await page.getByRole('tab', { name: 'AI summary', exact: true }).click()
      await expect(input).toBeHidden()
      await page.getByRole('tab', { name: 'AI chat', exact: true }).click()
      await expect(
        page.getByText('Generating answer…', { exact: true })
      ).toBeVisible()
      const transcript = await page
        .getByRole('log', { name: 'Conversation messages', exact: true })
        .boundingBox()
      expect(transcript!.height).toBeGreaterThan(300)
      const log = page.getByRole('log', {
        name: 'Conversation messages',
        exact: true,
      })
      pending!.write(
        `event: delta\ndata: ${JSON.stringify({ delta: Array.from({ length: 60 }, (_, index) => `\n\nParagraph ${index}: a longer streamed answer remains inside the transcript.`).join('') })}\n\n`
      )
      await expect
        .poll(() =>
          log.evaluate((node) => node.scrollHeight > node.clientHeight)
        )
        .toBe(true)
      await expect
        .poll(() =>
          log.evaluate(
            (node) => node.scrollHeight - node.scrollTop - node.clientHeight
          )
        )
        .toBeLessThan(80)
      await log.evaluate((node) => {
        node.scrollTop = 0
        node.dispatchEvent(new Event('scroll'))
      })
      await expect(
        page.getByRole('button', { name: 'Latest message', exact: true })
      ).toBeVisible()
      pending!.write(
        'event: delta\ndata: {"delta":"\\n\\nA new fragment must not pull the reader away from earlier text."}\n\n'
      )
      await expect(
        page.getByText(
          'A new fragment must not pull the reader away from earlier text.',
          { exact: true }
        )
      ).toBeAttached()
      expect(await log.evaluate((node) => node.scrollTop)).toBeLessThan(20)
      await page
        .getByRole('button', { name: 'Latest message', exact: true })
        .click()
      await expect
        .poll(() =>
          log.evaluate(
            (node) => node.scrollHeight - node.scrollTop - node.clientHeight
          )
        )
        .toBeLessThan(80)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: info.outputPath(`chat-streaming-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
      pending!.end(`event: done\ndata: ${envelope(savedMessage)}\n\n`)
      await expect(
        page.getByText(savedMessage.content, { exact: false })
      ).toBeVisible()
      await expect(
        page.getByText('Generating answer…', { exact: true })
      ).toHaveCount(0)
      await expect(input).toHaveValue('')
      await expect(
        page.getByText(
          'This text is visible while generation is still running.',
          { exact: false }
        )
      ).toHaveCount(0)
      mode = 'json'
      await input.fill('Now request a complete answer.')
      await page
        .getByRole('button', { name: 'Send AI message', exact: true })
        .click()
      await expect(
        page.getByText('The non-streaming answer arrives complete.', {
          exact: false,
        })
      ).toBeVisible()
      await expect(input).toHaveValue('')
      mode = 'stream'
      await input.fill('Stop this request and keep my input.')
      await page
        .getByRole('button', { name: 'Send AI message', exact: true })
        .click()
      await expect(
        page.getByText('Generating answer…', { exact: true })
      ).toBeVisible()
      await page
        .getByRole('button', { name: 'Stop generating', exact: true })
        .click()
      await expect(
        page.getByText('Generating answer…', { exact: true })
      ).toHaveCount(0)
      await expect(input).toHaveValue('Stop this request and keep my input.')
      expect(errors).toEqual([])
    } finally {
      pending?.destroy()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })
}

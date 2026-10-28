import { describe, expect, it } from 'vitest'
import { readServerEvents } from './server-events'

describe('server events', () => {
  it('preserves split UTF-8, CRLF, multiline data and immediate terminal events', async () => {
    const source =
      ': ping\r\n\r\nevent: delta\r\ndata: 你好\r\ndata: 世界\r\n\r\nevent: done\ndata: saved\n\n'
    const bytes = new TextEncoder().encode(source)
    const received: string[][] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    })
    await readServerEvents(stream, (event, data) => {
      received.push([event, data])
      return event === 'done'
    })
    expect(received).toEqual([
      ['delta', '你好\n世界'],
      ['done', 'saved'],
    ])
  })

  it('cancels the transport when processing fails', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: error\ndata: failure\n\n')
        )
      },
      cancel() {
        cancelled = true
      },
    })
    await expect(
      readServerEvents(stream, () => {
        throw new Error('Failed')
      })
    ).rejects.toThrow('Failed')
    expect(cancelled).toBe(true)
  })
})

// Decode transport chunks independently of SSE events, including split UTF-8 and CRLF.
export async function readServerEvents(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => boolean
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let event = ''
  let data: string[] = []
  let bytes = 0
  let completed = false
  const line = (value: string) => {
    if (value === '') {
      const done = data.length > 0 && onEvent(event, data.join('\n'))
      event = ''
      data = []
      return done
    }
    const separator = value.indexOf(':')
    const field = separator < 0 ? value : value.slice(0, separator)
    const content =
      separator < 0 ? '' : value.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') event = content
    if (field === 'data') data.push(content)
    return false
  }
  try {
    while (!completed) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 8 * 1024 * 1024) throw new Error('AI response is too large.')
      pending += decoder.decode(next.value, { stream: true })
      let boundary: number
      while ((boundary = pending.indexOf('\n')) >= 0) {
        const current = pending.slice(0, boundary).replace(/\r$/, '')
        pending = pending.slice(boundary + 1)
        if (line(current)) {
          completed = true
          break
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* The transport may already be aborted. */
    }
    reader.releaseLock()
  }
}

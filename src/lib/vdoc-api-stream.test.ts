import { AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAIRequestError, sendAIChatMessage, vdocApi } from './vdoc-api'

const message = {
  id: 'reply-1',
  session_id: 'session-1',
  role: 'assistant',
  content: '你好 world',
  created_at: '2026-10-28T00:00:00Z',
}
const envelope = { code: 200, status: 'OK', timestamp: 1, detail: message }

function mockResponse(body: string, contentType = 'text/event-stream') {
  const data = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(body)
      for (let index = 0; index < bytes.length; index += 3)
        controller.enqueue(bytes.slice(index, index + 3))
      controller.close()
    },
  })
  return vi.spyOn(vdocApi, 'post').mockResolvedValue({
    data,
    headers: new AxiosHeaders({ 'content-type': contentType }),
  } as AxiosResponse)
}

afterEach(() => vi.restoreAllMocks())

describe('streaming AI chat API', () => {
  it('routes reasoning and context events separately and sends the retry ID', async () => {
    const post = mockResponse(
      'event: context\ndata: {"status":"compacting","summary_count":2}\n\n' +
        'event: reasoning\ndata: {"delta":"检查早期事实"}\n\n' +
        'event: delta\ndata: {"delta":"答案"}\n\n' +
        'event: done\ndata: ' +
        JSON.stringify(envelope) +
        '\n\n'
    )
    const onReasoning = vi.fn()
    const onContext = vi.fn()
    const onDelta = vi.fn()
    await sendAIChatMessage('project-1', 'session-1', '', {
      retryOf: 'previous-answer',
      onDelta,
      onReasoning,
      onContext,
    })
    expect(post.mock.calls[0]?.[1]).toEqual({
      content: '',
      retry_of: 'previous-answer',
    })
    expect(onReasoning).toHaveBeenCalledWith('检查早期事实')
    expect(onDelta).toHaveBeenCalledWith('答案')
    expect(onContext).toHaveBeenCalledWith({
      status: 'compacting',
      summary_count: 2,
    })
  })

  it('preserves structured provider errors for recovery and diagnostics', async () => {
    const ai_error = {
      code: 'rate_limit',
      message: 'Wait before retrying',
      retryable: true,
      upstream_status: 429,
      retry_after_seconds: 10,
      provider_request_id: 'request-123',
    }
    mockResponse(
      'event: error\ndata: ' +
        JSON.stringify({
          code: 412,
          status: 'FAILED_PRECONDITION',
          message: ai_error.message,
          detail: { ai_error },
          trace_id: 'trace-123',
        }) +
        '\n\n'
    )
    try {
      await sendAIChatMessage('project-1', 'session-1', 'Explain', {
        onDelta: vi.fn(),
      })
      expect.unreachable('provider error should reject')
    } catch (error) {
      expect(getAIRequestError(error)).toEqual(ai_error)
    }
  })
  it('negotiates SSE, decodes deltas and returns only the final saved message', async () => {
    const post = mockResponse(
      'event: delta\ndata: {"delta":"你好 "}\n\nevent: delta\ndata: {"delta":"world"}\n\nevent: done\ndata: ' +
        JSON.stringify(envelope) +
        '\n\n'
    )
    const onDelta = vi.fn()
    const signal = new AbortController().signal
    const request = sendAIChatMessage('project-1', 'session-1', 'Explain', {
      signal,
      onDelta,
    })
    // Request interceptors must capture this session before any async boundary.
    expect(post).toHaveBeenCalledTimes(1)
    await expect(request).resolves.toEqual(message)
    expect(onDelta.mock.calls).toEqual([['你好 '], ['world']])
    expect(post).toHaveBeenCalledWith(
      '/api/v1/private/projects/project-1/ai/chat-sessions/session-1/messages',
      { content: 'Explain' },
      expect.objectContaining({
        adapter: 'fetch',
        responseType: 'stream',
        signal,
        headers: { Accept: 'text/event-stream, application/json' },
      })
    )
  })

  it('accepts the JSON result from a non-streaming provider', async () => {
    mockResponse(JSON.stringify(envelope), 'application/json; charset=utf-8')
    const onDelta = vi.fn()
    await expect(
      sendAIChatMessage('project-1', 'session-1', 'Explain', { onDelta })
    ).resolves.toEqual(message)
    expect(onDelta).not.toHaveBeenCalled()
  })

  it.each([
    {
      body: 'event: delta\ndata: {"delta":"partial"}\n\n',
      error: 'ended before completion',
    },
    {
      body: 'event: error\ndata: {"code":412,"status":"FAILED_PRECONDITION","description":"Provider interrupted","timestamp":1}\n\n',
      error: 'Provider interrupted',
    },
    {
      body: 'event: delta\ndata: {"delta":123}\n\n',
      error: 'Invalid AI stream event',
    },
    {
      body:
        'event: done\ndata: ' +
        JSON.stringify({
          ...envelope,
          detail: { ...message, session_id: 'another-session' },
        }) +
        '\n\n',
      error: 'Invalid AI stream completion',
    },
  ])(
    'rejects incomplete, failed or mismatched responses: $error',
    async ({ body, error }) => {
      mockResponse(body)
      await expect(
        sendAIChatMessage('project-1', 'session-1', 'Explain', {
          onDelta: vi.fn(),
        })
      ).rejects.toThrow(error)
    }
  )
})

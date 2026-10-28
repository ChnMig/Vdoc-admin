import { readServerEvents } from './server-events'
import {
  unwrapEnvelope,
  VdocApiError,
  vdocApi,
  type AIChatMessageDTO,
  type RequestOptions,
  type VdocEnvelope,
} from './vdoc-api'

export async function sendStreamingAIChatMessage(
  projectId: string,
  sessionId: string,
  content: string,
  options: RequestOptions & { onDelta?: (delta: string) => void }
) {
  const response = await vdocApi.post<ReadableStream<Uint8Array>>(
    `/api/v1/private/projects/${projectId}/ai/chat-sessions/${sessionId}/messages`,
    { content },
    {
      adapter: 'fetch',
      responseType: 'stream',
      signal: options.signal,
      headers: { Accept: 'text/event-stream, application/json' },
    }
  )
  if (
    !String(response.headers['content-type']).startsWith('text/event-stream')
  ) {
    const envelope: VdocEnvelope<AIChatMessageDTO> = await new Response(
      response.data
    ).json()
    return unwrapEnvelope(Promise.resolve({ data: envelope }))
  }
  let message: AIChatMessageDTO | undefined
  await readServerEvents(response.data, (event, data) => {
    options.signal?.throwIfAborted()
    if (event === 'delta') {
      const chunk = JSON.parse(data) as { delta: string }
      if (typeof chunk.delta !== 'string')
        throw new Error('Invalid AI stream event.')
      options.onDelta?.(chunk.delta)
    } else if (event === 'done' || event === 'error') {
      const envelope = JSON.parse(data) as VdocEnvelope<AIChatMessageDTO>
      if (envelope.code !== 200 || envelope.status !== 'OK')
        throw new VdocApiError(envelope)
      if (
        event !== 'done' ||
        !envelope.detail?.id ||
        envelope.detail.session_id !== sessionId
      ) {
        throw new Error('Invalid AI stream completion.')
      }
      message = envelope.detail
      return true
    }
    return false
  })
  if (!message)
    throw new Error('AI stream ended before completion. Please retry.')
  return message
}

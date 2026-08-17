import { z } from 'zod'
import {
  filenameFromContentDisposition,
  isAttachmentContentDisposition,
} from './content-disposition'
import type {
  DocumentShareId,
  DocumentShareSecret,
  PublicVersionId,
} from './document-share-url'
import {
  parsePublicShareOrigin,
  resolvePublicShareApiBaseUrl,
} from './public-share-config'

const publicVersionSchema = z
  .object({
    id: z.string().regex(/^[0-9a-f]{32}$/),
    version_name: z.string(),
    changelog: z.string().optional(),
    published_at: z.string().datetime({ offset: true }),
  })
  .strict()

const publicShareMetadataSchema = z
  .object({
    document_name: z.string(),
    document_type: z.union([z.literal(1), z.literal(2)]),
    version_scope: z.union([z.literal(1), z.literal(2)]),
    expires_at: z.string().datetime({ offset: true }).optional(),
    current_version: publicVersionSchema,
  })
  .strict()

const publicShareContentSchema = z
  .object({
    version_id: z.string().regex(/^[0-9a-f]{32}$/),
    content: z.string(),
  })
  .strict()

const publicEnvelopeSchema = z
  .object({
    code: z.number(),
    status: z.string(),
    description: z.string(),
    message: z.string().optional(),
    trace_id: z.string().optional(),
    timestamp: z.number(),
    detail: z.unknown().optional(),
    total: z.number().optional(),
  })
  .strict()

export type PublicVersionDTO = z.infer<typeof publicVersionSchema>
export type PublicShareMetadataDTO = z.infer<typeof publicShareMetadataSchema>
export type PublicShareContentDTO = z.infer<typeof publicShareContentSchema>

type PublicShareRequest = {
  readonly baseUrl?: string
  readonly shareId: DocumentShareId
  readonly secret: DocumentShareSecret
  readonly signal: AbortSignal
  readonly unlockProof?: string
}

type PublicShareVersionRequest = PublicShareRequest & {
  readonly versionId: PublicVersionId
}

export type PublicShareDownload = {
  readonly blob: Blob
  readonly filename: string
  readonly mimeType: string
}

export const PUBLIC_SHARE_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024
export const PUBLIC_SHARE_REQUEST_TIMEOUT_MS = 15_000

const publicShareUnlockSchema = z
  .object({
    unlock_proof: z.string().min(1),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict()

export type PublicShareUnlockDTO = z.infer<typeof publicShareUnlockSchema>

export class PublicShareRequestError extends Error {
  readonly name = 'PublicShareRequestError'

  constructor(
    readonly code: number | undefined,
    readonly status: string | undefined
  ) {
    super('Public share request failed')
  }
}

export async function getPublicShareMetadata(
  request: PublicShareRequest
): Promise<PublicShareMetadataDTO> {
  return publicShareRequest(request, '', (response) =>
    parsePublicDetail(response, publicShareMetadataSchema)
  )
}

export async function unlockPublicShare(
  request: PublicShareRequest & { readonly password: string }
): Promise<PublicShareUnlockDTO> {
  return publicShareRequest(
    request,
    '/unlock',
    (response) => parsePublicDetail(response, publicShareUnlockSchema),
    {
      method: 'POST',
      body: JSON.stringify({ password: request.password }),
    }
  )
}

export async function listPublicShareVersions(
  request: PublicShareRequest
): Promise<readonly PublicVersionDTO[]> {
  return publicShareRequest(request, '/versions', (response) =>
    parsePublicDetail(response, z.array(publicVersionSchema))
  )
}

export async function getPublicShareContent(
  request: PublicShareVersionRequest
): Promise<PublicShareContentDTO> {
  return publicShareRequest(
    request,
    `/versions/${request.versionId}/content`,
    (response) => parsePublicDetail(response, publicShareContentSchema)
  )
}

export async function downloadPublicShareVersion(
  request: PublicShareVersionRequest
): Promise<PublicShareDownload> {
  return publicShareRequest(
    request,
    `/versions/${request.versionId}/download`,
    async (response) => {
      const disposition = response.headers.get('Content-Disposition')
      if (
        response.status !== 200 ||
        !isAttachmentContentDisposition(disposition)
      ) {
        await parsePublicEnvelope(response)
        throw new PublicShareRequestError(undefined, undefined)
      }

      const mimeType = response.headers.get('Content-Type') ?? ''
      if (declaredBodyExceedsLimit(response, PUBLIC_SHARE_DOWNLOAD_MAX_BYTES)) {
        try {
          await response.body?.cancel()
        } catch {
          // The sanitized size error below is authoritative.
        }
        throw new PublicShareRequestError(413, 'RESPONSE_TOO_LARGE')
      }
      const blob = await response.blob()
      if (blob.size > PUBLIC_SHARE_DOWNLOAD_MAX_BYTES)
        throw new PublicShareRequestError(413, 'RESPONSE_TOO_LARGE')
      return {
        blob,
        filename: filenameFromContentDisposition(disposition, mimeType),
        mimeType,
      }
    }
  )
}

function declaredBodyExceedsLimit(response: Response, limit: number): boolean {
  const value = response.headers.get('Content-Length')
  if (value === null || !/^\d+$/.test(value)) return false
  const length = Number(value)
  return !Number.isSafeInteger(length) || length > limit
}

export function savePublicShareDownload(download: PublicShareDownload): void {
  const objectUrl = URL.createObjectURL(download.blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = download.filename
  anchor.hidden = true
  document.body.append(anchor)
  let clickCompleted = false
  try {
    anchor.click()
    clickCompleted = true
  } finally {
    anchor.remove()
    if (clickCompleted) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } else {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

async function publicShareRequest<T>(
  request: PublicShareRequest,
  suffix: string,
  consume: (response: Response) => Promise<T>,
  init?: Pick<RequestInit, 'method' | 'body'>
): Promise<T> {
  const origin =
    request.baseUrl === undefined
      ? resolvePublicShareApiBaseUrl()
      : parsePublicShareOrigin(request.baseUrl)
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(request.signal.reason)
  if (request.signal.aborted) forwardAbort()
  else request.signal.addEventListener('abort', forwardAbort, { once: true })
  let timedOut = false
  let timeoutId = 0
  const timeoutError = new PublicShareRequestError(408, 'REQUEST_TIMEOUT')
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
      reject(timeoutError)
    }, PUBLIC_SHARE_REQUEST_TIMEOUT_MS)
  })
  try {
    const operation = fetch(
      `${origin}/api/v1/open/document-shares/${request.shareId}${suffix}`,
      {
        method: init?.method ?? 'GET',
        body: init?.body,
        credentials: 'omit',
        headers: {
          Authorization: `VdocShare ${request.secret}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...(request.unlockProof
            ? { 'X-Vdoc-Share-Unlock': request.unlockProof }
            : {}),
        },
        signal: controller.signal,
      }
    ).then(consume)
    return await Promise.race([operation, timeout])
  } catch (error) {
    if (error instanceof PublicShareRequestError) throw error
    if (timedOut) throw timeoutError
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error
    throw new PublicShareRequestError(undefined, undefined)
  } finally {
    window.clearTimeout(timeoutId)
    request.signal.removeEventListener('abort', forwardAbort)
  }
}

async function parsePublicDetail<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
  const envelope = await parsePublicEnvelope(response)
  const parsed = schema.safeParse(envelope.detail)
  if (!parsed.success)
    throw new PublicShareRequestError(200, 'INVALID_RESPONSE')
  return parsed.data
}

async function parsePublicEnvelope(response: Response) {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new PublicShareRequestError(undefined, undefined)
    }
    throw error
  }

  const parsed = publicEnvelopeSchema.safeParse(payload)
  if (!parsed.success) throw new PublicShareRequestError(undefined, undefined)
  if (parsed.data.code !== 200 || parsed.data.status !== 'OK') {
    throw new PublicShareRequestError(parsed.data.code, parsed.data.status)
  }
  return parsed.data
}

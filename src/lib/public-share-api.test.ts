import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseDocumentShareId,
  parseDocumentShareSecret,
  parsePublicVersionId,
} from './document-share-url'
import {
  PublicShareRequestError,
  PUBLIC_SHARE_DOWNLOAD_MAX_BYTES,
  PUBLIC_SHARE_REQUEST_TIMEOUT_MS,
  downloadPublicShareVersion,
  getPublicShareContent,
  getPublicShareMetadata,
  listPublicShareVersions,
  savePublicShareDownload,
  unlockPublicShare,
} from './public-share-api'

const shareId = parseDocumentShareId('0123456789abcdef0123456789abcdef')
const versionId = parsePublicVersionId('abcdef0123456789abcdef0123456789')
const secret = parseDocumentShareSecret(`vdoc_share_${'b'.repeat(48)}`)
const baseUrl = 'https://share.example.test'
const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('public share API', () => {
  it('uses the configured backend origin instead of the public page origin', async () => {
    window.__VDOC_ADMIN_CONFIG__ = {
      apiBaseUrl: 'https://api.example.test',
      publicShareBaseUrl: 'https://share.example.test',
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        detail: {
          document_name: 'Payments API',
          document_type: 1,
          version_scope: 1,
          current_version: {
            id: versionId,
            version_name: 'v1',
            published_at: '2026-07-20T00:00:00Z',
          },
        },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await getPublicShareMetadata({
      shareId,
      secret,
      signal: new AbortController().signal,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/api/v1/open/document-shares/${shareId}`,
      expect.any(Object)
    )
  })

  it('gets metadata with one native request and capability-only credentials', async () => {
    const signal = new AbortController().signal
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        detail: {
          document_name: 'Payments API',
          document_type: 1,
          version_scope: 2,
          current_version: {
            id: versionId,
            version_name: 'v1',
            published_at: '2026-07-20T00:00:00Z',
          },
        },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getPublicShareMetadata({ baseUrl, shareId, secret, signal })
    ).resolves.toMatchObject({ document_name: 'Payments API' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/open/document-shares/${shareId}`,
      expect.objectContaining({
        method: 'GET',
        credentials: 'omit',
        signal: expect.any(AbortSignal),
      })
    )
    const requestInit = fetchMock.mock.calls[0]?.[1]
    expect(requestInit?.headers).toEqual({
      Authorization: `VdocShare ${secret}`,
    })
    expect(requestInit?.headers).not.toHaveProperty('Cookie')
  })

  it('uses one request for versions and content with isolated timeout signals', async () => {
    const controller = new AbortController()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          detail: [
            {
              id: versionId,
              version_name: 'v1',
              published_at: '2026-07-20T00:00:00Z',
            },
          ],
          total: 1,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ detail: { version_id: versionId, content: '# API' } })
      )
    vi.stubGlobal('fetch', fetchMock)

    await listPublicShareVersions({
      baseUrl,
      shareId,
      secret,
      signal: controller.signal,
    })
    await getPublicShareContent({
      baseUrl,
      shareId,
      versionId,
      secret,
      signal: controller.signal,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBeInstanceOf(AbortSignal)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).not.toBe(controller.signal)
    expect(fetchMock.mock.calls[1]?.[1]?.signal).not.toBe(controller.signal)
  })

  it('unlocks with capability-only credentials and forwards proof in memory', async () => {
    const signal = new AbortController().signal
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          detail: {
            unlock_proof: 'vdoc_share_unlock_header.claims.signature',
            expires_at: '2026-07-20T00:15:00Z',
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          detail: {
            document_name: 'Payments API',
            document_type: 1,
            version_scope: 1,
            current_version: {
              id: versionId,
              version_name: 'v1',
              published_at: '2026-07-20T00:00:00Z',
            },
          },
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const unlocked = await unlockPublicShare({
      baseUrl,
      shareId,
      secret,
      signal,
      password: 'correct horse battery',
    })
    await getPublicShareMetadata({
      baseUrl,
      shareId,
      secret,
      signal,
      unlockProof: unlocked.unlock_proof,
    })

    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        body: JSON.stringify({ password: 'correct horse battery' }),
      })
    )
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: `VdocShare ${secret}`,
      'X-Vdoc-Share-Unlock': unlocked.unlock_proof,
    })
  })

  it('accepts raw envelope-shaped JSON bytes only with an attachment header', async () => {
    const body = JSON.stringify({ code: 404, status: 'NOT_FOUND' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: {
            'Content-Disposition': 'attachment; filename="payload.json"',
            'Content-Type': 'application/json',
          },
        })
      )
    )

    const result = await downloadPublicShareVersion({
      baseUrl,
      shareId,
      versionId,
      secret,
      signal: new AbortController().signal,
    })

    expect(result.filename).toBe('payload.json')
    await expect(result.blob.text()).resolves.toBe(body)
  })

  it('rejects downloads whose declared or actual body exceeds the safety limit', async () => {
    const attachmentHeaders = {
      'Content-Disposition': 'attachment; filename="payload.bin"',
      'Content-Type': 'application/octet-stream',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('small', {
          status: 200,
          headers: {
            ...attachmentHeaders,
            'Content-Length': String(PUBLIC_SHARE_DOWNLOAD_MAX_BYTES + 1),
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array(PUBLIC_SHARE_DOWNLOAD_MAX_BYTES + 1), {
          status: 200,
          headers: attachmentHeaders,
        })
      )
    vi.stubGlobal('fetch', fetchMock)
    const request = () =>
      downloadPublicShareVersion({
        baseUrl,
        shareId,
        versionId,
        secret,
        signal: new AbortController().signal,
      })

    await expect(request()).rejects.toMatchObject({
      code: 413,
      status: 'RESPONSE_TOO_LARGE',
    })
    await expect(request()).rejects.toMatchObject({
      code: 413,
      status: 'RESPONSE_TOO_LARGE',
    })
  })

  it('rejects denial downloads without leaking secret or response details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          code: 404,
          status: 'NOT_FOUND',
          description: 'A specified resource is not found',
        })
      )
    )

    const request = downloadPublicShareVersion({
      baseUrl,
      shareId,
      versionId,
      secret,
      signal: new AbortController().signal,
    })

    await expect(request).rejects.toBeInstanceOf(PublicShareRequestError)
    await expect(request).rejects.not.toThrow(secret)
    await expect(request).rejects.not.toThrow('A specified resource')
  })

  it('forwards aborts without retrying or wrapping capability data', async () => {
    const controller = new AbortController()
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError'
    )
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', fetchMock)
    controller.abort()

    await expect(
      getPublicShareMetadata({
        baseUrl,
        shareId,
        secret,
        signal: controller.signal,
      })
    ).rejects.toBe(abortError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts and sanitizes requests that exceed the public timeout', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const fetchMock = vi.fn().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? undefined
          requestSignal?.addEventListener(
            'abort',
            () => reject(requestSignal?.reason),
            { once: true }
          )
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = getPublicShareMetadata({
      baseUrl,
      shareId,
      secret,
      signal: new AbortController().signal,
    })
    const rejection = expect(request).rejects.toMatchObject({
      code: 408,
      status: 'REQUEST_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(PUBLIC_SHARE_REQUEST_TIMEOUT_MS)

    await rejection
    expect(requestSignal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the timeout active while JSON and download bodies are consumed', async () => {
    vi.useFakeTimers()
    const jsonResponseWithPendingBody = jsonResponse()
    const downloadResponseWithPendingBody = new Response('', {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="payload.md"',
        'Content-Type': 'text/markdown',
      },
    })
    vi.spyOn(jsonResponseWithPendingBody, 'json').mockReturnValue(
      new Promise<never>(() => undefined)
    )
    vi.spyOn(downloadResponseWithPendingBody, 'blob').mockReturnValue(
      new Promise<Blob>(() => undefined)
    )
    const requestSignals: AbortSignal[] = []
    const responses = [
      jsonResponseWithPendingBody,
      downloadResponseWithPendingBody,
    ]
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.signal instanceof AbortSignal)
            requestSignals.push(init.signal)
          return Promise.resolve(responses.shift() as Response)
        })
    )

    const metadataRequest = getPublicShareMetadata({
      baseUrl,
      shareId,
      secret,
      signal: new AbortController().signal,
    })
    const metadataRejection = expect(metadataRequest).rejects.toMatchObject({
      code: 408,
      status: 'REQUEST_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(PUBLIC_SHARE_REQUEST_TIMEOUT_MS)
    await metadataRejection

    const downloadRequest = downloadPublicShareVersion({
      baseUrl,
      shareId,
      versionId,
      secret,
      signal: new AbortController().signal,
    })
    const downloadRejection = expect(downloadRequest).rejects.toMatchObject({
      code: 408,
      status: 'REQUEST_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(PUBLIC_SHARE_REQUEST_TIMEOUT_MS)
    await downloadRejection

    expect(requestSignals).toHaveLength(2)
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true)
  })

  it('rejects unknown document and version-scope codes as invalid responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          detail: {
            document_name: 'Payments API',
            document_type: 99,
            version_scope: 99,
            current_version: {
              id: versionId,
              version_name: 'v1',
              published_at: '2026-07-20T00:00:00Z',
            },
          },
        })
      )
    )

    await expect(
      getPublicShareMetadata({
        baseUrl,
        shareId,
        secret,
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject({ code: 200, status: 'INVALID_RESPONSE' })
  })

  it('sanitizes non-abort transport errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError(`transport exposed ${secret}`))
    vi.stubGlobal('fetch', fetchMock)

    const request = getPublicShareMetadata({
      baseUrl,
      shareId,
      secret,
      signal: new AbortController().signal,
    })

    await expect(request).rejects.toBeInstanceOf(PublicShareRequestError)
    await expect(request).rejects.not.toThrow(secret)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('revokes the object URL even when the browser download click fails', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {
        throw new DOMException('Download blocked', 'NotAllowedError')
      })
    const createObjectURL = vi.fn().mockReturnValue('blob:fixture')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    expect(() =>
      savePublicShareDownload({
        blob: new Blob(['content']),
        filename: 'document.md',
        mimeType: 'text/markdown; charset=utf-8',
      })
    ).toThrow('Download blocked')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fixture')

    click.mockRestore()
  })
})

function jsonResponse(
  overrides: Readonly<Record<string, unknown>> = {}
): Response {
  return new Response(
    JSON.stringify({
      code: 200,
      status: 'OK',
      description: 'OK',
      timestamp: 1,
      ...overrides,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

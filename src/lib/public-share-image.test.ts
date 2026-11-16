import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseDocumentShareId,
  parseDocumentShareSecret,
  parsePublicVersionId,
} from './document-share-url'
import { getPublicShareImage } from './public-share-api'

const request = {
  baseUrl: 'https://share.example.test',
  shareId: parseDocumentShareId('0123456789abcdef0123456789abcdef'),
  secret: parseDocumentShareSecret(`vdoc_share_${'b'.repeat(48)}`),
  versionId: parsePublicVersionId('abcdef0123456789abcdef0123456789'),
  unlockProof: 'test-unlock-proof',
  assetId: 'a'.repeat(64),
  signal: new AbortController().signal,
}
afterEach(() => vi.unstubAllGlobals())
describe('public shared images', () => {
  it('fetches a fixed-version image with capability/proof headers and no cookies', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response('image', { headers: { 'Content-Type': 'image/png' } })
      )
    vi.stubGlobal('fetch', fetch)
    const blob = await getPublicShareImage(request)
    expect(blob.type).toBe('image/png')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(
      `${request.baseUrl}/api/v1/open/document-shares/${request.shareId}/versions/${request.versionId}/images/${request.assetId}`
    )
    expect(init.credentials).toBe('omit')
    expect(init.headers).toMatchObject({
      Authorization: `VdocShare ${request.secret}`,
      'X-Vdoc-Share-Unlock': request.unlockProof,
    })
    expect(url).not.toContain(request.secret)
  })
  it('rejects HTTP 200 JSON errors and oversized image responses', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 403,
            status: 'PASSWORD_REQUIRED',
            description: '',
            timestamp: 0,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response('x', {
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(4 * 1024 * 1024 + 1),
          },
        })
      )
    vi.stubGlobal('fetch', fetch)
    await expect(getPublicShareImage(request)).rejects.toMatchObject({
      status: 'PASSWORD_REQUIRED',
    })
    await expect(getPublicShareImage(request)).rejects.toMatchObject({
      status: 'RESPONSE_TOO_LARGE',
    })
  })
})

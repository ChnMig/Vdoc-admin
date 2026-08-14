import { describe, expect, it, vi } from 'vitest'
import {
  buildDocumentShareUrl,
  createPublicShareSession,
  disposePublicShareSession,
  parseAndEraseDocumentShareFragment,
  parseDocumentShareId,
  parseDocumentShareSecret,
  parsePublicVersionId,
} from './document-share-url'

const shareId = '0123456789abcdef0123456789abcdef'
const secret = `vdoc_share_${'a'.repeat(48)}`

describe('document share URL primitives', () => {
  it('builds the exact capability URL from validated values', () => {
    expect(
      buildDocumentShareUrl({
        baseUrl: 'https://share.example.test',
        shareId: parseDocumentShareId(shareId),
        secret: parseDocumentShareSecret(secret),
      })
    ).toBe(`https://share.example.test/share/${shareId}#${secret}`)
  })

  it.each([
    '',
    'ABCDEF0123456789abcdef0123456789',
    '0123456789abcdef0123456789abcdeg',
    '0123456789abcdef',
  ])('rejects invalid share IDs: %s', (value) => {
    expect(() => parseDocumentShareId(value)).toThrow()
  })

  it.each([
    '',
    `#${secret}`,
    `vdoc_share_${'A'.repeat(48)}`,
    `token=${secret}`,
    `${secret}0`,
  ])('rejects invalid share secrets: %s', (value) => {
    expect(() => parseDocumentShareSecret(value)).toThrow()
  })

  it('does not include rejected capability text in parse errors', () => {
    const invalidSecret = `${secret}invalid`

    expect(() => parseDocumentShareSecret(invalidSecret)).not.toThrow(
      invalidSecret
    )
  })

  it('brands public version IDs separately from share IDs', () => {
    expect(parsePublicVersionId('abcdef0123456789abcdef0123456789')).toBe(
      'abcdef0123456789abcdef0123456789'
    )
  })

  it('parses and erases an exact raw capability fragment synchronously', () => {
    const replaceState = vi.fn()

    const parsed = parseAndEraseDocumentShareFragment(
      { hash: `#${secret}`, pathname: `/share/${shareId}`, search: '?view=1' },
      { replaceState }
    )

    expect(parsed).toBe(secret)
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      `/share/${shareId}?view=1`
    )
  })

  it.each([
    '',
    `#token=${secret}`,
    `#%76doc_share_${'a'.repeat(48)}`,
    `#${secret}&extra=1`,
    `##${secret}`,
  ])('rejects non-exact fragments without rewriting history: %s', (hash) => {
    const replaceState = vi.fn()

    expect(
      parseAndEraseDocumentShareFragment(
        { hash, pathname: `/share/${shareId}`, search: '' },
        { replaceState }
      )
    ).toBeUndefined()
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('creates an opaque memory-only session and aborts it on disposal', () => {
    const session = createPublicShareSession({
      shareId: parseDocumentShareId(shareId),
      secret: parseDocumentShareSecret(secret),
    })

    expect(session.sessionId).toMatch(/^[0-9a-f]{32}$/)
    expect(session.sessionId).not.toContain(secret)
    expect(session.controller.signal.aborted).toBe(false)

    disposePublicShareSession(session)

    expect(session.controller.signal.aborted).toBe(true)
  })
})

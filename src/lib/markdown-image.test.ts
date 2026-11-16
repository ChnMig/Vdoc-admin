import { describe, expect, it } from 'vitest'
import {
  insertMarkdownImages,
  managedImageId,
  markdownSourceOffset,
  validateDocumentImageBlob,
} from './markdown-image'

const reference = `vdoc-asset:${'a'.repeat(64)}`
describe('managed Markdown image references', () => {
  it('allows only exact managed references and raster image responses', () => {
    expect(managedImageId(reference)).toBe('a'.repeat(64))
    for (const value of [
      'https://example.test/a.png',
      `${reference}/extra`,
      ` ${reference}`,
      'vdoc-asset:../x',
      'data:image/png;base64,abc',
    ])
      expect(managedImageId(value)).toBeUndefined()
    expect(() =>
      validateDocumentImageBlob(
        new Blob(['error'], { type: 'application/json' })
      )
    ).toThrow()
    expect(() =>
      validateDocumentImageBlob(new Blob(['<svg/>'], { type: 'image/svg+xml' }))
    ).toThrow()
    expect(() =>
      validateDocumentImageBlob(new Blob(['image'], { type: 'image/png' }))
    ).not.toThrow()
  })
  it('maps DOM selection offsets into preserved CRLF source', () => {
    const source = '# Guide\r\n\r\nbefore after\r\n'
    const position = '# Guide\n\nbefore '.length
    expect(markdownSourceOffset(source, position)).toBe(
      '# Guide\r\n\r\nbefore '.length
    )
    const inserted = insertMarkdownImages(source, position, position + 5, [
      { reference, filename: 'diagram[1].png' },
    ])
    expect(inserted.content).toBe(
      `# Guide\r\n\r\nbefore ![diagram 1 .png](${reference})\r\n`
    )
    expect(inserted.caret).toBe(
      inserted.content.replace(/\r\n/g, '\n').length - 1
    )
  })
})

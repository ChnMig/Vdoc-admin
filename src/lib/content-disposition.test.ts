import { describe, expect, it } from 'vitest'
import { filenameFromContentDisposition } from './content-disposition'

describe('Content-Disposition filenames', () => {
  it('prefers a strictly decoded UTF-8 filename* over filename', () => {
    expect(
      filenameFromContentDisposition(
        `attachment; filename="document.json"; filename*=UTF-8''API%20%E6%96%87%E6%A1%A3.json`,
        'application/json'
      )
    ).toBe('API 文档.json')
  })

  it('falls back to quoted filename when filename* is malformed', () => {
    expect(
      filenameFromContentDisposition(
        `attachment; filename="safe.yaml"; filename*=UTF-8''bad%ZZname`,
        'application/yaml'
      )
    ).toBe('safe.yaml')
  })

  it('takes the final basename and removes control characters', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="..\\folder\\report\u0000.md"',
        'text/markdown; charset=utf-8'
      )
    ).toBe('report.md')
  })

  it.each([
    ['attachment; filename="."', 'application/json', 'document.json'],
    ['attachment; filename=".."', 'application/yaml', 'document.yaml'],
    [
      'inline; filename="report.md"',
      'text/markdown; charset=utf-8',
      'document.md',
    ],
    ['attachment', 'application/octet-stream', 'download.bin'],
  ])(
    'uses a deterministic fallback for unusable attachment names',
    (header, mimeType, fallback) => {
      expect(filenameFromContentDisposition(header, mimeType)).toBe(fallback)
    }
  )
})

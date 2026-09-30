import { describe, expect, it } from 'vitest'
import { filenameFromContentDisposition } from './content-disposition'

describe('Content-Disposition filenames', () => {
  it.each(['api.yaml', 'api.json', 'guide.md'])(
    'preserves the backend token filename %s',
    (filename) => {
      expect(
        filenameFromContentDisposition(
          `attachment; filename=${filename}`,
          'application/octet-stream'
        )
      ).toBe(filename)
    }
  )

  it('handles quoted semicolons and escaped quotes', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="API; \\"notes\\".yaml"',
        'application/yaml'
      )
    ).toBe('API; "notes".yaml')
  })

  it('decodes an extended filename with a language tag', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename=guide.md; filename*=UTF-8'zh'%E6%8C%87%E5%8D%97.md",
        'text/markdown'
      )
    ).toBe('指南.md')
  })

  it('ignores filename-looking text inside other quoted parameters', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; note="; filename=wrong.json;"; filename=api.yaml',
        'application/yaml'
      )
    ).toBe('api.yaml')
  })

  it.each([
    [
      'attachment; filename=api.yaml',
      'application/yaml; charset=utf-8',
      'api.yaml',
    ],
    ['attachment', 'APPLICATION/JSON; charset=UTF-8', 'document.json'],
    [null, 'application/yaml; charset=utf-8', 'document.yaml'],
    ['attachment', 'text/markdown', 'document.md'],
    [
      'attachment; filename=invalid name.json',
      'application/json',
      'document.json',
    ],
    ['attachment; filename="broken.json', 'application/json', 'document.json'],
    [
      'attachment; filename="safe.json"suffix',
      'application/json',
      'document.json',
    ],
    [
      "attachment; filename*=UTF-8''..%2Ffolder%2Fapi.json",
      'application/json',
      'api.json',
    ],
  ])(
    'falls back by media type and rejects malformed names',
    (header, mimeType, filename) => {
      expect(filenameFromContentDisposition(header, mimeType)).toBe(filename)
    }
  )

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

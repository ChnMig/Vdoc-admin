const asciiWhitespace = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g

export function isAttachmentContentDisposition(value: string | null): boolean {
  return value !== null && /^\s*attachment(?:\s*;|\s*$)/i.test(value)
}

export function filenameFromContentDisposition(
  disposition: string | null,
  mimeType: string
): string {
  if (isAttachmentContentDisposition(disposition)) {
    const extended = disposition?.match(/;\s*filename\*\s*=\s*([^;]*)/i)?.[1]
    const extendedFilename = decodeExtendedFilename(extended)
    const safeExtendedFilename = sanitizeFilename(extendedFilename)
    if (safeExtendedFilename !== undefined) return safeExtendedFilename

    const quoted = disposition?.match(/;\s*filename\s*=\s*"([^"]*)"/i)?.[1]
    const safeQuotedFilename = sanitizeFilename(quoted)
    if (safeQuotedFilename !== undefined) return safeQuotedFilename
  }

  if (mimeType === 'application/json') return 'document.json'
  if (mimeType === 'application/yaml') return 'document.yaml'
  if (mimeType === 'text/markdown; charset=utf-8') return 'document.md'
  return 'download.bin'
}

function decodeExtendedFilename(value: string | undefined): string | undefined {
  if (value === undefined || !/^UTF-8''/i.test(value)) return undefined
  try {
    return decodeURIComponent(value.slice(7))
  } catch (error) {
    if (error instanceof URIError) return undefined
    throw error
  }
}

function sanitizeFilename(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.replace(asciiWhitespace, '')
  const segments = trimmed.replace(/\\/g, '/').split('/')
  const basename = segments[segments.length - 1] ?? ''
  const sanitized = Array.from(basename)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint > 31 && codePoint !== 127
    })
    .join('')

  if (sanitized === '' || sanitized === '.' || sanitized === '..') {
    return undefined
  }
  if (sanitized.includes('/') || sanitized.includes('\\')) return undefined
  return sanitized
}

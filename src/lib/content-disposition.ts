const asciiWhitespace = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g

export function isAttachmentContentDisposition(value: string | null): boolean {
  return value !== null && /^\s*attachment(?:\s*;|\s*$)/i.test(value)
}

export function filenameFromContentDisposition(
  disposition: string | null,
  mimeType: string
): string {
  if (isAttachmentContentDisposition(disposition)) {
    const parameters = filenameParameters(disposition ?? '')
    const extended = parameters.get('filename*')
    const extendedFilename = decodeExtendedFilename(extended)
    const safeExtendedFilename = sanitizeFilename(extendedFilename)
    if (safeExtendedFilename !== undefined) return safeExtendedFilename

    const safeFilename = sanitizeFilename(parameters.get('filename'))
    if (safeFilename !== undefined) return safeFilename
  }

  const mediaType = mimeType.split(';', 1)[0].trim().toLowerCase()
  if (mediaType === 'application/json') return 'document.json'
  if (mediaType === 'application/yaml') return 'document.yaml'
  if (mediaType === 'text/markdown') return 'document.md'
  return 'download.bin'
}

function filenameParameters(disposition: string): Map<string, string> {
  const parameters = new Map<string, string>()
  const pattern =
    /;\s*([!#$%&'*+.^_`|~0-9A-Za-z-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([!#$%&'*+.^_`|~0-9A-Za-z-]+))\s*(?=;|$)/gi
  for (const match of disposition.matchAll(pattern)) {
    const name = match[1].toLowerCase()
    if (name !== 'filename' && name !== 'filename*') continue
    if (parameters.has(name)) continue
    // Accept raw Windows path separators as well as escaped quotes/backslashes.
    const value = match[2]?.replace(/\\(["\\])/g, '$1') ?? match[3]
    parameters.set(name, value)
  }
  return parameters
}

function decodeExtendedFilename(value: string | undefined): string | undefined {
  const encoded = value?.match(/^UTF-8'[^']*'(.*)$/i)?.[1]
  if (encoded === undefined) return undefined
  try {
    return decodeURIComponent(encoded)
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

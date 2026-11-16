export const DOCUMENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024
export const DOCUMENT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'
const imageTypes = new Set(DOCUMENT_IMAGE_ACCEPT.split(','))

export function managedImageId(reference: string): string | undefined {
  return /^vdoc-asset:([0-9a-f]{64})$/.exec(reference)?.[1]
}

export function validateDocumentImageBlob(blob: Blob): Blob {
  if (
    !imageTypes.has(blob.type.split(';')[0].trim().toLowerCase()) ||
    blob.size === 0 ||
    blob.size > DOCUMENT_IMAGE_MAX_BYTES
  )
    throw new Error('Invalid document image response')
  return blob
}

// Textareas normalize CRLF to LF, while the saved source keeps its original bytes.
export function markdownSourceOffset(source: string, textareaOffset: number) {
  let offset = 0
  for (
    let visible = 0;
    visible < textareaOffset && offset < source.length;
    visible++
  ) {
    offset += source[offset] === '\r' && source[offset + 1] === '\n' ? 2 : 1
  }
  return offset
}

export function insertMarkdownImages(
  source: string,
  start: number,
  end: number,
  images: readonly { reference: string; filename: string }[]
) {
  const eol =
    source.includes('\r\n') && !/(^|[^\r])\n/.test(source) ? '\r\n' : '\n'
  const markdown = images
    .map(({ reference, filename }) => {
      if (!managedImageId(reference))
        throw new Error('Invalid document image reference')
      const alt = filename.replace(/[\\[\]\r\n]/g, ' ').trim()
      return `![${alt}](${reference})`
    })
    .join(eol)
  const from = markdownSourceOffset(source, start)
  const to = markdownSourceOffset(source, end)
  return {
    content: source.slice(0, from) + markdown + source.slice(to),
    caret: start + markdown.replace(/\r\n/g, '\n').length,
  }
}

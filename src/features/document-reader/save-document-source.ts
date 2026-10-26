export function saveDocumentSource(content: string, fileName: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/plain;charset=utf-8' })
  )
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = fileName.split(/[\\/]/).pop() || 'document.txt'
  window.document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

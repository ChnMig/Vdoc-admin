export type MarkdownSafeLink =
  | { readonly kind: 'safe'; readonly href: string }
  | { readonly kind: 'unsafe'; readonly url: string }

const allowedSchemes = new Set(['http', 'https', 'mailto'])
const schemePattern = /^([a-zA-Z][a-zA-Z\d+.-]*):/

export function markdownSafeLink(url: string): MarkdownSafeLink {
  const trimmedUrl = url.trim()
  if (trimmedUrl.length === 0) return { kind: 'unsafe', url }
  if (trimmedUrl.startsWith('#')) return { kind: 'safe', href: trimmedUrl }
  if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
    return { kind: 'safe', href: trimmedUrl }
  }
  if (trimmedUrl.startsWith('./') || trimmedUrl.startsWith('../')) {
    return { kind: 'safe', href: trimmedUrl }
  }

  const scheme = schemePattern.exec(trimmedUrl)?.[1].toLowerCase()
  if (scheme) {
    return allowedSchemes.has(scheme)
      ? { kind: 'safe', href: trimmedUrl }
      : { kind: 'unsafe', url }
  }

  return trimmedUrl.startsWith('//')
    ? { kind: 'unsafe', url }
    : { kind: 'safe', href: trimmedUrl }
}

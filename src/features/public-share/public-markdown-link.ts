export type PublicMarkdownLink =
  | { readonly kind: 'safe'; readonly href: string }
  | { readonly kind: 'unsafe'; readonly url: string }

const explicitPublicUrl = /^(?:https?:|mailto:)/i

export function publicMarkdownLink(url: string): PublicMarkdownLink {
  return explicitPublicUrl.test(url)
    ? { kind: 'safe', href: url }
    : { kind: 'unsafe', url }
}

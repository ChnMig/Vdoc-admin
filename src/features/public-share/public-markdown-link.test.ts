import { describe, expect, it } from 'vitest'
import { publicMarkdownLink } from './public-markdown-link'

describe('public Markdown links', () => {
  it.each([
    'https://example.test/docs',
    'http://example.test/docs',
    'mailto:docs@example.test',
  ])('allows explicit public protocols: %s', (url) => {
    expect(publicMarkdownLink(url)).toEqual({ kind: 'safe', href: url })
  })

  it.each([
    '#section',
    '/docs',
    './docs',
    '../docs',
    'docs/page',
    '//example.test/docs',
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '',
  ])('renders non-explicit links as inert text: %s', (url) => {
    expect(publicMarkdownLink(url)).toEqual({ kind: 'unsafe', url })
  })
})

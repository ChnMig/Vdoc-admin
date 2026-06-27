import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { MarkdownFactsCard } from './markdown-facts-card'

function renderMarkdownFactsCard(content: string) {
  return render(
    <LanguageProvider>
      <MarkdownFactsCard content={content} />
    </LanguageProvider>
  )
}

describe('MarkdownFactsCard', () => {
  it('renders a structured facts browser for markdown content', () => {
    const screen = renderMarkdownFactsCard(
      '# Overview\n\n- [ ] Ship review note\n\n```bash\npnpm test\n```\n\nRead [API](./api.md) and [HTTP](https://example.test/docs).'
    )

    expect(
      screen.getByRole('heading', { name: 'Markdown facts' })
    ).toBeInTheDocument()
    expect(screen.getByText('1 headings')).toBeInTheDocument()
    expect(screen.getByText('1 tasks')).toBeInTheDocument()
    expect(screen.getByText('1 code blocks')).toBeInTheDocument()
    expect(screen.getByText('2 links')).toBeInTheDocument()
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Ship review note')).toBeInTheDocument()
    expect(screen.getByText('bash')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'API' })).toHaveAttribute(
      'href',
      './api.md'
    )
    expect(screen.getByRole('link', { name: 'HTTP' })).toHaveAttribute(
      'href',
      'https://example.test/docs'
    )
  })

  it('renders unsafe javascript markdown links as non-clickable text', () => {
    const screen = renderMarkdownFactsCard(
      'Unsafe [run script](javascript:alert(document.cookie)) link.'
    )

    expect(
      screen.queryByRole('link', { name: 'run script' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('run script')).toBeInTheDocument()
    expect(screen.getByText('Unsafe link')).toBeInTheDocument()
  })

  it('renders an intentional empty state when markdown has no facts', () => {
    const screen = renderMarkdownFactsCard('plain paragraph only')

    expect(screen.getByText('No Markdown facts found.')).toBeInTheDocument()
  })
})

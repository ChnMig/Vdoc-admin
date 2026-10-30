import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { AIChatMarkdown, AIChatMessage } from './ai-chat-message'

describe('chat markdown', () => {
  it('keeps provider reasoning in a disclosure and allows latest-answer regeneration', () => {
    const regenerate = vi.fn()
    const { container } = render(
      <LanguageProvider>
        <AIChatMessage
          message={{
            role: 'assistant',
            content: 'Final answer',
            reasoning: '**Checked** the supplied source.',
          }}
          onRegenerate={regenerate}
        />
      </LanguageProvider>
    )
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.getByText('Checked').tagName).toBe('STRONG')
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate answer' }))
    expect(regenerate).toHaveBeenCalledOnce()
  })
  it('renders structured replies and confines wide code and tables', () => {
    render(
      <LanguageProvider>
        <AIChatMarkdown
          content={
            '## Answer\n\n**Important**\n\n- First\n- Second\n\n```ts\nconst value = 1\n```\n\n| Key | Value |\n| --- | --- |\n| a | b |'
          }
        />
      </LanguageProvider>
    )
    expect(screen.getByRole('heading', { name: 'Answer' })).toBeInTheDocument()
    expect(screen.getByText('Important').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy code' })
    ).toBeInTheDocument()
  })

  it('suppresses raw HTML, remote images and executable links', () => {
    const { container } = render(
      <LanguageProvider>
        <AIChatMarkdown
          content={
            '<script>alert(1)</script>\n\n![tracking](https://example.test/pixel.png)\n\n[unsafe](javascript:alert%281%29)\n\n[reference](https://example.test/docs)'
          }
        />
      </LanguageProvider>
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('unsafe')).not.toHaveAttribute(
      'href',
      expect.stringContaining('javascript:')
    )
    expect(screen.getByRole('link', { name: 'reference' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
  })
})

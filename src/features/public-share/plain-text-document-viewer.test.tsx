import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlainTextDocumentViewer } from './plain-text-document-viewer'

describe('PlainTextDocumentViewer', () => {
  it('keeps text, line endings and indentation literal without Markdown or HTML rendering', () => {
    const content =
      '# Release notes\r\n\r\n  [documentation](https://example.test)\n\t<script>alert("text")</script>\n'
    const screen = render(<PlainTextDocumentViewer content={content} />)

    expect(screen.container.querySelector('pre')?.textContent).toBe(content)
    expect(screen.container.querySelector('pre')).toHaveClass(
      'whitespace-pre-wrap'
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.container.querySelector('script')).not.toBeInTheDocument()
  })

  it('renders an empty text document as an empty preview', () => {
    const screen = render(<PlainTextDocumentViewer content='' />)

    expect(screen.container.querySelector('pre')?.textContent).toBe('')
  })
})

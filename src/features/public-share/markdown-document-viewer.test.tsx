import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownDocumentViewer } from './markdown-document-viewer'

describe('MarkdownDocumentViewer', () => {
  it('renders GFM semantics and explicit external links', () => {
    const screen = render(
      <MarkdownDocumentViewer
        content={
          '# API\n\n- [x] reviewed\n\nVisit [docs](https://example.test).'
        }
      />
    )

    expect(screen.getByRole('heading', { name: 'API' })).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Completed task' })
    ).toBeChecked()
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute(
      'target',
      '_blank'
    )
    expect(screen.getByRole('link', { name: 'docs' })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    )
  })

  it('removes raw HTML and images while making unsafe links inert', () => {
    const screen = render(
      <MarkdownDocumentViewer
        content={
          '<script>window.secret = true</script>\n\n![remote](https://example.test/image.png)\n\n[relative](./private.md) [script](javascript:alert(1))'
        }
      />
    )

    expect(screen.container.querySelector('script')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'relative' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'script' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('relative script')).toBeInTheDocument()
  })
})

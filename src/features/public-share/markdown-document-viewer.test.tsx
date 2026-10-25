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

  it('uses an unframed article and omits only a matching leading document title', () => {
    const screen = render(
      <MarkdownDocumentViewer
        variant='article'
        documentTitle='Release guide'
        content={
          '\n# **Release** guide\n\nIntroduction.\n\n## Install\n\n# Release guide'
        }
      />
    )
    const article = screen.container.querySelector('article')!
    expect(article).not.toHaveClass('panel-control', 'border', 'bg-card')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Install' })).toBeVisible()
  })

  it.each([
    ['# Another title', 'Release guide', 'Another title'],
    ['Introduction.\n\n# Release guide', 'Release guide', 'Release guide'],
  ])(
    'keeps a different title or a heading following other content',
    (content, documentTitle, heading) => {
      const screen = render(
        <MarkdownDocumentViewer
          variant='article'
          content={content}
          documentTitle={documentTitle}
        />
      )
      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
    }
  )

  it('preserves a matching title in the default public-share panel', () => {
    const screen = render(
      <MarkdownDocumentViewer
        content='# Release guide'
        documentTitle='Release guide'
      />
    )
    expect(screen.getByRole('heading', { name: 'Release guide' })).toBeVisible()
    expect(screen.container.querySelector('article')).toHaveClass(
      'panel-control'
    )
  })
})

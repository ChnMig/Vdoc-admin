import { useRef, type ReactNode } from 'react'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspaceOutline } from './document-workspace-outline'

function Reader({
  content,
  contextKey = 'document-1:version-1',
  controlledScroll = false,
  externalAriaHidden = false,
  onNavigate,
}: {
  content?: ReactNode
  contextKey?: string
  controlledScroll?: boolean
  externalAriaHidden?: boolean
  onNavigate?: () => void
}) {
  const contentRootRef = useRef<HTMLDivElement>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  return (
    <LanguageProvider>
      <div
        data-testid='reader-scroll'
        ref={scrollRootRef}
        aria-hidden={externalAriaHidden || undefined}
      >
        <h1>Page title outside the content</h1>
        <div ref={contentRootRef}>
          <section data-document-content>{content}</section>
        </div>
      </div>
      <DocumentWorkspaceOutline
        contentRootRef={contentRootRef}
        scrollRootRef={controlledScroll ? scrollRootRef : undefined}
        contextKey={contextKey}
        onNavigate={onNavigate}
      />
    </LanguageProvider>
  )
}

describe('DocumentWorkspaceOutline', () => {
  beforeEach(() => {
    document.cookie = 'vdoc-admin-language=en; path=/'
  })

  afterEach(() => vi.restoreAllMocks())

  it('collects asynchronous rendered headings, gives duplicate titles unique stable ids, and ignores the page title', async () => {
    const screen = render(<Reader />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    screen.rerender(
      <Reader
        content={
          <>
            <h1>Getting started</h1>
            <h2>Configuration</h2>
            <h3>Configuration</h3>
            <h4>Environment</h4>
          </>
        }
      />
    )
    const links = await screen.findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Getting started',
      'Configuration',
      'Configuration',
      'Environment',
    ])
    const ids = links.map((link) => link.getAttribute('href')!.slice(1))
    expect(new Set(ids).size).toBe(4)
    expect(ids.every((id) => document.getElementById(id))).toBe(true)

    screen.rerender(
      <Reader
        content={
          <>
            <h1>Getting started</h1>
            <h2>Configuration</h2>
            <h3>Configuration</h3>
            <h4>Environment</h4>
            <p>More content arrived</p>
          </>
        }
      />
    )
    await waitFor(() =>
      expect(
        screen.getAllByRole('link').map((link) => link.getAttribute('href'))
      ).toEqual(ids.map((id) => `#${id}`))
    )
  })

  it('excludes inactive/hidden content and clears the previous revision while new content loads', async () => {
    const screen = render(
      <Reader
        content={
          <>
            <h2>Visible heading</h2>
            <div hidden>
              <h2>Hidden heading</h2>
            </div>
            <div aria-hidden='true'>
              <h2>Aria hidden heading</h2>
            </div>
            <div data-state='inactive'>
              <h2>Inactive heading</h2>
            </div>
          </>
        }
      />
    )
    expect(
      await screen.findByRole('link', { name: 'Visible heading' })
    ).toBeVisible()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    screen.rerender(<Reader contextKey='document-1:version-2' />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    screen.rerender(
      <Reader
        contextKey='document-1:version-2'
        content={<h2>New version</h2>}
      />
    )
    expect(
      await screen.findByRole('link', { name: 'New version' })
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Visible heading' })
    ).not.toBeInTheDocument()
  })

  it('collects the same reader inside modal-isolated ancestors while excluding hidden source content', async () => {
    const screen = render(<Reader externalAriaHidden />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    screen.rerender(
      <Reader
        externalAriaHidden
        content={
          <>
            <h2>Section available in the outline dialog</h2>
            <div hidden>
              <h2>Unselected hidden source</h2>
            </div>
            <div aria-hidden='true'>
              <h2>Internal aria hidden source</h2>
            </div>
            <div data-state='inactive'>
              <h2>Inactive revision content</h2>
            </div>
          </>
        }
      />
    )
    expect(
      await screen.findByRole('link', {
        name: 'Section available in the outline dialog',
      })
    ).toBeVisible()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByTestId('reader-scroll')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(
      screen.queryByRole('link', { name: 'Unselected hidden source' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Internal aria hidden source' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Inactive revision content' })
    ).not.toBeInTheDocument()
  })

  it('keeps a unique existing anchor and repairs duplicate existing ids', async () => {
    const screen = render(
      <Reader
        content={
          <>
            <h2 id='valid-anchor'>Original anchor</h2>
            <h2 id='duplicate'>First duplicate</h2>
            <h2 id='duplicate'>Second duplicate</h2>
          </>
        }
      />
    )
    expect(
      await screen.findByRole('link', { name: 'Original anchor' })
    ).toHaveAttribute('href', '#valid-anchor')
    const links = screen.getAllByRole('link')
    expect(new Set(links.map((link) => link.getAttribute('href'))).size).toBe(3)
  })

  it.each([false, true])(
    'scrolls only the central reader and respects reduced motion (with navigation callback: %s)',
    async (notify) => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
      const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
      const onNavigate = notify ? vi.fn() : undefined
      const screen = render(
        <Reader
          controlledScroll
          content={<h2>Target section</h2>}
          onNavigate={onNavigate}
        />
      )
      const root = screen.getByTestId('reader-scroll')
      const scrollTo = vi.fn()
      Object.defineProperty(root, 'scrollTo', {
        configurable: true,
        value: scrollTo,
      })
      Object.defineProperty(root, 'scrollTop', {
        configurable: true,
        value: 100,
      })
      vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
        top: 20,
      } as DOMRect)
      vi.spyOn(
        screen.getByRole('heading', { name: 'Target section' }),
        'getBoundingClientRect'
      ).mockReturnValue({ top: 320 } as DOMRect)

      fireEvent.click(
        await screen.findByRole('link', { name: 'Target section' })
      )
      expect(scrollTo).toHaveBeenCalledWith({ top: 368, behavior: 'auto' })
      expect(scrollIntoView).not.toHaveBeenCalled()
      expect(window.location.hash).toBe('')
      if (onNavigate) {
        expect(onNavigate).toHaveBeenCalledOnce()
        expect(scrollTo.mock.invocationCallOrder[0]).toBeLessThan(
          onNavigate.mock.invocationCallOrder[0]
        )
      }
    }
  )

  it('notifies once after navigating without a dedicated scroll container', async () => {
    const onNavigate = vi.fn()
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const screen = render(
      <Reader content={<h2>Standalone section</h2>} onNavigate={onNavigate} />
    )
    fireEvent.click(
      await screen.findByRole('link', { name: 'Standalone section' })
    )
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({
      behavior: 'smooth',
      block: 'start',
    })
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(scrollIntoView.mock.invocationCallOrder[0]).toBeLessThan(
      onNavigate.mock.invocationCallOrder[0]
    )
    expect(window.location.hash).toBe('')
  })

  it('updates the active section as the central reader scrolls', async () => {
    const screen = render(
      <Reader
        controlledScroll
        content={
          <>
            <h2>First</h2>
            <h2>Second</h2>
          </>
        }
      />
    )
    let secondTop = 300
    vi.spyOn(
      screen.getByRole('heading', { name: 'First' }),
      'getBoundingClientRect'
    ).mockReturnValue({ top: 0 } as DOMRect)
    vi.spyOn(
      screen.getByRole('heading', { name: 'Second' }),
      'getBoundingClientRect'
    ).mockImplementation(() => ({ top: secondTop }) as DOMRect)
    const nav = within(screen.getByRole('navigation'))
    await waitFor(() =>
      expect(nav.getByRole('link', { name: 'First' })).toHaveAttribute(
        'aria-current',
        'location'
      )
    )
    secondTop = 20
    fireEvent.scroll(screen.getByTestId('reader-scroll'))
    await waitFor(() =>
      expect(nav.getByRole('link', { name: 'Second' })).toHaveAttribute(
        'aria-current',
        'location'
      )
    )
    expect(nav.getByRole('link', { name: 'First' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it.each([
    <pre key='txt'># Plain text stays literal</pre>,
    <pre key='openapi'>
      <code>{'openapi: 3.0.0\ninfo:\n  title: API'}</code>
    </pre>,
  ])(
    'does not invent headings for literal TXT or OpenAPI content',
    async (content) => {
      const screen = render(<Reader content={content} />)
      await waitFor(() =>
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
      )
    }
  )
})

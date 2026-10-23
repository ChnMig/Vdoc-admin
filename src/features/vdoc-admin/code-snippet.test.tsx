import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { CodeSnippet } from './code-snippet'

function snippet(content: string) {
  return (
    <LanguageProvider>
      <CodeSnippet title='config.toml' content={content} />
    </LanguageProvider>
  )
}

describe('CodeSnippet clipboard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('copies the complete content and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const content = 'line one\nline two'
    const screen = render(snippet(content))

    fireEvent.click(screen.getByRole('button', { name: /config.toml/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(content))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Copied')
    )
  })

  it('keeps the code available for manual selection when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const screen = render(snippet('manually selectable configuration'))

    fireEvent.click(screen.getByRole('button', { name: /config.toml/ }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed')
    )
    expect(screen.getByText('manually selectable configuration')).toBeVisible()
  })

  it('does not show stale feedback when token configuration changes during copying', async () => {
    let resolve!: () => void
    const writeText = vi.fn().mockReturnValue(
      new Promise<void>((complete) => {
        resolve = complete
      })
    )
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const screen = render(snippet('synthetic original token configuration'))
    fireEvent.click(screen.getByRole('button', { name: /config.toml/ }))

    screen.rerender(snippet('<YOUR_ACTIVE_VDOC_TOKEN>'))
    await act(async () => resolve())

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByText('<YOUR_ACTIVE_VDOC_TOKEN>')).toBeVisible()
    expect(
      screen.queryByText('synthetic original token configuration')
    ).toBeNull()
  })
})

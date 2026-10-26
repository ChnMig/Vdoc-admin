import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DocumentReader } from './document-reader'

afterEach(() => vi.unstubAllGlobals())

it.each([1, 2, 3])(
  'copies exact raw content for document type %s without metadata or rendered text',
  async (documentType) => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const source =
      '\uFEFF# Raw title\r\n\r\n**Original**  \n<script>literal</script>'
    const screen = render(
      <DocumentReader
        title='Different display name'
        filePath='folder/source.md'
        documentType={documentType}
        content={source}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledExactlyOnceWith(source)
    )
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeEnabled()
    expect(screen.container.querySelector('script')).toBeNull()
  }
)

it('keeps copy and source actions disabled until content is loaded, including an empty source', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const screen = render(<DocumentReader title='Empty file' documentType={2} />)
  expect(screen.getByRole('button', { name: 'Copy content' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Download source' })).toBeDisabled()
  screen.rerender(
    <DocumentReader title='Empty file' documentType={2} content='' />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(''))
})

it('does not apply a late copy result to another revision', async () => {
  let finish!: () => void
  const writeText = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
  const screen = render(
    <DocumentReader title='Guide' documentType={3} content='first' />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Copy content' }))
  screen.rerender(
    <DocumentReader title='Guide' documentType={3} content='next' />
  )
  await act(async () => finish())
  expect(screen.getByRole('button', { name: 'Copy content' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
})

import { useState } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  uploadDocumentImage,
  type DocumentImage,
} from '@/lib/document-images-api'
import { MarkdownImageEditor } from './markdown-image-editor'

vi.mock('@/lib/document-images-api', () => ({
  uploadDocumentImage: vi.fn(),
  getDocumentImage: vi.fn(),
}))
const image: DocumentImage = {
  asset_id: 'a'.repeat(64),
  reference: `vdoc-asset:${'a'.repeat(64)}`,
  filename: 'diagram.png',
  content_type: 'image/png',
  byte_length: 4,
  width: 1,
  height: 1,
}
const png = () => new File(['image'], 'diagram.png', { type: 'image/png' })
function Editor({ documentId = 'doc' }: { documentId?: string }) {
  const [value, setValue] = useState('before after')
  const [pending, setPending] = useState(false)
  return (
    <>
      <label htmlFor='markdown'>Content</label>
      <MarkdownImageEditor
        id='markdown'
        projectId='project'
        documentId={documentId}
        value={value}
        disabled={pending}
        onChange={setValue}
        onBusyChange={setPending}
      />
    </>
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(uploadDocumentImage).mockResolvedValue(image)
})
afterEach(cleanup)

describe('Markdown image editing', () => {
  it('inserts a selected image at the selection and preserves surrounding text', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const input = screen.getByRole('textbox', {
      name: 'Content',
    }) as HTMLTextAreaElement
    input.setSelectionRange(7, 7)
    await user.upload(screen.getByLabelText('Choose document images'), png())
    await waitFor(() =>
      expect(input).toHaveValue(
        `before ![diagram.png](${image.reference})after`
      )
    )
    expect(uploadDocumentImage).toHaveBeenCalledWith(
      'project',
      'doc',
      expect.any(File),
      expect.any(AbortSignal)
    )
  })
  it.each(['paste', 'drop'])(
    'accepts %s images without navigating or discarding the text',
    async (kind) => {
      render(<Editor />)
      const input = screen.getByRole('textbox', {
        name: 'Content',
      }) as HTMLTextAreaElement
      input.setSelectionRange(input.value.length, input.value.length)
      if (kind === 'paste')
        fireEvent.paste(input, { clipboardData: { files: [png()] } })
      else fireEvent.drop(input, { dataTransfer: { files: [png()] } })
      await waitFor(() => expect(input.value).toContain(image.reference))
      expect(input.value).toMatch(/^before after/)
    }
  )
  it('preserves text after an upload error and rejects oversized images before sending', async () => {
    const user = userEvent.setup()
    vi.mocked(uploadDocumentImage).mockRejectedValueOnce(new Error('network'))
    render(<Editor />)
    await user.upload(screen.getByLabelText('Choose document images'), png())
    expect(await screen.findByText(/Image upload failed/)).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(
      'before after'
    )
    await user.upload(
      screen.getByLabelText('Choose document images'),
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      })
    )
    expect(
      await screen.findByText(/at most|between 1 byte and 4 MB/)
    ).toBeVisible()
    expect(uploadDocumentImage).toHaveBeenCalledOnce()
  })
  it('ignores a delayed upload after switching documents', async () => {
    let finish!: (value: DocumentImage) => void
    vi.mocked(uploadDocumentImage).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const user = userEvent.setup()
    const view = render(<Editor />)
    await user.upload(screen.getByLabelText('Choose document images'), png())
    view.rerender(<Editor documentId='other-document' />)
    await act(async () => finish(image))
    expect(vi.mocked(uploadDocumentImage).mock.calls[0][3].aborted).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(
      'before after'
    )
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeEnabled()
  })
})

import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { translate } from '@/lib/i18n'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { visibleDocumentFolders } from './document-folder-picker'
import {
  DocumentFormFields,
  documentPayloadFromFormData,
} from './document-form-fields'

const api = vi.hoisted(() => ({
  listDocumentFolders: vi.fn(),
  createDocumentFolder: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
const t: Parameters<typeof documentPayloadFromFormData>[1] = (key, values) =>
  translate('en', key, values)
const folder = (
  id: string,
  parent: string | null = null,
  name = id
): DocumentFolderDTO => ({
  id,
  project_id: 'project-a',
  parent_id: parent,
  name,
  path: name,
  created_by: 'admin',
  created_at: '2026-10-24T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
})
function setup(projectId = 'project-a', document?: DocumentDTO) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const ui = (project: string) => (
    <StrictMode>
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <form data-testid='document-form'>
            <DocumentFormFields projectId={project} document={document} />
          </form>
        </LanguageProvider>
      </QueryClientProvider>
    </StrictMode>
  )
  return { ...render(ui(projectId)), client, ui }
}
beforeEach(() => {
  vi.clearAllMocks()
  api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
})

describe('document file and folder fields', () => {
  it('defaults the filename until edited, then keeps it independent of display name and uploads', async () => {
    setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Name'), 'Display title')
    expect(screen.getByLabelText('Filename')).toHaveValue('Display title.yaml')
    await user.clear(screen.getByLabelText('Filename'))
    await user.type(screen.getByLabelText('Filename'), 'custom.yaml')
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'New title')
    expect(screen.getByLabelText('Filename')).toHaveValue('custom.yaml')
    await user.upload(
      screen.getByLabelText('Initial document file (optional)'),
      new File(['openapi: 3.0.0'], 'original.yaml', {
        type: 'application/yaml',
      })
    )
    expect(screen.getByLabelText('Filename')).toHaveValue('custom.yaml')
    expect(screen.getByLabelText('Name')).toHaveValue('New title')
  })

  it('uses the original uploaded filename, infers TXT, and preserves exact content in one create payload', async () => {
    setup()
    const user = userEvent.setup()
    const content = '# Literal heading\r\n<script>literal</script>\r\n中文\n'
    await user.upload(
      screen.getByLabelText('Initial document file (optional)'),
      new File([content], 'notes.txt', { type: 'text/plain' })
    )
    expect(screen.getByLabelText('Filename')).toHaveValue('notes.txt')
    expect(screen.getByLabelText('Name')).toHaveValue('notes')
    const data = new FormData(
      screen.getByTestId('document-form') as HTMLFormElement
    )
    // JSDOM does not copy the userEvent file list into native FormData yet.
    const upload = screen.getByLabelText<HTMLInputElement>(
      'Initial document file (optional)'
    )
    data.set('initial_file', upload.files![0])
    const payload = await documentPayloadFromFormData(data, t)
    expect(payload).toEqual({
      name: 'notes',
      description: '',
      document_type: 3,
      file_name: 'notes.txt',
      folder_id: null,
      initial_content: { content, version_name: '0.1.0' },
    })
  })

  it('distinguishes an empty uploaded TXT from no upload and rejects invalid UTF-8', async () => {
    const data = new FormData()
    data.set('name', 'Empty document')
    data.set('file_name', 'empty.txt')
    data.set('document_type', '3')
    expect(await documentPayloadFromFormData(data, t)).not.toHaveProperty(
      'initial_content'
    )
    data.set('initial_file', new File([], 'empty.txt'))
    expect(
      (await documentPayloadFromFormData(data, t)).initial_content
    ).toEqual({ content: '', version_name: '0.1.0' })
    data.set('initial_file', new File([new Uint8Array([0xff])], 'invalid.txt'))
    await expect(documentPayloadFromFormData(data, t)).rejects.toThrow('UTF-8')
  })

  it('preserves a UTF-8 BOM and non-ASCII bytes in initial upload content', async () => {
    const data = new FormData()
    data.set('name', 'UTF-8 document')
    data.set('file_name', 'utf8.txt')
    data.set('document_type', '3')
    const content = '\uFEFF中文\r\n'
    data.set('initial_file', new File([content], 'utf8.txt'))
    expect(
      (await documentPayloadFromFormData(data, t)).initial_content
    ).toEqual({
      content,
      version_name: '0.1.0',
    })
  })

  it('rejects path traversal and type mismatches without making a create request', async () => {
    const data = new FormData()
    data.set('name', 'Title')
    data.set('document_type', '3')
    data.set('file_name', '../notes.txt')
    await expect(documentPayloadFromFormData(data, t)).rejects.toThrow(
      'filename'
    )
    data.set('file_name', 'notes.md')
    await expect(documentPayloadFromFormData(data, t)).rejects.toThrow(
      'extension'
    )
    data.set('file_name', 'notes.txt')
    data.set('initial_file_invalid', 'true')
    await expect(documentPayloadFromFormData(data, t)).rejects.toThrow('file')
    data.set('initial_file_invalid', 'false')
    data.set('folder_valid', 'false')
    await expect(documentPayloadFromFormData(data, t)).rejects.toThrow('folder')
  })

  it('appends the matching default extension when the independent filename has none', async () => {
    const data = new FormData()
    data.set('name', 'Display title')
    data.set('file_name', 'independent-name')
    data.set('document_type', '3')
    expect(await documentPayloadFromFormData(data, t)).toMatchObject({
      name: 'Display title',
      file_name: 'independent-name.txt',
    })
  })

  it('allows moving an unresolved legacy path explicitly to project root', async () => {
    setup('project-a', {
      id: 'legacy-document',
      project_id: 'project-a',
      name: 'Legacy title',
      relative_path: 'missing/title.txt',
      document_type: 3,
      status: 1,
      created_by: 'admin',
      created_at: '2026-10-24T00:00:00Z',
      updated_at: '2026-10-24T00:00:00Z',
    })
    const user = userEvent.setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('folder')
    await user.click(screen.getByRole('button', { name: 'Project root' }))
    const data = new FormData(
      screen.getByTestId('document-form') as HTMLFormElement
    )
    expect(await documentPayloadFromFormData(data, t)).toMatchObject({
      file_name: 'title.txt',
      folder_id: null,
    })
  })

  it('announces file removal to the enclosing form for pending edit tracking', async () => {
    setup()
    const user = userEvent.setup()
    await user.upload(
      screen.getByLabelText('Initial document file (optional)'),
      new File(['text'], 'notes.txt', { type: 'text/plain' })
    )
    const onInput = vi.fn()
    screen.getByTestId('document-form').addEventListener('input', onInput)
    await user.click(
      screen.getByRole('button', { name: 'Remove uploaded file' })
    )
    expect(onInput).toHaveBeenCalledOnce()
    expect(
      screen.getByLabelText<HTMLInputElement>(
        'Initial document file (optional)'
      ).files
    ).toHaveLength(0)
  })

  it('expands folders with normal keyboard buttons, creates a selected empty child, and retries without losing its name', async () => {
    const existing = [
      folder('parent', null, 'Guides'),
      folder('child', 'parent', 'Nested'),
    ]
    api.listDocumentFolders.mockResolvedValue({ items: existing, total: 2 })
    api.createDocumentFolder
      .mockRejectedValueOnce(new Error('Folder save failed'))
      .mockResolvedValueOnce(folder('new', 'child', 'New leaf'))
    setup()
    const user = userEvent.setup()
    const expand = await screen.findByRole('button', { name: 'Expand Guides' })
    expand.focus()
    await user.keyboard('{Enter}')
    const child = screen.getByRole('button', { name: 'Nested' })
    child.focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: 'New subfolder' }))
    await user.type(screen.getByLabelText('Folder name'), 'New leaf')
    await user.click(screen.getByRole('button', { name: 'Create folder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Folder save failed'
    )
    expect(screen.getByLabelText('Folder name')).toHaveValue('New leaf')
    await user.click(screen.getByRole('button', { name: 'Create folder' }))
    await waitFor(() =>
      expect(screen.queryByLabelText('Folder name')).not.toBeInTheDocument()
    )
    expect(api.createDocumentFolder).toHaveBeenLastCalledWith('project-a', {
      name: 'New leaf',
      parent_id: 'child',
    })
    expect(screen.getByRole('button', { name: 'New leaf' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      new FormData(screen.getByTestId('document-form') as HTMLFormElement).get(
        'folder_id'
      )
    ).toBe('new')
  })

  it('resets location and input ownership on project changes and ignores a previous project folder response', async () => {
    let resolve!: (value: DocumentFolderDTO) => void
    api.createDocumentFolder.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const view = setup()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Name'), 'Old project title')
    await user.click(screen.getByRole('button', { name: 'New subfolder' }))
    await user.type(screen.getByLabelText('Folder name'), 'Old folder')
    await user.click(screen.getByRole('button', { name: 'Create folder' }))
    await waitFor(() => expect(api.createDocumentFolder).toHaveBeenCalledOnce())
    view.rerender(view.ui('project-b'))
    expect(screen.getByLabelText('Name')).toHaveValue('')
    await act(async () => resolve(folder('old-result')))
    expect(
      screen.queryByRole('button', { name: 'old-result' })
    ).not.toBeInTheDocument()
    expect(
      new FormData(screen.getByTestId('document-form') as HTMLFormElement).get(
        'folder_id'
      )
    ).toBe('')
  })

  it('does not recurse or cap valid folder depth', () => {
    const folders = Array.from({ length: 12_000 }, (_, index) =>
      folder(String(index), index === 0 ? null : String(index - 1))
    )
    const visible = visibleDocumentFolders(
      folders,
      new Set(folders.map((item) => item.id))
    )
    expect(visible).toHaveLength(12_000)
    expect(visible[visible.length - 1]?.depth).toBe(11_999)
  })
})

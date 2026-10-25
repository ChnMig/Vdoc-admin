import type { ComponentProps } from 'react'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentFileTree } from './document-file-tree'

const makeFolder = (
  id: string,
  name: string,
  parent_id: string | null = null,
  path = name
): DocumentFolderDTO => ({
  id,
  name,
  parent_id,
  path,
  project_id: 'project-1',
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})

const makeDocument = (
  id: string,
  folder_id: string | null = null,
  document_type = 3
): DocumentDTO => ({
  id,
  name: `${id} title`,
  file_name: `${id}.txt`,
  document_type,
  folder_id,
  project_id: 'project-1',
  workflow_state: 'empty',
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})

type TreeProps = ComponentProps<typeof DocumentFileTree>

function renderTree(overrides: Partial<TreeProps> = {}) {
  let props: TreeProps = {
    folders: [makeFolder('guides', 'Guides')],
    documents: [makeDocument('intro', 'guides')],
    folderId: '',
    onFolderSelect: vi.fn(),
    onDocumentSelect: vi.fn(),
    ...overrides,
  }
  const view = () => (
    <LanguageProvider>
      <DocumentFileTree {...props} />
    </LanguageProvider>
  )
  const screen = render(view())
  return {
    ...screen,
    onFolderSelect: props.onFolderSelect,
    onDocumentSelect: props.onDocumentSelect,
    rerenderTree: (next: Partial<TreeProps>) => {
      props = { ...props, ...next }
      screen.rerender(view())
    },
  }
}

describe('document file tree', () => {
  beforeEach(() => {
    document.cookie = 'vdoc-admin-language=en; path=/'
  })

  it('uses the whole folder row to expand and select the creation destination', async () => {
    const user = userEvent.setup()
    const screen = renderTree()
    const folder = screen.getByRole('button', { name: 'Expand Guides' })
    expect(within(folder).getByText('Guides')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /intro.txt/ })).toBeNull()

    await user.click(within(folder).getByText('Guides'))

    expect(screen.onFolderSelect).toHaveBeenLastCalledWith('guides')
    expect(folder).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('button', { name: /intro.txt/ })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Guides/ })).toHaveLength(1)

    screen.rerenderTree({ folderId: 'guides' })
    expect(folder).toHaveAttribute('aria-pressed', 'true')
    expect(folder).toHaveAttribute('aria-current', 'location')
    await user.click(folder)
    expect(folder).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /intro.txt/ })).toBeNull()
    expect(screen.onFolderSelect).toHaveBeenCalledTimes(2)
  })

  it('supports native activation, expansion keys, and navigation between visible rows', async () => {
    const user = userEvent.setup()
    const screen = renderTree({
      folders: [
        makeFolder('guides', 'Guides'),
        makeFolder('reference', 'Reference'),
      ],
    })
    const navigation = screen.getByRole('navigation', { name: 'Files' })
    const root = within(navigation).getAllByRole('button')[0]
    const guides = screen.getByRole('button', { name: 'Expand Guides' })
    const reference = screen.getByRole('button', { name: 'Expand Reference' })
    root.focus()
    await user.keyboard('{ArrowDown}')
    expect(guides).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(guides).toHaveAttribute('aria-expanded', 'true')
    expect(screen.onFolderSelect).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('button', { name: /intro.txt/ })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(reference).toHaveFocus()
    await user.keyboard('{Home}')
    expect(root).toHaveFocus()
    await user.keyboard('{End}')
    expect(reference).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowLeft}')
    expect(guides).toHaveFocus()
    expect(guides).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{Enter}')
    expect(guides).toHaveAttribute('aria-expanded', 'true')
    expect(screen.onFolderSelect).toHaveBeenLastCalledWith('guides')
    await user.keyboard(' ')
    expect(guides).toHaveAttribute('aria-expanded', 'false')
    expect(screen.onFolderSelect).toHaveBeenCalledTimes(2)
  })

  it('expands the open document ancestors independently from the creation destination', async () => {
    const user = userEvent.setup()
    const screen = renderTree({
      folders: [
        makeFolder('guides', 'Guides'),
        makeFolder('install', 'Install', 'guides', 'Guides/Install'),
        makeFolder('reference', 'Reference'),
      ],
      documents: [makeDocument('intro', 'install')],
      documentId: 'intro',
      folderId: 'reference',
    })
    const selectedDocument = screen.getByRole('button', { name: /intro.txt/ })
    expect(selectedDocument).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('button', { name: 'Collapse Guides' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Collapse Install' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expand Reference' })
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Collapse Guides' }))
    screen.rerenderTree({ folderId: 'guides' })
    expect(screen.queryByRole('button', { name: /intro.txt/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Expand Guides' })
    ).toHaveAttribute('aria-expanded', 'false')
    screen.rerenderTree({ folderId: '' })
    const root = within(
      screen.getByRole('navigation', { name: 'Files' })
    ).getAllByRole('button')[0]
    expect(root).toHaveAttribute('aria-pressed', 'true')
  })

  it('finds legacy document ancestors from the relative path', () => {
    const screen = renderTree({
      folders: [
        makeFolder('guides', 'Guides'),
        makeFolder('install', 'Install', 'guides', 'Guides/Install'),
      ],
      documents: [
        { ...makeDocument('intro'), relative_path: 'guides/install/intro.txt' },
      ],
      documentId: 'intro',
    })
    expect(
      screen.getByRole('button', { name: /intro.txt/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Collapse Guides' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Collapse Install' })
    ).toBeInTheDocument()
  })

  it('keeps the scroll position while browsing folders beside an open document', async () => {
    const user = userEvent.setup()
    const screen = renderTree({
      documents: [makeDocument('intro'), makeDocument('next')],
      documentId: 'intro',
    })
    const navigation = screen.getByRole('navigation', { name: 'Files' })
    const selected = screen.getByRole('button', { name: /intro.txt/ })
    vi.spyOn(navigation, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 100,
    } as DOMRect)
    vi.spyOn(selected, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 520,
    } as DOMRect)
    navigation.scrollTop = 20

    await user.click(screen.getByRole('button', { name: 'Expand Guides' }))
    screen.rerenderTree({ folderId: 'guides' })
    expect(navigation.scrollTop).toBe(20)
    vi.spyOn(
      screen.getByRole('button', { name: /next.txt/ }),
      'getBoundingClientRect'
    ).mockReturnValue({ top: 600, bottom: 620 } as DOMRect)
    screen.rerenderTree({ documentId: 'next' })
    expect(navigation.scrollTop).toBe(540)
  })

  it('lets search matches collapse, resets expansion for a new query, and restores normal expansion', async () => {
    const user = userEvent.setup()
    const screen = renderTree({
      folders: [
        makeFolder('guides', 'Guides'),
        makeFolder('install', 'Install', 'guides', 'Guides/Install'),
      ],
      documents: [makeDocument('intro', 'install')],
    })
    const search = screen.getByRole('textbox', { name: 'Search files' })
    await user.type(search, 'intro')
    expect(
      screen.getByRole('button', { name: /intro.txt/ })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse Guides' }))
    expect(screen.queryByRole('button', { name: /intro.txt/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Expand Guides' })
    ).toHaveAttribute('aria-expanded', 'false')
    await user.clear(search)
    expect(
      screen.getByRole('button', { name: 'Expand Guides' })
    ).toBeInTheDocument()
    await user.type(search, 'intro')
    expect(
      screen.getByRole('button', { name: /intro.txt/ })
    ).toBeInTheDocument()
    await user.clear(search)
    expect(screen.queryByRole('button', { name: /intro.txt/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Expand Guides' }))
    expect(
      screen.getByRole('button', { name: 'Expand Install' })
    ).toBeInTheDocument()
    await user.type(search, 'intro')
    await user.clear(search)
    expect(
      screen.getByRole('button', { name: 'Collapse Guides' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Expand Install' })
    ).toBeInTheDocument()
  })

  it('exposes document type names and selects the document when its row is activated', async () => {
    const user = userEvent.setup()
    const documents = [
      makeDocument('api', null, 1),
      makeDocument('guide', null, 2),
      makeDocument('notes', null, 3),
    ]
    const screen = renderTree({ folders: [], documents })
    const api = screen.getByRole('button', { name: /OpenAPI.*api.txt/ })
    const markdown = screen.getByRole('button', { name: /Markdown.*guide.txt/ })
    const text = screen.getByRole('button', { name: /TXT.*notes.txt/ })
    expect(
      new Set(
        [api, markdown, text].map((row) => row.querySelector('svg')?.innerHTML)
      ).size
    ).toBe(3)
    await user.click(text)
    expect(screen.onDocumentSelect).toHaveBeenCalledWith(documents[2])
    expect(screen.onFolderSelect).not.toHaveBeenCalled()
  })
})

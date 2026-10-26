import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDTO, DraftDTO, VersionDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import {
  DocumentWorkspaceContent,
  type DocumentReadingSelection,
} from './document-workspace-content'

const api = vi.hoisted(() => ({
  getDraftContent: vi.fn(),
  getVersionContent: vi.fn(),
  listEndpoints: vi.fn(),
  getEndpoint: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const document: DocumentDTO = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'Release guide',
  file_name: 'release.txt',
  document_type: 3,
  latest_version_id: 'latest-version',
  latest_draft_id: 'latest-draft',
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const draft: DraftDTO = {
  id: 'selected-draft',
  revision: 'revision-1',
  review_revision: 'review-1',
  project_id: document.project_id,
  document_id: document.id,
  branch_id: 'branch-1',
  version_name: 'Next release',
  document_format: 4,
  source_type: 1,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const version: VersionDTO = {
  ...draft,
  id: 'older-version',
  version_name: 'Release 1.0',
  draft_id: 'published-draft',
  published_by: 'user-1',
  published_at: '',
}
const publishedSelection: DocumentReadingSelection = {
  mode: 'published',
  branchId: 'branch-1',
  version,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderReader(
  selection?: DocumentReadingSelection,
  {
    presentation = 'panel',
    canWrite = false,
    documentType = document.document_type,
    endpointId: initialEndpointId,
  }: {
    presentation?: 'panel' | 'page'
    canWrite?: boolean
    documentType?: number
    endpointId?: string
  } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let currentSelection = selection
  let currentEndpointId = initialEndpointId
  const onEndpointChange = vi.fn((value: string) => {
    currentEndpointId = value || undefined
    screen.rerender(element(currentSelection))
  })
  const element = (nextSelection?: DocumentReadingSelection) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentWorkspaceContent
          projectId={document.project_id}
          document={{ ...document, document_type: documentType }}
          selection={nextSelection}
          canWrite={canWrite}
          presentation={presentation}
          endpointId={currentEndpointId}
          onEndpointChange={onEndpointChange}
          onEditDraft={vi.fn()}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(element(selection))
  return {
    ...screen,
    onEndpointChange,
    rerenderSelection: (nextSelection: DocumentReadingSelection) => {
      currentSelection = nextSelection
      screen.rerender(element(nextSelection))
    },
  }
}

describe('document workspace reading selection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    api.getVersionContent.mockResolvedValue({
      content: 'Published <literal>\r\ncontent\n',
    })
    api.getDraftContent.mockResolvedValue({ content: 'Selected draft content' })
    api.listEndpoints.mockResolvedValue({
      items: [
        {
          id: 'endpoint-1',
          version_id: version.id,
          method: 'GET',
          path: '/workspace-endpoint',
          summary: 'Workspace endpoint',
          deprecated: false,
          hash: '',
          created_at: '',
          updated_at: '',
        },
      ],
      total: 1,
    })
    api.getEndpoint.mockResolvedValue({
      id: 'endpoint-1',
      version_id: version.id,
      method: 'GET',
      path: '/workspace-endpoint',
      summary: 'Workspace endpoint',
      deprecated: false,
      hash: '',
      created_at: '',
      updated_at: '',
      responses: { description: 'Endpoint response facts' },
    })
  })

  it('reads an explicitly selected older published version as literal TXT', async () => {
    const screen = renderReader(publishedSelection)
    expect(await screen.findByText('Published <literal> content')).toBeVisible()
    expect(api.getVersionContent).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'older-version',
      'raw',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(api.getDraftContent).not.toHaveBeenCalled()
    expect(screen.container.querySelector('literal')).toBeNull()
    expect(screen.getByText('branch-1')).toBeVisible()
    expect(screen.getByText('Release 1.0')).toBeVisible()
  })

  it('renders a page reader without a duplicate revision toolbar or edit action', async () => {
    const screen = renderReader(publishedSelection, {
      presentation: 'page',
      canWrite: true,
    })
    expect(await screen.findByText('Published <literal> content')).toBeVisible()
    expect(screen.queryByText('Release 1.0')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit draft' })
    ).not.toBeInTheDocument()
    expect(screen.container.querySelector('article')).not.toHaveClass(
      'panel-control',
      'border',
      'bg-card'
    )
    expect(
      screen.container.querySelector('[data-document-content]')
    ).toHaveTextContent('Published <literal>')
    expect(api.getVersionContent.mock.calls[0][2]).toBe('older-version')
  })

  it('separates document metadata from Markdown and switches views locally with one labeled icon button', async () => {
    const source =
      '# Release guide\n\n## Content section\n\n**Reviewed content**'
    api.getVersionContent.mockResolvedValue({ content: source })
    const screen = renderReader(publishedSelection, {
      presentation: 'page',
      documentType: 2,
    })
    const heading = await screen.findByRole('heading', {
      name: 'Content section',
    })
    const metadata = screen.container.querySelector<HTMLElement>(
      '[data-document-reading-header]'
    )!
    const body = screen.container.querySelector<HTMLElement>(
      '[data-document-content]'
    )!
    expect(metadata).toHaveTextContent('Release guide')
    expect(metadata).toHaveTextContent('File path')
    expect(metadata).toHaveTextContent('release.txt')
    expect(body).toContainElement(heading)
    expect(body).not.toContainElement(metadata)
    expect(body).not.toContainElement(
      screen.getByRole('heading', { name: 'Release guide' })
    )
    expect(
      screen.queryByRole('tab', { name: 'Preview' })
    ).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Switch to source' })
    const previewIcon = toggle.querySelector('svg')!.innerHTML
    toggle.focus()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Switch to preview' })).toBe(
      toggle
    )
    expect(toggle).toHaveFocus()
    expect(toggle.querySelector('svg')!.innerHTML).not.toBe(previewIcon)
    expect(body.querySelector('pre')).toHaveTextContent('# Release guide')
    expect(body.querySelector('h2')).toBeNull()

    screen.rerenderSelection({ mode: 'draft', branchId: 'branch-1', draft })
    await screen.findByText('Selected draft content', { selector: 'pre' })
    const draftBody = screen.container.querySelector<HTMLElement>(
      '[data-document-content]'
    )!
    expect(screen.getByRole('button', { name: 'Switch to preview' })).toBe(
      toggle
    )
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Switch to source' })).toBe(
      toggle
    )
    expect(draftBody.querySelector('article')).toHaveTextContent(
      'Selected draft content'
    )
    expect(api.getVersionContent).toHaveBeenCalledOnce()
    expect(api.getDraftContent).toHaveBeenCalledOnce()
  })

  it('retains metadata while a Markdown selection is pending and disables its view control', () => {
    const screen = renderReader(
      { ...publishedSelection, pending: true },
      {
        presentation: 'page',
        documentType: 2,
      }
    )
    expect(screen.getByRole('heading', { name: 'Release guide' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Switch to source' })
    ).toBeDisabled()
    expect(screen.container.querySelector('[data-document-content]')).toBeNull()
    expect(api.getVersionContent).not.toHaveBeenCalled()
  })

  it('aborts the old request and does not show late published content after switching to a draft', async () => {
    const oldContent = deferred<{ content: string }>()
    const draftContent = deferred<{ content: string }>()
    api.getVersionContent.mockReturnValue(oldContent.promise)
    api.getDraftContent.mockReturnValue(draftContent.promise)
    const screen = renderReader(publishedSelection)
    await waitFor(() => expect(api.getVersionContent).toHaveBeenCalledOnce())
    const signal = api.getVersionContent.mock.calls[0][4].signal as AbortSignal

    screen.rerenderSelection({ mode: 'draft', branchId: 'branch-1', draft })
    await waitFor(() => expect(api.getDraftContent).toHaveBeenCalledOnce())
    expect(signal.aborted).toBe(true)
    expect(api.getDraftContent).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'selected-draft',
      'raw',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    await act(async () =>
      oldContent.resolve({ content: 'Wrong late published content' })
    )
    expect(
      screen.queryByText('Wrong late published content')
    ).not.toBeInTheDocument()
    await act(async () =>
      draftContent.resolve({ content: 'Right selected draft content' })
    )
    expect(
      await screen.findByText('Right selected draft content')
    ).toBeVisible()
  })

  it.each<DocumentReadingSelection>([
    { mode: 'published', branchId: 'branch-1' },
    { mode: 'draft', branchId: 'branch-1' },
    { ...publishedSelection, invalid: true },
    { ...publishedSelection, pending: true },
    { ...publishedSelection, branchId: 'other-branch' },
    {
      ...publishedSelection,
      version: { ...version, document_id: 'other-document' },
    },
    {
      ...publishedSelection,
      version: { ...version, project_id: 'other-project' },
    },
  ])(
    'never falls back to latest content for an unresolved or invalid controlled selection: %j',
    async (selection) => {
      renderReader(selection)
      await act(async () => Promise.resolve())
      expect(api.getVersionContent).not.toHaveBeenCalled()
      expect(api.getDraftContent).not.toHaveBeenCalled()
    }
  )

  it('clears visible cached content while a different revision loads', async () => {
    const screen = renderReader(publishedSelection)
    await screen.findByText('Published <literal> content')
    const nextContent = deferred<{ content: string }>()
    api.getVersionContent.mockReturnValue(nextContent.promise)
    screen.rerenderSelection({
      ...publishedSelection,
      version: { ...version, id: 'version-2' },
    })
    expect(
      screen.queryByText('Published <literal> content')
    ).not.toBeInTheDocument()
    await act(async () =>
      nextContent.resolve({ content: 'Second version content' })
    )
    expect(await screen.findByText('Second version content')).toBeVisible()
  })

  it('preserves the latest-published fallback only when selection is omitted', async () => {
    const screen = renderReader()
    await screen.findByText('Published <literal> content')
    expect(api.getVersionContent.mock.calls[0][2]).toBe('latest-version')
    expect(api.getDraftContent).not.toHaveBeenCalled()
  })

  it('opens published OpenAPI interfaces from the reader and writes selected endpoint state without navigating to version tools', async () => {
    const screen = renderReader(publishedSelection, {
      documentType: 1,
      presentation: 'page',
    })
    await waitFor(() => expect(api.getVersionContent).toHaveBeenCalledOnce())
    expect(api.listEndpoints).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Source' })).toHaveAttribute(
      'data-state',
      'active'
    )
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'OpenAPI endpoints' }),
      { button: 0 }
    )
    const row = await screen.findByRole('button', {
      name: /workspace-endpoint/,
    })
    fireEvent.click(row)
    expect(screen.onEndpointChange).toHaveBeenLastCalledWith('endpoint-1')
    expect(
      await screen.findByText('Endpoint response facts', { exact: false })
    ).toBeVisible()
    expect(
      screen.queryByRole('tab', { name: 'Versions' })
    ).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Source' }), {
      button: 0,
    })
    expect(screen.onEndpointChange).toHaveBeenLastCalledWith('')
    expect(screen.getByRole('tab', { name: 'Source' })).toHaveAttribute(
      'data-state',
      'active'
    )
  })

  it('opens an exact OpenAPI endpoint deep link and loads raw source for copy and download', async () => {
    const screen = renderReader(publishedSelection, {
      documentType: 1,
      endpointId: 'endpoint-1',
    })
    expect(
      await screen.findByText('Endpoint response facts', { exact: false })
    ).toBeVisible()
    expect(
      screen.getByRole('tab', { name: 'OpenAPI endpoints' })
    ).toHaveAttribute('data-state', 'active')
    expect(api.getVersionContent).toHaveBeenCalledOnce()
    expect(api.getEndpoint).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'older-version',
      'endpoint-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(screen.onEndpointChange).not.toHaveBeenCalled()
  })

  it.each<DocumentReadingSelection>([
    { mode: 'published', branchId: 'branch-1' },
    { ...publishedSelection, invalid: true },
    { ...publishedSelection, pending: true },
    { ...publishedSelection, branchId: 'foreign-branch' },
    {
      ...publishedSelection,
      version: { ...version, project_id: 'foreign-project' },
    },
    {
      ...publishedSelection,
      version: { ...version, document_id: 'foreign-document' },
    },
  ])(
    'does not mount endpoint queries or fall back to latest for an invalid OpenAPI owner: %j',
    async (selection) => {
      const screen = renderReader(selection, {
        documentType: 1,
        endpointId: 'endpoint-1',
      })
      await act(async () => Promise.resolve())
      expect(api.listEndpoints).not.toHaveBeenCalled()
      expect(api.getEndpoint).not.toHaveBeenCalled()
      expect(api.getVersionContent).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('tab', { name: 'OpenAPI endpoints' })
      ).not.toBeInTheDocument()
    }
  )

  it.each([2, 3])(
    'keeps non-OpenAPI document type %s in its existing reader without endpoint requests',
    async (documentType) => {
      api.getVersionContent.mockResolvedValue({ content: '# Existing content' })
      const screen = renderReader(publishedSelection, {
        documentType,
        endpointId: 'endpoint-1',
      })
      expect(
        await screen.findByText(
          documentType === 2 ? 'Existing content' : '# Existing content'
        )
      ).toBeVisible()
      expect(
        screen.queryByRole('tab', { name: 'OpenAPI endpoints' })
      ).not.toBeInTheDocument()
      expect(api.listEndpoints).not.toHaveBeenCalled()
      expect(api.getEndpoint).not.toHaveBeenCalled()
      expect(api.getVersionContent.mock.calls[0][2]).toBe('older-version')
    }
  )

  it('offers retry for the selected revision after a content error', async () => {
    api.getVersionContent.mockRejectedValueOnce(
      new Error('Content access failed')
    )
    const screen = renderReader(publishedSelection)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Content access failed'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Published <literal> content')).toBeVisible()
    expect(api.getVersionContent).toHaveBeenCalledTimes(2)
    expect(api.getVersionContent.mock.calls[1][2]).toBe('older-version')
    expect(api.getDraftContent).not.toHaveBeenCalled()
  })
})

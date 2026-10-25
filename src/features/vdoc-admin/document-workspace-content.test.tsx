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

function renderReader(selection?: DocumentReadingSelection) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const element = (nextSelection?: DocumentReadingSelection) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentWorkspaceContent
          projectId={document.project_id}
          document={document}
          selection={nextSelection}
          canWrite={false}
          onEditDraft={vi.fn()}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(element(selection))
  return {
    ...screen,
    rerenderSelection: (nextSelection: DocumentReadingSelection) =>
      screen.rerender(element(nextSelection)),
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

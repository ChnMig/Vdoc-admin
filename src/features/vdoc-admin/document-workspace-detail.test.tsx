import { act, fireEvent, render, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDTO, DraftDTO, VersionDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { LanguageProvider } from '@/context/language-provider'
import type { DocumentReadingSelection } from './document-workspace-content'
import { DocumentWorkspaceDetail } from './document-workspace-detail'

const reading = vi.hoisted(() => ({
  selection: {} as DocumentReadingSelection,
  editorMounted: vi.fn(),
  editorUnmounted: vi.fn(),
  draftNavigate: undefined as
    ((patch: Partial<VdocRouteSearch>) => void) | undefined,
  versionNavigate: undefined as
    ((patch: Partial<VdocRouteSearch>) => void) | undefined,
  shareProps: vi.fn(),
}))

vi.mock('./use-document-reading-selection', () => ({
  useDocumentReadingSelection: () => ({
    selection: reading.selection,
    branch: { id: 'branch-1', status: 1 },
    branches: [],
    versions: [],
    drafts: [],
    queryStates: [],
  }),
}))
vi.mock('./document-workspace-toolbar', () => ({
  DocumentWorkspaceToolbar: () => null,
}))
vi.mock('./document-workspace-content', () => ({
  DocumentWorkspaceContent: () => null,
}))
vi.mock('./document-workspace-branches', () => ({
  DocumentWorkspaceBranches: () => null,
}))
vi.mock('./document-workspace-share', () => ({
  DocumentWorkspaceShare: (props: unknown) => {
    reading.shareProps(props)
    return <p>Exact document share context</p>
  },
}))
vi.mock('./versions-page', () => ({
  VersionsPage: ({
    onSearchChange,
  }: {
    onSearchChange: (patch: Partial<VdocRouteSearch>) => void
  }) => {
    reading.versionNavigate = onSearchChange
    return <p>Version tools</p>
  },
}))
vi.mock('./document-workspace-ai', () => ({
  DocumentWorkspaceAI: () => <p>Document AI tools</p>,
}))
vi.mock('./drafts-page', async () => {
  const { useEffect, useState } = await import('react')
  return {
    DraftsPage: function StatefulDraftEditor({
      search,
      onSearchChange,
    }: {
      search: VdocRouteSearch
      onSearchChange: (patch: Partial<VdocRouteSearch>) => void
    }) {
      const id = search.draft_id ?? 'new-draft'
      reading.draftNavigate = onSearchChange
      const [sessions, setSessions] = useState<
        Record<string, { content: string; conflict: boolean }>
      >({})
      const session = sessions[id] ?? {
        content: `Saved content for ${id}`,
        conflict: false,
      }
      useEffect(() => {
        reading.editorMounted()
        return () => reading.editorUnmounted()
      }, [])
      return (
        <section aria-label='Draft editor'>
          <p>Editing {id}</p>
          <label>
            Working draft content
            <textarea
              value={session.content}
              onChange={(event) =>
                setSessions((current) => ({
                  ...current,
                  [id]: { ...session, content: event.target.value },
                }))
              }
            />
          </label>
          <button
            onClick={() =>
              setSessions((current) => ({
                ...current,
                [id]: { ...session, conflict: true },
              }))
            }
          >
            Mark draft conflict
          </button>
          {session.conflict && <p role='alert'>Unresolved draft conflict</p>}
        </section>
      )
    },
  }
})

const document: DocumentDTO = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'Guide',
  latest_version_id: 'latest-version',
  document_type: 2,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const draft = (id: string): DraftDTO => ({
  id,
  project_id: document.project_id,
  document_id: document.id,
  branch_id: 'branch-1',
  revision: `revision-${id}`,
  review_revision: `review-${id}`,
  version_name: id,
  document_format: 3,
  source_type: 1,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
})
const selection = (id: string): DocumentReadingSelection => ({
  mode: 'draft',
  branchId: 'branch-1',
  draft: draft(id),
})

function renderDetail(
  initial: DocumentReadingSelection,
  { canManage = false }: { canManage?: boolean } = {}
) {
  reading.selection = initial
  let search: VdocRouteSearch = {
    project_id: document.project_id,
    document_id: document.id,
    branch_id: 'branch-1',
    draft_id: initial.draft?.id,
    version_id: initial.version?.id,
    content_mode: initial.mode,
    workspace_view: initial.mode === 'draft' ? 'drafts' : 'content',
  }
  const changes = vi.fn()
  const element = () => (
    <LanguageProvider>
      <DocumentWorkspaceDetail
        projectId={document.project_id}
        document={document}
        search={search}
        canManage={canManage}
        canWrite
        interactive
        onSearchChange={changes}
      />
    </LanguageProvider>
  )
  const screen = render(element())
  return {
    ...screen,
    changes,
    rerenderSelection(next: DocumentReadingSelection, requestedId: string) {
      reading.selection = next
      search = {
        ...search,
        draft_id: next.mode === 'draft' ? requestedId : undefined,
        version_id: next.mode === 'published' ? requestedId : undefined,
        content_mode: next.mode,
      }
      screen.rerender(element())
    },
    rerenderView(workspace_view: VdocRouteSearch['workspace_view']) {
      search = { ...search, workspace_view }
      screen.rerender(element())
    },
  }
}

describe('document workspace draft editor retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reading.draftNavigate = undefined
    reading.versionNavigate = undefined
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
  })

  it('keeps draft sessions and conflict state while another draft resolves in the same branch', async () => {
    const screen = renderDetail(selection('draft-a'))
    const content = await screen.findByLabelText('Working draft content')
    fireEvent.change(content, {
      target: { value: 'Unsaved edits for draft A' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mark draft conflict' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unresolved draft conflict'
    )

    screen.rerenderSelection(
      { mode: 'draft', branchId: 'branch-1', pending: true },
      'draft-b'
    )
    expect(content.isConnected).toBe(true)
    expect(screen.getByText('Editing draft-b')).toBeVisible()
    screen.rerenderSelection(selection('draft-b'), 'draft-b')
    expect(screen.getByLabelText('Working draft content')).toHaveValue(
      'Saved content for draft-b'
    )

    screen.rerenderSelection(
      { mode: 'draft', branchId: 'branch-1', pending: true },
      'draft-a'
    )
    screen.rerenderSelection(selection('draft-a'), 'draft-a')
    expect(screen.getByLabelText('Working draft content')).toBe(content)
    expect(content).toHaveValue('Unsaved edits for draft A')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unresolved draft conflict'
    )
    expect(reading.editorMounted).toHaveBeenCalledOnce()
    expect(reading.editorUnmounted).not.toHaveBeenCalled()
    expect(screen.changes).not.toHaveBeenCalled()
  })

  it('retains unsaved draft text and unresolved conflicts while navigating preview, version tools, and AI', async () => {
    const screen = renderDetail(selection('draft-a'))
    const editor = await screen.findByLabelText('Working draft content')
    fireEvent.change(editor, {
      target: { value: 'Unsaved work must survive navigation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mark draft conflict' }))

    for (const view of ['content', 'versions', 'ai'] as const) {
      screen.rerenderView(view)
      if (view === 'versions') await screen.findByText('Version tools')
      if (view === 'ai') await screen.findByText('Document AI tools')
      expect(editor.isConnected).toBe(true)
      expect(editor).not.toBeVisible()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      screen.rerenderView('drafts')
      expect(screen.getByLabelText('Working draft content')).toBe(editor)
      expect(editor).toHaveValue('Unsaved work must survive navigation')
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unresolved draft conflict'
      )
    }
    expect(reading.editorMounted).toHaveBeenCalledOnce()
    expect(reading.editorUnmounted).not.toHaveBeenCalled()
    expect(screen.changes).not.toHaveBeenCalled()
  })

  it('ignores navigation from inactive retained panes and stale selection callbacks', async () => {
    const screen = renderDetail(selection('draft-a'))
    await screen.findByLabelText('Working draft content')
    const draftNavigate = reading.draftNavigate!
    screen.rerenderView('versions')
    await screen.findByText('Version tools')
    const versionNavigate = reading.versionNavigate!
    act(() => draftNavigate({ draft_id: 'stale-hidden-draft' }))
    expect(screen.changes).not.toHaveBeenCalled()

    act(() => versionNavigate({ version_id: 'selected-historical-version' }))
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        version_id: 'selected-historical-version',
        content_mode: 'published',
        draft_id: undefined,
      },
      true
    )
    screen.changes.mockClear()
    screen.rerenderView('drafts')
    act(() => versionNavigate({ version_id: 'stale-hidden-version' }))
    expect(screen.changes).not.toHaveBeenCalled()

    screen.rerenderSelection(selection('draft-b'), 'draft-b')
    act(() => draftNavigate({ draft_id: 'stale-before-selection-change' }))
    expect(screen.changes).not.toHaveBeenCalled()
    act(() => reading.draftNavigate!({ draft_id: 'current-draft-selection' }))
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        draft_id: 'current-draft-selection',
        content_mode: 'draft',
        version_id: undefined,
      },
      true
    )
  })

  it('shares the exact selected historical version and passes no published version for a draft', async () => {
    const historicalVersion: VersionDTO = {
      ...draft('historical-version'),
      id: 'historical-version',
      draft_id: 'historical-draft',
      published_by: 'user-1',
      published_at: '',
    }
    const screen = renderDetail(
      { mode: 'published', branchId: 'branch-1', version: historicalVersion },
      { canManage: true }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Share · Guide' })
    )
    expect(
      await dialog.findByText('Exact document share context')
    ).toBeVisible()
    expect(reading.shareProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        document,
        selectedBranchId: 'branch-1',
        selectedVersionId: 'historical-version',
        embedded: true,
      })
    )

    screen.rerenderSelection(selection('draft-a'), 'draft-a')
    expect(reading.shareProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedBranchId: 'branch-1',
        selectedVersionId: null,
      })
    )
  })
})

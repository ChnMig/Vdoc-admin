import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDTO, DraftDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { LanguageProvider } from '@/context/language-provider'
import type { DocumentReadingSelection } from './document-workspace-content'
import { DocumentWorkspaceDetail } from './document-workspace-detail'

const reading = vi.hoisted(() => ({
  selection: {} as DocumentReadingSelection,
  editorMounted: vi.fn(),
  editorUnmounted: vi.fn(),
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
  DocumentWorkspaceShare: () => null,
}))
vi.mock('./drafts-page', async () => {
  const { useEffect, useState } = await import('react')
  return {
    DraftsPage: function StatefulDraftEditor({
      search,
    }: {
      search: VdocRouteSearch
    }) {
      const id = search.draft_id ?? 'new-draft'
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

function renderDetail(initial: DocumentReadingSelection) {
  reading.selection = initial
  let search: VdocRouteSearch = {
    project_id: document.project_id,
    document_id: document.id,
    branch_id: 'branch-1',
    draft_id: initial.draft?.id,
    content_mode: 'draft',
    workspace_view: 'drafts',
  }
  const changes = vi.fn()
  const element = () => (
    <LanguageProvider>
      <DocumentWorkspaceDetail
        projectId={document.project_id}
        document={document}
        search={search}
        canManage={false}
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
      search = { ...search, draft_id: requestedId }
      screen.rerender(element())
    },
  }
}

describe('document workspace draft editor retention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
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
  readerMounted: vi.fn(),
  readerUnmounted: vi.fn(),
  assistantMounted: vi.fn(),
  assistantUnmounted: vi.fn(),
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
vi.mock('./document-workspace-content', async () => {
  const { useEffect } = await import('react')
  return {
    DocumentWorkspaceContent: function Reader() {
      useEffect(() => {
        reading.readerMounted()
        return () => reading.readerUnmounted()
      }, [])
      return <p>Stable document reader</p>
    },
  }
})
vi.mock('./document-workspace-branches', () => ({
  DocumentWorkspaceBranches: () => <p>Branch management controls</p>,
}))
vi.mock('./documents-page', () => ({
  DocumentsPage: () => (
    <label>
      Document name
      <input defaultValue='Guide' />
    </label>
  ),
}))
vi.mock('./diffs-page', () => ({
  DiffsPage: () => <p>Independent diff comparison</p>,
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
vi.mock('./document-workspace-ai', async () => {
  const { useEffect, useState } = await import('react')
  return {
    DocumentWorkspaceAI: function Assistant() {
      const [question, setQuestion] = useState('')
      useEffect(() => {
        reading.assistantMounted()
        return () => reading.assistantUnmounted()
      }, [])
      return (
        <section>
          <p>Document AI tools</p>
          <label>
            Assistant question
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
        </section>
      )
    },
  }
})
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

function mockWideLayout(initial = false) {
  let wide = initial
  const listeners = new Set<() => void>()
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(min-width: 1280px)' && wide,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject
    ) => listeners.add(listener as () => void),
    removeEventListener: (
      _type: string,
      listener: EventListenerOrEventListenerObject
    ) => listeners.delete(listener as () => void),
    dispatchEvent: () => true,
  }))
  return (next: boolean) =>
    act(() => {
      wide = next
      listeners.forEach((listener) => listener())
    })
}

describe('document workspace draft editor retention', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    reading.draftNavigate = undefined
    reading.versionNavigate = undefined
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    for (const method of ['show', 'showModal', 'close'] as const) {
      Object.defineProperty(HTMLDialogElement.prototype, method, {
        configurable: true,
        writable: true,
        value: vi.fn(function (this: HTMLDialogElement) {
          if (method === 'close') this.removeAttribute('open')
          else this.setAttribute('open', '')
        }),
      })
    }
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

  it('keeps the current editor and its scroll position while opening, closing, and resizing the single AI assistant', async () => {
    const setWide = mockWideLayout()
    const screen = renderDetail(selection('draft-a'))
    const editor = await screen.findByLabelText('Working draft content')
    fireEvent.change(editor, {
      target: { value: 'Continue editing beside AI' },
    })
    const editorPane = editor.closest('[data-document-tool-pane]')!
    editorPane.scrollTop = 173
    const mobileTrigger = screen.getAllByRole('button', {
      name: 'Document AI',
    })[0]
    fireEvent.click(mobileTrigger)
    const question = await screen.findByLabelText('Assistant question')
    const dialog = question.closest('dialog')!
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
    expect(editor).toBeVisible()
    expect(editor).toHaveValue('Continue editing beside AI')
    expect(editorPane.scrollTop).toBe(173)
    fireEvent.change(question, { target: { value: 'An unsent question' } })
    question.focus()
    setWide(true)
    expect(HTMLDialogElement.prototype.show).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Assistant question')).toBe(question)
    expect(question).toHaveFocus()
    expect(question.closest('dialog')).toBe(dialog)
    expect(question).toHaveValue('An unsent question')
    fireEvent.click(screen.getByRole('button', { name: 'Close document AI' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(dialog).toHaveAttribute('inert')
    expect(question.isConnected).toBe(true)
    expect(question).not.toBeVisible()
    const desktopTrigger = screen.getAllByRole('button', {
      name: 'Document AI',
    })[1]
    expect(desktopTrigger).toHaveFocus()
    fireEvent.click(desktopTrigger)
    expect(screen.getByLabelText('Assistant question')).toBe(question)
    expect(question).toHaveValue('An unsent question')
    expect(reading.assistantMounted).toHaveBeenCalledOnce()
    expect(reading.assistantUnmounted).not.toHaveBeenCalled()
    expect(reading.editorMounted).toHaveBeenCalledOnce()
    expect(screen.changes).not.toHaveBeenCalled()
  })

  it('preserves the same reading node and scroll while visiting separate version and comparison tools', async () => {
    const initial: DocumentReadingSelection = {
      mode: 'published',
      branchId: 'branch-1',
    }
    const screen = renderDetail(initial)
    const reader = screen.getByText('Stable document reader')
    const pane = reader.closest('[data-document-reading-pane]')!
    pane.scrollTop = 420
    screen.rerenderView('versions')
    await screen.findByText('Version tools')
    expect(screen.queryByRole('tab', { name: 'Diffs' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Versions' })
    ).not.toBeInTheDocument()
    expect(reader.isConnected).toBe(true)
    expect(reader).not.toBeVisible()
    screen.rerenderView('diffs')
    await screen.findByText('Independent diff comparison')
    expect(
      screen.queryByRole('tab', { name: 'Versions' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to preview' }))
    expect(screen.changes).toHaveBeenLastCalledWith({
      workspace_view: 'content',
    })
    screen.rerenderView('content')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(screen.getByText('Stable document reader')).toBe(reader)
    expect(reader).toBeVisible()
    expect(pane.scrollTop).toBe(420)
    expect(reading.readerMounted).toHaveBeenCalledOnce()
    expect(reading.readerUnmounted).not.toHaveBeenCalled()
  })

  it('keeps version history usable to recover an invalid reading revision without remounting its tools', async () => {
    const screen = renderDetail({
      mode: 'published',
      branchId: 'branch-1',
      invalid: true,
    })
    screen.rerenderView('versions')
    const tools = await screen.findByText('Version tools')
    screen.rerenderSelection(
      { mode: 'published', branchId: 'branch-1', pending: true },
      'resolving-version'
    )
    expect(screen.getByText('Version tools')).toBe(tools)
    act(() =>
      reading.versionNavigate!({
        version_id: 'valid-historical-version',
        branch_id: 'branch-2',
        workspace_view: 'content',
      })
    )
    expect(screen.changes).toHaveBeenLastCalledWith(
      {
        version_id: 'valid-historical-version',
        branch_id: 'branch-2',
        workspace_view: 'content',
        content_mode: 'published',
        draft_id: undefined,
      },
      true
    )
    expect(reading.readerMounted).toHaveBeenCalledOnce()
  })

  it('keeps settings in a single entry and retains document form values across its branch tab', async () => {
    const screen = renderDetail(selection('draft-a'), { canManage: true })
    screen.rerenderView('manage')
    const name = await screen.findByLabelText('Document name')
    fireEvent.change(name, { target: { value: 'Unsubmitted metadata' } })
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Branches' }), {
      button: 0,
    })
    await screen.findByText('Branch management controls')
    expect(
      screen.queryByRole('button', { name: 'Manage branches' })
    ).not.toBeInTheDocument()
    expect(name.isConnected).toBe(true)
    expect(name).not.toBeVisible()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Document details' }), {
      button: 0,
    })
    expect(screen.getByLabelText('Document name')).toBe(name)
    expect(name).toHaveValue('Unsubmitted metadata')
  })

  it('handles native mobile cancellation and returns focus to the opener without discarding chat', async () => {
    const screen = renderDetail(selection('draft-a'))
    await screen.findByLabelText('Working draft content')
    const trigger = screen.getAllByRole('button', {
      name: 'Document AI',
    })[0]
    fireEvent.click(trigger)
    const question = await screen.findByLabelText('Assistant question')
    fireEvent.change(question, { target: { value: 'Preserved after Escape' } })
    const dialog = question.closest('dialog')!
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog).not.toHaveAttribute('open')
    expect(trigger).toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getByLabelText('Assistant question')).toBe(question)
    expect(question).toHaveValue('Preserved after Escape')
  })

  it('wraps mobile assistant keyboard focus at its boundaries while keeping desktop modeless', async () => {
    const setWide = mockWideLayout(false)
    const screen = renderDetail(selection('draft-a'))
    await screen.findByLabelText('Working draft content')
    fireEvent.click(screen.getAllByRole('button', { name: 'Document AI' })[0])
    const question = await screen.findByLabelText('Assistant question')
    const dialog = question.closest('dialog')!
    const close = within(dialog).getByRole('button', {
      name: 'Close document AI',
    })
    const rectangle = {
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: 30,
      left: 0,
      width: 100,
      height: 30,
      toJSON: () => ({}),
    }
    vi.spyOn(close, 'getClientRects').mockReturnValue([
      rectangle,
    ] as unknown as DOMRectList)
    vi.spyOn(question, 'getClientRects').mockReturnValue([
      rectangle,
    ] as unknown as DOMRectList)
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    question.focus()
    fireEvent.keyDown(question, { key: 'Tab' })
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(question).toHaveFocus()
    setWide(true)
    expect(dialog).not.toHaveAttribute('aria-modal')
    question.focus()
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    fireEvent(question, tab)
    expect(tab.defaultPrevented).toBe(false)
  })

  it.each([
    ['dialog', 'dialog-content'],
    ['alertdialog', 'alert-dialog-content'],
    ['dialog', 'sheet-content'],
  ])(
    'yields mobile AI to any active shared %s instead of starting a second modal scope',
    async (role, slot) => {
      const setWide = mockWideLayout(true)
      const screen = renderDetail(selection('draft-a'), { canManage: true })
      await screen.findByLabelText('Working draft content')
      fireEvent.click(screen.getAllByRole('button', { name: 'Document AI' })[1])
      const question = await screen.findByLabelText('Assistant question')
      fireEvent.change(question, {
        target: { value: 'Unsent question behind a form' },
      })
      const assistant = question.closest('dialog')!
      const external = globalThis.document.createElement('div')
      external.setAttribute('role', role)
      external.setAttribute('data-slot', slot)
      external.setAttribute('data-state', 'open')
      // The breakpoint update must see the live modal synchronously, even before
      // MutationObserver has delivered the newly inserted portal.
      act(() => {
        globalThis.document.body.append(external)
        setWide(false)
      })
      expect(assistant).not.toHaveAttribute('open')
      expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
      await waitFor(() => expect(assistant).toHaveAttribute('inert'))
      act(() => external.setAttribute('data-state', 'closed'))
      await waitFor(() =>
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
      )
      expect(screen.getByLabelText('Assistant question')).toBe(question)
      expect(question).toHaveValue('Unsent question behind a form')
      expect(reading.assistantMounted).toHaveBeenCalledOnce()
      external.remove()
    }
  )

  it('avoids overlapping modal focus scopes when a shared document dialog crosses the mobile breakpoint', async () => {
    const setWide = mockWideLayout(true)
    const screen = renderDetail(selection('draft-a'), { canManage: true })
    await screen.findByLabelText('Working draft content')
    fireEvent.click(screen.getAllByRole('button', { name: 'Document AI' })[1])
    const question = await screen.findByLabelText('Assistant question')
    fireEvent.change(question, {
      target: { value: 'Keep through share dialog' },
    })
    const assistant = question.closest('dialog')!
    expect(assistant).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    const share = await screen.findByRole('dialog', { name: 'Share · Guide' })
    setWide(false)
    expect(assistant).not.toHaveAttribute('open')
    expect(assistant).toHaveAttribute('inert')
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
    expect(question).toHaveValue('Keep through share dialog')
    fireEvent.click(within(share).getByRole('button', { name: 'Close' }))
    await screen.findByRole('dialog', { name: 'Document AI' })
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Assistant question')).toBe(question)
    expect(question).toHaveValue('Keep through share dialog')
    expect(reading.assistantMounted).toHaveBeenCalledOnce()
    expect(reading.assistantUnmounted).not.toHaveBeenCalled()
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

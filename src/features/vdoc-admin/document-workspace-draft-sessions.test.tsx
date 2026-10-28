import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import type { DocumentDTO, DraftDTO, ProjectDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspacePage } from './document-workspace-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentFolders: vi.fn(),
  listBranches: vi.fn(),
  listVersions: vi.fn(),
  listDrafts: vi.fn(),
  getDraftContent: vi.fn(),
  getDocumentOverview: vi.fn(),
  getAISummary: vi.fn(),
  listAIChatSessions: vi.fn(),
  updateDraft: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
}))
vi.mock('@/components/search', () => ({ Search: () => null }))
vi.mock('@/components/language-switch', () => ({ LanguageSwitch: () => null }))
vi.mock('@/components/theme-switch', () => ({ ThemeSwitch: () => null }))
vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))
vi.mock('./ai-panels', () => ({ AIContextPanel: () => null }))

const user = {
  id: 'editor',
  name: 'Editor',
  email: 'editor@example.test',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}
const projects: ProjectDTO[] = ['project-1', 'project-2'].map((id) => ({
  id,
  team_id: 'team-1',
  team_name: 'Team',
  name: id,
  status: 1,
  created_by: user.id,
  created_at: '',
  updated_at: '',
}))
const documents: DocumentDTO[] = ['document-a', 'document-b'].map((id) => ({
  id,
  project_id: 'project-1',
  name: id,
  file_name: `${id}.txt`,
  document_type: 3,
  folder_id: null,
  status: 1,
  workflow_state: 'draft',
  latest_draft_id: `${id}-draft`,
  created_by: user.id,
  created_at: '',
  updated_at: '',
}))
function draft(projectId: string, documentId: string): DraftDTO {
  return {
    id: `${documentId}-draft`,
    revision: `${documentId}-revision-1`,
    review_revision: '',
    project_id: projectId,
    document_id: documentId,
    branch_id: `${documentId}-branch`,
    version_name: `${documentId} v1`,
    document_format: 3,
    source_type: 1,
    status: 1,
    created_by: user.id,
    created_at: '',
    updated_at: '',
  }
}
const bodies = new Map<string, string>()
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
function renderWorkspace() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Harness() {
    const [search, setSearch] = useState<VdocRouteSearch>({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'document-a',
      workspace_view: 'drafts',
      draft_id: 'document-a-draft',
    })
    return (
      <>
        <button
          onClick={() =>
            setSearch({
              ...search,
              project_id:
                search.project_id === 'project-1' ? 'project-2' : 'project-1',
            })
          }
        >
          Change project
        </button>
        <DocumentWorkspacePage
          search={search}
          onSearchChange={(patch) =>
            setSearch((current) => ({ ...current, ...patch }))
          }
        />
      </>
    )
  }
  const view = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <Harness />
      </LanguageProvider>
    </QueryClientProvider>
  )
  return { ...view, client }
}
async function content() {
  return await screen.findByRole(
    'textbox',
    { name: 'Content' },
    { timeout: 5000 }
  )
}
async function openDocument(id: string) {
  const tree = await screen.findByRole('navigation', { name: 'Files' })
  fireEvent.click(within(tree).getByRole('button', { name: new RegExp(id) }))
  const edit = await screen.findByRole('button', { name: 'Edit draft' })
  await waitFor(() => expect(edit).toBeEnabled())
  fireEvent.click(edit)
  await content()
}

describe('workspace draft sessions across the real file tree', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bodies.clear()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    useVdocContextStore.getState().reset()
    useAuthStore.getState().auth.setSession(user, 'synthetic-session')
    api.listProjects.mockResolvedValue({
      items: projects,
      total: projects.length,
    })
    api.listDocuments.mockImplementation(async (projectId: string) => ({
      items: documents.map((item) => ({ ...item, project_id: projectId })),
      total: documents.length,
    }))
    api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
    api.listBranches.mockImplementation(
      async (_projectId: string, documentId: string) => ({
        items: [
          {
            id: `${documentId}-branch`,
            document_id: documentId,
            name: 'main',
            kind: 2,
            is_default: true,
            is_protected: false,
            status: 1,
            created_by: user.id,
            created_at: '',
            updated_at: '',
          },
        ],
        total: 1,
      })
    )
    api.listVersions.mockResolvedValue({ items: [], total: 0 })
    api.listDrafts.mockImplementation(
      async (projectId: string, documentId: string) => ({
        items: [draft(projectId, documentId)],
        total: 1,
      })
    )
    api.getDraftContent.mockImplementation(
      async (projectId: string, documentId: string) => ({
        content:
          bodies.get(`${projectId}:${documentId}`) ??
          `Saved ${projectId} ${documentId}`,
        draft: draft(projectId, documentId),
        hash: 'synthetic-hash',
      })
    )
    api.getDocumentOverview.mockResolvedValue({
      published_branch_ids: [],
      has_reviewed_draft: false,
    })
    api.getAISummary.mockResolvedValue(null)
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.updateDraft.mockImplementation(
      async (
        projectId: string,
        documentId: string,
        _id: string,
        payload: { content: string }
      ) => {
        bodies.set(`${projectId}:${documentId}`, payload.content)
        return draft(projectId, documentId)
      }
    )
  })

  it('retains unsaved text and a selected file through A → B → A', async () => {
    renderWorkspace()
    fireEvent.change(await content(), { target: { value: 'Unsaved A' } })
    const file = new File(['Uploaded A'], 'local-a.txt', { type: 'text/plain' })
    await userEvent.upload(screen.getByLabelText('Document file'), file)
    await openDocument('document-b')
    fireEvent.change(await content(), { target: { value: 'Unsaved B' } })
    await openDocument('document-a')
    expect(await content()).toHaveValue('Unsaved A')
    expect(screen.getByText('local-a.txt')).toBeVisible()
    await openDocument('document-b')
    expect(await content()).toHaveValue('Unsaved B')
  })

  it('clears drafts when leaving the project, including when returning to it', async () => {
    renderWorkspace()
    fireEvent.change(await content(), {
      target: { value: 'Private project edits' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change project' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Content')).toHaveValue(
        'Saved project-2 document-a'
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change project' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Content')).toHaveValue(
        'Saved project-1 document-a'
      )
    )
  })

  it.each(['sign out', 'same user reauthentication'])(
    'clears drafts on %s',
    async (transition) => {
      renderWorkspace()
      fireEvent.change(await content(), {
        target: { value: 'Private session edits' },
      })
      act(() => {
        if (transition === 'sign out') useAuthStore.getState().auth.reset()
        useAuthStore.getState().auth.setSession(user, 'new-synthetic-session')
      })
      await waitFor(() =>
        expect(screen.getByLabelText('Content')).toHaveValue(
          'Saved project-1 document-a'
        )
      )
    }
  )

  it('does not revive saved edits after switching documents', async () => {
    renderWorkspace()
    fireEvent.change(await content(), { target: { value: 'Committed A' } })
    fireEvent.click(screen.getByRole('button', { name: /^Update$/ }))
    await waitFor(() => expect(api.updateDraft).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.queryByText(/Unsaved edits are kept/)
      ).not.toBeInTheDocument()
    )
    bodies.set('project-1:document-a', 'Newer saved A')
    await openDocument('document-b')
    await openDocument('document-a')
    await waitFor(() =>
      expect(screen.getByLabelText('Content')).toHaveValue('Newer saved A')
    )
  })

  it('retains conflict detection and explicit reload after a server change while away', async () => {
    const { client } = renderWorkspace()
    fireEvent.change(await content(), { target: { value: 'Local conflict A' } })
    await openDocument('document-b')
    bodies.set('project-1:document-a', 'Server changed A')
    await client.invalidateQueries({
      queryKey: ['draft-content', 'project-1', 'document-a'],
    })
    await openDocument('document-a')
    expect(await content()).toHaveValue('Local conflict A')
    const reload = await screen.findByRole('button', {
      name: 'Discard edits and load server version',
    })
    expect(screen.getByRole('button', { name: /^Update$/ })).toBeDisabled()
    fireEvent.click(reload)
    expect(await content()).toHaveValue('Server changed A')
    expect(screen.getByRole('button', { name: /^Update$/ })).toBeEnabled()
  })

  it.each(['same session', 'new session'])(
    'does not discard newer edits when an older save completes in the %s',
    async (session) => {
      const pending = deferred<DraftDTO>()
      api.updateDraft.mockReturnValueOnce(pending.promise)
      renderWorkspace()
      fireEvent.change(await content(), {
        target: { value: 'Old in-flight A' },
      })
      fireEvent.click(screen.getByRole('button', { name: /^Update$/ }))
      await waitFor(() => expect(api.updateDraft).toHaveBeenCalledOnce())
      await openDocument('document-b')
      if (session === 'new session') {
        act(() => {
          useAuthStore.getState().auth.reset()
          useAuthStore
            .getState()
            .auth.setSession(user, 'reauthenticated-session')
        })
      }
      await openDocument('document-a')
      fireEvent.change(await content(), { target: { value: 'Newer local A' } })
      await act(async () => pending.resolve(draft('project-1', 'document-a')))
      expect(await content()).toHaveValue('Newer local A')
      await openDocument('document-b')
      await openDocument('document-a')
      expect(await content()).toHaveValue('Newer local A')
    }
  )

  it.each(['success', 'failure'])(
    'handles an in-flight save %s after leaving the document',
    async (outcome) => {
      const pending = deferred<DraftDTO>()
      api.updateDraft.mockImplementationOnce(
        async (
          projectId: string,
          documentId: string,
          _id: string,
          payload: { content: string }
        ) => {
          const result = await pending.promise
          bodies.set(`${projectId}:${documentId}`, payload.content)
          return result
        }
      )
      const { client } = renderWorkspace()
      fireEvent.change(await content(), { target: { value: 'In-flight A' } })
      fireEvent.click(screen.getByRole('button', { name: /^Update$/ }))
      await waitFor(() => expect(api.updateDraft).toHaveBeenCalledOnce())
      await openDocument('document-b')
      await act(async () => {
        if (outcome === 'success')
          pending.resolve(draft('project-1', 'document-a'))
        else pending.reject(new Error('Synthetic save failed'))
      })
      if (outcome === 'success') {
        bodies.set('project-1:document-a', 'Another editor saved A')
        await client.invalidateQueries({
          queryKey: ['draft-content', 'project-1', 'document-a'],
        })
      }
      await openDocument('document-a')
      await waitFor(() =>
        expect(screen.getByLabelText('Content')).toHaveValue(
          outcome === 'success' ? 'Another editor saved A' : 'In-flight A'
        )
      )
    }
  )
})

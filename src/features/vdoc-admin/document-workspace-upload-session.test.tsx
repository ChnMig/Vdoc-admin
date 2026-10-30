import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { bindQueryCacheToAuth } from '@/lib/auth-query-cache'
import type { ProjectDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspacePage } from './document-workspace-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentFolders: vi.fn(),
  listProjectMembers: vi.fn(),
  createDocument: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
const repository = vi.hoisted(() => ({
  listRepositoryBranches: vi.fn(),
  getRepositoryCommit: vi.fn(),
}))
vi.mock('@/lib/repository-api', async (load) => ({
  ...(await load<typeof import('@/lib/repository-api')>()),
  ...repository,
}))
vi.mock('./document-workspace-detail', () => ({
  DocumentWorkspaceDetail: () => null,
}))

const userA = {
  id: 'user-a',
  email: 'a@example.test',
  name: 'Alice',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}
const project: ProjectDTO = {
  id: 'project-a',
  team_id: 'team-a',
  team_name: 'Team A',
  name: 'Project A',
  status: 1,
  created_by: userA.id,
  created_at: '',
  updated_at: '',
}
const committed = {
  id: 'server-commit',
  project_id: project.id,
  parent_ids: ['root'],
  tree_hash: 'tree',
  message: '',
  created_by: userA.id,
  created_at: '',
  files: [
    {
      document_id: 'created-document',
      relative_path: 'private.txt',
      name: 'Private upload',
      document_type: 3,
      content_hash: 'hash',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  document.cookie = 'vdoc-admin-language=en; path=/'
  useAuthStore.getState().auth.setSession(userA, 'account-a-token')
  repository.listRepositoryBranches.mockResolvedValue([
    {
      id: 'working',
      project_id: project.id,
      name: 'main',
      head_commit_id: 'root',
      generation: 0,
      is_protected: false,
      created_by: userA.id,
      created_at: '',
    },
  ])
  repository.getRepositoryCommit.mockResolvedValue({
    ...committed,
    id: 'root',
    files: [],
  })
  api.listProjects.mockResolvedValue({ items: [project], total: 1 })
  api.listDocuments.mockResolvedValue({ items: [], total: 0 })
  api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
  api.listProjectMembers.mockResolvedValue({ items: [], total: 0 })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  act(() => useAuthStore.getState().auth.reset())
})

describe('initial document upload session ownership', () => {
  it.each(['same', 'unmount', 'logout', 'switch', 'same-user-session'])(
    'guards delayed file reads across the %s boundary',
    async (boundary) => {
      const actual =
        await vi.importActual<typeof import('@/lib/vdoc-api')>('@/lib/vdoc-api')
      const originalAdapter = actual.vdocApi.defaults.adapter
      const transport = vi.fn(async (config) => ({
        data: { code: 200, status: 'OK', timestamp: 0, detail: committed },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }))
      actual.vdocApi.defaults.adapter = transport
      const onError = vi.fn()
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: Infinity },
          mutations: { retry: false, onError },
        },
      })
      const unbind = bindQueryCacheToAuth(client)
      const changes = vi.fn()
      let finishRead: (() => void) | undefined
      vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(
        function (this: FileReader) {
          finishRead = () => {
            Object.defineProperty(this, 'result', {
              value: new TextEncoder().encode('Private text').buffer,
              configurable: true,
            })
            this.dispatchEvent(new ProgressEvent('load'))
          }
        }
      )
      // JSDOM does not yet copy a userEvent FileList into native FormData.
      const NativeFormData = FormData
      vi.stubGlobal(
        'FormData',
        class extends NativeFormData {
          constructor(form?: HTMLFormElement) {
            super(form)
            const file = form?.querySelector<HTMLInputElement>(
              'input[name="initial_file"]'
            )?.files?.[0]
            if (file) this.set('initial_file', file)
          }
        }
      )
      const view = render(
        <QueryClientProvider client={client}>
          <LanguageProvider>
            <DocumentWorkspacePage
              search={{ team_id: project.team_id, project_id: project.id }}
              onSearchChange={changes}
            />
          </LanguageProvider>
        </QueryClientProvider>
      )
      try {
        const user = userEvent.setup()
        const newButton = await view.findByRole('button', {
          name: 'New document',
        })
        await waitFor(() => expect(newButton).toBeEnabled())
        await user.click(newButton)
        const dialog = within(
          view.getByRole('dialog', { name: 'New document' })
        )
        await user.upload(
          dialog.getByLabelText('Initial document file (optional)'),
          new File(['Private text'], 'private.txt', { type: 'text/plain' })
        )
        await user.click(dialog.getByRole('button', { name: 'Create' }))
        await waitFor(() => expect(finishRead).toBeDefined())
        expect(transport).not.toHaveBeenCalled()

        if (boundary === 'unmount') view.unmount()
        if (boundary === 'logout')
          act(() => useAuthStore.getState().auth.reset())
        if (boundary === 'switch')
          act(() =>
            useAuthStore
              .getState()
              .auth.setSession({ ...userA, id: 'user-b' }, 'account-b-token')
          )
        if (boundary === 'same-user-session')
          act(() =>
            useAuthStore.getState().auth.setSession(userA, 'account-a-token')
          )
        const invalidate = vi.spyOn(client, 'invalidateQueries')
        await act(async () => {
          finishRead!()
        })
        await waitFor(() => expect(client.isMutating()).toBe(0))
        if (boundary === 'same') {
          expect(transport).toHaveBeenCalledOnce()
          expect(transport.mock.calls[0][0].headers.get('Authorization')).toBe(
            'account-a-token'
          )
          expect(JSON.parse(transport.mock.calls[0][0].data)).toMatchObject({
            changes: [
              {
                document_id: '',
                content: 'Private text',
                relative_path: 'private.txt',
              },
            ],
          })
          expect(changes).toHaveBeenCalledWith(
            expect.objectContaining({
              document_id: 'created-document',
              commit_id: 'server-commit',
            }),
            { replace: false }
          )
        } else {
          expect(api.createDocument).not.toHaveBeenCalled()
          expect(transport).not.toHaveBeenCalled()
          expect(changes).not.toHaveBeenCalled()
          expect(invalidate).not.toHaveBeenCalled()
        }
        expect(onError).not.toHaveBeenCalled()
      } finally {
        view.unmount()
        unbind()
        client.clear()
        actual.vdocApi.defaults.adapter = originalAdapter
      }
    }
  )
})

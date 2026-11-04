import type { ComponentProps } from 'react'
import {
  isCancelledError,
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from '@tanstack/react-query'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import {
  deleteRepositoryDocument,
  updateRepositoryDocumentMetadata,
} from '@/lib/document-management-api'
import { repositoryKeys, type RepositoryDocument } from '@/lib/repository-api'
import type { DocumentFolderDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentActions } from './document-actions'

vi.mock('@/lib/document-management-api', () => ({
  deleteRepositoryDocument: vi.fn(),
  updateRepositoryDocumentMetadata: vi.fn(),
}))

const document: RepositoryDocument = {
  id: 'guide',
  project_id: 'project',
  name: 'Shared guide',
  document_type: 2,
  relative_path: 'Guides/shared.md',
  file_name: 'shared.md',
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
  default_branch_id: 'main',
  default_branch_name: 'main',
}
const folders: DocumentFolderDTO[] = [
  {
    id: 'guides',
    project_id: 'project',
    name: 'Guides',
    path: 'Guides',
    parent_id: null,
    created_by: 'admin',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'archive',
    project_id: 'project',
    name: 'Archive',
    path: 'Archive',
    parent_id: null,
    created_by: 'admin',
    created_at: '',
    updated_at: '',
  },
]
const clients: QueryClient[] = []
function setup(initial: Partial<ComponentProps<typeof DocumentActions>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  client.setQueryData(repositoryKeys.documents('project'), [document])
  const onChanged = vi.fn()
  let props = {
    projectId: 'project',
    document,
    folders,
    submissionScope: 'project:guide',
    isCurrent: () => true,
    onChanged,
    ...initial,
  }
  const view = () => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentActions {...props} />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(view())
  const user = userEvent.setup()
  const open = async (label: string) => {
    await user.click(
      screen.getByRole('button', {
        name: `Document actions: ${props.document.name}`,
      })
    )
    await user.click(screen.getByRole('menuitem', { name: label }))
  }
  return {
    screen,
    user,
    client,
    onChanged,
    open,
    rerender: (next: Partial<typeof props>) => {
      props = { ...props, ...next }
      screen.rerender(view())
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  globalThis.document.cookie = 'vdoc-admin-language=en; Path=/'
  vi.mocked(deleteRepositoryDocument).mockResolvedValue({ deleted: true })
  vi.mocked(updateRepositoryDocumentMetadata).mockResolvedValue(document)
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

describe('document management', () => {
  it('keeps edits entered while a rename request is pending', async () => {
    let resolve!: (value: RepositoryDocument) => void
    vi.mocked(updateRepositoryDocumentMetadata).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    const { screen, user, open } = setup()
    await open('Rename document')
    const dialog = within(
      screen.getByRole('dialog', { name: 'Rename document' })
    )
    const title = dialog.getByRole('textbox', { name: 'Document title' })
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(updateRepositoryDocumentMetadata).toHaveBeenCalledOnce()
    )
    await user.clear(title)
    await user.type(title, 'Still editing')
    await act(async () => resolve(document))
    expect(
      screen.getByRole('dialog', { name: 'Rename document' })
    ).toBeVisible()
    expect(title).toHaveValue('Still editing')
  })

  it('keeps rename values after a conflict and retries without changing identity', async () => {
    const updated = {
      ...document,
      name: 'Renamed guide',
      relative_path: 'Guides/renamed.md',
      file_name: 'renamed.md',
    }
    vi.mocked(updateRepositoryDocumentMetadata)
      .mockRejectedValueOnce(new Error('A file with this name already exists.'))
      .mockResolvedValueOnce(updated)
    const { screen, user, client, onChanged, open } = setup()
    await open('Rename document')
    const dialog = within(
      screen.getByRole('dialog', { name: 'Rename document' })
    )
    const title = dialog.getByRole('textbox', { name: 'Document title' })
    const filename = dialog.getByRole('textbox', { name: 'File name' })
    await user.clear(title)
    await user.type(title, 'Renamed guide')
    await user.clear(filename)
    await user.type(filename, 'renamed.md')
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'A file with this name already exists.'
    )
    expect(title).toHaveValue('Renamed guide')
    expect(filename).toHaveValue('renamed.md')
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(updateRepositoryDocumentMetadata).toHaveBeenLastCalledWith(
      'project',
      'guide',
      { name: 'Renamed guide', relative_path: 'Guides/renamed.md' }
    )
    expect(client.getQueryData(repositoryKeys.documents('project'))).toEqual([
      updated,
    ])
    expect(onChanged).toHaveBeenCalledWith(updated)
  })

  it('moves a document to a chosen folder and back to the project root', async () => {
    const { screen, user, open } = setup()
    for (const [option, path] of [
      ['Archive', 'Archive/shared.md'],
      ['Project root', 'shared.md'],
    ]) {
      await open('Move document')
      const dialog = within(
        screen.getByRole('dialog', { name: 'Move document' })
      )
      await user.click(dialog.getByRole('treeitem', { name: option }))
      await user.click(dialog.getByRole('button', { name: 'Move document' }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      )
      expect(updateRepositoryDocumentMetadata).toHaveBeenLastCalledWith(
        'project',
        'guide',
        { relative_path: path }
      )
    }
  })

  it('cancels without a request and preserves the confirmation after a delete failure', async () => {
    const { screen, user, client, open, onChanged } = setup()
    const scope = { projectId: 'project', documentId: 'guide' }
    client.setQueryData(repositoryKeys.branches(scope), ['cached branch'])
    client.setQueryData(['versions', 'project', 'guide'], ['cached version'])
    client.setQueryData(['documents', 'project', 'all'], {
      items: [document],
      total: 1,
    })
    await open('Delete document')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      })
    )
    expect(deleteRepositoryDocument).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Document actions: Shared guide' })
      ).toHaveFocus()
    )
    await open('Delete document')
    vi.mocked(deleteRepositoryDocument).mockRejectedValueOnce(
      new Error('Please retry deletion.')
    )
    const dialog = within(screen.getByRole('alertdialog'))
    expect(
      dialog.getByText(/all its public shares will stop working/)
    ).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Delete document' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Please retry deletion.'
    )
    await user.click(dialog.getByRole('button', { name: 'Delete document' }))
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
    expect(client.getQueryData(repositoryKeys.documents('project'))).toEqual([])
    expect(client.getQueryData(repositoryKeys.branches(scope))).toBeUndefined()
    expect(
      client.getQueryData(['versions', 'project', 'guide'])
    ).toBeUndefined()
    expect(client.getQueryData(['documents', 'project', 'all'])).toEqual({
      items: [],
      total: 0,
    })
    expect(onChanged).toHaveBeenCalledWith(null)
  })

  it('clears cached and in-flight AI data only for the deleted document', async () => {
    const { screen, user, client, open } = setup()
    const aiKeys = (
      projectId: string,
      documentId: string,
      ownerId: string
    ): QueryKey[] => {
      const target = { projectId, documentId, ownerType: 'version', ownerId }
      const identity = JSON.stringify([
        projectId,
        documentId,
        target.ownerType,
        ownerId,
      ])
      return [
        ['ai-summary', target],
        ['ai-chat-sessions', identity, target],
        ['ai-chat-session', identity, projectId, `session-${ownerId}`],
      ]
    }
    const cachedKeys = aiKeys('project', 'guide', 'cached-version')
    const retainedKeys = [
      ...aiKeys('project', 'other-guide', 'cached-version'),
      ...aiKeys('other-project', 'guide', 'cached-version'),
      repositoryKeys.branches({
        projectId: 'project',
        documentId: 'other-guide',
      }),
      repositoryKeys.branches('project'),
      ['audit-logs', 'project'],
      ['ai-provider', 'project', 'project'],
    ]
    for (const key of [...cachedKeys, ...retainedKeys])
      client.setQueryData(key, { cached: true })
    const startRequest = (queryKey: QueryKey) => {
      let signal!: AbortSignal
      let finish!: (value: string) => void
      const request = client
        .fetchQuery({
          queryKey,
          queryFn: ({ signal: requestSignal }) => {
            signal = requestSignal
            return new Promise<string>((resolve) => {
              finish = resolve
            })
          },
        })
        .then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error })
        )
      return { queryKey, signal, finish, request }
    }
    const affected = aiKeys('project', 'guide', 'pending-version').map(
      startRequest
    )
    const unaffected = [
      ...aiKeys('project', 'other-guide', 'pending-version'),
      ...aiKeys('other-project', 'guide', 'pending-version'),
    ].map(startRequest)
    await open('Delete document')
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete document',
      })
    )
    await waitFor(() => {
      for (const queryKey of [
        ...cachedKeys,
        ...affected.map((request) => request.queryKey),
      ])
        expect(
          client.getQueryState(queryKey),
          JSON.stringify(queryKey)
        ).toBeUndefined()
    })
    for (const request of affected) {
      expect(request.signal.aborted).toBe(true)
      expect(isCancelledError((await request.request).error)).toBe(true)
      request.finish('late deleted-document result')
    }
    for (const queryKey of retainedKeys)
      expect(client.getQueryData(queryKey), JSON.stringify(queryKey)).toEqual({
        cached: true,
      })
    for (const request of unaffected) {
      expect(request.signal.aborted).toBe(false)
      expect(client.getQueryState(request.queryKey)?.fetchStatus).toBe(
        'fetching'
      )
      request.finish('other document result')
      expect(await request.request).toEqual({
        value: 'other document result',
        error: undefined,
      })
      expect(client.getQueryData(request.queryKey)).toBe(
        'other document result'
      )
    }
    expect(client.getQueryData(repositoryKeys.documents('project'))).toEqual([])
    for (const request of affected)
      expect(client.getQueryState(request.queryKey)).toBeUndefined()
  })

  it.each(['project', 'account'] as const)(
    'ignores a late delete reply after switching %s',
    async (switchKind) => {
      let resolve!: (value: { deleted: true }) => void
      vi.mocked(deleteRepositoryDocument).mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done
          })
      )
      const { screen, user, open, onChanged, rerender, client } = setup()
      await open('Delete document')
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', {
          name: 'Delete document',
        })
      )
      await waitFor(() =>
        expect(deleteRepositoryDocument).toHaveBeenCalledOnce()
      )
      if (switchKind === 'account')
        act(() => useAuthStore.getState().auth.reset())
      else rerender({ projectId: 'other', submissionScope: 'other:guide' })
      await act(async () => resolve({ deleted: true }))
      expect(onChanged).not.toHaveBeenCalled()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      if (switchKind === 'account')
        expect(
          client.getQueryData(repositoryKeys.documents('project'))
        ).toEqual([document])
    }
  )
})

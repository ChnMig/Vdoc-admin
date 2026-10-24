import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { selectOption } from '@/test/select-option'
import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { bindQueryCacheToAuth } from '@/lib/auth-query-cache'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentsPage } from './documents-page'
import { DraftsPage } from './drafts-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentFolders: vi.fn(),
  listBranches: vi.fn(),
  listDrafts: vi.fn(),
  getDraftContent: vi.fn(),
  getDocumentOverview: vi.fn(),
  createDocument: vi.fn(),
  createBranch: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  promoteDraft: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
vi.mock('./page-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./page-shared')>()),
  PageChrome: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))
vi.mock('./document-share-panel', () => ({ DocumentSharePanel: () => null }))
vi.mock('./ai-panels', () => ({ AIContextPanel: () => null }))

const userA = {
  id: 'user-a',
  email: 'a@example.test',
  name: 'Alice',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}
const project = { id: 'project-a', name: 'Project A', status: 1 }
const documentA = {
  id: 'document-a',
  project_id: project.id,
  name: 'Document A',
  document_type: 2,
  status: 1,
}
const documentB = { ...documentA, id: 'document-b', name: 'Document B' }
const branch = {
  id: 'main-a',
  document_id: documentA.id,
  name: 'main',
  kind: 1,
  is_default: true,
  is_protected: false,
  status: 1,
}
const draft = {
  id: 'draft-a',
  project_id: project.id,
  document_id: documentA.id,
  branch_id: branch.id,
  version_name: 'Existing draft',
  changelog: '',
  source_git_commit_id: '',
  document_format: 2,
  source_type: 1,
  revision: 'revision-a',
  status: 1,
}
const overview = { published_branch_ids: [branch.id], latest_version: null }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((finish, fail) => {
    resolve = finish
    reject = fail
  })
  return { promise, resolve, reject }
}

function renderPage(
  page: ReactNode,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) {
  return {
    ...render(
      <QueryClientProvider client={client}>
        <LanguageProvider>{page}</LanguageProvider>
      </QueryClientProvider>
    ),
    client,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useVdocContextStore.getState().reset()
  useAuthStore.getState().auth.setSession(userA, 'account-a-token')
  api.listProjects.mockResolvedValue({ items: [project], total: 1 })
  api.listDocuments.mockResolvedValue({ items: [documentA], total: 1 })
  api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
  api.listBranches.mockResolvedValue({ items: [branch], total: 1 })
  api.listDrafts.mockResolvedValue({ items: [draft], total: 1 })
  api.getDraftContent.mockResolvedValue({
    draft,
    content: '# Existing content',
  })
  api.getDocumentOverview.mockResolvedValue(overview)
})
afterEach(() => {
  act(() => useAuthStore.getState().auth.reset())
})

describe('document create completion', () => {
  it.each(['unchanged', 'new-project', 'new-input'])(
    'keeps newer form input while preserving normal completion: %s',
    async (scenario) => {
      api.listProjects.mockResolvedValue({
        items: [project, { ...project, id: 'project-b', name: 'Project B' }],
        total: 2,
      })
      api.listDocuments.mockResolvedValue({ items: [], total: 0 })
      const request = deferred<unknown>()
      api.createDocument.mockImplementation(() => request.promise)
      const view = renderPage(<DocumentsPage />)
      const user = userEvent.setup()
      await user.click(
        await view.findByRole('button', { name: 'Create document' })
      )
      const dialog = view.getByRole('dialog', { name: 'Create document' })
      const name = within(dialog).getByLabelText('Name')
      const path = within(dialog).getByLabelText('Filename')
      await user.type(name, 'Document A')
      await user.clear(path)
      await user.type(path, 'a.yaml')
      await user.click(within(dialog).getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(api.createDocument).toHaveBeenCalledOnce())
      if (scenario === 'new-project') {
        // External context updates can happen while the modal blocks background clicks.
        act(() => useVdocContextStore.getState().setProjectId('project-b'))
        await waitFor(() =>
          expect(view.getByLabelText('Project')).toHaveValue('project-b')
        )
        expect(view.queryByRole('dialog')).not.toBeInTheDocument()
        expect(
          view.getByRole('button', { name: 'Create document' })
        ).toBeDisabled()
      }
      if (scenario === 'new-input') {
        await user.clear(name)
        await user.type(name, 'Unsaved document B')
        await user.clear(path)
        await user.type(path, 'b.yaml')
      }
      await act(async () => request.resolve({ id: 'created-a' }))
      await waitFor(() => expect(view.client.isMutating()).toBe(0))
      expect(api.createDocument.mock.calls[0][0]).toBe(project.id)
      if (scenario === 'new-input') {
        expect(view.getByRole('dialog')).toBe(dialog)
        expect(name).toHaveValue('Unsaved document B')
        expect(path).toHaveValue('b.yaml')
      } else {
        expect(view.queryByRole('dialog')).not.toBeInTheDocument()
        await user.click(view.getByRole('button', { name: 'Create document' }))
        const freshDialog = view.getByRole('dialog', {
          name: 'Create document',
        })
        expect(within(freshDialog).getByLabelText('Name')).toHaveValue('')
        expect(within(freshDialog).getByLabelText('Filename')).toHaveValue('')
      }
      view.unmount()
      view.client.clear()
    }
  )
})

describe('branch create completion', () => {
  it.each([
    'normal-success',
    'normal-error',
    'document-switch-success',
    'document-switch-error',
    'returned-document-error',
    'settled-error-roundtrip',
  ])('keeps the original form ownership: %s', async (scenario) => {
    api.listDocuments.mockResolvedValue({
      items: [documentA, documentB],
      total: 2,
    })
    api.listBranches.mockResolvedValue({ items: [], total: 0 })
    const request = deferred<unknown>()
    api.createBranch.mockImplementation(() => request.promise)
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    for (const document of [documentA, documentB]) {
      client.setQueryData(['branches', project.id, document.id], {
        items: [],
        total: 0,
      })
      client.setQueryData(
        ['document-overview', project.id, document.id],
        overview
      )
    }
    const view = renderPage(<DocumentsPage />, client)
    const user = userEvent.setup()
    const document = await view.findByLabelText('Document')
    await waitFor(() => expect(document).toHaveValue(documentA.id))
    await user.click(view.getByRole('button', { name: 'Create branch' }))
    const dialog = view.getByRole('dialog', { name: 'Create branch' })
    const name = within(dialog).getByLabelText('Name')
    await user.type(name, 'feature/from-a')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(api.createBranch).toHaveBeenCalledOnce())
    expect(api.createBranch.mock.calls[0].slice(0, 2)).toEqual([
      project.id,
      documentA.id,
    ])
    if (scenario === 'settled-error-roundtrip') {
      await act(async () =>
        request.reject(new Error('Document A request failed'))
      )
      expect(
        await within(dialog).findByText('Document A request failed')
      ).toBeInTheDocument()
    }
    const changesContext = !scenario.startsWith('normal-')
    if (changesContext) {
      // Model an external route/context change rather than clicking through the modal.
      act(() => useVdocContextStore.getState().setDocumentId(documentB.id))
      await waitFor(() => expect(document).toHaveValue(documentB.id))
      if (
        scenario === 'returned-document-error' ||
        scenario === 'settled-error-roundtrip'
      ) {
        act(() => useVdocContextStore.getState().setDocumentId(documentA.id))
        await waitFor(() => expect(document).toHaveValue(documentA.id))
      }
      expect(view.queryByRole('dialog')).not.toBeInTheDocument()
    }
    if (scenario.endsWith('error')) {
      await act(async () =>
        request.reject(new Error('Document A request failed'))
      )
    } else if (scenario !== 'settled-error-roundtrip') {
      await act(async () =>
        request.resolve({ id: 'created-branch', document_id: documentA.id })
      )
    }
    await waitFor(() => expect(client.isMutating()).toBe(0))
    if (scenario === 'normal-error') {
      expect(view.getByRole('dialog')).toBe(dialog)
      expect(name).toHaveValue('feature/from-a')
      expect(
        within(dialog).getByText('Document A request failed')
      ).toBeInTheDocument()
    } else {
      expect(view.queryByRole('dialog')).not.toBeInTheDocument()
      await user.click(view.getByRole('button', { name: 'Create branch' }))
      const freshDialog = view.getByRole('dialog', { name: 'Create branch' })
      const freshName = within(freshDialog).getByLabelText('Name')
      expect(freshName).toHaveValue('')
      expect(
        within(freshDialog).queryByText('Document A request failed')
      ).not.toBeInTheDocument()
      await user.type(freshName, 'feature/current-unsaved')
      expect(freshName).toHaveValue('feature/current-unsaved')
    }
    view.unmount()
    client.clear()
  })
})

describe('delayed draft file uploads', () => {
  it.each(['create', 'update'] as const)(
    'keeps %s completion from clearing editor state in a later session',
    async (operation) => {
      const request = deferred<unknown>()
      const save = operation === 'create' ? api.createDraft : api.updateDraft
      save.mockImplementation(() => request.promise)
      const view = renderPage(<DraftsPage />)
      const user = userEvent.setup()
      await user.click(view.getAllByLabelText('Branch', { exact: true })[0])
      await view.findByRole('option', { name: 'main' })
      await user.keyboard('{Escape}')
      if (operation === 'update') {
        await selectOption(view.getByLabelText('Draft'), draft.id, user)
        await waitFor(() =>
          expect(view.getByLabelText('Content')).toHaveValue(
            '# Existing content'
          )
        )
        await user.clear(view.getByLabelText('Version name'))
      } else {
        await selectOption(
          view.getAllByLabelText('Branch', { exact: true })[1],
          branch.id,
          user
        )
      }
      await user.type(view.getByLabelText('Version name'), 'Submitted draft')
      await user.click(
        view.getByRole('button', {
          name: operation === 'create' ? 'Create' : 'Update',
        })
      )
      await waitFor(() => expect(save).toHaveBeenCalledOnce())
      // Reauthentication can retain the same user id and token while ending the old session.
      act(() =>
        useAuthStore.getState().auth.setSession(userA, 'account-a-token')
      )
      await act(async () => request.resolve(draft))
      await waitFor(() => expect(view.client.isMutating()).toBe(0))
      expect(view.getByLabelText('Version name')).toHaveValue('Submitted draft')
      view.unmount()
      view.client.clear()
    }
  )

  it.each(['create', 'update'] as const)(
    'guards %s dispatch across session and mount boundaries',
    async (operation) => {
      const actual =
        await vi.importActual<typeof import('@/lib/vdoc-api')>('@/lib/vdoc-api')
      const originalAdapter = actual.vdocApi.defaults.adapter
      const transport = vi.fn(async (config) => ({
        data: { code: 200, status: 'OK', timestamp: 0, detail: draft },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }))
      actual.vdocApi.defaults.adapter = transport
      const save = operation === 'create' ? api.createDraft : api.updateDraft
      save.mockImplementation(
        operation === 'create' ? actual.createDraft : actual.updateDraft
      )
      try {
        for (const boundary of [
          'same',
          'unmount',
          'logout',
          'switch',
          'same-user-session',
        ]) {
          act(() =>
            useAuthStore.getState().auth.setSession(userA, 'account-a-token')
          )
          const client = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
          const unbind = bindQueryCacheToAuth(client)
          save.mockClear()
          transport.mockClear()
          const read = deferred<string>()
          const file = new File(['# Delayed content'], 'draft.md', {
            type: 'text/markdown',
          })
          file.text = () => read.promise
          const view = renderPage(<DraftsPage />, client)
          const user = userEvent.setup()
          await user.click(view.getAllByLabelText('Branch', { exact: true })[0])
          await view.findByRole('option', { name: 'main' })
          await user.keyboard('{Escape}')
          if (operation === 'update') {
            await selectOption(view.getByLabelText('Draft'), draft.id, user)
            await waitFor(() =>
              expect(view.getByLabelText('Content')).toHaveValue(
                '# Existing content'
              )
            )
          } else {
            await selectOption(
              view.getAllByLabelText('Branch', { exact: true })[1],
              branch.id,
              user
            )
            await user.type(view.getByLabelText('Version name'), 'New draft')
          }
          await user.upload(view.getByLabelText('Document file'), file)
          await user.click(
            view.getByRole('button', {
              name: operation === 'create' ? 'Create' : 'Update',
            })
          )
          expect(save).not.toHaveBeenCalled()
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
          await act(async () => read.resolve('# Delayed content'))
          if (boundary === 'same') {
            await waitFor(() => expect(transport).toHaveBeenCalledOnce())
            expect(save.mock.calls[0].slice(0, 2)).toEqual([
              project.id,
              documentA.id,
            ])
            expect(
              transport.mock.calls[0][0].headers.get('Authorization')
            ).toBe('account-a-token')
            expect(JSON.parse(transport.mock.calls[0][0].data)).toMatchObject({
              content: '# Delayed content',
            })
          } else {
            expect(save, boundary).not.toHaveBeenCalled()
            expect(transport, boundary).not.toHaveBeenCalled()
          }
          view.unmount()
          unbind()
          client.clear()
        }
      } finally {
        actual.vdocApi.defaults.adapter = originalAdapter
      }
    }
  )
})

describe('promotion completion', () => {
  it.each(['unchanged', 'new-document', 'new-input'])(
    'clears controlled and native inputs only for the submitted promotion: %s',
    async (scenario) => {
      const branchA = [
        branch,
        { ...branch, id: 'release-a', name: 'release A', is_default: false },
      ]
      const branchB = [
        { ...branch, id: 'main-b', document_id: documentB.id, name: 'main B' },
        {
          ...branch,
          id: 'release-b',
          document_id: documentB.id,
          name: 'release B',
          is_default: false,
        },
      ]
      api.listDocuments.mockResolvedValue({
        items: [documentA, documentB],
        total: 2,
      })
      api.listBranches.mockImplementation(async (_project, documentId) => ({
        items: documentId === documentB.id ? branchB : branchA,
        total: 2,
      }))
      api.getDocumentOverview.mockImplementation(
        async (_project, documentId) => ({
          ...overview,
          published_branch_ids: [
            documentId === documentB.id ? 'main-b' : branch.id,
          ],
        })
      )
      const request = deferred<unknown>()
      api.promoteDraft.mockImplementation(() => request.promise)
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      // Cached queries keep the same real FormCard mounted across the document switch.
      client.setQueryData(['branches', project.id, documentB.id], {
        items: branchB,
        total: 2,
      })
      client.setQueryData(['document-overview', project.id, documentB.id], {
        ...overview,
        published_branch_ids: ['main-b'],
      })
      const view = renderPage(<DraftsPage />, client)
      const user = userEvent.setup()
      await user.click(view.getByRole('tab', { name: 'Draft history' }))
      const source = await view.findByLabelText('Source branch')
      const target = view.getByLabelText('Target branch')
      const form = source.closest('form')!
      const version = within(form).getByLabelText('Version name')
      const changelog = within(form).getByLabelText('Changelog')
      await selectOption(source, branch.id, user)
      await selectOption(target, 'release-a', user)
      await user.type(version, 'Promotion A')
      await user.click(
        within(form).getByRole('button', { name: 'Create promotion draft' })
      )
      await waitFor(() => expect(api.promoteDraft).toHaveBeenCalledOnce())
      if (scenario === 'new-document') {
        await selectOption(view.getByLabelText('Document'), documentB.id, user)
        await selectOption(source, 'main-b', user)
        await selectOption(target, 'release-b', user)
      }
      if (scenario !== 'unchanged') {
        fireEvent.change(version, { target: { value: 'Unsaved promotion' } })
        fireEvent.change(changelog, { target: { value: 'Unsaved changelog' } })
      }
      await act(async () => request.resolve(draft))
      await waitFor(() => expect(client.isMutating()).toBe(0))
      expect(api.promoteDraft.mock.calls[0].slice(0, 2)).toEqual([
        project.id,
        documentA.id,
      ])
      expect(version).toHaveValue(
        scenario === 'unchanged' ? '' : 'Unsaved promotion'
      )
      expect(changelog).toHaveValue(
        scenario === 'unchanged' ? '' : 'Unsaved changelog'
      )
      expect(source).toHaveValue(
        scenario === 'unchanged'
          ? ''
          : scenario === 'new-document'
            ? 'main-b'
            : branch.id
      )
      expect(target).toHaveValue(
        scenario === 'unchanged'
          ? ''
          : scenario === 'new-document'
            ? 'release-b'
            : 'release-a'
      )
      view.unmount()
      client.clear()
    }
  )
})

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  listBranches: vi.fn(),
  listDrafts: vi.fn(),
  getDraftContent: vi.fn(),
  getDocumentOverview: vi.fn(),
  createDocument: vi.fn(),
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
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
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
    'keeps newer form input while preserving normal reset: %s',
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
      const name = await view.findByLabelText('Name')
      const path = view.getByLabelText('Relative path')
      await user.type(name, 'Document A')
      await user.type(path, 'a.md')
      await user.click(view.getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(api.createDocument).toHaveBeenCalledOnce())
      if (scenario === 'new-project')
        await user.selectOptions(view.getByLabelText('Project'), 'project-b')
      if (scenario !== 'unchanged') {
        await user.clear(name)
        await user.type(name, 'Unsaved document B')
        await user.clear(path)
        await user.type(path, 'b.md')
      }
      await act(async () => request.resolve({ id: 'created-a' }))
      await waitFor(() => expect(view.client.isMutating()).toBe(0))
      expect(api.createDocument.mock.calls[0][0]).toBe(project.id)
      expect(name).toHaveValue(
        scenario === 'unchanged' ? '' : 'Unsaved document B'
      )
      expect(path).toHaveValue(scenario === 'unchanged' ? '' : 'b.md')
      view.unmount()
      view.client.clear()
    }
  )
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
      await view.findAllByRole('option', { name: 'main' })
      if (operation === 'update') {
        await user.selectOptions(view.getByLabelText('Draft'), draft.id)
        await waitFor(() =>
          expect(view.getByLabelText('Content')).toHaveValue(
            '# Existing content'
          )
        )
        await user.clear(view.getByLabelText('Version name'))
      } else {
        await user.selectOptions(
          view.getAllByLabelText('Branch', { exact: true })[1],
          branch.id
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
          await view.findAllByRole('option', { name: 'main' })
          if (operation === 'update') {
            await user.selectOptions(view.getByLabelText('Draft'), draft.id)
            await waitFor(() =>
              expect(view.getByLabelText('Content')).toHaveValue(
                '# Existing content'
              )
            )
          } else {
            await user.selectOptions(
              view.getAllByLabelText('Branch', { exact: true })[1],
              branch.id
            )
            await user.type(view.getByLabelText('Version name'), 'New draft')
          }
          await user.upload(
            view.getByLabelText('Schema or Markdown file'),
            file
          )
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
      const source = await view.findByLabelText('Source branch')
      const target = view.getByLabelText('Target branch')
      const form = source.closest('form')!
      const version = within(form).getByLabelText('Version name')
      const changelog = within(form).getByLabelText('Changelog')
      await user.selectOptions(source, branch.id)
      await user.selectOptions(target, 'release-a')
      await user.type(version, 'Promotion A')
      await user.click(
        within(form).getByRole('button', { name: 'Create promotion draft' })
      )
      await waitFor(() => expect(api.promoteDraft).toHaveBeenCalledOnce())
      if (scenario === 'new-document') {
        await user.selectOptions(view.getByLabelText('Document'), documentB.id)
        await user.selectOptions(source, 'main-b')
        await user.selectOptions(target, 'release-b')
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

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRepositoryCommit,
  getRepositoryContent,
  listRepositoryBranches,
  saveRepositoryCommit,
  type RepositoryBranch,
  type RepositoryCommit,
} from '@/lib/repository-api'
import type { DocumentDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { LanguageProvider } from '@/context/language-provider'
import { RepositoryWorkspace } from './repository-workspace'

vi.mock('@/lib/repository-api', async (load) => ({
  ...(await load<typeof import('@/lib/repository-api')>()),
  getRepositoryCommit: vi.fn(),
  getRepositoryContent: vi.fn(),
  listRepositoryBranches: vi.fn(),
  saveRepositoryCommit: vi.fn(),
}))
const branch: RepositoryBranch = {
  id: 'branch',
  project_id: 'p',
  name: 'main',
  head_commit_id: 'head',
  generation: 2,
  is_protected: false,
  created_by: 'admin',
  created_at: '',
}
const file = {
  document_id: 'doc',
  relative_path: 'docs/guide.txt',
  name: 'Guide',
  document_type: 3,
  content_hash: 'hash',
}
const commit: RepositoryCommit = {
  id: 'head',
  project_id: 'p',
  parent_ids: ['parent'],
  tree_hash: 'tree',
  message: '',
  created_by: 'admin',
  created_at: '',
  files: [file],
}
const document: DocumentDTO = {
  id: 'doc',
  project_id: 'p',
  name: 'Guide',
  document_type: 3,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
const clients: QueryClient[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
function setup(initial: VdocRouteSearch = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  const changes = vi.fn()
  function Harness() {
    const [search, setSearch] = useState(initial)
    return (
      <RepositoryWorkspace
        projectId='p'
        projectName='Docs'
        document={document}
        legacyDocuments={[]}
        search={search}
        canManage
        canWrite
        interactive
        onSearchChange={(patch) => {
          changes(patch)
          setSearch((current) => ({ ...current, ...patch }))
        }}
      />
    )
  }
  return {
    ...render(
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <Harness />
        </LanguageProvider>
      </QueryClientProvider>
    ),
    client,
    changes,
    user: userEvent.setup(),
  }
}
describe('commit workspace', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    vi.mocked(listRepositoryBranches).mockResolvedValue([branch])
    vi.mocked(getRepositoryCommit).mockResolvedValue(commit)
    vi.mocked(getRepositoryContent).mockResolvedValue({
      commit_id: 'head',
      document: file,
      content: 'Exact source\r\nlast line',
    })
  })
  afterEach(() => {
    cleanup()
    for (const client of clients) client.clear()
    clients.length = 0
  })
  it('waits for the exact committed body before mounting the editor', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getRepositoryContent>>>()
    vi.mocked(getRepositoryContent).mockReturnValue(pending.promise)
    const view = setup({ repository_view: 'edit', commit_id: 'head' })
    await waitFor(() =>
      expect(getRepositoryContent).toHaveBeenCalledWith(
        'p',
        'head',
        'doc',
        expect.any(AbortSignal)
      )
    )
    expect(
      view.queryByRole('textbox', { name: 'Content' })
    ).not.toBeInTheDocument()
    await act(async () =>
      pending.resolve({
        commit_id: 'head',
        document: file,
        content: 'Actual body',
      })
    )
    expect(await view.findByRole('textbox', { name: 'Content' })).toHaveValue(
      'Actual body'
    )
  })
  it('does not turn a failed body read into an empty editable file', async () => {
    vi.mocked(getRepositoryContent).mockRejectedValue(
      new Error('Snapshot unavailable')
    )
    const view = setup({ repository_view: 'edit' })
    await view.findAllByText('Snapshot unavailable')
    expect(
      view.queryByRole('textbox', { name: 'Content' })
    ).not.toBeInTheDocument()
    expect(saveRepositoryCommit).not.toHaveBeenCalled()
  })
  it('does not fall back from an invalid fixed commit or branch', async () => {
    vi.mocked(getRepositoryCommit).mockRejectedValue(
      new Error('Commit not found')
    )
    const view = setup({ commit_id: 'missing' })
    await view.findByText('Commit not found')
    expect(
      vi.mocked(getRepositoryCommit).mock.calls.map((call) => call[1])
    ).toEqual(['missing'])
    expect(getRepositoryContent).not.toHaveBeenCalled()
    view.unmount()
    vi.clearAllMocks()
    const invalid = setup({ repository_branch_id: 'missing-branch' })
    await invalid.findByText(
      'Repository data is unavailable. Retry without losing your current edits.'
    )
    expect(getRepositoryCommit).not.toHaveBeenCalled()
  })
  it('keeps the reader and uncommitted editor input when switching tools', async () => {
    const view = setup()
    const body = await view.findByText('Exact source last line')
    await view.user.click(view.getByRole('button', { name: 'Edit' }))
    const editor = await view.findByRole('textbox', { name: 'Content' })
    await view.user.type(editor, ' addition')
    await view.user.click(view.getByRole('button', { name: 'Read' }))
    expect(await view.findByText('Exact source last line')).toBe(body)
    await view.user.click(view.getByRole('button', { name: 'Edit' }))
    expect(view.getByRole('textbox', { name: 'Content' })).toBe(editor)
    expect(editor).toHaveValue('Exact source\nlast line addition')
  })
  it('blocks writes and gives an administrator import action for legacy history', async () => {
    vi.mocked(listRepositoryBranches).mockResolvedValue([
      { ...branch, import_required: true },
    ])
    const view = setup({ repository_view: 'edit' })
    await view.findByRole('button', { name: 'Import existing documents' })
    expect(await view.findByRole('textbox', { name: 'Content' })).toBeDisabled()
    expect(view.getByRole('button', { name: 'Save and commit' })).toBeDisabled()
  })
})

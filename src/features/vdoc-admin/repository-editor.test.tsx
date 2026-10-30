import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRepositoryBranch,
  saveRepositoryCommit,
  type RepositoryBranch,
  type RepositoryCommit,
} from '@/lib/repository-api'
import type { DocumentDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { RepositoryEditor } from './repository-editor'

vi.mock('@/lib/repository-api', async (load) => ({
  ...(await load<typeof import('@/lib/repository-api')>()),
  createRepositoryBranch: vi.fn(),
  saveRepositoryCommit: vi.fn(),
}))
const branch: RepositoryBranch = {
  id: 'branch',
  project_id: 'p',
  name: 'feature',
  head_commit_id: 'base',
  generation: 3,
  is_protected: false,
  created_by: 'admin',
  created_at: '',
}
const document: DocumentDTO = {
  id: 'doc',
  project_id: 'p',
  name: 'Guide',
  document_type: 3,
  file_name: 'guide.txt',
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
const file = {
  document_id: 'doc',
  relative_path: 'guide.txt',
  name: 'Guide',
  document_type: 3,
  content_hash: 'hash',
}
const commit: RepositoryCommit = {
  id: 'server-new',
  project_id: 'p',
  parent_ids: ['base'],
  tree_hash: 'tree',
  message: '',
  created_by: 'admin',
  created_at: '',
  files: [file],
}
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  const onSaved = vi.fn().mockResolvedValue(undefined)
  const props = {
    projectId: 'p',
    branch,
    document,
    baseCommitId: 'base',
    files: [file],
    content: { commit_id: 'base', document: file, content: 'old\r\nsource' },
    contentPending: false,
    canWrite: true,
    canManage: true,
    onSaved,
    onEdit: vi.fn(),
    onBranchCreated: vi.fn(),
  }
  const ui = (next = props) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <RepositoryEditor {...next} />
      </LanguageProvider>
    </QueryClientProvider>
  )
  return { ...render(ui()), user: userEvent.setup(), onSaved, props, ui }
}
describe('repository editor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    vi.mocked(saveRepositoryCommit).mockResolvedValue(commit)
  })
  afterEach(() => {
    cleanup()
    for (const client of clients) client.clear()
    clients.length = 0
  })
  it('submits a fixed base and preserves input and idempotency across a retry', async () => {
    vi.mocked(saveRepositoryCommit).mockRejectedValueOnce(
      new Error('HEAD changed')
    )
    const view = setup()
    const body = view.getByRole('textbox', { name: 'Content' })
    await view.user.clear(body)
    await view.user.type(body, 'new content')
    await view.user.click(view.getByRole('button', { name: 'Save and commit' }))
    await view.findByText('HEAD changed')
    expect(body).toHaveValue('new content')
    const first = vi.mocked(saveRepositoryCommit).mock.calls[0][2]
    expect(first).toMatchObject({
      expected_head_commit_id: 'base',
      expected_generation: 3,
      changes: [{ document_id: 'doc', content: 'new content' }],
    })
    expect(first.idempotency_key).toBeTruthy()
    expect(first).not.toHaveProperty('version_name')
    await view.user.click(view.getByRole('button', { name: 'Save and commit' }))
    await waitFor(() =>
      expect(view.onSaved).toHaveBeenCalledWith(commit, 'branch')
    )
    expect(vi.mocked(saveRepositoryCommit).mock.calls[1][2]).toEqual(first)
  })
  it('preserves a conflicting edit on a branch created from the original baseline', async () => {
    vi.mocked(saveRepositoryCommit).mockRejectedValueOnce(
      new Error('HEAD changed')
    )
    vi.mocked(createRepositoryBranch).mockResolvedValue({
      ...branch,
      id: 'recovered',
      name: 'recovered',
      generation: 0,
    })
    const view = setup()
    await view.user.type(
      view.getByRole('textbox', { name: 'Content' }),
      ' addition'
    )
    await view.user.click(view.getByRole('button', { name: 'Save and commit' }))
    await view.findByText('HEAD changed')
    await view.user.click(
      view.getByRole('button', { name: 'Save changes on a new branch' })
    )
    const dialog = within(view.getByRole('dialog'))
    await view.user.type(
      dialog.getByRole('textbox', { name: 'Branch name' }),
      'recovered'
    )
    await view.user.click(
      dialog.getByRole('button', { name: 'Save and commit' })
    )
    await waitFor(() =>
      expect(view.onSaved).toHaveBeenCalledWith(commit, 'recovered')
    )
    expect(createRepositoryBranch).toHaveBeenCalledWith('p', {
      name: 'recovered',
      from_commit_id: 'base',
    })
    const requests = vi.mocked(saveRepositoryCommit).mock.calls
    expect(requests[1][2]).toMatchObject({
      expected_head_commit_id: 'base',
      expected_generation: 0,
      changes: [{ content: 'old\r\nsource addition' }],
    })
    expect(requests[1][2].idempotency_key).not.toBe(
      requests[0][2].idempotency_key
    )
  })
})

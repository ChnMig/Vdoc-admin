import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRepositoryCommit,
  getRepositoryContent,
  getRepositoryMergeContent,
  type RepositoryMergeRequest,
} from '@/lib/repository-api'
import { LanguageProvider } from '@/context/language-provider'
import { RepositoryMergePreview } from './repository-merge-preview'

vi.mock('@/lib/repository-api', async (load) => ({
  ...(await load<typeof import('@/lib/repository-api')>()),
  getRepositoryCommit: vi.fn(),
  getRepositoryContent: vi.fn(),
  getRepositoryMergeContent: vi.fn(),
}))
vi.mock('./source-diff-viewer', () => ({
  default: ({ before, after }: { before: string; after: string }) => (
    <div>
      <pre data-testid='before'>{before}</pre>
      <pre data-testid='after'>{after}</pre>
    </div>
  ),
}))
const file = {
  document_id: 'doc',
  relative_path: 'guide.txt',
  name: 'Guide',
  document_type: 3,
  content_hash: 'candidate-hash',
}
const request: RepositoryMergeRequest = {
  id: 'request',
  project_id: 'p',
  title: 'Merge',
  source_branch_id: 'source',
  target_branch_id: 'target',
  source_commit_id: 'source-fixed',
  target_commit_id: 'target-fixed',
  source_generation: 1,
  target_generation: 2,
  base_commit_id: 'base',
  conflicts: [],
  status: 'open',
  created_by: 'admin',
  created_at: '',
  generation: 3,
  result_files: [file],
}
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <RepositoryMergePreview projectId='p' request={request} />
      </LanguageProvider>
    </QueryClientProvider>
  )
}
describe('merge candidate review', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    document.cookie = 'vdoc-admin-language=en; path=/'
    vi.mocked(getRepositoryCommit).mockResolvedValue({
      id: 'target-fixed',
      project_id: 'p',
      parent_ids: ['base'],
      tree_hash: 'target',
      message: '',
      created_by: 'admin',
      created_at: '',
      files: [{ ...file, content_hash: 'target-hash' }],
    })
    vi.mocked(getRepositoryContent).mockResolvedValue({
      commit_id: 'target-fixed',
      document: file,
      content: 'A=1\nB=0\n',
    })
    vi.mocked(getRepositoryMergeContent).mockResolvedValue({
      merge_request_id: 'request',
      generation: 3,
      document: file,
      content: 'A=1\nB=1\n',
    })
  })
  afterEach(() => {
    cleanup()
    for (const client of clients) client.clear()
    clients.length = 0
  })
  it('compares target content to the actual automatic merge result', async () => {
    const view = setup()
    expect(await view.findByTestId('after')).toHaveTextContent('A=1 B=1')
    expect(view.getByTestId('before')).toHaveTextContent('A=1 B=0')
    expect(getRepositoryMergeContent).toHaveBeenCalledWith(
      'p',
      'request',
      'doc',
      expect.any(AbortSignal)
    )
    expect(getRepositoryContent).toHaveBeenCalledWith(
      'p',
      'target-fixed',
      'doc',
      expect.any(AbortSignal)
    )
    expect(
      vi
        .mocked(getRepositoryContent)
        .mock.calls.some((call) => call[1] === 'source-fixed')
    ).toBe(false)
  })
  it('shows candidate read errors without substituting a source-branch body', async () => {
    vi.mocked(getRepositoryMergeContent).mockRejectedValue(
      new Error('Candidate unavailable')
    )
    const view = setup()
    await view.findByText('Candidate unavailable')
    expect(view.queryByTestId('after')).not.toBeInTheDocument()
  })
})

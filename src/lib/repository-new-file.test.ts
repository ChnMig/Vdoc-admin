import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRepositoryDocument,
  type RepositoryCommit,
} from './repository-api'
import {
  createRepositoryFile,
  type RepositoryNewFileAttempt,
} from './repository-new-file'

vi.mock('./repository-api', () => ({ createRepositoryDocument: vi.fn() }))
const commit: RepositoryCommit = {
  id: 'commit',
  project_id: 'p',
  parent_ids: [],
  tree_hash: 'tree',
  message: '',
  created_by: 'admin',
  created_at: '',
  files: [],
}
const result = {
  commit,
  document: { id: 'document' },
  branch: { id: 'branch' },
} as Awaited<ReturnType<typeof createRepositoryDocument>>
describe('atomic document creation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createRepositoryDocument).mockResolvedValue(result)
  })
  it('creates an independent named branch with exact initial bytes and a server-assigned identity', async () => {
    const source = '\ufeff中文\r\nlast line'
    const attempt: RepositoryNewFileAttempt = {
      fingerprint: 'input',
      key: 'request-key',
    }
    const saved = await createRepositoryFile(
      'p',
      {
        name: 'Guide',
        file_name: 'guide.txt',
        document_type: 3,
        initial_content: { content: source },
      },
      {
        directory: 'docs',
        newBranchName: 'dev',
        attempt,
        isCurrent: () => true,
      }
    )
    expect(createRepositoryDocument).toHaveBeenCalledWith('p', {
      name: 'Guide',
      relative_path: 'docs/guide.txt',
      document_type: 3,
      description: undefined,
      content: source,
      initial_branch: 'dev',
      idempotency_key: 'request-key',
    })
    expect(saved).toEqual({
      commit,
      branchId: 'branch',
      documentId: 'document',
    })
  })
  it('defaults to main and retries the original payload after a lost response', async () => {
    vi.mocked(createRepositoryDocument).mockRejectedValueOnce(
      new Error('Connection lost')
    )
    const input = { name: 'Guide', file_name: 'guide.txt', document_type: 3 }
    const options = {
      attempt: { fingerprint: 'input', key: 'same-key' },
      isCurrent: () => true,
    }
    await expect(createRepositoryFile('p', input, options)).rejects.toThrow(
      'Connection lost'
    )
    await createRepositoryFile('p', { ...input, name: 'later edit' }, options)
    expect(vi.mocked(createRepositoryDocument).mock.calls[1]).toEqual(
      vi.mocked(createRepositoryDocument).mock.calls[0]
    )
    expect(
      vi.mocked(createRepositoryDocument).mock.calls[1][1].initial_branch
    ).toBe('main')
  })
  it('does not write after its form loses scope', async () => {
    await createRepositoryFile(
      'p',
      { name: 'Guide', file_name: 'guide.txt', document_type: 3 },
      { attempt: { fingerprint: 'input', key: 'key' }, isCurrent: () => false }
    )
    expect(createRepositoryDocument).not.toHaveBeenCalled()
  })
})

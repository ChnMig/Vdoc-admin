import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRepositoryBranch,
  listRepositoryBranches,
  saveRepositoryCommit,
  type RepositoryBranch,
  type RepositoryCommit,
} from './repository-api'
import {
  createRepositoryFile,
  type RepositoryNewFileAttempt,
} from './repository-new-file'

vi.mock('./repository-api', () => ({
  createRepositoryBranch: vi.fn(),
  listRepositoryBranches: vi.fn(),
  saveRepositoryCommit: vi.fn(),
}))
const main: RepositoryBranch = {
  id: 'main',
  project_id: 'p',
  name: 'main',
  head_commit_id: 'server-base',
  generation: 4,
  is_protected: true,
  created_by: 'admin',
  created_at: '',
}
const working = {
  ...main,
  id: 'work',
  name: 'feature',
  generation: 0,
  is_protected: false,
}
const result: RepositoryCommit = {
  id: 'server-commit',
  project_id: 'p',
  parent_ids: ['server-base'],
  tree_hash: 'tree',
  message: '',
  created_by: 'admin',
  created_at: '',
  files: [
    {
      document_id: 'server-document',
      relative_path: 'docs/guide.txt',
      name: 'Guide',
      document_type: 3,
      content_hash: 'hash',
    },
  ],
}
describe('atomic repository file creation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(listRepositoryBranches).mockResolvedValue([main])
    vi.mocked(createRepositoryBranch).mockResolvedValue(working)
    vi.mocked(saveRepositoryCommit).mockResolvedValue(result)
  })
  it('creates a working branch and submits exact source without a client version or document ID', async () => {
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
        newBranchName: 'feature',
        attempt,
        isCurrent: () => true,
      }
    )
    expect(createRepositoryBranch).toHaveBeenCalledWith('p', {
      name: 'feature',
      from_commit_id: 'server-base',
    })
    expect(saveRepositoryCommit).toHaveBeenCalledWith('p', 'work', {
      expected_head_commit_id: 'server-base',
      expected_generation: 0,
      idempotency_key: 'request-key',
      changes: [
        {
          operation: 'upsert',
          document_id: '',
          relative_path: 'docs/guide.txt',
          name: 'Guide',
          document_type: 3,
          description: undefined,
          content: source,
        },
      ],
    })
    expect(
      JSON.stringify(vi.mocked(saveRepositoryCommit).mock.calls[0])
    ).not.toContain('version_name')
    expect(saved).toEqual({
      commit: result,
      branchId: 'work',
      documentId: 'server-document',
    })
  })
  it('retains the original CAS baseline and key after an unknown save result', async () => {
    vi.mocked(saveRepositoryCommit).mockRejectedValueOnce(
      new Error('Connection lost')
    )
    const attempt: RepositoryNewFileAttempt = {
      fingerprint: 'input',
      key: 'same-key',
    }
    const input = { name: 'Guide', file_name: 'guide.txt', document_type: 3 }
    const options = {
      branch: working,
      directory: 'docs',
      attempt,
      isCurrent: () => true,
    }
    await expect(createRepositoryFile('p', input, options)).rejects.toThrow(
      'Connection lost'
    )
    working.head_commit_id = 'changed-after-request'
    await createRepositoryFile('p', input, options)
    expect(vi.mocked(saveRepositoryCommit).mock.calls[1]).toEqual(
      vi.mocked(saveRepositoryCommit).mock.calls[0]
    )
    working.head_commit_id = 'server-base'
  })
  it('does not dispatch writes after its form loses scope', async () => {
    await createRepositoryFile(
      'p',
      { name: 'Guide', file_name: 'guide.txt', document_type: 3 },
      { attempt: { fingerprint: 'input', key: 'key' }, isCurrent: () => false }
    )
    expect(listRepositoryBranches).not.toHaveBeenCalled()
    expect(saveRepositoryCommit).not.toHaveBeenCalled()
  })
})

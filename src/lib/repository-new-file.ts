import {
  createRepositoryBranch,
  listRepositoryBranches,
  saveRepositoryCommit,
  type RepositoryBranch,
  type RepositoryCommit,
  type RepositorySave,
} from './repository-api'

export type RepositoryNewFileInput = {
  name: string
  file_name: string
  document_type: number
  description?: string
  initial_content?: { content: string }
}

export type RepositoryNewFileAttempt = {
  fingerprint: string
  key: string
  branch?: RepositoryBranch
  payload?: RepositorySave
}

// The attempt belongs to the form. Retrying a lost response must reuse the same
// branch, compare-and-swap baseline and idempotency key.
export async function createRepositoryFile(
  projectId: string,
  input: RepositoryNewFileInput,
  options: {
    branch?: RepositoryBranch
    directory?: string
    newBranchName?: string
    attempt: RepositoryNewFileAttempt
    isCurrent: () => boolean
  }
): Promise<
  { commit: RepositoryCommit; branchId: string; documentId: string } | undefined
> {
  const { attempt, isCurrent } = options
  if (!isCurrent()) return
  if (!attempt.branch) {
    let branch = options.branch
    if (!branch) {
      const branches = await listRepositoryBranches(projectId)
      branch = branches.find((item) => item.name === 'main') ?? branches[0]
    }
    if (!isCurrent()) return
    if (!branch) throw new Error('No repository branch is available.')
    if (branch.import_required)
      throw new Error(
        'A project administrator must import the existing document history before new commits can be saved.'
      )
    if (branch.is_protected || options.newBranchName?.trim()) {
      branch = await createRepositoryBranch(projectId, {
        name:
          options.newBranchName?.trim() || `work/${attempt.key.slice(0, 8)}`,
        from_commit_id: branch.head_commit_id,
      })
    }
    attempt.branch = branch
  }
  if (!isCurrent()) return
  const directory = (options.directory ?? '').trim().replace(/^\/+|\/+$/g, '')
  const path = directory ? `${directory}/${input.file_name}` : input.file_name
  attempt.payload ??= {
    expected_head_commit_id: attempt.branch.head_commit_id,
    expected_generation: attempt.branch.generation,
    idempotency_key: attempt.key,
    changes: [
      {
        operation: 'upsert',
        document_id: '',
        relative_path: path,
        name: input.name,
        document_type: input.document_type,
        description: input.description,
        content: input.initial_content?.content ?? '',
      },
    ],
  }
  const commit = await saveRepositoryCommit(
    projectId,
    attempt.branch.id,
    attempt.payload
  )
  const file = commit.files.find((item) => item.relative_path === path)
  if (!file) throw new Error('The saved commit did not include the new file.')
  return { commit, branchId: attempt.branch.id, documentId: file.document_id }
}

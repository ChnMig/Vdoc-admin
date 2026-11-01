import {
  createRepositoryDocument,
  type RepositoryCreateDocument,
  type RepositoryCommit,
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
  payload?: RepositoryCreateDocument
}

// A new document owns its initial branch; retries reuse the same atomic request.
export async function createRepositoryFile(
  projectId: string,
  input: RepositoryNewFileInput,
  options: {
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
  const directory = (options.directory ?? '').trim().replace(/^\/+|\/+$/g, '')
  attempt.payload ??= {
    name: input.name,
    relative_path: directory
      ? `${directory}/${input.file_name}`
      : input.file_name,
    document_type: input.document_type,
    description: input.description,
    content: input.initial_content?.content ?? '',
    initial_branch: options.newBranchName?.trim() || 'main',
    idempotency_key: attempt.key,
  }
  const created = await createRepositoryDocument(projectId, attempt.payload)
  if (!isCurrent()) return
  return {
    commit: created.commit,
    branchId: created.branch.id,
    documentId: created.document.id,
  }
}

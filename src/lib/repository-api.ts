import { unwrapEnvelope, vdocApi, type DocumentDTO } from './vdoc-api'

export type RepositoryFile = {
  document_id: string
  relative_path: string
  name: string
  document_type: number
  description?: string
  content_hash: string
}

export type RepositoryBranch = {
  id: string
  project_id: string
  document_id?: string
  revision?: number
  name: string
  head_commit_id: string
  generation: number
  is_protected: boolean
  created_by: string
  created_at: string
  import_required?: boolean
}

export type RepositoryCommit = {
  id: string
  project_id: string
  document_id?: string
  branch_id?: string
  revision?: number
  version_name?: string
  parent_ids: string[]
  tree_hash: string
  message: string
  created_by: string
  created_at: string
  files: RepositoryFile[]
  provenance?: string
}

export type RepositoryContent = {
  commit_id: string
  content: string
  document: RepositoryFile
}

export type RepositoryChange = Omit<RepositoryFile, 'content_hash'> & {
  operation: 'upsert' | 'delete'
  content: string
}

export type RepositorySave = {
  expected_head_commit_id: string
  expected_generation: number
  idempotency_key: string
  message?: string
  changes: RepositoryChange[]
}

export type RepositoryComparison = {
  id: string
  from_commit_id: string
  to_commit_id: string
  files: {
    document_id: string
    relative_path: string
    old_relative_path?: string
    document_type: number
    change_type: string
    old_content: string
    new_content: string
    semantic_status?: string
    semantic_diff?: unknown
  }[]
}

export type RepositoryMergeRequest = {
  id: string
  project_id: string
  title: string
  source_branch_id: string
  target_branch_id: string
  source_commit_id: string
  target_commit_id: string
  source_generation: number
  target_generation: number
  base_commit_id: string
  conflicts: string[]
  status: 'open' | 'approved' | 'merged' | 'superseded'
  created_by: string
  created_at: string
  approved_by?: string
  merged_commit_id?: string
  generation: number
  result_files?: RepositoryFile[]
  resolves_request_id?: string
}

export type RepositoryRelease = {
  id: string
  branch_id: string
  commit_id: string
  version_name: string
  message: string
  published_by: string
  published_at: string
}

export type RepositoryEvent = {
  id: string
  sequence: number
  event_type: string
  branch_id?: string
  before_commit_id?: string
  after_commit_id?: string
  ref_generation?: number
  actor_id: string
  created_at: string
  resource_id?: string
}

export type RepositoryAnalysis = {
  id: string
  sequence?: number
  from_commit_id?: string
  to_commit_id: string
  document_id?: string
  status: string
  content: string
  error_message?: string
  created_at: string
  completed_at?: string
}

export type RepositorySubscription = {
  id: string
  project_id: string
  name: string
  kind: 'in_app' | 'webhook'
  event_types: string[]
  branch_id?: string
  document_id?: string
  url?: string
  paused: boolean
  last_sequence: number
  generation: number
  created_by: string
  created_at: string
}

export type RepositoryDelivery = {
  id: string
  sequence?: number
  subscription_id: string
  event_id: string
  event_sequence: number
  event_type: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  attempt_count: number
  last_error?: string
  http_status?: number
  next_attempt_at?: string
  attempted_at?: string
  completed_at?: string
  created_at: string
}

export type RepositoryScope = string | { projectId: string; documentId: string }
export const repositoryProjectId = (scope: RepositoryScope) =>
  typeof scope === 'string' ? scope : scope.projectId
export const repositoryScopeKey = (scope: RepositoryScope) =>
  typeof scope === 'string' ? scope : `${scope.projectId}:${scope.documentId}`
export const repositoryPath = (scope: RepositoryScope) => {
  const project = `/api/v1/private/projects/${encodeURIComponent(repositoryProjectId(scope))}`
  return typeof scope === 'string'
    ? `${project}/repository`
    : `${project}/documents/${encodeURIComponent(scope.documentId)}/repository`
}
const segment = encodeURIComponent

export const repositoryKeys = {
  all: (scope: RepositoryScope): readonly string[] =>
    typeof scope === 'string'
      ? ['repository', scope]
      : ['repository', scope.projectId, 'document', scope.documentId],
  branches: (scope: RepositoryScope) =>
    [...repositoryKeys.all(scope), 'branches'] as const,
  commit: (scope: RepositoryScope, commitId: string) =>
    [...repositoryKeys.all(scope), 'commit', commitId] as const,
  documents: (projectId: string) =>
    ['repository', projectId, 'documents'] as const,
}

export type RepositoryDocument = DocumentDTO & {
  default_branch_id: string
  default_branch_name: string
  head_version_name?: string
}

export function listRepositoryDocuments(
  projectId: string,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryDocument[]>(
    vdocApi.get(`${repositoryPath(projectId)}/documents`, { signal })
  )
}

export type RepositoryCreateDocument = {
  name: string
  relative_path: string
  document_type: number
  description?: string
  content: string
  initial_branch: string
  idempotency_key: string
}

export function createRepositoryDocument(
  projectId: string,
  input: RepositoryCreateDocument
) {
  return unwrapEnvelope<{
    document: RepositoryDocument
    branch: RepositoryBranch
    commit: RepositoryCommit
  }>(vdocApi.post(`${repositoryPath(projectId)}/documents`, input))
}

export function listRepositoryBranches(
  projectId: RepositoryScope,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryBranch[]>(
    vdocApi.get(`${repositoryPath(projectId)}/branches`, { signal })
  )
}

export function createRepositoryBranch(
  projectId: RepositoryScope,
  input: { name: string; from_commit_id: string; is_protected?: boolean }
) {
  return unwrapEnvelope<RepositoryBranch>(
    vdocApi.post(`${repositoryPath(projectId)}/branches`, input)
  )
}

export function bootstrapRepository(projectId: RepositoryScope) {
  return unwrapEnvelope<RepositoryBranch[]>(
    vdocApi.post(`${repositoryPath(projectId)}/bootstrap`, {})
  )
}

export function getRepositoryCommit(
  projectId: RepositoryScope,
  commitId: string,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryCommit>(
    vdocApi.get(`${repositoryPath(projectId)}/commits/${segment(commitId)}`, {
      signal,
    })
  )
}

export async function listRepositoryCommits(
  projectId: RepositoryScope,
  input: { branch_id: string; document_id?: string; cursor?: string },
  signal?: AbortSignal
) {
  const page = await unwrapEnvelope<{
    commits: RepositoryCommit[]
    next_cursor?: string
  }>(
    vdocApi.get(`${repositoryPath(projectId)}/commits`, {
      params: { ...input, page: true },
      signal,
    })
  )
  return { items: page.commits ?? [], nextCursor: page.next_cursor }
}

export function getRepositoryContent(
  projectId: RepositoryScope,
  commitId: string,
  documentId: string,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryContent>(
    vdocApi.get(
      `${repositoryPath(projectId)}/commits/${segment(commitId)}/documents/${segment(documentId)}/content`,
      { signal }
    )
  )
}

export function saveRepositoryCommit(
  projectId: RepositoryScope,
  branchId: string,
  input: RepositorySave
) {
  return unwrapEnvelope<RepositoryCommit>(
    vdocApi.post(
      `${repositoryPath(projectId)}/branches/${segment(branchId)}/commits`,
      input
    )
  )
}

export function compareRepositoryCommits(
  projectId: RepositoryScope,
  input: {
    from_commit_id: string
    to_commit_id: string
    document_id?: string
  }
) {
  return unwrapEnvelope<RepositoryComparison>(
    vdocApi.post(`${repositoryPath(projectId)}/comparisons`, input)
  )
}

export function listRepositoryMergeRequests(
  projectId: RepositoryScope,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryMergeRequest[]>(
    vdocApi.get(`${repositoryPath(projectId)}/merge-requests`, { signal })
  )
}

export function createRepositoryMergeRequest(
  projectId: RepositoryScope,
  input: { source_branch_id: string; target_branch_id: string; title?: string }
) {
  return unwrapEnvelope<RepositoryMergeRequest>(
    vdocApi.post(`${repositoryPath(projectId)}/merge-requests`, input)
  )
}

export function repositoryMergeAction(
  projectId: RepositoryScope,
  request: RepositoryMergeRequest,
  action: 'approve' | 'merge'
) {
  return unwrapEnvelope<RepositoryMergeRequest>(
    vdocApi.post(
      `${repositoryPath(projectId)}/merge-requests/${segment(request.id)}/${action}`,
      {}
    )
  )
}

export function resolveRepositoryMerge(
  projectId: RepositoryScope,
  request: RepositoryMergeRequest,
  input: {
    idempotency_key: string
    message?: string
    files: RepositoryChange[]
  }
) {
  return unwrapEnvelope<RepositoryMergeRequest>(
    vdocApi.post(
      `${repositoryPath(projectId)}/merge-requests/${segment(request.id)}/resolve`,
      {
        expected_generation: request.generation,
        expected_source_commit_id: request.source_commit_id,
        expected_target_commit_id: request.target_commit_id,
        expected_source_generation: request.source_generation,
        expected_target_generation: request.target_generation,
        ...input,
      }
    )
  )
}

export function getRepositoryMergeContent(
  projectId: RepositoryScope,
  requestId: string,
  documentId: string,
  signal?: AbortSignal
) {
  return unwrapEnvelope<{
    merge_request_id: string
    generation: number
    content: string
    document: RepositoryFile
  }>(
    vdocApi.get(
      `${repositoryPath(projectId)}/merge-requests/${segment(requestId)}/documents/${segment(documentId)}/content`,
      { signal }
    )
  )
}

export function revertRepositoryCommit(
  projectId: RepositoryScope,
  branch: RepositoryBranch,
  commitId: string,
  idempotencyKey: string
) {
  return unwrapEnvelope<RepositoryCommit>(
    vdocApi.post(
      `${repositoryPath(projectId)}/branches/${segment(branch.id)}/reverts`,
      {
        commit_id: commitId,
        expected_head_commit_id: branch.head_commit_id,
        expected_generation: branch.generation,
        idempotency_key: idempotencyKey,
      }
    )
  )
}

export function listRepositoryReleases(
  projectId: RepositoryScope,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryRelease[]>(
    vdocApi.get(`${repositoryPath(projectId)}/releases`, { signal })
  )
}

export function publishRepositoryCommit(
  projectId: RepositoryScope,
  branch: RepositoryBranch,
  commitId: string,
  message?: string
) {
  return unwrapEnvelope<RepositoryRelease>(
    vdocApi.post(`${repositoryPath(projectId)}/releases`, {
      branch_id: branch.id,
      commit_id: commitId,
      expected_generation: branch.generation,
      message,
    })
  )
}

export function listRepositoryEvents(
  projectId: RepositoryScope,
  signal?: AbortSignal,
  after?: number
) {
  return unwrapEnvelope<RepositoryEvent[]>(
    vdocApi.get(`${repositoryPath(projectId)}/events`, {
      signal,
      params: { after },
    })
  )
}

export function analyzeRepositoryChange(
  projectId: RepositoryScope,
  input: {
    from_commit_id?: string
    to_commit_id: string
    document_id?: string
    message?: string
    language?: string
  }
) {
  return unwrapEnvelope<RepositoryAnalysis>(
    vdocApi.post(`${repositoryPath(projectId)}/ai/analyses`, input)
  )
}

export function listRepositoryAnalyses(
  projectId: RepositoryScope,
  signal?: AbortSignal,
  after?: number
) {
  return unwrapEnvelope<RepositoryAnalysis[]>(
    vdocApi.get(`${repositoryPath(projectId)}/ai/analyses`, {
      signal,
      params: { after },
    })
  )
}

export function getRepositoryAnalysis(
  projectId: RepositoryScope,
  id: string,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositoryAnalysis>(
    vdocApi.get(`${repositoryPath(projectId)}/ai/analyses/${segment(id)}`, {
      signal,
    })
  )
}

export function listRepositorySubscriptions(
  projectId: RepositoryScope,
  signal?: AbortSignal
) {
  return unwrapEnvelope<RepositorySubscription[]>(
    vdocApi.get(`${repositoryPath(projectId)}/subscriptions`, { signal })
  )
}

export function createRepositorySubscription(
  projectId: RepositoryScope,
  input: {
    name: string
    kind: RepositorySubscription['kind']
    event_types: string[]
    branch_id?: string
    document_id?: string
    url?: string
  }
) {
  return unwrapEnvelope<RepositorySubscription & { secret?: string }>(
    vdocApi.post(`${repositoryPath(projectId)}/subscriptions`, input)
  )
}

export function setRepositorySubscriptionPaused(
  projectId: RepositoryScope,
  id: string,
  paused: boolean
) {
  return unwrapEnvelope<RepositorySubscription>(
    vdocApi.post(
      `${repositoryPath(projectId)}/subscriptions/${segment(id)}/${paused ? 'pause' : 'resume'}`,
      {}
    )
  )
}

export function listRepositoryDeliveries(
  projectId: RepositoryScope,
  signal?: AbortSignal,
  after?: number
) {
  return unwrapEnvelope<RepositoryDelivery[]>(
    vdocApi.get(`${repositoryPath(projectId)}/event-deliveries`, {
      signal,
      params: { after },
    })
  )
}

export function retryRepositoryDelivery(
  projectId: RepositoryScope,
  id: string
) {
  return unwrapEnvelope<RepositoryDelivery>(
    vdocApi.post(
      `${repositoryPath(projectId)}/event-deliveries/${segment(id)}/retry`,
      {}
    )
  )
}

import axios from 'axios'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

export type VdocEnvelope<T> = {
  code: number
  status: string
  description?: string
  message?: string
  detail?: T
  total?: number
  trace_id?: string
  timestamp: number
}

type VdocSession = {
  user: AuthUser
  token: string
}

type VdocList<T> = {
  items: T[]
  total: number
}

type VdocHealthDependency = {
  enabled: boolean
  ready: boolean
  status: string
  message?: string
}

type VdocHealth = {
  status: string
  healthy: boolean
  ready: boolean
  uptime: string
  timestamp: number
  dependencies: Record<string, VdocHealthDependency>
}

export type UserDTO = AuthUser

export type TeamDTO = {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
}

export type ProjectDTO = {
  id: string
  team_id: string
  name: string
  description?: string
  status: number
  created_by: string
  created_at: string
  updated_at: string
}

type ProjectMemberDTO = {
  project_id: string
  user_id: string
  role: number
  status: number
  added_by: string
  created_at: string
  updated_at: string
}

export type DocumentDTO = {
  id: string
  project_id: string
  name: string
  document_type: number
  relative_path?: string
  description?: string
  status: number
  created_by: string
  created_at: string
  updated_at: string
}

export type BranchDTO = {
  id: string
  document_id: string
  name: string
  kind: number
  description?: string
  is_default: boolean
  is_protected: boolean
  status: number
  created_by: string
  created_at: string
  updated_at: string
}

export type DiffSummaryDTO = {
  added_endpoints: number
  removed_endpoints: number
  modified_endpoints: number
  breaking_changes: number
}

export type DiffItemDTO = {
  id: string
  change_type: number
  severity: number
  method?: string
  path?: string
  operation_id?: string
  location?: string
  old_value?: unknown
  new_value?: unknown
  message: string
  frontend_impact?: string
  is_breaking: boolean
  must_handle: boolean
  sort_order: number
}

export type DiffDTO = {
  id: string
  document_id: string
  from_version_id?: string
  to_version_id?: string
  diff_object_key?: string
  diff_hash?: string
  diff_status: number
  summary: DiffSummaryDTO
  items: DiffItemDTO[]
  created_at: string
  updated_at: string
}

export type DraftDTO = {
  id: string
  project_id: string
  document_id: string
  branch_id: string
  version_name: string
  changelog?: string
  source_git_commit_id?: string
  document_format: number
  source_type: number
  source_branch_id?: string
  source_version_id?: string
  base_version_id?: string
  raw_content?: string
  normalized_content?: string
  raw_schema?: string
  normalized_schema?: string
  raw_content_object_key?: string
  normalized_content_object_key?: string
  raw_schema_object_key?: string
  normalized_schema_object_key?: string
  raw_content_hash?: string
  normalized_content_hash?: string
  raw_schema_hash?: string
  normalized_schema_hash?: string
  status: number
  diff_preview?: DiffDTO
  created_by: string
  submitted_at?: string
  created_at: string
  updated_at: string
}

export type VersionDTO = Omit<
  DraftDTO,
  'status' | 'diff_preview' | 'created_by' | 'submitted_at'
> & {
  draft_id: string
  status: number
  published_by: string
  published_at: string
}

type DraftActionResultDTO = DraftDTO | VersionDTO

type ContentDTO = {
  owner_type: string
  owner_id: string
  kind: string
  content_kind: string
  content: string
  object_key?: string
  hash: string
}

export type EndpointSummaryDTO = {
  id: string
  version_id: string
  method: string
  path: string
  operation_id?: string
  summary?: string
  tags?: string[]
  deprecated: boolean
  hash: string
  created_at: string
  updated_at: string
}

export type EndpointDTO = EndpointSummaryDTO & {
  parameters?: unknown
  request_body?: unknown
  responses?: unknown
  security?: unknown
  servers?: unknown
  normalized_operation?: unknown
  schema_refs?: unknown
}

export type MCPTokenDTO = {
  id: string
  user_id: string
  name: string
  token?: string
  scopes: number[]
  status: number
  created_at: string
  updated_at: string
  expires_at?: string
  revoked_at?: string
  revoked_by?: string
  last_used_at?: string
}

type LoginPayload = {
  email: string
  password: string
}

type RegisterPayload = LoginPayload & {
  name?: string
}

type CreateUserPayload = LoginPayload & {
  name: string
  is_super_admin: boolean
}

type PatchUserPayload = {
  status?: number
  is_super_admin?: boolean
}

type NameDescriptionPayload = {
  name: string
  description: string
}

type CreateProjectPayload = NameDescriptionPayload & {
  team_id: string
  admin_user_id: string
}

type AddProjectMemberPayload = {
  user_id: string
  role: number
}

type PatchProjectMemberRolePayload = {
  role: number
}

type DocumentPayload = NameDescriptionPayload & {
  document_type: number
  relative_path: string
  status?: number
}

type PatchBranchPayload = NameDescriptionPayload & {
  is_default?: boolean
  is_protected?: boolean
}

type DraftPayload = {
  branch_id: string
  version_name: string
  changelog: string
  source_git_commit_id: string
  schema_content?: string
  content?: string
}

type CompareDiffPayload = {
  from_version_id: string
  to_version_id: string
}

type PromoteDraftPayload = {
  source_branch_id: string
  target_branch_id: string
  version_name: string
  changelog: string
}

type CreateMCPTokenPayload = {
  name: string
  scopes: number[]
  expires_at?: string | null
}

export class VdocApiError extends Error {
  envelope: VdocEnvelope<unknown>
  code: number
  status: string

  constructor(envelope: VdocEnvelope<unknown>) {
    super(envelope.message || envelope.description || envelope.status)
    this.name = 'VdocApiError'
    this.envelope = envelope
    this.code = envelope.code
    this.status = envelope.status
  }
}

export const apiBaseUrl =
  import.meta.env.VITE_VDOC_API_BASE_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:8080'

export const vdocApi = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

vdocApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  if (token) {
    config.headers.Authorization = token
  }
  return config
})

export async function unwrapEnvelope<T>(
  request: Promise<{ data: VdocEnvelope<T> }>
) {
  const response = await request
  const envelope = response.data

  if (envelope.code !== 200 || envelope.status !== 'OK') {
    throw new VdocApiError(envelope as VdocEnvelope<unknown>)
  }

  return envelope.detail as T
}

export async function unwrapListEnvelope<T>(
  request: Promise<{ data: VdocEnvelope<T[]> }>
): Promise<VdocList<T>> {
  const response = await request
  const envelope = response.data

  if (envelope.code !== 200 || envelope.status !== 'OK') {
    throw new VdocApiError(envelope as VdocEnvelope<unknown>)
  }

  return {
    items: envelope.detail ?? [],
    total: envelope.total ?? envelope.detail?.length ?? 0,
  }
}

export function login(payload: LoginPayload) {
  return unwrapEnvelope<VdocSession>(
    vdocApi.post('/api/v1/open/auth/login', payload)
  )
}

export function register(payload: RegisterPayload) {
  return unwrapEnvelope<VdocSession>(
    vdocApi.post('/api/v1/open/auth/register', payload)
  )
}

export function getIdentity() {
  return unwrapEnvelope<AuthUser>(vdocApi.get('/api/v1/private/identity/me'))
}

export function getHealth() {
  return unwrapEnvelope<VdocHealth>(vdocApi.get('/api/v1/open/health'))
}

export function listUsers() {
  return unwrapListEnvelope<UserDTO>(
    vdocApi.get('/api/v1/private/system/users')
  )
}

export function createUser(payload: CreateUserPayload) {
  return unwrapEnvelope<UserDTO>(
    vdocApi.post('/api/v1/private/system/users', payload)
  )
}

export function patchUser(userId: string, payload: PatchUserPayload) {
  return unwrapEnvelope<UserDTO>(
    vdocApi.patch(`/api/v1/private/system/users/${userId}`, payload)
  )
}

export function listUserMCPTokens(userId: string) {
  return unwrapListEnvelope<MCPTokenDTO>(
    vdocApi.get(`/api/v1/private/system/users/${userId}/mcp-tokens`)
  )
}

export function revokeUserMCPToken(userId: string, tokenId: string) {
  return unwrapEnvelope<MCPTokenDTO>(
    vdocApi.post(
      `/api/v1/private/system/users/${userId}/mcp-tokens/${tokenId}/revoke`
    )
  )
}

export function listTeams() {
  return unwrapListEnvelope<TeamDTO>(vdocApi.get('/api/v1/private/teams'))
}

export function createTeam(payload: NameDescriptionPayload) {
  return unwrapEnvelope<TeamDTO>(vdocApi.post('/api/v1/private/teams', payload))
}

export function updateTeam(teamId: string, payload: NameDescriptionPayload) {
  return unwrapEnvelope<TeamDTO>(
    vdocApi.patch(`/api/v1/private/teams/${teamId}`, payload)
  )
}

export function archiveTeam(teamId: string) {
  return unwrapEnvelope<TeamDTO>(
    vdocApi.post(`/api/v1/private/teams/${teamId}/archive`)
  )
}

export function listProjects() {
  return unwrapListEnvelope<ProjectDTO>(vdocApi.get('/api/v1/private/projects'))
}

export function createProject(payload: CreateProjectPayload) {
  return unwrapEnvelope<ProjectDTO>(
    vdocApi.post('/api/v1/private/projects', payload)
  )
}

export function updateProject(
  projectId: string,
  payload: NameDescriptionPayload
) {
  return unwrapEnvelope<ProjectDTO>(
    vdocApi.patch(`/api/v1/private/projects/${projectId}`, payload)
  )
}

export function archiveProject(projectId: string) {
  return unwrapEnvelope<ProjectDTO>(
    vdocApi.post(`/api/v1/private/projects/${projectId}/archive`)
  )
}

export function listProjectMembers(projectId: string) {
  return unwrapListEnvelope<ProjectMemberDTO>(
    vdocApi.get(`/api/v1/private/projects/${projectId}/members`)
  )
}

export function addProjectMember(
  projectId: string,
  payload: AddProjectMemberPayload
) {
  return unwrapEnvelope<ProjectMemberDTO>(
    vdocApi.post(`/api/v1/private/projects/${projectId}/members`, payload)
  )
}

export function patchProjectMemberRole(
  projectId: string,
  userId: string,
  payload: PatchProjectMemberRolePayload
) {
  return unwrapEnvelope<ProjectMemberDTO>(
    vdocApi.patch(
      `/api/v1/private/projects/${projectId}/members/${userId}/role`,
      payload
    )
  )
}

export function removeProjectMember(projectId: string, userId: string) {
  return unwrapEnvelope<unknown>(
    vdocApi.delete(`/api/v1/private/projects/${projectId}/members/${userId}`)
  )
}

export function listDocuments(projectId: string) {
  return unwrapListEnvelope<DocumentDTO>(
    vdocApi.get(`/api/v1/private/projects/${projectId}/documents`)
  )
}

export function createDocument(projectId: string, payload: DocumentPayload) {
  return unwrapEnvelope<DocumentDTO>(
    vdocApi.post(`/api/v1/private/projects/${projectId}/documents`, payload)
  )
}

export function updateDocument(
  projectId: string,
  documentId: string,
  payload: DocumentPayload
) {
  return unwrapEnvelope<DocumentDTO>(
    vdocApi.patch(
      `/api/v1/private/projects/${projectId}/documents/${documentId}`,
      payload
    )
  )
}

export function archiveDocument(projectId: string, documentId: string) {
  return unwrapEnvelope<DocumentDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/archive`
    )
  )
}

export function listBranches(projectId: string, documentId: string) {
  return unwrapListEnvelope<BranchDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/branches`
    )
  )
}

export function createBranch(
  projectId: string,
  documentId: string,
  payload: NameDescriptionPayload
) {
  return unwrapEnvelope<BranchDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/branches`,
      payload
    )
  )
}

export function updateBranch(
  projectId: string,
  documentId: string,
  branchId: string,
  payload: PatchBranchPayload
) {
  return unwrapEnvelope<BranchDTO>(
    vdocApi.patch(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/branches/${branchId}`,
      payload
    )
  )
}

export function archiveBranch(
  projectId: string,
  documentId: string,
  branchId: string
) {
  return unwrapEnvelope<BranchDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/branches/${branchId}/archive`
    )
  )
}

export function listDrafts(projectId: string, documentId: string) {
  return unwrapListEnvelope<DraftDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts`
    )
  )
}

export function createDraft(
  projectId: string,
  documentId: string,
  payload: DraftPayload
) {
  return unwrapEnvelope<DraftDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts`,
      payload
    )
  )
}

export function updateDraft(
  projectId: string,
  documentId: string,
  draftId: string,
  payload: DraftPayload
) {
  return unwrapEnvelope<DraftDTO>(
    vdocApi.patch(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${draftId}`,
      payload
    )
  )
}

export function getDraftContent(
  projectId: string,
  documentId: string,
  draftId: string,
  contentKind: string
) {
  return unwrapEnvelope<ContentDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${draftId}/content/${contentKind}`
    )
  )
}

function draftAction(
  projectId: string,
  documentId: string,
  draftId: string,
  action: string
) {
  return unwrapEnvelope<DraftActionResultDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/${draftId}/${action}`
    )
  )
}

export function submitDraft(
  projectId: string,
  documentId: string,
  draftId: string
) {
  return draftAction(projectId, documentId, draftId, 'submit')
}

export function approveDraft(
  projectId: string,
  documentId: string,
  draftId: string
) {
  return draftAction(projectId, documentId, draftId, 'approve')
}

export function requestDraftChanges(
  projectId: string,
  documentId: string,
  draftId: string
) {
  return draftAction(projectId, documentId, draftId, 'request-changes')
}

export function rejectDraft(
  projectId: string,
  documentId: string,
  draftId: string
) {
  return draftAction(projectId, documentId, draftId, 'reject')
}

export function promoteDraft(
  projectId: string,
  documentId: string,
  payload: PromoteDraftPayload
) {
  return unwrapEnvelope<DraftDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/drafts/promote`,
      payload
    )
  )
}

export function listVersions(projectId: string, documentId: string) {
  return unwrapListEnvelope<VersionDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/versions`
    )
  )
}

export function getVersionContent(
  projectId: string,
  documentId: string,
  versionId: string,
  contentKind: string
) {
  return unwrapEnvelope<ContentDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/versions/${versionId}/content/${contentKind}`
    )
  )
}

export function listEndpoints(
  projectId: string,
  documentId: string,
  versionId: string,
  path?: string
) {
  return unwrapListEnvelope<EndpointSummaryDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/versions/${versionId}/endpoints`,
      { params: { path } }
    )
  )
}

export function getEndpoint(
  projectId: string,
  documentId: string,
  versionId: string,
  endpointId: string
) {
  return unwrapEnvelope<EndpointDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/versions/${versionId}/endpoints/${endpointId}`
    )
  )
}

export function compareDiff(
  projectId: string,
  documentId: string,
  payload: CompareDiffPayload
) {
  return unwrapEnvelope<DiffDTO>(
    vdocApi.post(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/diffs`,
      payload
    )
  )
}

export function getDiffSummary(
  projectId: string,
  documentId: string,
  diffId: string
) {
  return unwrapEnvelope<DiffSummaryDTO>(
    vdocApi.get(
      `/api/v1/private/projects/${projectId}/documents/${documentId}/diffs/${diffId}/summary`
    )
  )
}

export function listMCPTokens() {
  return unwrapListEnvelope<MCPTokenDTO>(
    vdocApi.get('/api/v1/private/mcp-tokens')
  )
}

export function createMCPToken(payload: CreateMCPTokenPayload) {
  return unwrapEnvelope<MCPTokenDTO>(
    vdocApi.post('/api/v1/private/mcp-tokens', payload)
  )
}

export function getMCPToken(tokenId: string) {
  return unwrapEnvelope<MCPTokenDTO>(
    vdocApi.get(`/api/v1/private/mcp-tokens/${tokenId}`)
  )
}

export function revokeMCPToken(tokenId: string) {
  return unwrapEnvelope<MCPTokenDTO>(
    vdocApi.post(`/api/v1/private/mcp-tokens/${tokenId}/revoke`)
  )
}

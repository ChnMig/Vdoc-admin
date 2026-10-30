import type { DocumentShareExpiryPreset } from './document-share-api'
import {
  type RequestOptions,
  unwrapEnvelope,
  unwrapListEnvelope,
  vdocApi,
} from './vdoc-api'

export type RepositoryShare = {
  readonly id: string
  readonly project_id: string
  readonly document_id: string
  readonly release_id: string
  readonly status: number
  readonly password_protected: boolean
  readonly expires_at?: string
  readonly created_by: string
  readonly created_at: string
  readonly updated_at: string
  readonly revoked_by?: string
  readonly revoked_at?: string
}

type RepositoryShareSecret = { share: RepositoryShare; secret: string }

function path(projectId: string, releaseId: string, documentId: string) {
  return `/api/v1/private/projects/${encodeURIComponent(projectId)}/repository/releases/${encodeURIComponent(releaseId)}/documents/${encodeURIComponent(documentId)}/shares`
}

export function listRepositoryShares(
  projectId: string,
  releaseId: string,
  documentId: string,
  options?: RequestOptions
) {
  return unwrapListEnvelope<RepositoryShare>(
    vdocApi.get(path(projectId, releaseId, documentId), {
      signal: options?.signal,
    })
  )
}

export function createRepositoryShare(
  projectId: string,
  releaseId: string,
  documentId: string,
  payload: { expiry_preset: DocumentShareExpiryPreset; password?: string }
) {
  return unwrapEnvelope<RepositoryShareSecret>(
    vdocApi.post(path(projectId, releaseId, documentId), payload)
  )
}

export function revealRepositoryShare(
  projectId: string,
  releaseId: string,
  documentId: string,
  shareId: string
) {
  return unwrapEnvelope<RepositoryShareSecret>(
    vdocApi.post(
      `${path(projectId, releaseId, documentId)}/${encodeURIComponent(shareId)}/reveal`
    )
  )
}

export function revokeRepositoryShare(
  projectId: string,
  releaseId: string,
  documentId: string,
  shareId: string
) {
  return unwrapEnvelope<RepositoryShare>(
    vdocApi.post(
      `${path(projectId, releaseId, documentId)}/${encodeURIComponent(shareId)}/revoke`
    )
  )
}

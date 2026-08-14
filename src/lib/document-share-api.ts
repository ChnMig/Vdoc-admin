import { unwrapEnvelope, unwrapListEnvelope, vdocApi } from './vdoc-api'

type DocumentShareVersionScope = 1 | 2

export const DOCUMENT_SHARE_EXPIRY_PRESETS = [
  '1_month',
  '3_months',
  '6_months',
  '1_year',
  'permanent',
] as const
export type DocumentShareExpiryPreset =
  (typeof DOCUMENT_SHARE_EXPIRY_PRESETS)[number]

export type DocumentShareDTO = {
  readonly id: string
  readonly project_id: string
  readonly document_id: string
  readonly branch_id: string
  readonly version_scope: number
  readonly status: number
  readonly password_protected: boolean
  readonly expires_at?: string
  readonly created_by: string
  readonly created_at: string
  readonly updated_at: string
  readonly revoked_by?: string
  readonly revoked_at?: string
}

export type CreateDocumentSharePayload = {
  readonly branch_id: string
  readonly version_scope: DocumentShareVersionScope
  readonly expiry_preset: DocumentShareExpiryPreset
  readonly password?: string
}

export type DocumentShareSecretDTO = {
  readonly share: DocumentShareDTO
  readonly secret: string
}

function documentSharesPath(projectId: string, documentId: string): string {
  return `/api/v1/private/projects/${projectId}/documents/${documentId}/shares`
}

export function listDocumentShares(projectId: string, documentId: string) {
  return unwrapListEnvelope<DocumentShareDTO>(
    vdocApi.get(documentSharesPath(projectId, documentId))
  )
}

export function createDocumentShare(
  projectId: string,
  documentId: string,
  payload: CreateDocumentSharePayload
) {
  return unwrapEnvelope<DocumentShareSecretDTO>(
    vdocApi.post(documentSharesPath(projectId, documentId), payload)
  )
}

export function revealDocumentShare(
  projectId: string,
  documentId: string,
  shareId: string
) {
  return unwrapEnvelope<DocumentShareSecretDTO>(
    vdocApi.post(
      `${documentSharesPath(projectId, documentId)}/${shareId}/reveal`
    )
  )
}

export function revokeDocumentShare(
  projectId: string,
  documentId: string,
  shareId: string
) {
  return unwrapEnvelope<DocumentShareDTO>(
    vdocApi.post(
      `${documentSharesPath(projectId, documentId)}/${shareId}/revoke`
    )
  )
}

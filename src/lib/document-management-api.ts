import { isAxiosError } from 'axios'
import type { RepositoryDocument } from './repository-api'
import {
  unwrapEnvelope,
  vdocApi,
  VdocApiError,
  type VdocEnvelope,
} from './vdoc-api'

export type DocumentMetadataUpdate = {
  name?: string
  relative_path?: string
  description?: string
}

const documentPath = (projectId: string, documentId: string) =>
  `/api/v1/private/projects/${encodeURIComponent(projectId)}/repository/documents/${encodeURIComponent(documentId)}`

export function updateRepositoryDocumentMetadata(
  projectId: string,
  documentId: string,
  input: DocumentMetadataUpdate
) {
  return documentResponse<RepositoryDocument>(
    vdocApi.patch(documentPath(projectId, documentId), input)
  )
}

export function deleteRepositoryDocument(
  projectId: string,
  documentId: string
) {
  return documentResponse<{ deleted: true }>(
    vdocApi.delete(documentPath(projectId, documentId))
  )
}

async function documentResponse<T>(
  request: Promise<{ data: VdocEnvelope<T> }>
) {
  try {
    return await unwrapEnvelope(request)
  } catch (error) {
    if (isAxiosError<VdocEnvelope<unknown>>(error)) {
      const envelope = error.response?.data
      if (
        envelope &&
        typeof envelope.code === 'number' &&
        typeof envelope.status === 'string'
      )
        throw new VdocApiError(envelope)
    }
    throw error
  }
}

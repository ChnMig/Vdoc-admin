import { useAuthStore } from '@/stores/auth-store'
import {
  DOCUMENT_IMAGE_MAX_BYTES,
  managedImageId,
  validateDocumentImageBlob,
} from './markdown-image'
import { unwrapEnvelope, vdocApi } from './vdoc-api'

export type DocumentImage = {
  asset_id: string
  reference: string
  filename: string
  content_type: string
  byte_length: number
  width: number
  height: number
}

function imagePath(projectId: string, documentId: string) {
  return `/api/v1/private/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/images`
}

function imageBase64(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const abort = () => reader.abort()
    reader.onload = () => {
      signal.removeEventListener('abort', abort)
      if (signal.aborted) reject(signal.reason)
      else resolve(String(reader.result).split(',')[1])
    }
    reader.onerror = () => {
      signal.removeEventListener('abort', abort)
      reject(new Error('Could not read image'))
    }
    reader.onabort = () => {
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Image upload cancelled', 'AbortError'))
    }
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    reader.readAsDataURL(file)
  })
}

export async function uploadDocumentImage(
  projectId: string,
  documentId: string,
  file: File,
  signal: AbortSignal
): Promise<DocumentImage> {
  const session = useAuthStore.getState().auth.sessionVersion
  if (!file.size || file.size > DOCUMENT_IMAGE_MAX_BYTES)
    throw new Error('Image must be at most 4 MB')
  const content_base64 = await imageBase64(file, signal)
  signal.throwIfAborted()
  if (useAuthStore.getState().auth.sessionVersion !== session)
    throw new DOMException('Image upload cancelled', 'AbortError')
  const image = await unwrapEnvelope<DocumentImage>(
    vdocApi.post(
      imagePath(projectId, documentId),
      { filename: file.name, content_base64 },
      { signal }
    )
  )
  if (
    !managedImageId(image.reference) ||
    image.asset_id !== managedImageId(image.reference)
  )
    throw new Error('Invalid image reference returned by server')
  return image
}

export async function getDocumentImage(
  projectId: string,
  documentId: string,
  assetId: string,
  signal: AbortSignal
): Promise<Blob> {
  if (!managedImageId(`vdoc-asset:${assetId}`))
    throw new Error('Invalid image ID')
  const response = await vdocApi.get<Blob>(
    `${imagePath(projectId, documentId)}/${assetId}`,
    {
      signal,
      responseType: 'blob',
    }
  )
  return validateDocumentImageBlob(response.data)
}

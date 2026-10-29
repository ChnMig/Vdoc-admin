import type { AIChatAttachmentDTO } from '@/lib/vdoc-api'

export const chatAttachmentAccept =
  '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.md,.markdown,.json,.yaml,.yml,.csv,.tsv,.log,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.go,.rs,.sql,.sh,.java,.c,.cpp,.h,.toml,.ini,.conf,.vue,.svelte'

const mediaTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
}
const textExtensions = new Set(
  chatAttachmentAccept
    .split(',')
    .map((value) => value.slice(1))
    .filter((value) => !mediaTypes[value])
)

export type AttachmentError =
  | 'attachmentTypeError'
  | 'attachmentSizeError'
  | 'attachmentCountError'
  | 'attachmentTotalError'
  | 'attachmentTextError'
  | 'attachmentReadError'

export class ChatAttachmentError extends Error {
  constructor(readonly key: AttachmentError) {
    super(key)
  }
}

export function attachmentBytes(attachment: AIChatAttachmentDTO) {
  return (
    Math.floor((attachment.data.length * 3) / 4) -
    (attachment.data.endsWith('==') ? 2 : attachment.data.endsWith('=') ? 1 : 0)
  )
}

export async function readChatAttachments(
  files: readonly File[],
  current: readonly AIChatAttachmentDTO[]
) {
  if (files.length + current.length > 4)
    throw new ChatAttachmentError('attachmentCountError')
  if (
    files.reduce(
      (size, file) => size + file.size,
      current.reduce((size, file) => size + attachmentBytes(file), 0)
    ) >
    6 * 1024 * 1024
  )
    throw new ChatAttachmentError('attachmentTotalError')
  return Promise.all(
    files.map(async (file): Promise<AIChatAttachmentDTO> => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      const mediaType =
        mediaTypes[extension] ??
        (textExtensions.has(extension) ? 'text/plain' : '')
      if (!mediaType) throw new ChatAttachmentError('attachmentTypeError')
      if (!file.size || file.size > 4 * 1024 * 1024)
        throw new ChatAttachmentError('attachmentSizeError')
      if (mediaType === 'text/plain' && file.size > 100 * 1024)
        throw new ChatAttachmentError('attachmentTextError')
      const dataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reader.onabort = () =>
          reject(new ChatAttachmentError('attachmentReadError'))
        reader.readAsDataURL(file)
      })
      const data = dataURL.slice(dataURL.indexOf(',') + 1)
      if (mediaType === 'text/plain') {
        try {
          const bytes = Uint8Array.from(atob(data), (char) =>
            char.charCodeAt(0)
          )
          if (
            new TextDecoder('utf-8', { fatal: true })
              .decode(bytes)
              .includes('\0')
          )
            throw new Error('binary')
        } catch {
          throw new ChatAttachmentError('attachmentTextError')
        }
      }
      return { name: file.name, media_type: mediaType, data }
    })
  )
}

export function chatAttachmentURL(attachment: AIChatAttachmentDTO) {
  return `data:${attachment.media_type};base64,${attachment.data}`
}

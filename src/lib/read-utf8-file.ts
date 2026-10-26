import type { TFunction } from './i18n'

export async function readUtf8File(file: File, t: TFunction) {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () =>
      reject(reader.error ?? new Error(t('toasts.somethingWrong')))
    reader.readAsArrayBuffer(file)
  })
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes
    )
  } catch {
    throw new Error(t('admin.documentForm.uploadInvalidUtf8'))
  }
}
